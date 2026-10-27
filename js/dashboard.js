/* ============================================================================
   dashboard.js  —  The "Dashboard" tab: summary statistics at a glance.
   Charts are built from plain HTML/CSS (no chart library) so they work offline.
   A day filter lets you see the whole register, or just who attended one day.
   ========================================================================== */
(function () {
  "use strict";
  const NIDSG = (window.NIDSG = window.NIDSG || {});
  const ui = NIDSG.ui, db = NIDSG.db;
  const el = ui.el, icon = ui.icon;

  function fmtDay(iso) {
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d)) return iso;
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }
  function fmtDayShort(iso) {
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d)) return iso;
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  }

  // Count occurrences of a field, return sorted [{label,count}] with an "Other" bucket.
  function tally(people, field, topN) {
    const map = new Map();
    people.forEach(function (p) {
      const v = (p[field] || "").trim() || "(not recorded)";
      map.set(v, (map.get(v) || 0) + 1);
    });
    let arr = Array.from(map, function (e) { return { label: e[0], count: e[1] }; });
    arr.sort(function (a, b) { return b.count - a.count || a.label.localeCompare(b.label); });
    if (topN && arr.length > topN) {
      const head = arr.slice(0, topN);
      const rest = arr.slice(topN).reduce(function (s, x) { return s + x.count; }, 0);
      if (rest > 0) head.push({ label: "Other", count: rest });
      return head;
    }
    return arr;
  }

  function hbars(rows, opts) {
    opts = opts || {};
    const max = rows.reduce(function (m, r) { return Math.max(m, r.count); }, 0) || 1;
    if (!rows.length) return el("p.panel-note", { text: "No data yet." });
    return el("div.hbars", {}, rows.map(function (r) {
      const pct = Math.round((r.count / max) * 100);
      return el("div.hbar-row", {}, [
        el("div.hbar-label", { title: r.label, text: r.label }),
        el("div.hbar-track", {}, el("div.hbar-fill" + (opts.amber ? ".amber" : ""),
          { style: "width:" + Math.max(pct, 2) + "%" })),
        el("div.hbar-val.tnum", { text: String(r.count) })
      ]);
    }));
  }

  function render(root) {
    ui.clear(root);
    root.appendChild(el("div.view-head", {}, [
      el("h1.view-title", { text: "Dashboard" }),
      el("p.view-sub", { text: "A summary of your data at a glance. Use the filter to see everyone, or only the people who attended a particular day." })
    ]));

    const filterHost = el("div.today-banner");
    root.appendChild(filterHost);
    const body = el("div");
    root.appendChild(body);

    Promise.all([db.People.all(), db.Attendance.all()]).then(function (res) {
      const people = res[0];
      const attendance = res[1];
      const byId = new Map(people.map(function (p) { return [p.id, p]; }));

      // distinct event days, most recent first
      const days = Array.from(new Set(attendance.map(function (a) { return a.date; }))).sort().reverse();
      // attendance counts per day (chronological for the chart)
      const perDay = {};
      attendance.forEach(function (a) { perDay[a.date] = (perDay[a.date] || 0) + 1; });

      let filter = "all"; // or a date string

      // ---- Filter control ---------------------------------------------------
      const sel = el("select.select", { style: "min-height:44px;width:auto;max-width:260px" }, [
        el("option", { value: "all" }, "All registered people"),
      ].concat(days.map(function (d) {
        return el("option", { value: d }, "Attended: " + fmtDay(d));
      })));
      sel.addEventListener("change", function () { filter = sel.value; draw(); });
      ui.clear(filterHost);
      filterHost.appendChild(el("label.row", { style: "gap:8px" }, [
        el("span", { class: "icon", html: icon("chart", 20), style: "color:var(--ink-muted)" }),
        el("span", { style: "font-weight:640;color:var(--ink-2)" }, "Showing:"),
        sel
      ]));

      function scopePeople() {
        if (filter === "all") return people;
        const ids = new Set(attendance.filter(function (a) { return a.date === filter; })
          .map(function (a) { return a.personId; }));
        return people.filter(function (p) { return ids.has(p.id); });
      }

      function draw() {
        ui.clear(body);
        const scope = scopePeople();

        if (!people.length) {
          body.appendChild(el("div.card.pad", {}, el("div.empty", {}, [
            el("div", { html: icon("chart", 40) }),
            el("h3", { text: "Nothing to show yet" }),
            el("p", { text: "Add people and mark attendance, and your statistics will appear here automatically." })
          ])));
          return;
        }

        // ---- Stat tiles -----------------------------------------------------
        const everAttended = new Set(attendance.map(function (a) { return a.personId; })).size;
        const topState = tally(scope, "state", 1)[0];
        const presentLabel = filter === "all" ? "Attended (all days)" : "Present on this day";
        const presentValue = filter === "all" ? everAttended
          : (perDay[filter] || 0);

        body.appendChild(el("div.stat-grid", {}, [
          statTile("Registered people", people.length, filter === "all" ? "in the system" : "total in system"),
          statTile(presentLabel, presentValue, filter === "all"
            ? (people.length ? Math.round(everAttended / people.length * 100) + "% of register" : "")
            : fmtDay(filter), true),
          statTile("Event days held", days.length, days.length ? "most recent " + fmtDayShort(days[0]) : "none yet"),
          statTile("Most common state", topState ? topState.label : "—",
            topState ? topState.count + (topState.count === 1 ? " person" : " people") : "", false, true)
        ]));

        // ---- Gender split ---------------------------------------------------
        const g = { Female: 0, Male: 0, Unspecified: 0 };
        scope.forEach(function (p) {
          const v = p.gender === "Male" ? "Male" : p.gender === "Female" ? "Female" : "Unspecified";
          g[v]++;
        });
        const gTotal = scope.length || 1;
        const splitBar = el("div.split", {}, [
          seg("s-f", g.Female, gTotal, "Female"),
          seg("s-m", g.Male, gTotal, "Male"),
          seg("s-u", g.Unspecified, gTotal, "Unspecified")
        ]);
        body.appendChild(el("div.card.pad.panel", {}, [
          el("div.panel-head", {}, [
            el("h2.panel-title", { text: "Gender" }),
            el("span.panel-note", { text: scope.length + (scope.length === 1 ? " person" : " people") })
          ]),
          splitBar,
          el("div.legend", {}, [
            legend("var(--accent)", "Female", g.Female),
            legend("var(--amber)", "Male", g.Male),
            legend("var(--border-strong)", "Unspecified", g.Unspecified)
          ])
        ]));

        // ---- Top organisations & states ------------------------------------
        body.appendChild(el("div.card.pad.panel", {}, [
          el("div.panel-head", {}, [
            el("h2.panel-title", { text: "Organisations" }),
            el("span.panel-note", { text: "Most common first" })
          ]),
          hbars(tally(scope, "organisation", 8))
        ]));

        body.appendChild(el("div.card.pad.panel", {}, [
          el("div.panel-head", {}, [
            el("h2.panel-title", { text: "States" }),
            el("span.panel-note", { text: "Most common first" })
          ]),
          hbars(tally(scope, "state", 8), { amber: true })
        ]));

        // ---- Attendance over time (always all days) ------------------------
        if (days.length) {
          const chrono = days.slice().reverse();
          const maxD = chrono.reduce(function (m, d) { return Math.max(m, perDay[d]); }, 0) || 1;
          body.appendChild(el("div.card.pad.panel", {}, [
            el("div.panel-head", {}, [
              el("h2.panel-title", { text: "Attendance over time" }),
              el("span.panel-note", { text: "People present each day" })
            ]),
            el("div.tbars", {}, chrono.map(function (d) {
              const c = perDay[d];
              return el("div.tbar", {}, [
                el("div.cnt.tnum", { text: String(c) }),
                el("div.col", { style: "height:" + Math.max(Math.round(c / maxD * 100), 4) + "%",
                  title: fmtDay(d) + ": " + c }),
                el("div.cap", { text: fmtDayShort(d) })
              ]);
            }))
          ]));
        }
      }

      draw();
    });

    function statTile(label, num, sub, accent, wideText) {
      return el("div.stat" + (accent ? ".accent" : ""), {}, [
        el("div.label", { text: label }),
        el("div", { class: "num" + (wideText ? "" : " tnum"),
          text: String(num), style: wideText ? "font-size:22px" : "" }),
        sub ? el("div.sub", { text: sub }) : null
      ]);
    }
    function seg(cls, count, total, name) {
      const pct = count / total * 100;
      if (count === 0) return null;
      return el("div", { class: cls, style: "flex:" + count + " 1 0", title: name + ": " + count },
        pct > 9 ? String(count) : "");
    }
    function legend(color, name, count) {
      return el("span", {}, [
        el("span.swatch", { style: "background:" + color }),
        el("span", { text: name + " · " }),
        el("b.tnum", { text: String(count) })
      ]);
    }
  }

  NIDSG.views = NIDSG.views || {};
  NIDSG.views.dashboard = { render: render };
})();
