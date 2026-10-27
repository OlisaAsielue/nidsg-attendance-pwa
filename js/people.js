/* ============================================================================
   people.js  —  The "Register" tab: the master list of people, plus the
   add / edit person form (also reused from the Event Day tab).
   ========================================================================== */
(function () {
  "use strict";
  const NIDSG = (window.NIDSG = window.NIDSG || {});
  const ui = NIDSG.ui, db = NIDSG.db, cfg = NIDSG.config;
  const el = ui.el, icon = ui.icon;

  function fullName(p) {
    return [p.title, p.firstName, p.surname].filter(Boolean).join(" ").trim();
  }
  function initials(p) {
    const a = (p.firstName || "").trim()[0] || "";
    const b = (p.surname || "").trim()[0] || "";
    return (a + b).toUpperCase() || "?";
  }

  // ---- Add / edit form ------------------------------------------------------
  // onSaved(person) is called after a successful save.
  function personForm(existing, onSaved) {
    const p = existing || {};
    let gender = p.gender || "";

    const titleList = el("datalist", { id: "title-list" },
      cfg.TITLES.map(function (t) { return el("option", { value: t }); }));

    const fTitle = el("input.input", { type: "text", list: "title-list",
      placeholder: "e.g. Mr, Mrs, Dr, Chief", value: p.title || "" });
    const fFirst = el("input.input", { type: "text", value: p.firstName || "", autocomplete: "off" });
    const fSurname = el("input.input", { type: "text", value: p.surname || "", autocomplete: "off" });
    const fPhone = el("input.input", { type: "tel", value: p.phone || "", placeholder: "e.g. 0803 123 4567" });
    const fEmail = el("input.input", { type: "email", value: p.email || "", placeholder: "optional", autocomplete: "off" });
    const fOrg = el("input.input", { type: "text", value: p.organisation || "" });
    const fState = el("select.select", {},
      [el("option", { value: "" }, "— Select state —")].concat(
        cfg.STATES.map(function (s) {
          return el("option", { value: s, selected: p.state === s }, s);
        })));
    const fAddr = el("textarea.input", { rows: "2", placeholder: "Street / town (state is chosen above)" });
    fAddr.value = p.addressLine || "";
    const fNotes = el("textarea.input", { rows: "2", placeholder: "Role at the event, or anything else" });
    fNotes.value = p.notes || "";

    const genderSeg = el("div.segment", {}, cfg.GENDERS.map(function (g) {
      const b = el("button", { type: "button", text: g,
        class: gender === g ? "on" : "" });
      b.addEventListener("click", function () {
        gender = g;
        genderSeg.querySelectorAll("button").forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
      });
      return b;
    }));

    function field(labelText, control, opts) {
      opts = opts || {};
      return el("div.field" + (opts.cls ? "." + opts.cls : ""), {}, [
        el("label", {}, [labelText, opts.required ? el("span.req", {}, " *") : null]),
        opts.hint ? el("span.hint", { text: opts.hint }) : null,
        control
      ]);
    }

    const form = el("form", {}, [
      titleList,
      field("First name", fFirst, { required: true }),
      field("Surname", fSurname, { required: true }),
      el("div.grid-2", {}, [
        field("Title", fTitle),
        field("Gender", genderSeg, { hint: "Used for the dashboard" })
      ]),
      el("div.grid-2", {}, [
        field("Phone number", fPhone),
        field("Email", fEmail)
      ]),
      field("Organisation", fOrg, { hint: "The group or body they come from" }),
      field("State", fState, { required: true, hint: "Nigerian state — used for the dashboard" }),
      field("Address (street / town)", fAddr),
      field("Notes", fNotes)
    ]);

    function markInvalid(controlWrapField, msg) {
      const f = controlWrapField.closest(".field");
      f.classList.add("invalid");
      if (!f.querySelector(".err")) f.appendChild(el("span.err", { text: msg }));
    }
    function clearInvalid() {
      form.querySelectorAll(".field.invalid").forEach(function (f) {
        f.classList.remove("invalid");
        const e = f.querySelector(".err"); if (e) e.remove();
      });
    }

    const saveBtn = el("button.btn.primary", { type: "button" },
      [el("span", { html: icon("check", 20) }), existing ? "Save changes" : "Add person"]);

    function save() {
      clearInvalid();
      let ok = true;
      if (!fFirst.value.trim()) { markInvalid(fFirst, "First name is required"); ok = false; }
      if (!fSurname.value.trim()) { markInvalid(fSurname, "Surname is required"); ok = false; }
      if (!fState.value) { markInvalid(fState, "Please choose a state"); ok = false; }
      if (!ok) { ui.toast("Please fill the highlighted fields", "error"); return; }

      const rec = Object.assign({}, p, {
        title: fTitle.value.trim(),
        firstName: fFirst.value.trim(),
        surname: fSurname.value.trim(),
        gender: gender || "Unspecified",
        phone: fPhone.value.trim(),
        email: fEmail.value.trim(),
        organisation: fOrg.value.trim(),
        state: fState.value,
        addressLine: fAddr.value.trim(),
        notes: fNotes.value.trim()
      });
      const op = existing ? db.People.update(rec) : db.People.add(rec);
      op.then(function (saved) {
        ui.closeModal();
        ui.toast(existing ? "Changes saved" : "Person added");
        if (onSaved) onSaved(saved);
      }).catch(function (e) {
        ui.toast("Could not save: " + e.message, "error");
      });
    }
    saveBtn.addEventListener("click", save);

    ui.modal({
      title: existing ? "Edit person" : "Add a person",
      content: form,
      footer: [
        el("button.btn.ghost", { type: "button", text: "Cancel", onclick: ui.closeModal }),
        saveBtn
      ]
    });
  }

  // ---- Person detail (view + edit + delete) ---------------------------------
  function personDetail(person, opts) {
    opts = opts || {};
    const p = person;
    const rows = [
      ["Title", p.title], ["Gender", p.gender],
      ["Phone", p.phone], ["Email", p.email],
      ["Organisation", p.organisation], ["State", p.state],
      ["Address", p.addressLine], ["Notes", p.notes]
    ].filter(function (r) { return r[1]; });

    const content = el("div.confirm-card", {}, [
      el("div.confirm-top", {}, [
        el("div.avatar.lg", { text: initials(p) }),
        el("div", {}, [
          el("div.confirm-name", { text: fullName(p) })
        ])
      ]),
      el("div.detail-grid", {}, rows.map(function (r) {
        return el("div.detail", {}, [el("div.k", { text: r[0] }), el("div.v", { text: r[1] })]);
      }))
    ]);

    ui.modal({
      title: "Person details",
      content: content,
      footer: [
        el("button.btn.danger", { type: "button" }, [el("span", { html: icon("trash", 20) }), "Delete"]),
        el("button.btn", { type: "button" }, [el("span", { html: icon("edit", 20) }), "Edit"])
      ].map(function (b, i) {
        if (i === 0) b.addEventListener("click", function () {
          ui.confirm({
            title: "Delete this person?",
            message: "This removes " + fullName(p) + " and all their attendance records. This cannot be undone.",
            confirmText: "Delete", danger: true
          }).then(function (yes) {
            if (!yes) return;
            db.People.remove(p.id).then(function () {
              ui.closeModal(); ui.toast("Person deleted");
              if (opts.onChange) opts.onChange();
            });
          });
        });
        if (i === 1) b.addEventListener("click", function () {
          ui.closeModal();
          personForm(p, function () { if (opts.onChange) opts.onChange(); });
        });
        return b;
      })
    });
  }

  // ---- Register tab ---------------------------------------------------------
  function render(root) {
    ui.clear(root);
    let sortKey = "surname";

    const head = el("div.view-head", {}, [
      el("div.spread", {}, [
        el("div", {}, [
          el("h1.view-title", { text: "Register" }),
          el("p.view-sub", { text: "Everyone in the system. Add people here before the event, or on the day." })
        ]),
        el("button.btn.primary", { type: "button", onclick: function () {
          personForm(null, function () { render(root); });
        } }, [el("span", { html: icon("plus", 20) }), "Add person"])
      ])
    ]);
    root.appendChild(head);

    const searchWrap = el("div.searchbox", { style: "margin-bottom:14px" }, [
      el("span.icon.search-ic", { html: icon("search", 24) }),
      el("input", { type: "search", placeholder: "Filter the list by name…", "aria-label": "Filter list" })
    ]);
    const filterInput = searchWrap.querySelector("input");
    root.appendChild(searchWrap);

    const listHost = el("div");
    root.appendChild(listHost);

    db.People.all().then(function (people) {
      function draw() {
        ui.clear(listHost);
        let list = people.slice();
        const q = filterInput.value.trim();
        if (q) {
          list = NIDSG.search.search(people, q).map(function (r) { return r.person; });
        } else {
          list.sort(function (a, b) {
            return (a[sortKey] || "").localeCompare(b[sortKey] || "");
          });
        }

        if (!people.length) {
          listHost.appendChild(el("div.card.pad", {}, el("div.empty", {}, [
            el("div", { html: icon("people", 40) }),
            el("h3", { text: "No one added yet" }),
            el("p", { text: "Tap “Add person” to enter your first record, or go to the Data tab to import a list from a spreadsheet." })
          ])));
          return;
        }

        listHost.appendChild(el("div.spread", { style: "margin-bottom:10px" }, [
          el("p.panel-note", { text: list.length + (list.length === 1 ? " person" : " people") + (q ? " found" : "") }),
          q ? null : el("label.row", { style: "gap:8px;font-size:14px;color:var(--ink-muted)" }, [
            "Sort by",
            (function () {
              const s = el("select.select", { style: "min-height:40px;width:auto" }, [
                el("option", { value: "surname", selected: sortKey === "surname" }, "Surname"),
                el("option", { value: "firstName", selected: sortKey === "firstName" }, "First name"),
                el("option", { value: "organisation", selected: sortKey === "organisation" }, "Organisation"),
                el("option", { value: "state", selected: sortKey === "state" }, "State")
              ]);
              s.addEventListener("change", function () { sortKey = s.value; draw(); });
              return s;
            })()
          ])
        ]));

        const rows = el("div.result-list", {}, list.map(function (p) {
          const row = el("button.person-row", { type: "button" }, [
            el("div.avatar", { text: initials(p) }),
            el("div.person-main", {}, [
              el("div.person-name", { text: fullName(p) }),
              el("div.person-meta", {}, [
                p.organisation ? el("span", {}, [el("span", { html: icon("building", 14) }), p.organisation]) : null,
                p.state ? el("span", {}, [el("span", { html: icon("pin", 14) }), p.state]) : null,
                p.phone ? el("span", {}, [el("span", { html: icon("phone", 14) }), p.phone]) : null
              ])
            ]),
            el("span", { class: "icon", html: icon("back", 20), style: "transform:rotate(180deg);color:var(--ink-muted)" })
          ]);
          row.addEventListener("click", function () {
            personDetail(p, { onChange: function () { render(root); } });
          });
          return row;
        }));
        listHost.appendChild(rows);
      }

      let deb;
      filterInput.addEventListener("input", function () {
        clearTimeout(deb); deb = setTimeout(draw, 120);
      });
      draw();
    });
  }

  NIDSG.people = { fullName: fullName, initials: initials, personForm: personForm, personDetail: personDetail };
  NIDSG.views = NIDSG.views || {};
  NIDSG.views.register = { render: render };
})();
