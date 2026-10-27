/* ============================================================================
   ui.js  —  Small helpers shared by every screen: element builder, SVG icons,
   toast messages, and a modal/confirm dialog. No external libraries.
   ========================================================================== */
(function () {
  "use strict";
  const NIDSG = (window.NIDSG = window.NIDSG || {});

  // ---- DOM builder ----------------------------------------------------------
  // el("button.primary", {onclick: fn}, "Save")
  function el(tag, attrs, children) {
    let name = "div", cls = [];
    const parts = String(tag).split(/(?=[.#])/);
    parts.forEach(function (p, i) {
      if (i === 0 && p[0] !== "." && p[0] !== "#") name = p;
      else if (p[0] === ".") cls.push(p.slice(1));
      else if (p[0] === "#") name = name; // ids via attrs instead
    });
    const node = document.createElement(name === "" ? "div" : name);
    if (cls.length) node.className = cls.join(" ");
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        const v = attrs[k];
        if (v == null || v === false) return;
        if (k === "class") node.className = (node.className + " " + v).trim();
        else if (k === "html") node.innerHTML = v;
        else if (k === "text") node.textContent = v;
        else if (k.slice(0, 2) === "on" && typeof v === "function") {
          node.addEventListener(k.slice(2).toLowerCase(), v);
        } else if (k === "dataset") {
          Object.keys(v).forEach(function (dk) { node.dataset[dk] = v[dk]; });
        } else if (v === true) node.setAttribute(k, "");
        else node.setAttribute(k, v);
      });
    }
    appendChildren(node, children);
    return node;
  }
  function appendChildren(node, children) {
    if (children == null) return;
    if (Array.isArray(children)) {
      children.forEach(function (c) { appendChildren(node, c); });
    } else if (children instanceof Node) {
      node.appendChild(children);
    } else {
      node.appendChild(document.createTextNode(String(children)));
    }
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function escapeHTML(s) {
    return (s == null ? "" : String(s))
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // ---- Icons (consistent stroked set; no emoji) -----------------------------
  const ICONS = {
    calendar: '<path d="M7 3v3M17 3v3M3.5 9h17M5 5h14a1.5 1.5 0 0 1 1.5 1.5V19A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V6.5A1.5 1.5 0 0 1 5 5Z"/>',
    people: '<path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19"/><circle cx="10" cy="8" r="3.2"/><path d="M20 19v-1.4a3.4 3.4 0 0 0-2.6-3.3M15.5 5.1a3.2 3.2 0 0 1 0 6"/>',
    chart: '<path d="M4 20V4M4 20h16M8 20v-6M12.5 20V9M17 20v-9"/>',
    database: '<ellipse cx="12" cy="6" rx="7" ry="2.8"/><path d="M5 6v6c0 1.55 3.13 2.8 7 2.8s7-1.25 7-2.8V6M5 12v6c0 1.55 3.13 2.8 7 2.8s7-1.25 7-2.8v-6"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    checkCircle: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.3l2.4 2.4 4.6-4.9"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4l10-10-4-4L4 16v4Z"/><path d="M13.5 6.5l4 4"/>',
    trash: '<path d="M4 7h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7"/>',
    download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14"/>',
    upload: '<path d="M12 16V5M7.5 9.5 12 5l4.5 4.5M5 20h14"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 7 7 0 1 0 20 14.5Z"/>',
    phone: '<path d="M6 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a1.5 1.5 0 0 1-1.6 1.5A15.5 15.5 0 0 1 4.5 5.6 1.5 1.5 0 0 1 6 4Z"/>',
    building: '<path d="M5 21V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v16M14 21V9h4a1 1 0 0 1 1 1v11M3 21h18M8 8h2M8 12h2M8 16h2"/>',
    pin: '<path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"/><circle cx="12" cy="11" r="2.2"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
    warning: '<path d="M12 4 2.5 20h19L12 4Z"/><path d="M12 10v4M12 17h.01"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    undo: '<path d="M9 7 4 12l5 5M4 12h9a6 6 0 0 1 0 12h-1"/>',
    table: '<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 4.5v15"/>',
    sortArrow: '<path d="M8 10l4-4 4 4M8 14l4 4 4-4"/>',
    mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4.2 7.5 12 13l7.8-5.5"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/>'
  };
  function icon(name, size) {
    const s = size || 22;
    return '<svg class="icon" viewBox="0 0 24 24" width="' + s + '" height="' + s +
      '" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || "") + "</svg>";
  }

  // ---- Toast ----------------------------------------------------------------
  function toast(message, kind) {
    let host = document.getElementById("toast-host");
    if (!host) {
      host = el("div", { id: "toast-host", class: "toast-host", "aria-live": "polite" });
      document.body.appendChild(host);
    }
    const t = el("div.toast" + (kind ? "." + kind : ""), {}, [
      el("span.toast-ic", { html: icon(kind === "error" ? "warning" : "checkCircle", 20) }),
      el("span", { text: message })
    ]);
    host.appendChild(t);
    setTimeout(function () { t.classList.add("show"); }, 10);
    setTimeout(function () {
      t.classList.remove("show");
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 300);
    }, kind === "error" ? 5000 : 3000);
  }

  // ---- Modal / confirm ------------------------------------------------------
  let _openModal = null;
  function modal(opts) {
    closeModal();
    const overlay = el("div.overlay", { role: "dialog", "aria-modal": "true" });
    const box = el("div.modal" + (opts.wide ? ".wide" : ""));
    const head = el("div.modal-head", {}, [
      el("h2.modal-title", { text: opts.title || "" }),
      el("button.icon-btn", {
        type: "button", "aria-label": "Close", onclick: closeModal, html: icon("x", 22)
      })
    ]);
    const body = el("div.modal-body");
    appendChildren(body, opts.content);
    box.appendChild(head);
    box.appendChild(body);
    if (opts.footer) {
      const foot = el("div.modal-foot");
      appendChildren(foot, opts.footer);
      box.appendChild(foot);
    }
    overlay.appendChild(box);
    overlay.addEventListener("mousedown", function (e) {
      if (e.target === overlay && opts.dismissable !== false) closeModal();
    });
    document.body.appendChild(overlay);
    document.body.classList.add("modal-open");
    _openModal = overlay;
    // Focus first field/button for keyboard + accessibility.
    const focusable = box.querySelector("input,select,textarea,button:not(.icon-btn)");
    if (focusable) setTimeout(function () { focusable.focus(); }, 30);
    return { close: closeModal, box: box, body: body };
  }
  function closeModal() {
    if (_openModal && _openModal.parentNode) _openModal.parentNode.removeChild(_openModal);
    _openModal = null;
    document.body.classList.remove("modal-open");
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeModal();
  });

  function confirmBox(opts) {
    return new Promise(function (resolve) {
      const m = modal({
        title: opts.title || "Please confirm",
        content: el("p.confirm-text", { text: opts.message || "" }),
        dismissable: true,
        footer: [
          el("button.btn.ghost", {
            type: "button", text: opts.cancelText || "Cancel",
            onclick: function () { closeModal(); resolve(false); }
          }),
          el("button.btn." + (opts.danger ? "danger" : "primary"), {
            type: "button", text: opts.confirmText || "Confirm",
            onclick: function () { closeModal(); resolve(true); }
          })
        ]
      });
      void m;
    });
  }

  NIDSG.ui = {
    el: el, clear: clear, escapeHTML: escapeHTML, icon: icon,
    toast: toast, modal: modal, closeModal: closeModal, confirm: confirmBox
  };
})();
