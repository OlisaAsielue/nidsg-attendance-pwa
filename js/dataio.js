/* ============================================================================
   dataio.js  —  The "Data" tab: back up & restore, import a spreadsheet (CSV),
   change the organisation name, and (carefully) clear all data.
   ========================================================================== */
(function () {
  "use strict";
  const NIDSG = (window.NIDSG = window.NIDSG || {});
  const ui = NIDSG.ui, db = NIDSG.db, cfg = NIDSG.config, S = NIDSG.search;
  const el = ui.el, icon = ui.icon;

  // ---- File download / read -------------------------------------------------
  function download(filename, text, type) {
    const blob = new Blob([text], { type: type || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = el("a", { href: url, download: filename, style: "display:none" });
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }
  function stamp() { return db.todayISO(); }

  // ---- CSV helpers ----------------------------------------------------------
  function csvCell(v) {
    v = v == null ? "" : String(v);
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function toCSV(headers, rows) {
    const lines = [headers.map(csvCell).join(",")];
    rows.forEach(function (r) { lines.push(r.map(csvCell).join(",")); });
    return lines.join("\r\n");
  }
  // Robust CSV parser (handles quotes, commas and newlines inside quotes).
  function parseCSV(text) {
    text = text.replace(/^﻿/, ""); // strip BOM
    const rows = []; let row = []; let field = ""; let i = 0; let inQ = false;
    while (i < text.length) {
      const c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"') { inQ = true; i++; continue; }
      if (c === ",") { row.push(field); field = ""; i++; continue; }
      if (c === "\r") { i++; continue; }
      if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
      field += c; i++;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return x.trim() !== ""; }); });
  }

  // ---- Normalisation for imports -------------------------------------------
  function normGender(v) {
    const s = (v || "").trim().toLowerCase();
    if (s === "m" || s === "male") return "Male";
    if (s === "f" || s === "female") return "Female";
    return "Unspecified";
  }
  const STATE_LOOKUP = (function () {
    const m = {};
    cfg.STATES.forEach(function (s) { m[S.normalise(s)] = s; });
    m[S.normalise("abuja")] = "FCT (Abuja)";
    m[S.normalise("fct")] = "FCT (Abuja)";
    m[S.normalise("akwaibom")] = "Akwa Ibom";
    m[S.normalise("crossriver")] = "Cross River";
    return m;
  })();
  function normState(v) {
    const key = S.normalise(v);
    if (!key) return "";
    return STATE_LOOKUP[key] || STATE_LOOKUP[key.replace(/\s+state$/, "")] || v.trim();
  }
  function dedupeKey(p) {
    return S.normalise(p.firstName) + "|" + S.normalise(p.surname) + "|" +
      (p.phone || "").replace(/\D/g, "");
  }

  const FIELD_DEFS = [
    { key: "title", label: "Title", guesses: ["title", "salutation"] },
    { key: "firstName", label: "First name", guesses: ["first", "firstname", "first name", "given", "forename"], required: true },
    { key: "surname", label: "Surname", guesses: ["surname", "last", "lastname", "last name", "family"], required: true },
    { key: "gender", label: "Gender", guesses: ["gender", "sex"] },
    { key: "phone", label: "Phone", guesses: ["phone", "mobile", "tel", "gsm", "number", "contact"] },
    { key: "email", label: "Email", guesses: ["email", "e-mail", "mail"] },
    { key: "organisation", label: "Organisation", guesses: ["organisation", "organization", "org", "body", "group", "company", "ministry", "agency", "institution"] },
    { key: "state", label: "State", guesses: ["state", "region"] },
    { key: "addressLine", label: "Address", guesses: ["address", "street", "town", "city", "location"] },
    { key: "notes", label: "Notes", guesses: ["notes", "note", "role", "comment", "remark"] }
  ];

  // ---- CSV import wizard ----------------------------------------------------
  function startCSVImport(afterImport) {
    const fileInput = el("input", { type: "file", accept: ".csv,text/csv", style: "display:none" });
    document.body.appendChild(fileInput);
    fileInput.addEventListener("change", function () {
      const f = fileInput.files[0];
      fileInput.remove();
      if (!f) return;
      const reader = new FileReader();
      reader.onload = function () {
        try {
          const rows = parseCSV(String(reader.result));
          if (rows.length < 2) { ui.toast("That file has no data rows.", "error"); return; }
          showMapping(rows[0], rows.slice(1), afterImport);
        } catch (e) {
          ui.toast("Could not read that file: " + e.message, "error");
        }
      };
      reader.onerror = function () { ui.toast("Could not read that file.", "error"); };
      reader.readAsText(f);
    });
    fileInput.click();
  }

  function guessColumn(headers, def) {
    for (let i = 0; i < headers.length; i++) {
      const h = S.normalise(headers[i]);
      for (let j = 0; j < def.guesses.length; j++) {
        if (h === S.normalise(def.guesses[j]) || h.indexOf(S.normalise(def.guesses[j])) !== -1) return i;
      }
    }
    return -1;
  }

  function showMapping(headers, dataRows, afterImport) {
    const mapping = {}; // fieldKey -> column index (or -1)
    FIELD_DEFS.forEach(function (d) { mapping[d.key] = guessColumn(headers, d); });

    const previewHost = el("div", { style: "margin-top:16px" });

    function buildRecord(cols) {
      const rec = {};
      FIELD_DEFS.forEach(function (d) {
        const idx = mapping[d.key];
        rec[d.key] = idx >= 0 ? (cols[idx] || "").trim() : "";
      });
      rec.gender = normGender(rec.gender);
      rec.state = normState(rec.state);
      return rec;
    }

    function refreshPreview() {
      db.People.all().then(function (existing) {
        const existingKeys = new Set(existing.map(dedupeKey));
        const records = dataRows.map(buildRecord);
        let valid = 0, dupes = 0, missing = 0;
        const seen = new Set();
        records.forEach(function (r) {
          if (!r.firstName || !r.surname) { missing++; return; }
          const k = dedupeKey(r);
          if (existingKeys.has(k) || seen.has(k)) { dupes++; return; }
          seen.add(k); valid++;
        });

        ui.clear(previewHost);
        previewHost.appendChild(el("div.callout", { style: "margin-bottom:12px" }, [
          el("span", { html: icon("info", 22) }),
          el("span", {}, [
            el("b", { text: valid + " new " + (valid === 1 ? "person" : "people") }),
            " will be imported. ",
            dupes ? (dupes + " already in the system (skipped). ") : "",
            missing ? (missing + " row(s) missing a name (skipped).") : ""
          ])
        ]));

        // small preview table of first rows
        const show = records.slice(0, 6);
        previewHost.appendChild(el("div.table-wrap", {}, el("table.data", {}, [
          el("thead", {}, el("tr", {}, ["First name", "Surname", "Gender", "Phone", "Organisation", "State"]
            .map(function (h) { return el("th", { text: h }); }))),
          el("tbody", {}, show.map(function (r) {
            return el("tr", {}, [r.firstName, r.surname, r.gender, r.phone, r.organisation, r.state]
              .map(function (v) { return el("td", { text: v || "—" }); }));
          }))
        ])));

        importBtn.disabled = valid === 0;
        importBtn.dataset.count = valid;
      });
    }

    const mapControls = el("div.grid-2", {}, FIELD_DEFS.map(function (d) {
      const s = el("select.select", {}, [el("option", { value: "-1" }, "— none —")].concat(
        headers.map(function (h, i) {
          return el("option", { value: String(i), selected: mapping[d.key] === i }, h || ("Column " + (i + 1)));
        })));
      s.addEventListener("change", function () { mapping[d.key] = parseInt(s.value, 10); refreshPreview(); });
      return el("div.field", {}, [
        el("label", {}, [d.label, d.required ? el("span.req", {}, " *") : null]),
        s
      ]);
    }));

    const importBtn = el("button.btn.primary", { type: "button" },
      [el("span", { html: icon("upload", 20) }), "Import"]);
    importBtn.addEventListener("click", function () {
      db.People.all().then(function (existing) {
        const existingKeys = new Set(existing.map(dedupeKey));
        const seen = new Set();
        const toAdd = [];
        dataRows.map(buildRecord).forEach(function (r) {
          if (!r.firstName || !r.surname) return;
          const k = dedupeKey(r);
          if (existingKeys.has(k) || seen.has(k)) return;
          seen.add(k); toAdd.push(r);
        });
        if (!toAdd.length) { ui.toast("Nothing new to import.", "error"); return; }
        db.People.bulkAdd(toAdd).then(function () {
          ui.closeModal();
          ui.toast(toAdd.length + " " + (toAdd.length === 1 ? "person" : "people") + " imported");
          if (afterImport) afterImport();
        }).catch(function (e) { ui.toast("Import failed: " + e.message, "error"); });
      });
    });

    ui.modal({
      title: "Import from spreadsheet",
      wide: true,
      content: [
        el("p.view-sub", { style: "margin-bottom:14px" },
          "Match each column in your file to the right field. We filled in our best guesses — please check them. Rows without a first name and surname are skipped, and anyone already in the system is skipped."),
        mapControls,
        previewHost
      ],
      footer: [
        el("button.btn.ghost", { type: "button", text: "Cancel", onclick: ui.closeModal }),
        importBtn
      ]
    });
    refreshPreview();
  }

  // ---- Backup / restore -----------------------------------------------------
  function backupNow() {
    db.exportAll().then(function (data) {
      download("nidsg-backup-" + stamp() + ".json", JSON.stringify(data, null, 2), "application/json");
      db.Meta.set("lastBackup", new Date().toISOString());
      ui.toast("Backup saved to your device");
      if (NIDSG.app && NIDSG.app.refreshBackupPill) NIDSG.app.refreshBackupPill();
    });
  }
  function exportPeopleCSV() {
    db.People.all().then(function (people) {
      const headers = ["Title", "First name", "Surname", "Gender", "Phone", "Email", "Organisation", "State", "Address", "Notes"];
      const rows = people.map(function (p) {
        return [p.title, p.firstName, p.surname, p.gender, p.phone, p.email, p.organisation, p.state, p.addressLine, p.notes];
      });
      download("nidsg-people-" + stamp() + ".csv", toCSV(headers, rows), "text/csv;charset=utf-8");
      ui.toast("People list exported");
    });
  }
  function exportAttendanceCSV() {
    Promise.all([db.People.all(), db.Attendance.all()]).then(function (r) {
      const byId = new Map(r[0].map(function (p) { return [p.id, p]; }));
      const recs = r[1].slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
      const headers = ["Date", "First name", "Surname", "Organisation", "State", "Phone"];
      const rows = recs.map(function (a) {
        const p = byId.get(a.personId) || {};
        return [a.date, p.firstName, p.surname, p.organisation, p.state, p.phone];
      });
      if (!rows.length) { ui.toast("No attendance recorded yet.", "error"); return; }
      download("nidsg-attendance-" + stamp() + ".csv", toCSV(headers, rows), "text/csv;charset=utf-8");
      ui.toast("Attendance exported");
    });
  }
  function restoreBackup(afterImport) {
    const fileInput = el("input", { type: "file", accept: ".json,application/json", style: "display:none" });
    document.body.appendChild(fileInput);
    fileInput.addEventListener("change", function () {
      const f = fileInput.files[0]; fileInput.remove();
      if (!f) return;
      const reader = new FileReader();
      reader.onload = function () {
        let data;
        try { data = JSON.parse(String(reader.result)); }
        catch (e) { ui.toast("That is not a valid backup file.", "error"); return; }
        if (!data || !Array.isArray(data.people)) { ui.toast("That backup file looks wrong.", "error"); return; }
        ui.confirm({
          title: "Restore this backup?",
          message: "This will add " + data.people.length + " people and " +
            (data.attendance ? data.attendance.length : 0) + " attendance records, merging with what you already have.",
          confirmText: "Restore"
        }).then(function (yes) {
          if (!yes) return;
          db.importAll(data, "merge").then(function (n) {
            ui.toast("Restored " + n.people + " people");
            if (afterImport) afterImport();
          }).catch(function (e) { ui.toast("Restore failed: " + e.message, "error"); });
        });
      };
      reader.readAsText(f);
    });
    fileInput.click();
  }

  // ---- Render tab -----------------------------------------------------------
  function render(root) {
    ui.clear(root);
    root.appendChild(el("div.view-head", {}, [
      el("h1.view-title", { text: "Data" }),
      el("p.view-sub", { text: "Back up your data, bring in a list from a spreadsheet, and manage settings. Everything stays on this device — please back up regularly." })
    ]));

    const reload = function () {
      if (NIDSG.app && NIDSG.app.refreshBackupPill) NIDSG.app.refreshBackupPill();
    };

    // Backup card
    root.appendChild(el("div.card.pad.panel", {}, [
      el("h2.panel-title", { style: "margin-bottom:6px", text: "Backup & restore" }),
      el("p.view-sub", { style: "margin-bottom:14px" },
        "A backup is a single file saved to this device. Keep a copy somewhere safe (email it to yourself, or save to a cloud drive)."),
      el("div.row", {}, [
        actionBtn("primary", "download", "Save a backup", backupNow),
        actionBtn("", "upload", "Restore a backup", function () { restoreBackup(reload); })
      ]),
      el("div.row", { style: "margin-top:10px" }, [
        actionBtn("ghost", "download", "Export people (CSV)", exportPeopleCSV),
        actionBtn("ghost", "download", "Export attendance (CSV)", exportAttendanceCSV)
      ])
    ]));

    // Import card
    root.appendChild(el("div.card.pad.panel", {}, [
      el("h2.panel-title", { style: "margin-bottom:6px", text: "Import a list" }),
      el("p.view-sub", { style: "margin-bottom:14px" },
        "Bring in people from a spreadsheet. Save your Excel or Google Sheet as a CSV file first (File → Save As / Download → CSV), then choose it here. You'll match up the columns before anything is added."),
      el("div.steps", {}, [
        step(1, "In Excel or Google Sheets, save/download your list as a .csv file."),
        step(2, "Tap “Choose a CSV file” and pick it."),
        step(3, "Check the column matching, review the preview, then Import.")
      ]),
      el("div.row", { style: "margin-top:8px" }, [
        actionBtn("primary", "upload", "Choose a CSV file", function () { startCSVImport(reload); })
      ])
    ]));

    // Settings card
    const orgInput = el("input.input", { type: "text", placeholder: cfg.DEFAULT_ORG_NAME, style: "max-width:320px" });
    db.Meta.get("orgName", "").then(function (v) { orgInput.value = v || ""; });
    root.appendChild(el("div.card.pad.panel", {}, [
      el("h2.panel-title", { style: "margin-bottom:6px", text: "Settings" }),
      el("div.field", { style: "margin-top:8px" }, [
        el("label", {}, "Organisation name (shown at the top)"),
        el("span.hint", {}, "Leave blank to use the default."),
        orgInput
      ]),
      actionBtn("", "check", "Save name", function () {
        db.Meta.set("orgName", orgInput.value.trim()).then(function () {
          ui.toast("Saved");
          if (NIDSG.app && NIDSG.app.applyBranding) NIDSG.app.applyBranding();
        });
      })
    ]));

    // Danger zone
    root.appendChild(el("div.card.pad.panel", { style: "border-color:var(--danger)" }, [
      el("h2.panel-title", { style: "margin-bottom:6px;color:var(--danger)", text: "Danger zone" }),
      el("p.view-sub", { style: "margin-bottom:14px" },
        "Permanently delete everyone and all attendance records from this device. Save a backup first — this cannot be undone."),
      actionBtn("danger", "trash", "Delete all data", function () {
        ui.confirm({
          title: "Delete ALL data?",
          message: "This removes every person and all attendance history from this device permanently. There is no undo. Have you saved a backup?",
          confirmText: "Yes, delete everything", danger: true
        }).then(function (yes) {
          if (!yes) return;
          db.clearAll().then(function () { ui.toast("All data deleted"); reload(); });
        });
      })
    ]));

    function actionBtn(kind, ic, label, fn) {
      return el("button.btn" + (kind ? "." + kind : ""), { type: "button", onclick: fn },
        [el("span", { html: icon(ic, 20) }), label]);
    }
    function step(n, t) {
      return el("div.step", {}, [el("div.n", { text: String(n) }), el("div.t", { text: t })]);
    }
  }

  NIDSG.dataio = { backupNow: backupNow, restoreBackup: restoreBackup, startCSVImport: startCSVImport };
  NIDSG.views = NIDSG.views || {};
  NIDSG.views.data = { render: render };
})();
