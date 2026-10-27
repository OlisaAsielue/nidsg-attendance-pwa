/* ============================================================================
   attendance.js  —  The "Event Day" tab. The main screen used on the day:
   pick the day, search a name, confirm the right person, mark them present.
   Keeps a dated record so history is never lost.
   ========================================================================== */
(function () {
  "use strict";
  const NIDSG = (window.NIDSG = window.NIDSG || {});
  const ui = NIDSG.ui, db = NIDSG.db;
  const el = ui.el, icon = ui.icon;
  const P = function () { return NIDSG.people; };

  function fmtDate(iso) {
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d)) return iso;
    return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }

  function render(root) {
    ui.clear(root);
    let selectedDate = db.todayISO();
    let people = [];
    let markedIds = new Set();   // personIds marked present on selectedDate

    // ---- Structure ----------------------------------------------------------
    root.appendChild(el("div.view-head", {}, [
      el("h1.view-title", { text: "Event Day" }),
      el("p.view-sub", { text: "Find a person, check it is the right one, then mark them present. Do this for each person as they arrive." })
    ]));

    const dateInput = el("input.input", { type: "date", value: selectedDate, style: "max-width:200px" });
    const countHost = el("span.today-count");
    const banner = el("div.today-banner", {}, [
      el("label.row", { style: "gap:8px" }, [
        el("span", { class: "icon", html: icon("calendar", 20), style: "color:var(--ink-muted)" }),
        el("span", { style: "font-weight:640;color:var(--ink-2)" }, "Event day:"),
        dateInput
      ]),
      el("span.appbar-spacer"),
      countHost
    ]);
    root.appendChild(banner);

    const searchWrap = el("div.searchbox", {}, [
      el("span.icon.search-ic", { html: icon("search", 24) }),
      el("input", { type: "search", placeholder: "Type a first name or surname…",
        autocomplete: "off", autocapitalize: "words", "aria-label": "Search for a person" }),
      el("button.clear-ic", { type: "button", "aria-label": "Clear", html: icon("x", 22),
        style: "display:none" })
    ]);
    const searchInput = searchWrap.querySelector("input");
    const clearBtn = searchWrap.querySelector(".clear-ic");
    root.appendChild(searchWrap);

    const results = el("div", { style: "margin-top:16px" });
    root.appendChild(results);

    // ---- Data helpers -------------------------------------------------------
    function refreshMarked() {
      return db.Attendance.forDate(selectedDate).then(function (recs) {
        markedIds = new Set(recs.map(function (r) { return r.personId; }));
        renderCount();
      });
    }
    function renderCount() {
      ui.clear(countHost);
      countHost.appendChild(el("b", { text: String(markedIds.size) }));
      countHost.appendChild(el("span", { text: markedIds.size === 1 ? "marked present" : "marked present" }));
    }

    // ---- Confirm & mark -----------------------------------------------------
    function openConfirm(person) {
      const already = markedIds.has(person.id);
      const rows = [
        ["Title", person.title], ["Gender", person.gender],
        ["Phone", person.phone], ["Organisation", person.organisation],
        ["State", person.state], ["Address", person.addressLine],
        ["Email", person.email], ["Notes", person.notes]
      ].filter(function (r) { return r[1]; });

      const content = el("div.confirm-card", {}, [
        el("p.view-sub", { style: "margin-bottom:14px",
          text: "Check this is the correct person before marking." }),
        el("div.confirm-top", {}, [
          el("div.avatar.lg", { text: P().initials(person) }),
          el("div", {}, [
            el("div.confirm-name", { text: P().fullName(person) }),
            already ? el("span.chip.present", { style: "margin-top:6px" },
              [el("span", { html: icon("check", 15) }), "Already present on this day"]) : null
          ])
        ]),
        el("div.detail-grid", {}, rows.map(function (r) {
          return el("div.detail", {}, [el("div.k", { text: r[0] }), el("div.v", { text: r[1] })]);
        }))
      ]);

      const primary = already
        ? el("button.btn.danger.big.block", { type: "button" },
            [el("span", { html: icon("undo", 22) }), "Undo — mark as NOT present"])
        : el("button.btn.primary.big.block", { type: "button" },
            [el("span", { html: icon("check", 22) }), "Mark present"]);

      primary.addEventListener("click", function () {
        const action = already
          ? db.Attendance.unmark(person.id, selectedDate)
          : db.Attendance.mark(person.id, selectedDate);
        action.then(function () {
          return refreshMarked();
        }).then(function () {
          ui.closeModal();
          ui.toast(already ? "Undone — " + P().fullName(person) + " is not marked"
                           : P().fullName(person) + " marked present ✓");
          runSearch();
        });
      });

      ui.modal({
        title: "Confirm attendance",
        content: content,
        footer: [
          el("button.btn.ghost", { type: "button", text: "Back", onclick: ui.closeModal }),
          primary
        ]
      });
    }

    // ---- Candidate row ------------------------------------------------------
    function candidateRow(person) {
      const marked = markedIds.has(person.id);
      const row = el("button.person-row", { type: "button" }, [
        el("div.avatar", { text: P().initials(person) }),
        el("div.person-main", {}, [
          el("div.person-name", { text: P().fullName(person) }),
          el("div.person-meta", {}, [
            person.organisation ? el("span", {}, [el("span", { html: icon("building", 14) }), person.organisation]) : null,
            person.state ? el("span", {}, [el("span", { html: icon("pin", 14) }), person.state]) : null,
            person.phone ? el("span", {}, [el("span", { html: icon("phone", 14) }), person.phone]) : null
          ])
        ]),
        el("div.row-tail", {}, [
          marked
            ? el("span.chip.present", {}, [el("span", { html: icon("check", 15) }), "Present"])
            : el("span.chip.notyet", {}, "Not yet")
        ])
      ]);
      row.addEventListener("click", function () { openConfirm(person); });
      return row;
    }

    // ---- Search -------------------------------------------------------------
    function runSearch() {
      const q = searchInput.value.trim();
      clearBtn.style.display = q ? "grid" : "none";
      ui.clear(results);

      if (!q) {
        renderMarkedTodayList();
        return;
      }
      const matches = NIDSG.search.search(people, q, 25).map(function (r) { return r.person; });
      if (!matches.length) {
        results.appendChild(el("div.card.pad", {}, el("div.empty", {}, [
          el("div", { html: icon("search", 40) }),
          el("h3", { text: "No match found" }),
          el("p", { text: "Try fewer letters, or a different spelling. Names can be spelled several ways." }),
          el("button.btn.primary", { type: "button", style: "margin-top:14px", onclick: function () {
            P().personForm({ firstName: q }, function (saved) {
              loadPeople().then(function () { searchInput.value = ""; runSearch(); openConfirm(saved); });
            });
          } }, [el("span", { html: icon("plus", 20) }), "Add as a new person"])
        ])));
        return;
      }
      results.appendChild(el("p.panel-note", { style: "margin-bottom:10px",
        text: matches.length + (matches.length === 1 ? " match" : " matches") + " — tap the correct person" }));
      if (matches.length > 1) {
        results.appendChild(el("div.callout", { style: "margin-bottom:12px" }, [
          el("span", { html: icon("info", 22) }),
          el("span", {}, "Several people match. Check the organisation, state and phone number to pick the right one.")
        ]));
      }
      results.appendChild(el("div.result-list", {}, matches.map(candidateRow)));
    }

    function renderMarkedTodayList() {
      const marked = people.filter(function (p) { return markedIds.has(p.id); });
      if (!people.length) {
        results.appendChild(el("div.card.pad", {}, el("div.empty", {}, [
          el("div", { html: icon("people", 40) }),
          el("h3", { text: "No one in the system yet" }),
          el("p", { text: "Go to the Register tab to add people, or the Data tab to import a spreadsheet." })
        ])));
        return;
      }
      if (!marked.length) {
        results.appendChild(el("div.callout", {}, [
          el("span", { html: icon("info", 22) }),
          el("span", {}, "Start typing a name above to mark someone present. People you mark for " +
            fmtDate(selectedDate) + " will appear here.")
        ]));
        return;
      }
      marked.sort(function (a, b) { return P().fullName(a).localeCompare(P().fullName(b)); });
      results.appendChild(el("div.spread", { style: "margin-bottom:10px" }, [
        el("h2.panel-title", { text: "Marked present on " + fmtDate(selectedDate) }),
        el("span.panel-note", { text: marked.length + " total" })
      ]));
      results.appendChild(el("div.result-list", {}, marked.map(candidateRow)));
    }

    // ---- Wire up ------------------------------------------------------------
    let deb;
    searchInput.addEventListener("input", function () {
      clearTimeout(deb); deb = setTimeout(runSearch, 120);
    });
    clearBtn.addEventListener("click", function () {
      searchInput.value = ""; searchInput.focus(); runSearch();
    });
    dateInput.addEventListener("change", function () {
      selectedDate = dateInput.value || db.todayISO();
      refreshMarked().then(runSearch);
    });

    function loadPeople() {
      return db.People.all().then(function (list) { people = list; });
    }

    loadPeople()
      .then(refreshMarked)
      .then(function () { runSearch(); setTimeout(function () { searchInput.focus(); }, 50); });
  }

  NIDSG.views = NIDSG.views || {};
  NIDSG.views.eventday = { render: render };
})();
