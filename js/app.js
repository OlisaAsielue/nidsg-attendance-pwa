/* ============================================================================
   app.js  —  Starts the app: builds the header and tabs, switches screens,
   handles the light/dark theme, the backup reminder, and first-run help.
   Loaded last, after all the other scripts.
   ========================================================================== */
(function () {
  "use strict";
  const NIDSG = (window.NIDSG = window.NIDSG || {});
  const ui = NIDSG.ui, db = NIDSG.db, cfg = NIDSG.config;
  const el = ui.el, icon = ui.icon;

  const TABS = [
    { key: "eventday", label: "Event Day", icon: "calendar" },
    { key: "register", label: "Register", icon: "people" },
    { key: "fulllist", label: "Full List", icon: "table" },
    { key: "dashboard", label: "Dashboard", icon: "chart" },
    { key: "data", label: "Data", icon: "database" }
  ];
  let current = "eventday";
  let brandNameEl, brandMarkEl, backupPillEl, view, tabBar;

  // ---- Theme ---------------------------------------------------------------
  function currentTheme() { return localStorage.getItem("nidsg-theme") || "system"; }
  function applyTheme() {
    const t = currentTheme();
    const rootEl = document.documentElement;
    if (t === "system") rootEl.removeAttribute("data-theme");
    else rootEl.setAttribute("data-theme", t);
  }
  function toggleTheme() {
    // Cycle: system -> dark -> light -> system
    const order = { system: "dark", dark: "light", light: "system" };
    localStorage.setItem("nidsg-theme", order[currentTheme()]);
    applyTheme();
    updateThemeBtn();
  }
  let themeBtn;
  function updateThemeBtn() {
    const t = currentTheme();
    const ic = t === "light" ? "sun" : t === "dark" ? "moon" : "sun";
    themeBtn.innerHTML = icon(ic, 22);
    themeBtn.setAttribute("aria-label", "Theme: " + t + " (tap to change)");
    themeBtn.title = "Theme: " + t;
  }

  // ---- Branding ------------------------------------------------------------
  function applyBranding() {
    db.Meta.get("orgName", "").then(function (name) {
      const shown = name || cfg.DEFAULT_ORG_NAME;
      brandNameEl.textContent = shown;
      const letters = shown.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "N";
      brandMarkEl.textContent = letters;
      document.title = shown + " — " + cfg.DEFAULT_ORG_TAGLINE;
    });
  }

  // ---- Backup reminder pill ------------------------------------------------
  function refreshBackupPill() {
    Promise.all([db.People.all(), db.Meta.get("lastBackup", null)]).then(function (r) {
      const count = r[0].length;
      const last = r[1] ? new Date(r[1]) : null;
      const days = last ? (Date.now() - last.getTime()) / 86400000 : Infinity;
      ui.clear(backupPillEl);
      backupPillEl.classList.remove("warn");
      if (count === 0) {
        backupPillEl.appendChild(el("span", { html: icon("database", 16) }));
        backupPillEl.appendChild(el("span", { text: "No data yet" }));
        return;
      }
      if (days > cfg.BACKUP_REMINDER_DAYS) {
        backupPillEl.classList.add("warn");
        backupPillEl.appendChild(el("span", { html: icon("warning", 16) }));
        backupPillEl.appendChild(el("span", { text: last ? "Back up now" : "Not backed up" }));
      } else {
        backupPillEl.appendChild(el("span", { html: icon("check", 16) }));
        backupPillEl.appendChild(el("span", { text: "Backed up" }));
      }
    });
  }

  // ---- Navigation ----------------------------------------------------------
  function go(key) {
    current = key;
    tabBar.querySelectorAll(".tab").forEach(function (t) {
      t.classList.toggle("active", t.dataset.key === key);
      t.setAttribute("aria-current", t.dataset.key === key ? "page" : "false");
    });
    window.scrollTo(0, 0);
    const v = NIDSG.views[key];
    if (v) v.render(view);
    refreshBackupPill();
  }

  // ---- First-run help ------------------------------------------------------
  function maybeShowIntro() {
    db.Meta.get("seenIntro", false).then(function (seen) {
      if (seen) return;
      ui.modal({
        title: "Welcome",
        dismissable: false,
        content: [
          el("p.confirm-text", { style: "margin-bottom:14px" },
            "This app keeps your list of people and marks who attends on each day. Everything is saved on this device only."),
          el("div.steps", {}, [
            introStep("calendar", "Event Day", "On the day, search a name and mark people present. It keeps a record for every day."),
            introStep("people", "Register", "Add and edit people, or import a list on the Data tab."),
            introStep("table", "Full List", "See the whole register as one table, every detail at a glance."),
            introStep("chart", "Dashboard", "See totals and breakdowns (gender, organisation, state) at a glance."),
            introStep("database", "Data", "Save backups regularly and import spreadsheets here.")
          ]),
          el("div.callout.amber", { style: "margin-top:14px" }, [
            el("span", { html: icon("warning", 22) }),
            el("span", {}, "Important: because data is stored only on this device, save a backup often from the Data tab.")
          ])
        ],
        footer: [
          el("button.btn.primary.block", { type: "button", text: "Get started", onclick: function () {
            db.Meta.set("seenIntro", true); ui.closeModal();
          } })
        ]
      });
    });
  }
  function introStep(ic, title, text) {
    return el("div.step", {}, [
      el("div.n", { html: icon(ic, 16) }),
      el("div.t", {}, [el("b", { text: title + " — " }), text])
    ]);
  }

  // ---- Build shell ---------------------------------------------------------
  function build() {
    brandMarkEl = el("div.brand-mark", { text: "N" });
    brandNameEl = el("div.brand-name", { text: cfg.DEFAULT_ORG_NAME });
    backupPillEl = el("button.backup-pill", { type: "button", onclick: function () { go("data"); } });
    themeBtn = el("button.icon-btn", { type: "button" });
    themeBtn.addEventListener("click", toggleTheme);

    const appbar = el("header.appbar", {}, el("div.appbar-inner", {}, [
      el("div.brand", {}, [
        brandMarkEl,
        el("div.brand-text", {}, [
          brandNameEl,
          el("div.brand-tag", { text: cfg.DEFAULT_ORG_TAGLINE })
        ])
      ]),
      el("span.appbar-spacer"),
      backupPillEl,
      themeBtn
    ]));

    tabBar = el("nav.tabs", { "aria-label": "Sections" }, el("div.tabs-inner", {},
      TABS.map(function (t) {
        const b = el("button.tab", { type: "button", dataset: { key: t.key }, "aria-current": "false" }, [
          el("span", { class: "icon", html: icon(t.icon, 24) }),
          el("span.tab-label", { text: t.label })
        ]);
        b.addEventListener("click", function () { go(t.key); });
        return b;
      })));

    view = el("main", { id: "view" });

    document.body.appendChild(appbar);
    document.body.appendChild(tabBar);
    document.body.appendChild(view);
  }

  // ---- Boot ----------------------------------------------------------------
  function boot() {
    applyTheme();
    build();
    updateThemeBtn();
    db.open().then(function () {
      applyBranding();
      go("eventday");
      maybeShowIntro();
    }).catch(function (e) {
      view.appendChild(el("div.card.pad", { style: "margin-top:20px" }, el("div.empty", {}, [
        el("div", { html: icon("warning", 40) }),
        el("h3", { text: "Storage is not available" }),
        el("p", {}, "This browser is blocking on-device storage (this can happen in Private/Incognito mode). Please open the app in a normal browser window and try again."),
        el("p", { style: "margin-top:8px;font-size:13px", text: String(e && e.message || e) })
      ])));
    });

    // Register service worker for offline use (only works over http/https, not file://).
    if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
      navigator.serviceWorker.register("sw.js").catch(function () { /* offline install just won't be available */ });
    }
  }

  NIDSG.app = { go: go, applyBranding: applyBranding, refreshBackupPill: refreshBackupPill };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
