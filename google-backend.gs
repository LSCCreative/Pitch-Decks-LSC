/**
 * LSC Creative — Pitch Studio backend (Google Apps Script web app)
 * ----------------------------------------------------------------
 * Deploy: Extensions → Apps Script → Deploy → New deployment →
 *         type "Web app" → Execute as "Me" → Access "Anyone".
 * Copy the resulting /exec URL into app.js → GOOGLE_SCRIPT_URL.
 *
 * Storage model:
 *   - Pitch records      → individual <pitchId>.json files in a Drive folder.
 *   - Dropdown values    → a Sheet tab ("Config") with Services / Deliverables columns.
 */

// ===== Configuration =========================================================
var CONFIG = {
  PITCHES_FOLDER_ID: "https://drive.google.com/drive/u/0/folders/1HPsoa3Kg3uII7QzhybnYBSx1kLxOmTbq", // Drive folder holding *.json pitches
  CONFIG_SHEET_ID: "https://docs.google.com/spreadsheets/d/1wIGdx1jjmynyCmozFZ3W7Ludn00FvWxsTSypsbyk2zQ/edit?gid=0#gid=0",          // Spreadsheet holding dropdown values
  CONFIG_SHEET_TAB: "Config",                         // Tab name with Services / Deliverables columns
  NOTIFY_EMAIL: "lachlan@lsccreative.com",             // Internal recipient for status alerts
};

// ===== Helpers ===============================================================
function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function _getPitchesFolder() {
  return DriveApp.getFolderById(CONFIG.PITCHES_FOLDER_ID);
}

/** Read every <id>.json pitch file from the Drive folder into an array. */
function _readAllPitches() {
  var folder = _getPitchesFolder();
  var files = folder.getFilesByType(MimeType.PLAIN_TEXT);
  var pitches = [];
  while (files.hasNext()) {
    var file = files.next();
    if (!/\.json$/i.test(file.getName())) continue;
    try {
      pitches.push(JSON.parse(file.getBlob().getDataAsString()));
    } catch (err) {
      // Skip malformed files but keep going.
    }
  }
  // Also catch files saved with an explicit JSON mime type.
  var jsonFiles = folder.getFilesByType("application/json");
  while (jsonFiles.hasNext()) {
    var jf = jsonFiles.next();
    try {
      pitches.push(JSON.parse(jf.getBlob().getDataAsString()));
    } catch (err) {}
  }
  return pitches;
}

/** Pull dropdown option arrays (services / deliverables) from the config sheet. */
function _readDropdowns() {
  var out = { services: [], deliverables: [] };
  try {
    var sheet = SpreadsheetApp
      .openById(CONFIG.CONFIG_SHEET_ID)
      .getSheetByName(CONFIG.CONFIG_SHEET_TAB);
    if (!sheet) return out;

    var values = sheet.getDataRange().getValues();
    if (!values.length) return out;

    var header = values[0].map(function (h) { return String(h).trim().toLowerCase(); });
    var sIdx = header.indexOf("services");
    var dIdx = header.indexOf("deliverables");

    for (var r = 1; r < values.length; r++) {
      if (sIdx > -1 && values[r][sIdx] !== "") out.services.push(String(values[r][sIdx]).trim());
      if (dIdx > -1 && values[r][dIdx] !== "") out.deliverables.push(String(values[r][dIdx]).trim());
    }
  } catch (err) {
    // Return whatever we have; the frontend has its own fallbacks.
  }
  return out;
}

/** Locate an existing <id>.json file, or null. */
function _findPitchFile(pitchId) {
  var folder = _getPitchesFolder();
  var name = pitchId + ".json";
  var it = folder.getFilesByName(name);
  return it.hasNext() ? it.next() : null;
}

// ===== Read endpoint =========================================================
function doGet(e) {
  try {
    var payload = {
      ok: true,
      dropdowns: _readDropdowns(),
      pitches: _readAllPitches(),
    };
    return _json(payload);
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}

// ===== Write endpoint ========================================================
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return _json({ ok: false, error: "No POST body received." });
    }

    var pitch = JSON.parse(e.postData.contents);
    if (!pitch.id) {
      pitch.id = "p-" + new Date().getTime();
    }

    // Create or overwrite the static <id>.json configuration file.
    var folder = _getPitchesFolder();
    var name = pitch.id + ".json";
    var content = JSON.stringify(pitch, null, 2);

    var existing = _findPitchFile(pitch.id);
    if (existing) {
      existing.setContent(content);
    } else {
      folder.createFile(name, content, MimeType.PLAIN_TEXT);
    }

    // Fire status-change email notifications.
    _maybeSendStatusEmail(pitch);

    return _json({ ok: true, id: pitch.id, status: pitch.status });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}

/**
 * Dispatch a MailApp notification when a pitch reaches a client decision.
 * Subject format (exact): "Pitch deck response [Title] [Approved/Rejected]"
 */
function _maybeSendStatusEmail(pitch) {
  if (!pitch || !pitch.status) return;

  var decision = null;
  if (pitch.status === "Approved") decision = "Approved";
  else if (pitch.status === "Revision Needed") decision = "Rejected";
  if (!decision) return; // Only notify on Approved / Rejected transitions.

  var title = pitch.title || "Untitled Pitch";
  var subject = "Pitch deck response [" + title + "] [" + decision + "]";

  var bodyLines = [
    "Pitch: " + title,
    "Client: " + (pitch.client || "—"),
    "Type: " + (pitch.type || "—"),
    "Decision: " + decision,
  ];
  if (decision === "Rejected" && pitch.feedback) {
    bodyLines.push("");
    bodyLines.push("Client feedback:");
    bodyLines.push(pitch.feedback);
  }

  MailApp.sendEmail({
    to: CONFIG.NOTIFY_EMAIL,
    subject: subject,
    body: bodyLines.join("\n"),
  });
}
