/* ============================================================================
   search.js  —  Careful name matching.
   People's names are often spelled several ways and many people share a name.
   So this NEVER auto-picks a person. It returns a ranked list of candidates and
   the caller shows enough detail (organisation, state, phone) to choose safely.
   ========================================================================== */
(function () {
  "use strict";
  const NIDSG = (window.NIDSG = window.NIDSG || {});

  // Lower-case, strip accents, collapse spaces.
  function normalise(s) {
    return (s || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Levenshtein edit distance (for close spellings, e.g. Chukwu / Chukvu).
  function editDistance(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    let prev = new Array(n + 1);
    let curr = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      }
      const tmp = prev; prev = curr; curr = tmp;
    }
    return prev[n];
  }

  // How close, allowing for typos, is token `t` to `target`? Returns 0..1.
  function tokenScore(t, target) {
    if (!t || !target) return 0;
    if (target === t) return 1;
    if (target.indexOf(t) === 0) return 0.9;          // prefix
    if (target.indexOf(t) !== -1) return 0.7;         // contains
    if (t.length >= 3) {
      const d = editDistance(t, target);
      const tol = t.length <= 4 ? 1 : 2;              // allow 1–2 typos
      if (d <= tol) return 0.6 - (d - 1) * 0.1;
    }
    return 0;
  }

  // Score one person against the whole query.
  function scorePerson(queryTokens, person) {
    const fields = [
      normalise(person.firstName),
      normalise(person.surname)
    ].filter(Boolean);
    const nameTokens = fields.join(" ").split(" ").filter(Boolean);
    if (!nameTokens.length) return 0;

    let total = 0;
    for (let i = 0; i < queryTokens.length; i++) {
      const q = queryTokens[i];
      let best = 0;
      for (let j = 0; j < nameTokens.length; j++) {
        best = Math.max(best, tokenScore(q, nameTokens[j]));
      }
      if (best === 0) return 0; // every query word must match something
      total += best;
    }
    // Average, with a small bonus when the whole name reads in the same order.
    let score = total / queryTokens.length;
    const full = fields.join(" ");
    if (full.indexOf(queryTokens.join(" ")) !== -1) score += 0.15;
    return score;
  }

  // Public: search a list of people. Returns [{person, score}] sorted best-first.
  function search(people, query, limit) {
    const nq = normalise(query);
    if (!nq) return [];
    const queryTokens = nq.split(" ").filter(Boolean);
    const results = [];
    for (let i = 0; i < people.length; i++) {
      const s = scorePerson(queryTokens, people[i]);
      if (s > 0) results.push({ person: people[i], score: s });
    }
    results.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      // Tie-break alphabetically by surname then first name for a stable order.
      const an = (a.person.surname || "") + (a.person.firstName || "");
      const bn = (b.person.surname || "") + (b.person.firstName || "");
      return an.localeCompare(bn);
    });
    return limit ? results.slice(0, limit) : results;
  }

  NIDSG.search = { search: search, normalise: normalise, editDistance: editDistance };
})();
