/* ============================================================================
   db.js  —  On-device storage using IndexedDB.
   Everything is stored locally on this device. Nothing is sent anywhere.

   Stores:
     people      { id, title, firstName, surname, gender, phone, email,
                   organisation, state, addressLine, notes, createdAt, updatedAt }
     attendance  { id, personId, date (YYYY-MM-DD), markedAt }
     meta        { key, value }   // settings, e.g. last backup date, org name
   ========================================================================== */
(function () {
  "use strict";
  const NIDSG = (window.NIDSG = window.NIDSG || {});
  const cfg = NIDSG.config;

  let _db = null;

  function open() {
    if (_db) return Promise.resolve(_db);
    return new Promise(function (resolve, reject) {
      let req;
      try {
        req = indexedDB.open(cfg.DB_NAME, cfg.DB_VERSION);
      } catch (e) {
        reject(e);
        return;
      }
      req.onupgradeneeded = function (ev) {
        const db = ev.target.result;
        if (!db.objectStoreNames.contains("people")) {
          const s = db.createObjectStore("people", { keyPath: "id" });
          s.createIndex("surname", "surname", { unique: false });
        }
        if (!db.objectStoreNames.contains("attendance")) {
          const a = db.createObjectStore("attendance", { keyPath: "id" });
          a.createIndex("personId", "personId", { unique: false });
          a.createIndex("date", "date", { unique: false });
          // One record per person per day.
          a.createIndex("person_date", ["personId", "date"], { unique: true });
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "key" });
        }
      };
      req.onsuccess = function (ev) { _db = ev.target.result; resolve(_db); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function tx(store, mode) {
    return open().then(function (db) {
      return db.transaction(store, mode).objectStore(store);
    });
  }

  function reqPromise(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  function getAll(store) {
    return tx(store, "readonly").then(function (os) { return reqPromise(os.getAll()); });
  }

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  function nowISO() { return new Date().toISOString(); }

  // ---- People ---------------------------------------------------------------
  const People = {
    all: function () { return getAll("people"); },
    get: function (id) {
      return tx("people", "readonly").then(function (os) { return reqPromise(os.get(id)); });
    },
    add: function (person) {
      const rec = Object.assign({}, person, {
        id: person.id || uid(),
        createdAt: person.createdAt || nowISO(),
        updatedAt: nowISO()
      });
      return tx("people", "readwrite")
        .then(function (os) { return reqPromise(os.add(rec)); })
        .then(function () { return rec; });
    },
    update: function (person) {
      const rec = Object.assign({}, person, { updatedAt: nowISO() });
      return tx("people", "readwrite")
        .then(function (os) { return reqPromise(os.put(rec)); })
        .then(function () { return rec; });
    },
    remove: function (id) {
      // Also remove that person's attendance records.
      return Attendance.forPerson(id).then(function (recs) {
        return Promise.all(recs.map(function (r) { return Attendance.remove(r.id); }));
      }).then(function () {
        return tx("people", "readwrite").then(function (os) { return reqPromise(os.delete(id)); });
      });
    },
    bulkAdd: function (people) {
      return open().then(function (db) {
        return new Promise(function (resolve, reject) {
          const t = db.transaction("people", "readwrite");
          const os = t.objectStore("people");
          const saved = [];
          people.forEach(function (p) {
            const rec = Object.assign({}, p, {
              id: p.id || uid(),
              createdAt: p.createdAt || nowISO(),
              updatedAt: nowISO()
            });
            os.put(rec);
            saved.push(rec);
          });
          t.oncomplete = function () { resolve(saved); };
          t.onerror = function () { reject(t.error); };
        });
      });
    }
  };

  // ---- Attendance -----------------------------------------------------------
  const Attendance = {
    all: function () { return getAll("attendance"); },
    forDate: function (date) {
      return tx("attendance", "readonly").then(function (os) {
        return reqPromise(os.index("date").getAll(date));
      });
    },
    forPerson: function (personId) {
      return tx("attendance", "readonly").then(function (os) {
        return reqPromise(os.index("personId").getAll(personId));
      });
    },
    isMarked: function (personId, date) {
      return tx("attendance", "readonly").then(function (os) {
        return reqPromise(os.index("person_date").get([personId, date]));
      }).then(function (r) { return !!r; });
    },
    mark: function (personId, date) {
      const rec = { id: uid(), personId: personId, date: date, markedAt: nowISO() };
      return tx("attendance", "readwrite")
        .then(function (os) { return reqPromise(os.add(rec)); })
        .then(function () { return rec; })
        .catch(function (err) {
          // Unique index means it's already marked — that's fine, treat as success.
          if (err && err.name === "ConstraintError") return null;
          throw err;
        });
    },
    unmark: function (personId, date) {
      return tx("attendance", "readonly").then(function (os) {
        return reqPromise(os.index("person_date").get([personId, date]));
      }).then(function (rec) {
        if (!rec) return false;
        return Attendance.remove(rec.id).then(function () { return true; });
      });
    },
    remove: function (id) {
      return tx("attendance", "readwrite").then(function (os) { return reqPromise(os.delete(id)); });
    }
  };

  // ---- Meta / settings ------------------------------------------------------
  const Meta = {
    get: function (key, fallback) {
      return tx("meta", "readonly").then(function (os) { return reqPromise(os.get(key)); })
        .then(function (r) { return r ? r.value : fallback; });
    },
    set: function (key, value) {
      return tx("meta", "readwrite").then(function (os) {
        return reqPromise(os.put({ key: key, value: value }));
      });
    }
  };

  // ---- Whole-database export / import / wipe ---------------------------------
  function exportAll() {
    return Promise.all([People.all(), Attendance.all(), getAll("meta")])
      .then(function (r) {
        return {
          app: "NIDSG Attendance Register",
          format: "nidsg-backup-v1",
          exportedAt: nowISO(),
          people: r[0],
          attendance: r[1],
          meta: r[2]
        };
      });
  }

  function importAll(data, mode) {
    // mode: "merge" (default) keeps existing and adds/updates by id; "replace" wipes first.
    const doImport = function () {
      return open().then(function (db) {
        return new Promise(function (resolve, reject) {
          const t = db.transaction(["people", "attendance", "meta"], "readwrite");
          (data.people || []).forEach(function (p) { t.objectStore("people").put(p); });
          (data.attendance || []).forEach(function (a) { t.objectStore("attendance").put(a); });
          (data.meta || []).forEach(function (m) { t.objectStore("meta").put(m); });
          t.oncomplete = function () {
            resolve({
              people: (data.people || []).length,
              attendance: (data.attendance || []).length
            });
          };
          t.onerror = function () { reject(t.error); };
        });
      });
    };
    if (mode === "replace") return clearAll().then(doImport);
    return doImport();
  }

  function clearAll() {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        const t = db.transaction(["people", "attendance"], "readwrite");
        t.objectStore("people").clear();
        t.objectStore("attendance").clear();
        t.oncomplete = function () { resolve(true); };
        t.onerror = function () { reject(t.error); };
      });
    });
  }

  NIDSG.db = {
    open: open,
    People: People,
    Attendance: Attendance,
    Meta: Meta,
    exportAll: exportAll,
    importAll: importAll,
    clearAll: clearAll,
    uid: uid,
    todayISO: function () {
      const d = new Date();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return d.getFullYear() + "-" + m + "-" + day;
    }
  };
})();
