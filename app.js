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
    published: { title: "Published Pitches", subtitle: "Live client portal links ready to share" },
    clients: { title: "CRM", subtitle: "Manage client relationships and contact profiles" },
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
    if (tab === "published" && typeof renderPublishedList === "function") renderPublishedList();
    if (tab === "clients" && typeof renderClientTable === "function") renderClientTable();
    if (tab === "settings" && typeof initSettingsPanel === "function") initSettingsPanel();
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
    clients: [
      { id: "c-1", business: "Northwind Films", contact: "Dana Wells", email: "dana@northwindfilms.com", phone: "+61 400 111 222" },
      { id: "c-2", business: "Halcyon Media", contact: "Marcus Lee", email: "marcus@halcyonmedia.co", phone: "+61 400 333 444" },
    ],
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
      deliverables: [
        { title: "Final 4K master film", description: "Fully graded and sound-mixed feature export, delivered in 4K ProRes and H.264." },
        { title: "Three social cut-downs", description: "60s, 30s and 15s vertical edits for Instagram, TikTok and YouTube Shorts." },
      ],
      published: true,
      publishedAt: "2026-06-01T00:00:00.000Z",
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

  // --- Filter + sort state for the history log ---
  appState.tableFilter = { status: "all", type: "all" };
  appState.tableSort = { key: "title", dir: "asc" };

  function getVisiblePitches() {
    const { status, type } = appState.tableFilter;
    let rows = appState.pitches.filter(
      (p) => (status === "all" || p.status === status) && (type === "all" || p.type === type)
    );
    const { key, dir } = appState.tableSort;
    const factor = dir === "asc" ? 1 : -1;
    rows = rows.slice().sort((a, b) => {
      let av = a[key];
      let bv = b[key];
      if (key === "value") {
        av = typeof av === "number" ? av : -Infinity;
        bv = typeof bv === "number" ? bv : -Infinity;
        return (av - bv) * factor;
      }
      return String(av || "").localeCompare(String(bv || ""), undefined, { sensitivity: "base" }) * factor;
    });
    return rows;
  }

  function updateSortArrows() {
    document.querySelectorAll("[data-sort-key]").forEach((btn) => {
      const arrow = btn.querySelector("[data-sort-arrow]");
      if (!arrow) return;
      arrow.textContent = btn.getAttribute("data-sort-key") === appState.tableSort.key
        ? (appState.tableSort.dir === "asc" ? "▲" : "▼")
        : "";
    });
  }

  // --- Render the data tracking matrix from appState ---
  function renderPitchTable() {
    if (!tableBody) return;
    appState.openMenuId = null;
    updateSortArrows();

    const rows = getVisiblePitches();
    if (!rows.length) {
      tableBody.innerHTML = "";
      emptyState.classList.remove("hidden");
      return;
    }
    emptyState.classList.add("hidden");

    tableBody.innerHTML = rows
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
                <button data-action="publish" data-id="${p.id}"
                  class="block w-full px-4 py-2.5 text-left text-sm text-ink transition hover:bg-surface hover:text-sage">${p.published ? "Copy client link" : "Publish"}</button>
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
        const act = action.getAttribute("data-action");
        if (act === "edit") {
          handleEditPitch(id);
        } else if (act === "publish") {
          handlePublishPitch(id);
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

  // --- Filter + sort controls ---
  const filterStatus = document.getElementById("pitch-filter-status");
  const filterType = document.getElementById("pitch-filter-type");
  if (filterStatus) filterStatus.addEventListener("change", () => {
    appState.tableFilter.status = filterStatus.value;
    renderPitchTable();
  });
  if (filterType) filterType.addEventListener("change", () => {
    appState.tableFilter.type = filterType.value;
    renderPitchTable();
  });
  document.querySelectorAll("[data-sort-key]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-sort-key");
      if (appState.tableSort.key === key) {
        appState.tableSort.dir = appState.tableSort.dir === "asc" ? "desc" : "asc";
      } else {
        appState.tableSort.key = key;
        appState.tableSort.dir = "asc";
      }
      renderPitchTable();
    });
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

  // Absolute client-portal URL for a pitch.
  function clientUrlFor(pitch) {
    const base = window.location.origin + window.location.pathname;
    return `${base}?view=client&id=${encodeURIComponent(pitch.id)}`;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (e2) {}
      document.body.removeChild(ta);
      return true;
    }
  }

  // Publish: flag the pitch live (status unchanged) and surface the client link.
  async function handlePublishPitch(id) {
    const pitch = appState.pitches.find((p) => p.id === id);
    if (!pitch) return;
    const link = clientUrlFor(pitch);

    if (!pitch.published) {
      pitch.published = true;
      pitch.publishedAt = new Date().toISOString();
      console.log("[publish] pitch published →", id, link);
      await savePitchToStorage(pitch);
      renderPitchTable();
    }
    await copyText(link);
    // Jump to the Published tab so the user sees the live link + copy control.
    activateTab("published");
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

  // Shared itemised deliverables block (title + description rows).
  function deliverablesSection() {
    return `
      <h4 class="mt-8 font-display text-base font-bold">Deliverables</h4>
      <p class="mt-0.5 text-xs text-ink-muted">Itemise exactly what the client receives. Each line shows on the client portal.</p>
      <div id="deliverables-list" class="mt-4 space-y-3"></div>
      <button type="button" id="add-deliverable"
        class="focus-sage mt-4 inline-flex items-center gap-2 rounded-xl border border-dashed border-sage/50 px-4 py-2.5 text-sm font-semibold text-sage transition hover:bg-sage/10">
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
        Add deliverable
      </button>`;
  }

  function appendDeliverable(title, desc) {
    const wrap = document.getElementById("deliverables-list");
    if (!wrap) return;
    const row = document.createElement("div");
    row.className = "rounded-xl border border-surface-line bg-surface/50 p-3";
    row.innerHTML = `
      <div class="flex items-start gap-3">
        <div class="flex-1 space-y-2">
          <input type="text" data-deliverable-title value="${escapeHtml(title || "")}" placeholder="Deliverable name — e.g. Final 4K master" class="${inputClass}" />
          <textarea data-deliverable-desc rows="2" placeholder="Short description of what this deliverable includes…" class="${inputClass}">${escapeHtml(desc || "")}</textarea>
        </div>
        <button type="button" data-remove-deliverable
          class="focus-sage mt-0.5 h-[42px] shrink-0 rounded-xl border border-surface-line px-3 text-sm text-ink-muted transition hover:border-terracotta hover:text-terracotta">Remove</button>
      </div>`;
    row.querySelector("[data-remove-deliverable]").addEventListener("click", () => row.remove());
    wrap.appendChild(row);
  }

  // ---- Image helpers (data-URL encoding so images persist in the payload) ----
  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ---- 1. Top Banner Image (start of form) ----
  function bannerSection(pitch) {
    const existing = pitch && has(pitch.banner) ? pitch.banner : "";
    return `
      <h4 class="font-display text-base font-bold">Top Banner Image</h4>
      <p class="mt-0.5 text-xs text-ink-muted">Cinematic hero image shown full-bleed at the top of the client pitch.</p>
      <div id="banner-dropzone" data-banner-zone
        class="focus-sage mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-surface-line bg-surface/50 p-6 text-center transition hover:border-sage">
        <input type="file" accept="image/*" data-banner-input class="hidden" />
        <img data-banner-preview src="${escapeHtml(existing)}" alt="Banner preview" class="${existing ? "" : "hidden"} max-h-40 w-full rounded-lg object-cover" />
        <div data-banner-placeholder class="${existing ? "hidden" : ""} flex flex-col items-center gap-1 text-ink-muted">
          <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
          <span class="text-sm">Click or drop an image to upload</span>
        </div>
      </div>
      <button type="button" data-banner-clear class="${existing ? "" : "hidden"} focus-sage mt-2 text-xs text-ink-muted transition hover:text-terracotta">Remove banner</button>`;
  }

  // ---- 2. Production Breakdown module ----
  function breakdownSection() {
    return `
      <h4 class="mt-8 font-display text-base font-bold">Production Breakdown</h4>
      <p class="mt-0.5 text-xs text-ink-muted">Itemise the phases of work for this project.</p>
      <div id="breakdown-list" class="mt-4 space-y-3"></div>
      <button type="button" id="add-breakdown"
        class="focus-sage mt-4 inline-flex items-center gap-2 rounded-xl border border-dashed border-sage/50 px-4 py-2.5 text-sm font-semibold text-sage transition hover:bg-sage/10">
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
        Production Module
      </button>`;
  }

  const BREAKDOWN_PHASES = ["Pre-production", "Production", "Post-production"];
  function appendBreakdownRow(phase, description) {
    const wrap = document.getElementById("breakdown-list");
    if (!wrap) return;
    const row = document.createElement("div");
    row.className = "rounded-xl border border-surface-line bg-surface/50 p-3";
    row.innerHTML = `
      <div class="flex items-start gap-3">
        <div class="flex-1 space-y-2">
          <select data-breakdown-phase class="${inputClass}">
            ${BREAKDOWN_PHASES.map((p) => `<option ${p === phase ? "selected" : ""}>${p}</option>`).join("")}
          </select>
          <textarea data-breakdown-desc rows="2" placeholder="Describe the work in this phase…" class="${inputClass}">${escapeHtml(description || "")}</textarea>
        </div>
        <button type="button" data-remove-breakdown
          class="focus-sage mt-0.5 h-[42px] shrink-0 rounded-xl border border-surface-line px-3 text-sm text-ink-muted transition hover:border-terracotta hover:text-terracotta">Remove</button>
      </div>`;
    row.querySelector("[data-remove-breakdown]").addEventListener("click", () => row.remove());
    wrap.appendChild(row);
  }

  // ---- 3. Interactive Project Storyboard ----
  function storyboardSection() {
    return `
      <h4 class="mt-8 font-display text-base font-bold">Project Storyboard</h4>
      <p class="mt-0.5 text-xs text-ink-muted">Build scenes with first-frame images and frame descriptions.</p>
      <div id="storyboard-list" class="mt-4 space-y-4"></div>
      <button type="button" id="add-scene"
        class="focus-sage mt-4 inline-flex items-center gap-2 rounded-xl border border-dashed border-sage/50 px-4 py-2.5 text-sm font-semibold text-sage transition hover:bg-sage/10">
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
        Add Scene
      </button>`;
  }

  // Append a frame (image dropzone + description) inside a scene's frame list.
  function appendFrame(framesWrap, frame) {
    const existing = frame && has(frame.image) ? frame.image : "";
    const row = document.createElement("div");
    row.className = "rounded-xl border border-surface-line bg-surface/40 p-3";
    row.innerHTML = `
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-[140px_1fr_auto] sm:items-start">
        <div data-frame-zone
          class="focus-sage flex h-[92px] cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-surface-line bg-surface/60 text-center transition hover:border-sage">
          <input type="file" accept="image/*" data-frame-input class="hidden" />
          <img data-frame-preview src="${escapeHtml(existing)}" alt="Frame" class="${existing ? "" : "hidden"} h-full w-full object-cover" />
          <span data-frame-placeholder class="${existing ? "hidden" : ""} px-2 text-[11px] text-ink-muted">Drop / click image</span>
        </div>
        <textarea data-frame-desc rows="3" placeholder="Frame description…" class="${inputClass}">${escapeHtml((frame && frame.description) || "")}</textarea>
        <button type="button" data-remove-frame
          class="focus-sage h-[42px] shrink-0 rounded-xl border border-surface-line px-3 text-sm text-ink-muted transition hover:border-terracotta hover:text-terracotta">Remove</button>
      </div>`;
    const input = row.querySelector("[data-frame-input]");
    input._dataUrl = existing || "";
    wireImageZone(row.querySelector("[data-frame-zone]"), input, row.querySelector("[data-frame-preview]"), row.querySelector("[data-frame-placeholder]"));
    row.querySelector("[data-remove-frame]").addEventListener("click", () => row.remove());
    framesWrap.appendChild(row);
  }

  function appendScene(title, frames) {
    const wrap = document.getElementById("storyboard-list");
    if (!wrap) return;
    const card = document.createElement("div");
    card.className = "rounded-xl border border-surface-line bg-surface/50 p-4";
    card.innerHTML = `
      <div class="flex items-center gap-3">
        <input type="text" data-scene-title value="${escapeHtml(title || "")}" placeholder="Scene title — e.g. Opening montage" class="${inputClass}" />
        <button type="button" data-remove-scene
          class="focus-sage h-[42px] shrink-0 rounded-xl border border-surface-line px-3 text-sm text-ink-muted transition hover:border-terracotta hover:text-terracotta">Remove scene</button>
      </div>
      <div data-scene-frames class="mt-3 space-y-3"></div>
      <button type="button" data-add-frame
        class="focus-sage mt-3 inline-flex items-center gap-2 rounded-lg border border-dashed border-sage/40 px-3 py-2 text-xs font-semibold text-sage transition hover:bg-sage/10">
        <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
        Add another storyboard image
      </button>`;
    const framesWrap = card.querySelector("[data-scene-frames]");
    card.querySelector("[data-remove-scene]").addEventListener("click", () => card.remove());
    card.querySelector("[data-add-frame]").addEventListener("click", () => appendFrame(framesWrap, null));
    const initial = Array.isArray(frames) && frames.length ? frames : [null]; // every scene starts with one frame
    initial.forEach((f) => appendFrame(framesWrap, f));
    wrap.appendChild(card);
  }

  // Wire a click/drag-drop image zone → reads to data URL, previews, stashes on input._dataUrl.
  function wireImageZone(zone, input, preview, placeholder) {
    const show = (dataUrl) => {
      input._dataUrl = dataUrl;
      preview.src = dataUrl;
      preview.classList.remove("hidden");
      if (placeholder) placeholder.classList.add("hidden");
    };
    const handleFile = async (file) => {
      if (!file || !file.type.startsWith("image/")) return;
      show(await fileToDataUrl(file));
    };
    zone.addEventListener("click", () => input.click());
    input.addEventListener("change", () => handleFile(input.files[0]));
    zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("border-sage"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("border-sage"));
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("border-sage");
      handleFile(e.dataTransfer.files[0]);
    });
  }

  function productionFormHtml(pitch) {
    return `
      <form id="pitch-form" data-form-type="Production" class="glass-panel rounded-xl p-6 sm:p-8">
        <!-- Guardrail -->
        <div class="mb-6 flex items-center gap-2 rounded-xl border border-terracotta/40 bg-terracotta/10 px-4 py-3">
          <svg viewBox="0 0 24 24" class="h-5 w-5 shrink-0 text-terracotta" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>
          <p class="text-sm font-semibold text-terracotta">PDF files only accepted</p>
        </div>

        ${bannerSection(pitch)}
        <div class="my-6 border-t border-surface-line"></div>

        <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div class="md:col-span-2">
            <label class="${labelClass}">Pitch title</label>
            <input type="text" name="title" required value="${escapeHtml(pitch?.title || "")}" placeholder="e.g. Behind the Lens" class="${inputClass}" />
          </div>
          <div>
            <label class="${labelClass}">Client</label>
            <select name="clientId" data-client-select class="${inputClass}">
              ${clientSelectOptions(resolveClientId(pitch))}
            </select>
            <p class="mt-1 text-xs text-ink-muted">Manage clients in the <span class="text-sage">CRM</span> tab.</p>
            <div data-client-preview class="mt-2 hidden rounded-xl border border-surface-line bg-surface/60 p-3 text-xs text-ink-muted"></div>
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

        ${breakdownSection()}

        ${storyboardSection()}

        ${deliverablesSection()}

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

        ${bannerSection(pitch)}
        <div class="my-6 border-t border-surface-line"></div>

        <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div class="md:col-span-2">
            <label class="${labelClass}">Pitch title</label>
            <input type="text" name="title" required value="${escapeHtml(pitch?.title || "")}" placeholder="e.g. Quarterly Brand Films" class="${inputClass}" />
          </div>
          <div>
            <label class="${labelClass}">Client</label>
            <select name="clientId" data-client-select class="${inputClass}">
              ${clientSelectOptions(resolveClientId(pitch))}
            </select>
            <p class="mt-1 text-xs text-ink-muted">Manage clients in the <span class="text-sage">CRM</span> tab.</p>
            <div data-client-preview class="mt-2 hidden rounded-xl border border-surface-line bg-surface/60 p-3 text-xs text-ink-muted"></div>
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

        ${breakdownSection()}

        ${storyboardSection()}

        ${deliverablesSection()}

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

    // Top banner image zone (shared): wire dropzone + clear, prefill preview when editing.
    const bannerInput = form.querySelector("[data-banner-input]");
    const bannerZone = form.querySelector("[data-banner-zone]");
    const bannerPreview = form.querySelector("[data-banner-preview]");
    const bannerPlaceholder = form.querySelector("[data-banner-placeholder]");
    const bannerClear = form.querySelector("[data-banner-clear]");
    bannerInput._dataUrl = (pitch && has(pitch.banner)) ? pitch.banner : "";
    wireImageZone(bannerZone, bannerInput, bannerPreview, bannerPlaceholder);
    const refreshBannerClear = () => bannerClear.classList.toggle("hidden", !bannerInput._dataUrl);
    bannerInput.addEventListener("change", () => setTimeout(refreshBannerClear, 0));
    bannerZone.addEventListener("drop", () => setTimeout(refreshBannerClear, 0));
    bannerClear.addEventListener("click", () => {
      bannerInput._dataUrl = "";
      bannerInput.value = "";
      bannerPreview.src = "";
      bannerPreview.classList.add("hidden");
      bannerPlaceholder.classList.remove("hidden");
      bannerClear.classList.add("hidden");
    });

    // Production Breakdown: prefill + wire add button.
    document.getElementById("add-breakdown").addEventListener("click", () => appendBreakdownRow("Pre-production", ""));
    const existingBreakdown = (pitch && Array.isArray(pitch.breakdown)) ? pitch.breakdown : [];
    existingBreakdown.forEach((b) => appendBreakdownRow(b.phase, b.description));

    // Project Storyboard: prefill scenes + wire add button.
    document.getElementById("add-scene").addEventListener("click", () => appendScene("", null));
    const existingScenes = (pitch && Array.isArray(pitch.storyboard)) ? pitch.storyboard : [];
    existingScenes.forEach((s) => appendScene(s.title, s.frames));

    // Deliverables (shared by both modules): prefill when editing + wire add button.
    document.getElementById("add-deliverable").addEventListener("click", () => appendDeliverable("", ""));
    const existingDeliverables = (pitch && Array.isArray(pitch.deliverables)) ? pitch.deliverables : [];
    existingDeliverables.forEach((d) => appendDeliverable(d.title, d.description));

    // CRM client dropdown: instantly preview the bound contact details on select.
    const clientSelect = form.querySelector("[data-client-select]");
    const clientPreview = form.querySelector("[data-client-preview]");
    const syncClientPreview = () => {
      const c = appState.clients.find((x) => x.id === clientSelect.value);
      if (!c) {
        clientPreview.classList.add("hidden");
        clientPreview.innerHTML = "";
        return;
      }
      clientPreview.classList.remove("hidden");
      clientPreview.innerHTML =
        `<span class="text-ink">${escapeHtml(c.contact || "—")}</span> · ` +
        `${escapeHtml(c.email || "—")} · ${escapeHtml(c.phone || "—")}`;
      console.log("[crm] bound client to pitch payload →", c.business);
    };
    clientSelect.addEventListener("change", syncClientPreview);
    syncClientPreview(); // reflect any prefilled selection when editing
  }

  // Collect form values, map to appState, persist, return to ledger.
  async function handleSavePitch(type, form) {
    const fd = new FormData(form);
    const existing = appState.editingId
      ? appState.pitches.find((p) => p.id === appState.editingId)
      : null;

    // Resolve the selected CRM client and bind their full profile into the payload.
    const clientId = (fd.get("clientId") || "").toString();
    const clientRecord = appState.clients.find((c) => c.id === clientId) || null;

    const pitch = {
      id: existing ? existing.id : "p-" + Date.now(),
      type,
      title: (fd.get("title") || "").toString().trim() || "Untitled Pitch",
      // Client binding from CRM (falls back to any pre-existing string client).
      clientId: clientRecord ? clientRecord.id : null,
      client: clientRecord ? clientRecord.business : (existing && existing.client) || "—",
      clientContact: clientRecord ? clientRecord.contact : (existing && existing.clientContact) || "",
      clientEmail: clientRecord ? clientRecord.email : (existing && existing.clientEmail) || "",
      clientPhone: clientRecord ? clientRecord.phone : (existing && existing.clientPhone) || "",
      value: fd.get("value") ? Number(fd.get("value")) : null,
      status: existing ? existing.status : "Draft",
      // Preserve publish state across edits.
      published: existing ? !!existing.published : false,
      publishedAt: existing ? existing.publishedAt || null : null,
    };

    // Top banner image (data URL, empty string if none).
    const bannerInput = form.querySelector("[data-banner-input]");
    pitch.banner = (bannerInput && bannerInput._dataUrl) ? bannerInput._dataUrl : "";

    // Production breakdown rows.
    pitch.breakdown = Array.from(form.querySelectorAll("#breakdown-list > div"))
      .map((row) => ({
        phase: row.querySelector("[data-breakdown-phase]").value,
        description: row.querySelector("[data-breakdown-desc]").value.trim(),
      }))
      .filter((b) => b.description);

    // Storyboard scenes → frames (image data URL + description).
    pitch.storyboard = Array.from(form.querySelectorAll("#storyboard-list > div"))
      .map((card) => ({
        title: card.querySelector("[data-scene-title]").value.trim(),
        frames: Array.from(card.querySelectorAll("[data-scene-frames] > div"))
          .map((fr) => ({
            image: fr.querySelector("[data-frame-input]")._dataUrl || "",
            description: fr.querySelector("[data-frame-desc]").value.trim(),
          }))
          .filter((f) => f.image || f.description),
      }))
      .filter((s) => s.title || s.frames.length);

    // Itemised deliverables (shared by both modules): title + description.
    pitch.deliverables = Array.from(form.querySelectorAll("#deliverables-list > div"))
      .map((row) => ({
        title: row.querySelector("[data-deliverable-title]").value.trim(),
        description: row.querySelector("[data-deliverable-desc]").value.trim(),
      }))
      .filter((d) => d.title || d.description);

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

    // Itemised deliverables (title + description) — collapses if none.
    const deliverables = Array.isArray(pitch.deliverables) ? pitch.deliverables.filter((d) => has(d.title) || has(d.description)) : [];
    const deliverablesClientHtml = deliverables.length
      ? `<div class="space-y-3">${deliverables
          .map(
            (d) => `
          <div class="rounded-xl border border-surface-line bg-surface-raised p-5">
            <p class="font-display text-base font-bold text-ink">${escapeHtml(d.title || "Deliverable")}</p>
            ${has(d.description) ? `<p class="mt-1.5 text-sm leading-relaxed text-ink-muted">${escapeHtml(d.description)}</p>` : ""}
          </div>`
          )
          .join("")}</div>`
      : "";

    // Top banner image — full-bleed cinematic asset (collapses if none).
    const topBannerHtml = has(pitch.banner)
      ? `<div class="w-full overflow-hidden border-b border-surface-line">
           <img src="${escapeHtml(pitch.banner)}" alt="${escapeHtml(pitch.title)}" class="h-64 w-full object-cover sm:h-80 lg:h-96" />
         </div>`
      : "";

    // Production breakdown — itemised phase layout (collapses if none).
    const breakdown = Array.isArray(pitch.breakdown) ? pitch.breakdown.filter((b) => has(b.description)) : [];
    const breakdownClientHtml = breakdown.length
      ? `<div class="space-y-3">${breakdown
          .map(
            (b) => `
          <div class="flex flex-col gap-1 rounded-xl border border-surface-line bg-surface-raised p-5 sm:flex-row sm:gap-5">
            <p class="shrink-0 font-mono text-xs font-semibold uppercase tracking-wide text-sage sm:w-40">${escapeHtml(b.phase || "Phase")}</p>
            <p class="text-sm leading-relaxed text-ink/90">${escapeHtml(b.description)}</p>
          </div>`
          )
          .join("")}</div>`
      : "";

    // Project storyboard — expandable accordion (collapses if none).
    const scenes = Array.isArray(pitch.storyboard)
      ? pitch.storyboard.filter((s) => has(s.title) || (Array.isArray(s.frames) && s.frames.some((f) => has(f.image) || has(f.description))))
      : [];
    const storyboardClientHtml = scenes.length
      ? `<div class="overflow-hidden rounded-xl border border-surface-line bg-surface-raised">
          <button type="button" data-storyboard-toggle aria-expanded="false"
            class="focus-sage flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
            <span class="font-display text-base font-bold text-ink">Project Storyboard</span>
            <svg viewBox="0 0 24 24" class="h-5 w-5 shrink-0 text-ink-muted transition-transform" data-storyboard-chevron fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          <div data-storyboard-body class="hidden border-t border-surface-line px-5 py-4 space-y-5">
            ${scenes
              .map(
                (s) => `
              <div>
                ${has(s.title) ? `<p class="font-display text-base font-bold text-ink">${escapeHtml(s.title)}</p>` : ""}
                <div class="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  ${(s.frames || [])
                    .filter((f) => has(f.image) || has(f.description))
                    .map(
                      (f) => `
                    <div class="rounded-xl border border-surface-line bg-surface p-3">
                      ${has(f.image) ? `<img src="${escapeHtml(f.image)}" alt="Storyboard frame" class="mb-2 h-36 w-full rounded-lg object-cover" />` : ""}
                      ${has(f.description) ? `<p class="text-sm leading-relaxed text-ink-muted">${escapeHtml(f.description)}</p>` : ""}
                    </div>`
                    )
                    .join("")}
                </div>
              </div>`
              )
              .join("")}
          </div>
        </div>`
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
      ${topBannerHtml}
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
        ${clientSection("Production Breakdown", breakdownClientHtml)}
        ${storyboardClientHtml ? `<section class="border-t border-surface-line py-10">${storyboardClientHtml}</section>` : ""}
        ${clientSection("Deliverables", deliverablesClientHtml)}
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
      return;
    }
    // Project Storyboard accordion toggle.
    const sbToggle = e.target.closest("[data-storyboard-toggle]");
    if (sbToggle) {
      const body = sbToggle.parentElement.querySelector("[data-storyboard-body]");
      const chevron = sbToggle.querySelector("[data-storyboard-chevron]");
      const open = body.classList.toggle("hidden");
      sbToggle.setAttribute("aria-expanded", String(!open));
      chevron.classList.toggle("rotate-180", !open);
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
    // Itemised deliverables (shared by both modules).
    (pitch.deliverables || []).filter((d) => has(d.title)).forEach((d) => items.push(d.title));
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

  // =====================================================================
  // PUBLISHED PITCHES LEDGER (live client links)
  // =====================================================================
  const publishedList = document.getElementById("published-list");
  const publishedEmpty = document.getElementById("published-empty");

  function renderPublishedList() {
    if (!publishedList) return;
    const published = appState.pitches.filter((p) => p.published);

    if (!published.length) {
      publishedList.innerHTML = "";
      publishedEmpty.classList.remove("hidden");
      return;
    }
    publishedEmpty.classList.add("hidden");

    publishedList.innerHTML = published
      .map((p) => {
        const link = clientUrlFor(p);
        return `
        <div class="rounded-xl border border-surface-line bg-surface-raised p-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="font-display text-lg font-bold text-ink">${escapeHtml(p.title)}</p>
              <p class="text-sm text-ink-muted">${escapeHtml(p.client)} · ${escapeHtml(p.type)} · ${formatValue(p.value)}</p>
            </div>
            <span class="inline-flex items-center gap-2 text-xs font-semibold text-sage"><span class="h-2 w-2 rounded-full bg-sage"></span>Published</span>
          </div>
          <div class="mt-4 flex flex-wrap items-center gap-2">
            <input type="text" readonly value="${escapeHtml(link)}"
              class="focus-sage min-w-0 flex-1 rounded-lg border border-surface-line bg-surface px-3 py-2 font-mono text-xs text-ink-muted" />
            <button type="button" data-copy-link="${escapeHtml(link)}"
              class="focus-sage rounded-lg bg-terracotta px-3.5 py-2 text-xs font-semibold text-ink transition hover:bg-terracotta-hover">Copy link</button>
            <a href="${escapeHtml(link)}" target="_blank" rel="noopener"
              class="focus-sage rounded-lg border border-surface-line px-3.5 py-2 text-xs font-semibold text-ink transition hover:border-sage hover:text-sage">Open ↗</a>
          </div>
        </div>`;
      })
      .join("");
  }

  if (publishedList) {
    publishedList.addEventListener("click", async (e) => {
      const copyBtn = e.target.closest("[data-copy-link]");
      if (copyBtn) {
        await copyText(copyBtn.getAttribute("data-copy-link"));
        const prev = copyBtn.textContent;
        copyBtn.textContent = "Copied!";
        setTimeout(() => (copyBtn.textContent = prev), 1400);
      }
    });
  }

  // =====================================================================
  // CRM — CLIENT RELATIONSHIP MANAGEMENT
  // =====================================================================
  const clientForm = document.getElementById("client-form");
  const clientTable = document.getElementById("client-table");
  const clientEmpty = document.getElementById("client-empty");

  function renderClientTable() {
    if (!clientTable) return;
    if (!appState.clients.length) {
      clientTable.innerHTML = "";
      clientEmpty.classList.remove("hidden");
      return;
    }
    clientEmpty.classList.add("hidden");

    clientTable.innerHTML = appState.clients
      .map(
        (c) => `
        <div class="rounded-xl border border-surface-line bg-surface p-4">
          <div class="flex items-start justify-between gap-3">
            <p class="font-display text-base font-bold text-ink">${escapeHtml(c.business)}</p>
            <span class="font-mono text-xs uppercase tracking-wide text-ink-muted">Client</span>
          </div>
          <dl class="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div><dt class="font-mono text-xs uppercase tracking-wide text-ink-muted">Contact</dt><dd class="text-ink">${escapeHtml(c.contact || "—")}</dd></div>
            <div><dt class="font-mono text-xs uppercase tracking-wide text-ink-muted">Phone</dt><dd class="text-ink">${escapeHtml(c.phone || "—")}</dd></div>
            <div class="sm:col-span-2"><dt class="font-mono text-xs uppercase tracking-wide text-ink-muted">Email</dt><dd class="text-ink">${escapeHtml(c.email || "—")}</dd></div>
          </dl>
        </div>`
      )
      .join("");
  }

  if (clientForm) {
    clientForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(clientForm);
      const business = (fd.get("business") || "").toString().trim();
      if (!business) return;
      const client = {
        id: "c-" + Date.now(),
        business,
        contact: (fd.get("contact") || "").toString().trim(),
        email: (fd.get("email") || "").toString().trim(),
        phone: (fd.get("phone") || "").toString().trim(),
      };
      appState.clients.push(client);
      console.log("[crm] client added →", client);
      clientForm.reset();
      renderClientTable();
      refreshClientSelect(); // keep any open pitch form in sync
    });
  }

  // Resolve a pitch's client to a CRM id: explicit clientId, else match by business name.
  function resolveClientId(pitch) {
    if (!pitch) return "";
    if (pitch.clientId) return pitch.clientId;
    const match = appState.clients.find((c) => c.business === pitch.client);
    return match ? match.id : "";
  }

  // Build <option> markup for a client <select>, optionally pre-selected.
  function clientSelectOptions(selectedId) {
    const opts = ['<option value="">Select a client…</option>'];
    appState.clients.forEach((c) => {
      const sel = c.id === selectedId ? "selected" : "";
      opts.push(`<option value="${escapeHtml(c.id)}" ${sel}>${escapeHtml(c.business)}</option>`);
    });
    return opts.join("");
  }

  // Refresh a live pitch form's client dropdown after a CRM change.
  function refreshClientSelect() {
    const sel = document.querySelector("#pitch-form [data-client-select]");
    if (sel) {
      const current = sel.value;
      sel.innerHTML = clientSelectOptions(current);
    }
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

  // Itemised deliverables (title + description) shared rendering.
  function itemisedDeliverablesBlock(pitch) {
    const list = (pitch.deliverables || []).filter((d) => has(d.title) || has(d.description));
    if (!list.length) return "";
    return `
      <div class="mt-4 space-y-2">
        <p class="font-mono text-xs uppercase tracking-wide text-ink-muted">Itemised deliverables</p>
        ${list
          .map(
            (d) => `
          <div class="rounded-lg border border-surface-line bg-surface px-3 py-2">
            <p class="text-sm font-semibold text-ink">${escapeHtml(d.title || "Deliverable")}</p>
            ${has(d.description) ? `<p class="mt-0.5 text-xs text-ink-muted">${escapeHtml(d.description)}</p>` : ""}
          </div>`
          )
          .join("")}
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
      return `<p class="text-sm text-ink-muted">Assets due for <span class="text-ink">${escapeHtml(pitch.title)}</span>:</p>${rows}${itemisedDeliverablesBlock(pitch)}`;
    }
    // Retainer cycle mechanics
    const dur = has(pitch.blockDuration) ? pitch.blockDuration : "the contracted term";
    const freq = FREQ_PHRASE[pitch.deliverableFrequency] || "on the agreed cadence";
    const shoot = has(pitch.shootSchedule) ? pitch.shootSchedule.toLowerCase() : "scheduled";
    return `
      <p class="text-sm leading-relaxed text-ink">Contracted for <span class="font-semibold">${escapeHtml(dur)}</span> with deliverables made <span class="font-semibold">${escapeHtml(freq)}</span>, on a <span class="font-semibold">${escapeHtml(shoot)}</span> shoot schedule.</p>
      ${has(pitch.bulkDeliveryDate) ? `<p class="mt-2 text-sm text-ink-muted">Bulk delivery target date: <span class="text-ink">${escapeHtml(pitch.bulkDeliveryDate)}</span></p>` : ""}
      ${itemisedDeliverablesBlock(pitch)}`;
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
  // SYSTEM SETTINGS CONTROL PANEL
  // Cover-letter template generator + Google source status monitors.
  // =====================================================================
  const DEFAULT_TEMPLATE =
    "Dear [Client Name],\n\n" +
    "Thank you for the opportunity to present [Project Title]. " +
    "We're excited to bring our documentary-style craft to this [Pitch Type] engagement.\n\n" +
    "Our proposed investment for this body of work is [Project Price], covering the full scope outlined in the attached pitch deck.\n\n" +
    "We'd love to walk you through the details whenever suits.\n\n" +
    "Warm regards,\nLSC Creative";

  const SAMPLE_TOKENS = {
    "[Client Name]": "Northwind Films",
    "[Project Title]": "Behind the Lens",
    "[Project Price]": "$48,000",
    "[Pitch Type]": "Production",
  };

  function mergeTemplate(text, tokens) {
    return Object.keys(tokens).reduce(
      (acc, k) => acc.split(k).join(tokens[k]),
      text
    );
  }

  let settingsInitialized = false;
  function initSettingsPanel() {
    const templateArea = document.getElementById("cover-letter-template");
    const preview = document.getElementById("template-preview");
    const savedFlag = document.getElementById("template-saved");
    const saveBtn = document.getElementById("save-template-btn");
    const tokenPalette = document.getElementById("token-palette");

    if (templateArea && !templateArea.value) {
      templateArea.value = appState.coverLetterTemplate || DEFAULT_TEMPLATE;
    }
    const refreshPreview = () => {
      if (preview) preview.textContent = mergeTemplate(templateArea.value, SAMPLE_TOKENS);
    };
    refreshPreview();

    renderSourceMonitors();

    if (settingsInitialized) return; // bind events only once
    settingsInitialized = true;

    templateArea.addEventListener("input", refreshPreview);

    // Insert token at cursor when a palette chip is clicked.
    tokenPalette.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-token]");
      if (!chip) return;
      const token = chip.getAttribute("data-token");
      const start = templateArea.selectionStart ?? templateArea.value.length;
      const end = templateArea.selectionEnd ?? templateArea.value.length;
      templateArea.value = templateArea.value.slice(0, start) + token + templateArea.value.slice(end);
      const caret = start + token.length;
      templateArea.focus();
      templateArea.setSelectionRange(caret, caret);
      refreshPreview();
    });

    saveBtn.addEventListener("click", () => {
      appState.coverLetterTemplate = templateArea.value;
      console.log("[settings] cover letter template saved", appState.coverLetterTemplate.length, "chars");
      savedFlag.classList.remove("hidden");
      setTimeout(() => savedFlag.classList.add("hidden"), 1600);
    });

    document.getElementById("recheck-sources-btn").addEventListener("click", () => {
      console.log("[settings] re-checking Google source connections…");
      renderSourceMonitors(true);
    });
  }

  // Connection monitors verify the configured Google sources.
  function renderSourceMonitors(forceCheck) {
    const wrap = document.getElementById("source-monitors");
    if (!wrap) return;

    // A source is "connected" only when the backend endpoint is configured.
    const connected = !!GOOGLE_SCRIPT_URL;
    const sources = [
      { name: "Google Sheets — Dropdown values", detail: "Config tab (services / deliverables)" },
      { name: "Google Drive — Pitch JSON folder", detail: "Stores <id>.json configuration files" },
      { name: "Google Drive — Export folder", detail: "Generated invoices & assets" },
    ];

    wrap.innerHTML = sources
      .map((s) => {
        const ok = connected;
        const dot = ok ? "bg-sage" : "bg-orange-400";
        const label = ok ? "Connected" : "Not configured";
        const labelColor = ok ? "text-sage" : "text-orange-400";
        return `
          <div class="flex items-center justify-between gap-4 rounded-xl border border-surface-line bg-surface px-4 py-3">
            <div>
              <p class="text-sm font-medium text-ink">${escapeHtml(s.name)}</p>
              <p class="font-mono text-xs text-ink-muted">${escapeHtml(s.detail)}</p>
            </div>
            <span class="inline-flex items-center gap-2 text-xs font-semibold ${labelColor}">
              <span class="h-2 w-2 rounded-full ${dot}"></span>${label}
            </span>
          </div>`;
      })
      .join("");

    if (forceCheck) {
      console.log("[settings] source status:", connected ? "all connected" : "endpoint not set (GOOGLE_SCRIPT_URL empty)");
    }
  }

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
