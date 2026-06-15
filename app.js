// LSC Creative — Creator Studio SPA
// Entry gate (4-digit PIN) + view engine + tab navigation.
(function () {
  "use strict";

  const PIN_CODE = "1234"; // Hardcoded validation PIN

  // Google Apps Script web app endpoint (paste the deployed /exec URL here).
  const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwvBQbKijukdz54ZqxVEjIdXhjwL5pP8ms3YN7uds2AQ8NsZHB49c2C5o8EmUhyrLLg/exec";

  // --- Element handles ---
  const loginView = document.getElementById("login-view");
  const creatorView = document.getElementById("creator-view");
  const pinForm = document.getElementById("pin-form");
  const pinError = document.getElementById("pin-error");
  const cells = Array.from(document.querySelectorAll("[data-pin-index]"));
  const navTabs = Array.from(document.querySelectorAll(".nav-tab"));
  const panels = Array.from(document.querySelectorAll(".panel"));
  const viewTitle = document.getElementById("view-title");
  const viewSubtitle = document.getElementById("view-subtitle");
  const logoutBtn = document.getElementById("logout-btn");

  const TAB_META = {
    dashboard: { title: "Dashboard", subtitle: "Your documentary pipeline at a glance" },
    approved: { title: "Approved Pitches", subtitle: "Concepts greenlit for production" },
    settings: { title: "Settings", subtitle: "Manage your studio profile and preferences" },
  };

  // --- PIN cell behaviour: auto-advance, backspace, paste ---
  cells.forEach((cell, i) => {
    cell.addEventListener("input", () => {
      cell.value = cell.value.replace(/[^0-9]/g, "").slice(0, 1);
      hideError();
      if (cell.value && i < cells.length - 1) cells[i + 1].focus();
    });

    cell.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !cell.value && i > 0) cells[i - 1].focus();
      if (e.key === "Enter") pinForm.requestSubmit();
    });

    cell.addEventListener("paste", (e) => {
      e.preventDefault();
      const digits = (e.clipboardData.getData("text") || "").replace(/[^0-9]/g, "").slice(0, cells.length);
      digits.split("").forEach((d, k) => (cells[k].value = d));
      const next = Math.min(digits.length, cells.length - 1);
      cells[next].focus();
    });
  });

  function readPin() {
    return cells.map((c) => c.value).join("");
  }

  function hideError() {
    pinError.classList.add("hidden");
    cells.forEach((c) => c.classList.remove("border-terracotta"));
  }

  function showError() {
    pinError.classList.remove("hidden");
    cells.forEach((c) => {
      c.classList.add("border-terracotta");
      c.value = "";
    });
    cells[0].focus();
  }

  // --- Entry gate validation ---
  pinForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (readPin() === PIN_CODE) {
      unlock();
    } else {
      showError();
    }
  });

  function unlock() {
    loginView.classList.add("hidden");
    creatorView.classList.remove("hidden");
    activateTab("dashboard");
  }

  function lock() {
    creatorView.classList.add("hidden");
    loginView.classList.remove("hidden");
    cells.forEach((c) => (c.value = ""));
    hideError();
    cells[0].focus();
  }

  logoutBtn.addEventListener("click", lock);

  // --- View engine: tab switching ---
  function activateTab(tab) {
    panels.forEach((p) => p.classList.toggle("hidden", p.dataset.panel !== tab));

    navTabs.forEach((btn) => {
      const active = btn.dataset.tab === tab;
      btn.classList.toggle("bg-surface", active);
      btn.classList.toggle("text-ink", active);
      btn.classList.toggle("text-ink-muted", !active);
      // Sage active indicator
      btn.classList.toggle("ring-1", active);
      btn.classList.toggle("ring-sage/40", active);
    });

    const meta = TAB_META[tab];
    if (meta) {
      viewTitle.textContent = meta.title;
      viewSubtitle.textContent = meta.subtitle;
    }

    // Re-render data-driven tabs on entry.
    if (tab === "approved" && typeof renderApprovedList === "function") renderApprovedList();
  }

  navTabs.forEach((btn) => {
    btn.addEventListener("click", () => activateTab(btn.dataset.tab));
  });

  // =====================================================================
  // DATA STATE ARCHITECTURE
  // Global appState — single source of truth for pitch configurations.
  // loadPitches() / savePitchToStorage() are async mocks that console-log
  // operations to mimic a future Google Apps Script JSON backend.
  // =====================================================================
  const appState = {
    pitches: [],
    dashboardMode: "list", // "list" | "create"
    createType: null,       // "Production" | "Retainer"
    openMenuId: null,       // id of the row whose action menu is open
  };
  // Expose for debugging / future modules.
  window.appState = appState;

  // Seed data used until a real backend is wired in.
  const SEED_PITCHES = [
    {
      id: "p-1001",
      title: "Behind the Lens",
      client: "Northwind Films",
      type: "Production",
      value: 48000,
      status: "Approved",
      intro:
        "A feature-length documentary exploring the craft and grit behind independent filmmaking. We follow three directors across a single production season, capturing the authentic, unscripted moments that define their work.",
      documents: [
        { label: "Production Script", fileName: "behind-the-lens_script.pdf", url: null },
        { label: "Shortlist", fileName: "behind-the-lens_shortlist.pdf", url: null },
        { label: "Key Production Equipment", fileName: "equipment-list.pdf", url: null },
      ],
      customDocuments: [{ label: "Location Release", fileName: "location-release.pdf", url: null }],
    },
    {
      id: "p-1002",
      title: "Authenticity in Film",
      client: "Halcyon Media",
      type: "Retainer",
      value: 6500,
      status: "Approved",
      hourlyRate: 120,
      blockDuration: "three months",
      shootSchedule: "Fortnightly",
      deliverableFrequency: "Fortnightly",
      bulkDeliveryDate: "2026-08-15",
    },
    { id: "p-1003", title: "Coastal Lines", client: "BlueReef Co.", type: "Production", value: 22000, status: "Draft" },
    { id: "p-1004", title: "Quarterly Brand Films", client: "Vantage Group", type: "Retainer", value: 9000, status: "Revision Needed" },
  ];

  // Dropdown option arrays hydrated from the backend (Sheet "Config" tab).
  appState.dropdowns = { services: [], deliverables: [] };

  // --- Live backend: Google Apps Script web app via Fetch API ---
  // READ: GET the web app → { ok, dropdowns, pitches:[...] }.
  async function loadPitches() {
    if (!GOOGLE_SCRIPT_URL) {
      // No endpoint deployed yet — fall back to local seed records.
      console.warn("[appState] GOOGLE_SCRIPT_URL not set — using local seed data.");
      return SEED_PITCHES.map((p) => ({ ...p }));
    }
    console.log("[appState] loadPitches() → GET", GOOGLE_SCRIPT_URL);
    try {
      const res = await fetch(GOOGLE_SCRIPT_URL, { method: "GET", redirect: "follow" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (!data || data.ok === false) throw new Error(data && data.error ? data.error : "Bad payload");

      if (data.dropdowns) appState.dropdowns = data.dropdowns;
      const pitches = Array.isArray(data.pitches) ? data.pitches : [];
      console.log("[appState] loadPitches() ← resolved", pitches.length, "records");
      return pitches;
    } catch (err) {
      console.error("[appState] loadPitches() failed — falling back to seed.", err);
      return SEED_PITCHES.map((p) => ({ ...p }));
    }
  }

  // WRITE: POST the full pitch object to the web app endpoint.
  async function savePitchToStorage(pitch) {
    if (!GOOGLE_SCRIPT_URL) {
      console.warn("[appState] GOOGLE_SCRIPT_URL not set — skipping remote save for", pitch && pitch.id);
      return { ok: false, offline: true, id: pitch && pitch.id };
    }
    console.log("[appState] savePitchToStorage() → POST", pitch && pitch.id);
    try {
      const res = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        redirect: "follow",
        // text/plain avoids a CORS preflight against the Apps Script endpoint.
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(pitch),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      console.log("[appState] savePitchToStorage() ← acknowledged", data && data.id);
      return data;
    } catch (err) {
      console.error("[appState] savePitchToStorage() failed", err);
      return { ok: false, error: String(err), id: pitch && pitch.id };
    }
  }

  // --- Status tag styling (editorial palette) ---
  const STATUS_STYLES = {
    Draft: "bg-surface text-ink-muted border border-surface-line",
    Sent: "bg-sage/15 text-sage",
    Approved: "bg-terracotta/20 text-terracotta",
    "Revision Needed": "bg-orange-500/15 text-orange-400",
  };

  function statusTag(status) {
    const cls = STATUS_STYLES[status] || STATUS_STYLES.Draft;
    return `<span class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${cls}">${escapeHtml(status)}</span>`;
  }

  function formatValue(value) {
    if (typeof value !== "number") return "—";
    return "$" + value.toLocaleString("en-US");
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  // --- Dashboard element handles ---
  const dashHome = document.getElementById("dashboard-home");
  const dashCreate = document.getElementById("dashboard-create");
  const tableBody = document.getElementById("pitch-table-body");
  const emptyState = document.getElementById("pitch-empty-state");
  const createViewTitle = document.getElementById("create-view-title");
  const createBackBtn = document.getElementById("create-back-btn");
  const createCanvas = document.getElementById("create-canvas");
  const createButtons = Array.from(document.querySelectorAll("[data-create-type]"));

  // Tracks the pitch currently being edited (null = new pitch).
  appState.editingId = null;

  // --- Render the data tracking matrix from appState ---
  function renderPitchTable() {
    if (!tableBody) return;
    appState.openMenuId = null;

    if (!appState.pitches.length) {
      tableBody.innerHTML = "";
      emptyState.classList.remove("hidden");
      return;
    }
    emptyState.classList.add("hidden");

    tableBody.innerHTML = appState.pitches
      .map(
        (p) => `
        <tr class="border-b border-surface-line/60 transition hover:bg-surface" data-row-id="${p.id}">
          <td class="px-5 py-3.5 font-medium text-ink">${escapeHtml(p.title)}</td>
          <td class="px-5 py-3.5 text-ink-muted">${escapeHtml(p.client)}</td>
          <td class="px-5 py-3.5 text-ink-muted">${escapeHtml(p.type)}</td>
          <td class="px-5 py-3.5 text-ink">${formatValue(p.value)}</td>
          <td class="px-5 py-3.5">${statusTag(p.status)}</td>
          <td class="px-5 py-3.5 text-right">
            <div class="relative inline-block text-left">
              <button data-menu-toggle="${p.id}" aria-haspopup="true" aria-expanded="false"
                class="focus-sage inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-line hover:text-ink">
                <svg viewBox="0 0 24 24" class="h-5 w-5 pointer-events-none" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>
              </button>
              <div data-menu-panel="${p.id}"
                class="absolute right-0 z-20 mt-1 hidden w-44 overflow-hidden rounded-lg border border-surface-line bg-surface-raised shadow-xl">
                <button data-action="edit" data-id="${p.id}"
                  class="block w-full px-4 py-2.5 text-left text-sm text-ink transition hover:bg-surface hover:text-sage">Edit Pitch Deck</button>
                <button data-action="delete" data-id="${p.id}"
                  class="block w-full px-4 py-2.5 text-left text-sm text-ink transition hover:bg-surface hover:text-terracotta">Delete</button>
              </div>
            </div>
          </td>
        </tr>`
      )
      .join("");
  }

  // --- Three-dot action menu (event-delegated) ---
  function closeAllMenus() {
    document.querySelectorAll("[data-menu-panel]").forEach((el) => el.classList.add("hidden"));
    document.querySelectorAll("[data-menu-toggle]").forEach((el) => el.setAttribute("aria-expanded", "false"));
    appState.openMenuId = null;
  }

  function toggleMenu(id) {
    const panel = document.querySelector(`[data-menu-panel="${id}"]`);
    const toggle = document.querySelector(`[data-menu-toggle="${id}"]`);
    if (!panel) return;
    const willOpen = panel.classList.contains("hidden");
    closeAllMenus();
    if (willOpen) {
      panel.classList.remove("hidden");
      if (toggle) toggle.setAttribute("aria-expanded", "true");
      appState.openMenuId = id;
    }
  }

  if (tableBody) {
    tableBody.addEventListener("click", (e) => {
      const toggleBtn = e.target.closest("[data-menu-toggle]");
      if (toggleBtn) {
        e.stopPropagation();
        toggleMenu(toggleBtn.getAttribute("data-menu-toggle"));
        return;
      }
      const action = e.target.closest("[data-action]");
      if (action) {
        e.stopPropagation();
        const id = action.getAttribute("data-id");
        if (action.getAttribute("data-action") === "edit") {
          handleEditPitch(id);
        } else {
          handleDeletePitch(id);
        }
        closeAllMenus();
      }
    });
  }

  // Close menus on outside click / Escape.
  document.addEventListener("click", () => closeAllMenus());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllMenus();
  });

  function handleEditPitch(id) {
    const pitch = appState.pitches.find((p) => p.id === id);
    console.log("[dashboard] Edit Pitch Deck →", id, pitch);
    enterCreateMode(pitch ? pitch.type : "Production", pitch);
  }

  function handleDeletePitch(id) {
    console.log("[dashboard] Delete →", id);
    appState.pitches = appState.pitches.filter((p) => p.id !== id);
    renderPitchTable();
  }

  // =====================================================================
  // CREATION FORM MODULES (injected into #create-canvas)
  // =====================================================================
  const inputClass =
    "focus-sage w-full rounded-xl border border-surface-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted/70 transition hover:border-sage focus:border-sage";
  const labelClass = "mb-1.5 block text-sm font-medium text-ink";

  // Fixed PDF attachment slots for the production module.
  const PRODUCTION_DOCS = [
    "Production Script",
    "Shortlist",
    "Key Production Equipment",
    "Characters List",
    "Interview List",
  ];

  function pdfField(label) {
    return `
      <div>
        <label class="${labelClass}">${escapeHtml(label)}</label>
        <input type="file" accept=".pdf,application/pdf" data-pdf-label="${escapeHtml(label)}"
          class="${inputClass} file:mr-3 file:rounded-lg file:border-0 file:bg-surface-line file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink hover:file:bg-sage/30" />
      </div>`;
  }

  function productionFormHtml(pitch) {
    return `
      <form id="pitch-form" data-form-type="Production" class="glass-panel rounded-xl p-6 sm:p-8">
        <!-- Guardrail -->
        <div class="mb-6 flex items-center gap-2 rounded-xl border border-terracotta/40 bg-terracotta/10 px-4 py-3">
          <svg viewBox="0 0 24 24" class="h-5 w-5 shrink-0 text-terracotta" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>
          <p class="text-sm font-semibold text-terracotta">PDF files only accepted</p>
        </div>

        <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div class="md:col-span-2">
            <label class="${labelClass}">Pitch title</label>
            <input type="text" name="title" required value="${escapeHtml(pitch?.title || "")}" placeholder="e.g. Behind the Lens" class="${inputClass}" />
          </div>
          <div>
            <label class="${labelClass}">Client</label>
            <input type="text" name="client" value="${escapeHtml(pitch?.client || "")}" placeholder="Client / studio name" class="${inputClass}" />
          </div>
          <div>
            <label class="${labelClass}">Estimated value ($)</label>
            <input type="number" min="0" step="100" name="value" value="${pitch?.value ?? ""}" placeholder="48000" class="${inputClass}" />
          </div>
          <div class="md:col-span-2">
            <label class="${labelClass}">Introductory text / client selling points</label>
            <textarea name="intro" rows="4" placeholder="Open with the story angle and why this production wins the client…" class="${inputClass}">${escapeHtml(pitch?.intro || "")}</textarea>
          </div>
        </div>

        <h4 class="mt-8 font-display text-base font-bold">Production documents</h4>
        <p class="mt-0.5 text-xs text-ink-muted">Attach the supporting PDFs for this pitch.</p>
        <div class="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
          ${PRODUCTION_DOCS.map(pdfField).join("")}
        </div>

        <!-- Dynamically appended custom pre-production documents -->
        <div id="custom-docs" class="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2"></div>

        <button type="button" id="add-custom-doc"
          class="focus-sage mt-5 inline-flex items-center gap-2 rounded-xl border border-dashed border-sage/50 px-4 py-2.5 text-sm font-semibold text-sage transition hover:bg-sage/10">
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          Add custom pre-production document
        </button>

        ${formFooter()}
      </form>`;
  }

  function retainerFormHtml(pitch) {
    return `
      <form id="pitch-form" data-form-type="Retainer" class="glass-panel rounded-xl p-6 sm:p-8">
        <!-- Mandated context banner -->
        <div class="mb-6 rounded-xl border border-sage/40 bg-sage/10 px-4 py-3">
          <p class="text-sm text-ink">Prepaid retainers refer to upfront payments made to a service provider to secure their availability, buy a block of hours, or guarantee ongoing product deliveries.</p>
        </div>

        <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div class="md:col-span-2">
            <label class="${labelClass}">Pitch title</label>
            <input type="text" name="title" required value="${escapeHtml(pitch?.title || "")}" placeholder="e.g. Quarterly Brand Films" class="${inputClass}" />
          </div>
          <div>
            <label class="${labelClass}">Client</label>
            <input type="text" name="client" value="${escapeHtml(pitch?.client || "")}" placeholder="Client / studio name" class="${inputClass}" />
          </div>
          <div>
            <label class="${labelClass}">Package value ($)</label>
            <input type="number" min="0" step="100" name="value" value="${pitch?.value ?? ""}" placeholder="9000" class="${inputClass}" />
          </div>
          <div>
            <label class="${labelClass}">Hourly rate ($)</label>
            <input type="number" min="0" step="5" name="hourlyRate" value="${pitch?.hourlyRate ?? ""}" placeholder="120" class="${inputClass}" />
          </div>
          <div>
            <label class="${labelClass}">Total contract block duration</label>
            <input type="text" name="blockDuration" value="${escapeHtml(pitch?.blockDuration || "")}" placeholder="e.g. 12 months / 120 hours" class="${inputClass}" />
          </div>
          <div>
            <label class="${labelClass}">Shoot schedule</label>
            <select name="shootSchedule" class="${inputClass}">
              ${["Weekly", "Fortnightly", "Monthly"].map((o) => `<option ${pitch?.shootSchedule === o ? "selected" : ""}>${o}</option>`).join("")}
            </select>
          </div>
          <div>
            <label class="${labelClass}">Deliverable frequency</label>
            <select name="deliverableFrequency" class="${inputClass}">
              ${["Weekly", "Fortnightly", "Monthly", "Quarterly"].map((o) => `<option ${pitch?.deliverableFrequency === o ? "selected" : ""}>${o}</option>`).join("")}
            </select>
          </div>
        </div>

        <!-- Conditional bulk delivery date -->
        <div class="mt-6 rounded-xl border border-surface-line bg-surface/60 p-4">
          <label class="flex items-center gap-3 text-sm font-medium text-ink">
            <input type="checkbox" id="bulk-delivery-toggle" name="bulkDelivery" ${pitch?.bulkDeliveryDate ? "checked" : ""}
              class="focus-sage h-4 w-4 rounded border-surface-line bg-surface text-terracotta accent-terracotta" />
            Bulk delivery set date
          </label>
          <div id="bulk-delivery-wrap" class="mt-3 ${pitch?.bulkDeliveryDate ? "" : "hidden"}">
            <label class="${labelClass}">Delivery date</label>
            <input type="date" id="bulk-delivery-date" name="bulkDeliveryDate" value="${escapeHtml(pitch?.bulkDeliveryDate || "")}" class="${inputClass} max-w-xs" />
          </div>
        </div>

        ${formFooter()}
      </form>`;
  }

  function formFooter() {
    return `
      <div class="mt-8 flex items-center justify-end gap-3 border-t border-surface-line pt-6">
        <button type="button" data-form-cancel
          class="focus-sage rounded-xl border border-surface-line px-4 py-2.5 text-sm font-medium text-ink-muted transition hover:border-sage hover:text-ink">Cancel</button>
        <button type="submit"
          class="focus-sage rounded-xl bg-terracotta px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-terracotta-hover active:scale-[.99]">Save Pitch</button>
      </div>`;
  }

  // Append a custom label + PDF slot pair (Production module).
  let customDocSeq = 0;
  function appendCustomDoc() {
    const wrap = document.getElementById("custom-docs");
    if (!wrap) return;
    customDocSeq += 1;
    const row = document.createElement("div");
    row.className = "md:col-span-2 grid grid-cols-1 gap-3 rounded-xl border border-surface-line bg-surface/50 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end";
    row.innerHTML = `
      <div>
        <label class="${labelClass}">Document label</label>
        <input type="text" data-custom-label class="${inputClass}" placeholder="e.g. Location Release" />
      </div>
      <div>
        <label class="${labelClass}">PDF upload</label>
        <input type="file" accept=".pdf,application/pdf" data-custom-file class="${inputClass} file:mr-3 file:rounded-lg file:border-0 file:bg-surface-line file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink hover:file:bg-sage/30" />
      </div>
      <button type="button" data-remove-custom
        class="focus-sage h-[42px] rounded-xl border border-surface-line px-3 text-sm text-ink-muted transition hover:border-terracotta hover:text-terracotta">Remove</button>`;
    row.querySelector("[data-remove-custom]").addEventListener("click", () => row.remove());
    wrap.appendChild(row);
  }

  // Render the correct module into the cleared canvas.
  function renderCreateForm(type, pitch) {
    createCanvas.innerHTML = type === "Retainer" ? retainerFormHtml(pitch) : productionFormHtml(pitch);

    const form = document.getElementById("pitch-form");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      handleSavePitch(type, form);
    });
    form.querySelector("[data-form-cancel]").addEventListener("click", exitCreateMode);

    if (type === "Production") {
      document.getElementById("add-custom-doc").addEventListener("click", appendCustomDoc);
    } else {
      const toggle = document.getElementById("bulk-delivery-toggle");
      const wrap = document.getElementById("bulk-delivery-wrap");
      toggle.addEventListener("change", () => wrap.classList.toggle("hidden", !toggle.checked));
    }
  }

  // Collect form values, map to appState, persist, return to ledger.
  async function handleSavePitch(type, form) {
    const fd = new FormData(form);
    const existing = appState.editingId
      ? appState.pitches.find((p) => p.id === appState.editingId)
      : null;

    const pitch = {
      id: existing ? existing.id : "p-" + Date.now(),
      type,
      title: (fd.get("title") || "").toString().trim() || "Untitled Pitch",
      client: (fd.get("client") || "").toString().trim() || "—",
      value: fd.get("value") ? Number(fd.get("value")) : null,
      status: existing ? existing.status : "Draft",
    };

    if (type === "Production") {
      pitch.intro = (fd.get("intro") || "").toString();
      pitch.documents = PRODUCTION_DOCS.map((label) => {
        const input = form.querySelector(`[data-pdf-label="${CSS.escape(label)}"]`);
        return { label, fileName: input && input.files[0] ? input.files[0].name : null };
      });
      pitch.customDocuments = Array.from(form.querySelectorAll("#custom-docs > div")).map((row) => ({
        label: row.querySelector("[data-custom-label]").value.trim(),
        fileName: row.querySelector("[data-custom-file]").files[0]
          ? row.querySelector("[data-custom-file]").files[0].name
          : null,
      }));
    } else {
      pitch.hourlyRate = fd.get("hourlyRate") ? Number(fd.get("hourlyRate")) : null;
      pitch.blockDuration = (fd.get("blockDuration") || "").toString().trim();
      pitch.shootSchedule = (fd.get("shootSchedule") || "").toString();
      pitch.deliverableFrequency = (fd.get("deliverableFrequency") || "").toString();
      pitch.bulkDeliveryDate = form.querySelector("#bulk-delivery-toggle").checked
        ? (fd.get("bulkDeliveryDate") || "").toString()
        : null;
    }

    // Map back into appState.pitches (replace or prepend).
    if (existing) {
      const idx = appState.pitches.findIndex((p) => p.id === existing.id);
      appState.pitches.splice(idx, 1, pitch);
    } else {
      appState.pitches.unshift(pitch);
    }

    await savePitchToStorage(pitch); // mock backend persist
    exitCreateMode();
    renderPitchTable();
  }

  // --- View mechanics: clear the canvas for the create form workflow ---
  function enterCreateMode(type, pitch) {
    appState.dashboardMode = "create";
    appState.createType = type;
    appState.editingId = pitch ? pitch.id : null;
    closeAllMenus();
    if (createViewTitle) {
      createViewTitle.textContent = pitch
        ? `Edit ${type} Pitch Deck`
        : `New ${type} Pitch Deck`;
    }
    renderCreateForm(type, pitch); // inject the form module
    dashHome.classList.add("hidden");
    dashCreate.classList.remove("hidden");
    console.log("[dashboard] enterCreateMode →", { mode: appState.dashboardMode, type, editingId: appState.editingId });
  }

  function exitCreateMode() {
    appState.dashboardMode = "list";
    appState.createType = null;
    appState.editingId = null;
    createCanvas.innerHTML = "";
    dashCreate.classList.add("hidden");
    dashHome.classList.remove("hidden");
    console.log("[dashboard] exitCreateMode → list");
  }

  createButtons.forEach((btn) => {
    btn.addEventListener("click", () => enterCreateMode(btn.getAttribute("data-create-type")));
  });
  if (createBackBtn) createBackBtn.addEventListener("click", exitCreateMode);

  // =====================================================================
  // CLIENT-FACING PITCH VIEW  (?view=client&id=<pitchId>)
  // Isolated, auth-bypassed, read-only editorial document.
  // =====================================================================
  const clientView = document.getElementById("client-view");

  // Mandated retainer copy (single source of truth, reused by creator + client).
  const RETAINER_BANNER =
    "Prepaid retainers refer to upfront payments made to a service provider to secure their availability, buy a block of hours, or guarantee ongoing product deliveries.";
  const RETAINER_FOOTER_DISCLAIMER =
    "Advanced-booking notice: retainer blocks secure scheduled availability in advance. Booked hours and shoot windows are reserved exclusively for the client for the agreed contract duration and are non-transferable. Unused prepaid hours within a delivery cycle are governed by the terms of the signed retainer agreement.";

  // Helpers that collapse empty containers to zero dead space.
  const has = (v) => v !== null && v !== undefined && String(v).trim() !== "";
  const hasDoc = (d) => d && (has(d.fileName) || has(d.url));

  // PDF asset registry for the modal (id → {title, url, fileName}).
  let clientDocRegistry = [];

  function docTitleHtml(doc, idx) {
    return `
      <button type="button" data-doc-index="${idx}"
        class="focus-sage group flex w-full items-center justify-between gap-4 rounded-xl border border-surface-line bg-surface-raised px-5 py-4 text-left transition hover:border-sage">
        <span class="flex items-center gap-3">
          <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-terracotta/15 text-terracotta">
            <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
          </span>
          <span>
            <span class="block font-display text-base font-bold text-ink group-hover:text-sage">${escapeHtml(doc.label || doc.fileName || "Document")}</span>
            <span class="block font-mono text-xs text-ink-muted">${escapeHtml(doc.fileName || "PDF document")}</span>
          </span>
        </span>
        <span class="font-mono text-xs uppercase tracking-wide text-ink-muted">View →</span>
      </button>`;
  }

  function clientSection(title, innerHtml) {
    // Returns "" when there's no inner content → container is never emitted (no dead space).
    if (!has(innerHtml)) return "";
    return `
      <section class="border-t border-surface-line py-10">
        <h2 class="mb-5 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-sage">${escapeHtml(title)}</h2>
        ${innerHtml}
      </section>`;
  }

  function renderClientView(pitch) {
    // Hide creator + login shells entirely.
    loginView.classList.add("hidden");
    creatorView.classList.add("hidden");
    document.body.classList.remove("font-sans");
    document.body.classList.add("font-sans");

    if (!pitch) {
      clientView.innerHTML = `
        <div class="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
          <h1 class="font-display text-3xl font-bold">Pitch not found</h1>
          <p class="mt-2 text-sm text-ink-muted">This pitch link is invalid or has been removed.</p>
        </div>`;
      clientView.classList.remove("hidden");
      return;
    }

    const isRetainer = pitch.type === "Retainer";

    // Build document registry (production fixed + custom docs).
    clientDocRegistry = []
      .concat(Array.isArray(pitch.documents) ? pitch.documents : [])
      .concat(Array.isArray(pitch.customDocuments) ? pitch.customDocuments : [])
      .filter(hasDoc);

    const docsHtml = clientDocRegistry.length
      ? `<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">${clientDocRegistry.map(docTitleHtml).join("")}</div>`
      : "";

    // Retainer financial / scheduling facts (each cell collapses if empty).
    const facts = [];
    if (isRetainer) {
      if (has(pitch.blockDuration)) facts.push(["Contract block", pitch.blockDuration]);
      if (has(pitch.shootSchedule)) facts.push(["Shoot schedule", pitch.shootSchedule]);
      if (has(pitch.deliverableFrequency)) facts.push(["Deliverable frequency", pitch.deliverableFrequency]);
      if (has(pitch.bulkDeliveryDate)) facts.push(["Bulk delivery date", pitch.bulkDeliveryDate]);
    }
    const factsHtml = facts.length
      ? `<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-${Math.min(facts.length, 4)}">
          ${facts
            .map(
              ([k, v]) => `
            <div class="rounded-xl border border-surface-line bg-surface-raised p-5">
              <p class="font-mono text-xs uppercase tracking-wide text-ink-muted">${escapeHtml(k)}</p>
              <p class="mt-2 font-display text-xl font-bold text-ink">${escapeHtml(v)}</p>
            </div>`
            )
            .join("")}
        </div>`
      : "";

    const introHtml = has(pitch.intro)
      ? `<p class="max-w-2xl text-lg leading-relaxed text-ink/90">${escapeHtml(pitch.intro)}</p>`
      : "";

    const retainerBannerHtml = isRetainer
      ? `<div class="mb-10 rounded-xl border border-sage/40 bg-sage/10 px-5 py-4">
           <p class="text-sm leading-relaxed text-ink">${RETAINER_BANNER}</p>
         </div>`
      : "";

    const retainerFooterHtml = isRetainer
      ? `<div class="mt-10 rounded-xl border border-surface-line bg-surface-raised px-5 py-4">
           <p class="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">Advanced-booking disclaimer</p>
           <p class="mt-2 text-xs leading-relaxed text-ink-muted">${RETAINER_FOOTER_DISCLAIMER}</p>
         </div>`
      : "";

    clientView.innerHTML = `
      <article class="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <!-- Masthead -->
        <header>
          <div class="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.3em] text-ink-muted">
            <span class="inline-block h-2 w-2 rounded-full bg-terracotta"></span> LSC Creative · ${escapeHtml(pitch.type)} Pitch
          </div>
          <h1 class="mt-5 font-display text-4xl font-bold leading-tight sm:text-5xl">${escapeHtml(pitch.title)}</h1>
          <div id="client-meta" class="mt-3 font-mono text-sm text-ink-muted ${has(pitch.client) ? "" : "hidden"}">
            Prepared for <span class="text-ink">${escapeHtml(pitch.client)}</span>
          </div>
          <div id="client-status" class="mt-5">${statusTag(pitch.status)}</div>
        </header>

        ${retainerBannerHtml ? `<div class="mt-10">${retainerBannerHtml}</div>` : ""}

        ${clientSection("Overview", introHtml)}
        ${clientSection(isRetainer ? "Retainer terms" : "Production details", factsHtml)}
        ${clientSection("Documents", docsHtml)}

        ${retainerFooterHtml}

        <!-- Persistent action panel -->
        <section id="client-action-panel" class="mt-12 rounded-xl border border-surface-line bg-surface-raised p-6 sm:p-8">
          <h2 class="font-display text-xl font-bold">Ready to proceed?</h2>
          <p class="mt-1 text-sm text-ink-muted">Approve this pitch or request changes — the LSC team is notified instantly.</p>

          <div id="client-action-buttons" class="mt-5 flex flex-wrap gap-3">
            <button id="client-approve"
              class="focus-sage rounded-xl bg-terracotta px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-terracotta-hover active:scale-[.99]">Approve</button>
            <button id="client-revise"
              class="focus-sage rounded-xl border border-surface-line px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-sage hover:text-sage">Not Quite Right</button>
          </div>

          <!-- Feedback box (revealed by "Not Quite Right") -->
          <div id="client-feedback-wrap" class="mt-5 hidden">
            <label class="mb-1.5 block text-sm font-medium text-ink">What would you like adjusted?</label>
            <textarea id="client-feedback-text" rows="4" placeholder="Share your feedback…"
              class="focus-sage w-full rounded-xl border border-surface-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted/70 transition hover:border-sage focus:border-sage"></textarea>
            <button id="client-feedback-submit"
              class="focus-sage mt-3 rounded-xl bg-terracotta px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-terracotta-hover">Submit feedback</button>
          </div>

          <!-- Resolution receipt -->
          <div id="client-resolution" class="mt-5 hidden rounded-xl border border-sage/40 bg-sage/10 px-4 py-3 text-sm text-ink"></div>
        </section>

        <footer class="mt-16 border-t border-surface-line pt-6 font-mono text-xs text-ink-muted">
          © ${new Date().getFullYear()} LSC Creative — High-end documentary-style brand filmmaking.
        </footer>
      </article>`;

    clientView.classList.remove("hidden");
    wireClientActions(pitch);
  }

  // --- Client document modal ---
  const pdfModal = document.getElementById("pdf-modal");
  const pdfModalTitle = document.getElementById("pdf-modal-title");
  const pdfModalBody = document.getElementById("pdf-modal-body");
  const pdfModalDownload = document.getElementById("pdf-modal-download");

  function openPdfModal(doc) {
    pdfModalTitle.textContent = doc.label || doc.fileName || "Document";
    if (has(doc.url)) {
      pdfModalBody.innerHTML = `<iframe src="${escapeHtml(doc.url)}#toolbar=1" title="${escapeHtml(doc.label || "PDF preview")}" class="h-full w-full border-0"></iframe>`;
      pdfModalDownload.href = doc.url;
      pdfModalDownload.setAttribute("download", doc.fileName || "document.pdf");
      pdfModalDownload.classList.remove("pointer-events-none", "opacity-40");
    } else {
      // No live file URL available (file not uploaded in this browser session).
      pdfModalBody.innerHTML = `
        <div class="flex h-full flex-col items-center justify-center px-8 text-center">
          <p class="font-display text-lg font-bold text-ink">${escapeHtml(doc.fileName || "PDF document")}</p>
          <p class="mt-2 max-w-md text-sm text-ink-muted">Interactive preview becomes available once the file is hosted by the backend. This is a placeholder for the native browser PDF viewer.</p>
        </div>`;
      pdfModalDownload.href = "#";
      pdfModalDownload.classList.add("pointer-events-none", "opacity-40");
    }
    pdfModal.classList.remove("hidden");
    pdfModal.classList.add("flex");
  }

  function closePdfModal() {
    pdfModal.classList.add("hidden");
    pdfModal.classList.remove("flex");
    pdfModalBody.innerHTML = "";
  }

  document.getElementById("pdf-modal-close").addEventListener("click", closePdfModal);
  pdfModal.querySelector("[data-modal-backdrop]").addEventListener("click", closePdfModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !pdfModal.classList.contains("hidden")) closePdfModal();
  });

  clientView.addEventListener("click", (e) => {
    const docBtn = e.target.closest("[data-doc-index]");
    if (docBtn) {
      const idx = Number(docBtn.getAttribute("data-doc-index"));
      if (clientDocRegistry[idx]) openPdfModal(clientDocRegistry[idx]);
    }
  });

  // --- Interactive action panel (Approve / Not Quite Right) ---
  function wireClientActions(pitch) {
    const approveBtn = document.getElementById("client-approve");
    const reviseBtn = document.getElementById("client-revise");
    const feedbackWrap = document.getElementById("client-feedback-wrap");
    const feedbackText = document.getElementById("client-feedback-text");
    const feedbackSubmit = document.getElementById("client-feedback-submit");
    const statusEl = document.getElementById("client-status");
    const buttonsEl = document.getElementById("client-action-buttons");
    const resolutionEl = document.getElementById("client-resolution");

    // If already resolved, lock immediately.
    if (pitch.status === "Approved" || pitch.status === "Revision Needed") {
      lockActionPanel(pitch.status, pitch.feedback);
    }

    function lockActionPanel(status, feedback) {
      buttonsEl.classList.add("hidden");
      feedbackWrap.classList.add("hidden");
      statusEl.innerHTML = statusTag(status);
      resolutionEl.classList.remove("hidden");
      resolutionEl.textContent =
        status === "Approved"
          ? "Thank you — this pitch has been approved and the LSC team has been notified."
          : "Thanks for the feedback — your requested changes have been sent to the LSC team.";
      if (has(feedback)) {
        resolutionEl.textContent += " “" + feedback + "”";
      }
    }

    async function mockEmailAlert(kind, payload) {
      // Mimics a Google Apps Script email alert dispatch.
      console.log(`[GAS:emailAlert] → MailApp.sendEmail (${kind})`, payload);
      return new Promise((res) => setTimeout(() => {
        console.log(`[GAS:emailAlert] ← delivered (${kind})`);
        res({ ok: true });
      }, 200));
    }

    approveBtn.addEventListener("click", async () => {
      pitch.status = "Approved";
      pitch.locked = true;
      syncPitchToState(pitch);
      lockActionPanel("Approved");
      await savePitchToStorage(pitch);
      await mockEmailAlert("approval", {
        to: "studio@lsccreative.com",
        subject: `Pitch APPROVED — ${pitch.title}`,
        pitchId: pitch.id,
        client: pitch.client,
        status: pitch.status,
      });
    });

    reviseBtn.addEventListener("click", () => {
      feedbackWrap.classList.remove("hidden");
      feedbackText.focus();
    });

    feedbackSubmit.addEventListener("click", async () => {
      const text = feedbackText.value.trim();
      pitch.status = "Revision Needed";
      pitch.feedback = text;
      pitch.locked = true;
      syncPitchToState(pitch);
      console.log("[client] feedback submitted →", text);
      lockActionPanel("Revision Needed", text);
      await savePitchToStorage(pitch);
      await mockEmailAlert("revision", {
        to: "studio@lsccreative.com",
        subject: `Pitch REVISION requested — ${pitch.title}`,
        pitchId: pitch.id,
        client: pitch.client,
        status: pitch.status,
        feedback: text,
      });
    });
  }

  // Keep appState in sync (so the creator ledger reflects client decisions in-session).
  function syncPitchToState(pitch) {
    const idx = appState.pitches.findIndex((p) => p.id === pitch.id);
    if (idx >= 0) appState.pitches.splice(idx, 1, pitch);
  }

  // =====================================================================
  // APPROVED LEDGER + INVOICING EXPORT MODAL
  // =====================================================================
  const approvedList = document.getElementById("approved-list");
  const approvedEmpty = document.getElementById("approved-empty");

  // --- Established financial formulas (single source of truth) ---
  const MARKUP_RATE = 0.35; // 35% markup applied over base production cost
  function computeFinancials(pitch) {
    const total = typeof pitch.value === "number" ? pitch.value : 0;
    const baseCost = total / (1 + MARKUP_RATE); // base = total ÷ (1 + markup)
    const markupAmount = total - baseCost;       // markup = total − base
    const marginPct = total > 0 ? (markupAmount / total) * 100 : 0; // margin = markup ÷ total
    return { total, baseCost, markupAmount, marginPct };
  }

  // Human phrasing for retainer cadence mechanics.
  const FREQ_PHRASE = {
    Weekly: "every week",
    Fortnightly: "every fortnight",
    Monthly: "every month",
    Quarterly: "every quarter",
  };

  // Build the active project line items (no cost markups / margins).
  function lineItemsFor(pitch) {
    const items = [];
    if (pitch.type === "Production") {
      items.push(`${pitch.title} — production package`);
      (pitch.documents || []).filter(hasDoc).forEach((d) => items.push(`${d.label || d.fileName} (deliverable)`));
      (pitch.customDocuments || []).filter(hasDoc).forEach((d) => items.push(`${d.label || d.fileName} (deliverable)`));
    } else {
      if (has(pitch.blockDuration)) items.push(`Retainer block — ${pitch.blockDuration}`);
      if (has(pitch.shootSchedule)) items.push(`Shoot schedule — ${pitch.shootSchedule}`);
      if (has(pitch.deliverableFrequency)) items.push(`Deliverables — ${pitch.deliverableFrequency}`);
      if (has(pitch.bulkDeliveryDate)) items.push(`Bulk delivery date — ${pitch.bulkDeliveryDate}`);
    }
    return items;
  }

  // --- Approved ledger list ---
  function renderApprovedList() {
    if (!approvedList) return;
    const approved = appState.pitches.filter((p) => p.status === "Approved");

    if (!approved.length) {
      approvedList.innerHTML = "";
      approvedEmpty.classList.remove("hidden");
      return;
    }
    approvedEmpty.classList.add("hidden");

    approvedList.innerHTML = approved
      .map(
        (p) => `
        <button type="button" data-approved-id="${p.id}"
          class="focus-sage flex w-full items-center justify-between gap-4 rounded-xl border border-surface-line bg-surface-raised p-5 text-left transition hover:border-sage">
          <span>
            <span class="block font-display text-lg font-bold text-ink">${escapeHtml(p.title)}</span>
            <span class="block text-sm text-ink-muted">${escapeHtml(p.client)} · ${escapeHtml(p.type)} · ${formatValue(p.value)}</span>
          </span>
          <span class="flex items-center gap-3">
            <span class="inline-flex items-center rounded-full bg-sage/15 px-3 py-1 text-xs font-semibold text-sage">Approved</span>
            <span class="font-mono text-xs uppercase tracking-wide text-ink-muted">Invoice →</span>
          </span>
        </button>`
      )
      .join("");
  }

  if (approvedList) {
    approvedList.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-approved-id]");
      if (btn) openInvoiceModal(btn.getAttribute("data-approved-id"));
    });
  }

  // --- Invoicing export modal ---
  const invoiceModal = document.getElementById("invoice-modal");
  const invoiceTitle = document.getElementById("invoice-modal-title");
  const invoiceSub = document.getElementById("invoice-modal-sub");
  const invoiceAccordions = document.getElementById("invoice-accordions");
  const invoiceClientLink = document.getElementById("invoice-client-link");

  function accordion(idx, title, bodyHtml, open) {
    return `
      <div class="overflow-hidden rounded-xl border border-surface-line bg-surface-raised">
        <button type="button" data-accordion-toggle="${idx}" aria-expanded="${open ? "true" : "false"}"
          class="focus-sage flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
          <span class="font-display text-base font-bold text-ink">${escapeHtml(title)}</span>
          <svg viewBox="0 0 24 24" class="h-5 w-5 shrink-0 text-ink-muted transition-transform ${open ? "rotate-180" : ""}" data-accordion-chevron fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div data-accordion-body class="border-t border-surface-line px-5 py-4 ${open ? "" : "hidden"}">${bodyHtml}</div>
      </div>`;
  }

  // Deliverables / scope copy.
  function deliverablesHtml(pitch) {
    let rows = "";
    if (pitch.type === "Production") {
      const docs = [].concat(pitch.documents || [], pitch.customDocuments || []).filter(hasDoc);
      rows = docs.length
        ? `<ul class="mt-2 space-y-1.5 text-sm text-ink">${docs
            .map((d) => `<li class="flex items-center gap-2"><span class="h-1.5 w-1.5 rounded-full bg-sage"></span>${escapeHtml(d.label || d.fileName)}</li>`)
            .join("")}</ul>`
        : `<p class="mt-2 text-sm text-ink-muted">No specific document deliverables attached.</p>`;
      return `<p class="text-sm text-ink-muted">Assets due for <span class="text-ink">${escapeHtml(pitch.title)}</span>:</p>${rows}`;
    }
    // Retainer cycle mechanics
    const dur = has(pitch.blockDuration) ? pitch.blockDuration : "the contracted term";
    const freq = FREQ_PHRASE[pitch.deliverableFrequency] || "on the agreed cadence";
    const shoot = has(pitch.shootSchedule) ? pitch.shootSchedule.toLowerCase() : "scheduled";
    return `
      <p class="text-sm leading-relaxed text-ink">Contracted for <span class="font-semibold">${escapeHtml(dur)}</span> with deliverables made <span class="font-semibold">${escapeHtml(freq)}</span>, on a <span class="font-semibold">${escapeHtml(shoot)}</span> shoot schedule.</p>
      ${has(pitch.bulkDeliveryDate) ? `<p class="mt-2 text-sm text-ink-muted">Bulk delivery target date: <span class="text-ink">${escapeHtml(pitch.bulkDeliveryDate)}</span></p>` : ""}`;
  }

  // Granular financial breakdown (internal — includes markups + margins).
  function financialHtml(pitch) {
    const f = computeFinancials(pitch);
    const money = (n) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 2 });
    const row = (k, v, accent) =>
      `<div class="flex items-center justify-between py-2 text-sm"><span class="text-ink-muted">${escapeHtml(k)}</span><span class="font-mono ${accent || "text-ink"}">${v}</span></div>`;
    let extra = "";
    if (pitch.type === "Retainer" && has(pitch.hourlyRate)) {
      extra = row("Hourly rate", money(pitch.hourlyRate));
    }
    return `
      <div class="divide-y divide-surface-line">
        ${row("Base production cost", money(f.baseCost))}
        ${row(`Applied markup (${Math.round(MARKUP_RATE * 100)}%)`, "+" + money(f.markupAmount), "text-sage")}
        ${extra}
        ${row("Final client total", money(f.total), "text-ink font-semibold")}
        ${row("Profit margin", f.marginPct.toFixed(1) + "%", "text-terracotta")}
      </div>
      <p class="mt-3 text-xs text-ink-muted">Internal figures — markups and margins are excluded from the client invoice export.</p>`;
  }

  // Raw invoice export text (NO markups / margins).
  function buildInvoiceText(pitch) {
    const items = lineItemsFor(pitch);
    const lines = [
      "LSC CREATIVE — INVOICE EXPORT",
      `Project: ${pitch.title}`,
      `Client: ${pitch.client}`,
      `Type: ${pitch.type}`,
      "",
      "Line items:",
      ...items.map((it) => `- ${it}`),
      "",
      `Total: ${formatValue(pitch.value)}`,
    ];
    return lines.join("\n");
  }

  function invoiceTextHtml(pitch) {
    const raw = buildInvoiceText(pitch);
    return `
      <p class="text-sm text-ink-muted">Clean, unformatted payload — ready to paste into an external invoicing agent.</p>
      <pre id="invoice-raw" class="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-surface-line bg-surface p-4 font-mono text-xs leading-relaxed text-ink">${escapeHtml(raw)}</pre>
      <button id="invoice-copy-btn" type="button"
        class="focus-sage mt-3 inline-flex items-center gap-2 rounded-xl bg-terracotta px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-terracotta-hover active:scale-[.99]">
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        <span id="invoice-copy-label">Copy to Clipboard</span>
      </button>`;
  }

  function renderInvoiceAccordions(pitch) {
    invoiceAccordions.innerHTML = [
      accordion(0, "Deliverables & Scope", deliverablesHtml(pitch), true),
      accordion(1, "Granular Financial Breakdown", financialHtml(pitch), false),
      accordion(2, "Invoicing Export Text", invoiceTextHtml(pitch), false),
    ].join("");

    // Accordion toggles.
    invoiceAccordions.querySelectorAll("[data-accordion-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const body = btn.parentElement.querySelector("[data-accordion-body]");
        const chevron = btn.querySelector("[data-accordion-chevron]");
        const open = body.classList.toggle("hidden");
        btn.setAttribute("aria-expanded", String(!open));
        chevron.classList.toggle("rotate-180", !open);
      });
    });

    // Copy-to-clipboard engine (markups/margins omitted by construction).
    const copyBtn = document.getElementById("invoice-copy-btn");
    const copyLabel = document.getElementById("invoice-copy-label");
    copyBtn.addEventListener("click", async () => {
      const raw = buildInvoiceText(pitch);
      try {
        await navigator.clipboard.writeText(raw);
      } catch (err) {
        // Fallback for non-secure contexts.
        const pre = document.getElementById("invoice-raw");
        const range = document.createRange();
        range.selectNodeContents(pre);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        document.execCommand("copy");
        sel.removeAllRanges();
      }
      console.log("[invoice] copied export payload for", pitch.id);
      copyLabel.textContent = "Copied!";
      setTimeout(() => (copyLabel.textContent = "Copy to Clipboard"), 1600);
    });
  }

  function openInvoiceModal(id) {
    const pitch = appState.pitches.find((p) => p.id === id);
    if (!pitch) return;
    invoiceTitle.textContent = pitch.title;
    invoiceSub.textContent = `${pitch.client} · ${pitch.type} · ${formatValue(pitch.value)}`;
    invoiceClientLink.href = `?view=client&id=${encodeURIComponent(pitch.id)}`;
    renderInvoiceAccordions(pitch);
    invoiceModal.classList.remove("hidden");
    invoiceModal.classList.add("flex");
  }

  function closeInvoiceModal() {
    invoiceModal.classList.add("hidden");
    invoiceModal.classList.remove("flex");
    invoiceAccordions.innerHTML = "";
  }

  document.getElementById("invoice-modal-close").addEventListener("click", closeInvoiceModal);
  invoiceModal.querySelector("[data-invoice-backdrop]").addEventListener("click", closeInvoiceModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !invoiceModal.classList.contains("hidden")) closeInvoiceModal();
  });

  // =====================================================================
  // ROUTER + BOOT
  // =====================================================================
  async function boot() {
    const params = new URLSearchParams(window.location.search);
    appState.pitches = await loadPitches();

    if (params.get("view") === "client") {
      // Isolated client route — bypass PIN entirely.
      const id = params.get("id");
      const pitch = appState.pitches.find((p) => p.id === id) || null;
      console.log("[router] client route →", id, pitch ? "found" : "not found");
      renderClientView(pitch);
      return;
    }

    // Default creator route.
    renderPitchTable();
    if (cells[0]) cells[0].focus();
  }
  boot();
})();
