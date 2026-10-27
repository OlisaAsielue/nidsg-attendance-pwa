/* ============================================================================
   fulllist.js  —  The "Full List" tab: the entire register in one spreadsheet-
   style table, every column visible at once. Sort by any column, filter by name,
   tap a row to view/edit. Good for a laptop overview; scrolls on a tablet.
   ========================================================================== */
(function () {
  "use strict";
  const NIDSG = (window.NIDSG = window.NIDSG || {});
  const ui = NIDSG.ui, db = NIDSG.db;
  const el = ui.el, icon = ui.icon;
  const P = function () { return NIDSG.people; };

  // Columns: key used for sorting, header label, and how to render the cell.
  const COLS = [
    { key: "name", label: "Name", get: function (p) { return P().fullName(p); },
      cell: function (p) { return el("span.cell-name", { text: P().fullName(p) }); },
      sort: function (p) { return (p.surname || "") + " " + (p.firstName || ""); } },
    { key: "gender", label: "Gender", get: function (p) { return p.gender || ""; } },
    { key: "phone", label: "Phone", get: function (p) { return p.phone || ""; } },
    { key: "email", label: "Email", get: function (p) { return p.email || ""; } },
    { key: "organisation", label: "Organisation", get: function (p) { return p.organisation || ""; } },
    { key: "state", label: "State", get: function (p) { return p.state || ""; } },
    { key: "addressLine", label: "Address", get: function (p) { return p.addressLine || ""; } },
    { key: "notes", label: "Notes", get: function (p) { return p.notes || ""; } },
    { key: "daysAttended", label: "Days attended", num: true,
      get: function (p) { return String(p._days || 0); },
      sort: function (p) { return p._days || 0; } }
  ];

  function render(root) {
    ui.clear(root);
    let sortKey = "name";
    let sortDir = 1; // 1 asc, -1 desc
    let filter = "";

    root.appendChild(el("div.view-head", {}, [
      el("div.spread", {}, [
        el("div", {}, [
          el("h1.view-title", { text: "Full List" }),
          el("p.view-sub", { text: "The whole register in one table — every detail at a glance. Tap any column heading to sort, or tap a row to view and edit that person." })
        ]),
        el("div.row", {}, [
          el("button.btn.ghost", { type: "button", onclick: function () {
            if (NIDSG.dataio) NIDSG.dataio.exportPeopleCSV ? NIDSG.dataio.exportPeopleCSV() : null;
          } }, [el("span", { html: icon("download", 20) }), "Export CSV"]),
          el("button.btn.primary", { type: "button", onclick: function () {
            P().personForm(null, function () { render(root); });
          } }, [el("span", { html: icon("plus", 20) }), "Add person"])
        ])
      ])
    ]));

    const searchWrap = el("div.searchbox", { style: "margin-bottom:14px" }, [
      el("span.icon.search-ic", { html: icon("search", 24) }),
      el("input", { type: "search", placeholder: "Filter the list by name…", "aria-label": "Filter list" })
    ]);
    const filterInput = searchWrap.querySelector("input");
    root.appendChild(searchWrap);

    const countLine = el("p.panel-note", { style: "margin-bottom:10px" });
    root.appendChild(countLine);

    const host = el("div");
    root.appendChild(host);

    Promise.all([db.People.all(), db.Attendance.all()]).then(function (res) {
      const people = res[0];
      const attendance = res[1];
      // days attended per person (each attendance record is one day)
      const dayCount = {};
      attendance.forEach(function (a) { dayCount[a.personId] = (dayCount[a.personId] || 0) + 1; });
      people.forEach(function (p) { p._days = dayCount[p.id] || 0; });

      function draw() {
        ui.clear(host);

        if (!people.length) {
          countLine.textContent = "";
          host.appendChild(el("div.card.pad", {}, el("div.empty", {}, [
            el("div", { html: icon("table", 40) }),
            el("h3", { text: "The register is empty" }),
            el("p", { text: "Add people with the button above, or import a spreadsheet from the Data tab." })
          ])));
          return;
        }

        let list = people.slice();
        if (filter) {
          list = NIDSG.search.search(people, filter).map(function (r) { return r.person; });
        } else {
          const col = COLS.filter(function (c) { return c.key === sortKey; })[0] || COLS[0];
          const keyFn = col.sort || col.get;
          list.sort(function (a, b) {
            const va = keyFn(a), vb = keyFn(b);
            if (typeof va === "number" && typeof vb === "number") return (va - vb) * sortDir;
            return String(va).localeCompare(String(vb)) * sortDir;
          });
        }

        countLine.textContent = list.length + (list.length === 1 ? " person" : " people") +
          (filter ? " found" : " in the register");

        const headRow = el("tr", {}, COLS.map(function (c) {
          const sorted = !filter && sortKey === c.key;
          const th = el("th.sortable" + (sorted ? ".sorted" : "") + (sorted && sortDir === -1 ? ".desc" : ""),
            { scope: "col", title: "Sort by " + c.label },
            el("span.th-in", {}, [
              c.label,
              el("span", { class: "icon sort-ind", html: icon("sortArrow", 14) })
            ]));
          th.addEventListener("click", function () {
            if (filter) { filterInput.value = ""; filter = ""; }
            if (sortKey === c.key) sortDir = -sortDir; else { sortKey = c.key; sortDir = 1; }
            draw();
          });
          return th;
        }));

        const bodyRows = list.map(function (p) {
          const tr = el("tr", {}, COLS.map(function (c) {
            if (c.cell) return el("td", {}, c.cell(p));
            const v = c.get(p);
            return el("td" + (c.num ? ".num-col" : ""), { text: v || "—" });
          }));
          tr.addEventListener("click", function () {
            P().personDetail(p, { onChange: function () { render(root); } });
          });
          return tr;
        });

        host.appendChild(el("div.table-scroll", {}, el("table.data", {}, [
          el("thead", {}, headRow),
          el("tbody", {}, bodyRows)
        ])));
      }

      let deb;
      filterInput.addEventListener("input", function () {
        clearTimeout(deb);
        deb = setTimeout(function () { filter = filterInput.value.trim(); draw(); }, 120);
      });
      draw();
    });
  }

  NIDSG.views = NIDSG.views || {};
  NIDSG.views.fulllist = { render: render };
})();
