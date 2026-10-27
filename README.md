# NIDSG Attendance Register

An offline-first attendance register for a community charity's events. Volunteers search a name, confirm it's the right person, and mark them present. It runs on iPads, Kindle Fire tablets and laptops with no internet and no installation beyond "Add to Home Screen".

Live: https://genuine-horse-f55c9f.netlify.app/ (loads empty; import `sample-data.csv` from the Data tab to try it)

## Problem

The charity ran its events from paper lists and spreadsheets. Venues often have no reliable Wi-Fi, volunteers vary in confidence with technology, and many attendees share or spell names differently. The register had to:

- work fully offline;
- be impossible to double-count;
- never guess which "Chukwuemeka Okafor" someone meant;
- be maintainable by a non-developer for years.

## Approach

- **Progressive Web App, no framework, no build step.** Plain HTML, CSS and JavaScript. A cache-first service worker makes the app open with no connection once installed. The scripts are plain (not ES modules), so the app also runs straight from a file on a laptop.
- **Local-first storage.** IndexedDB holds people, attendance and settings. A unique compound index on (person, date) makes double check-ins impossible at the database level rather than relying on the UI.
- **Careful name search.** Names are normalised (case, accents, punctuation) and ranked with exact, prefix and Levenshtein matching, so spelling variants still match. Search never auto-selects: it returns a ranked list showing organisation, state and phone so the volunteer picks the right person.
- **Spreadsheet in, spreadsheet out.** CSV import with column matching and a preview before anything is written; CSV export of people and attendance; one-file JSON backup and restore; a reminder when no backup has been made for 7 days.
- **Five task-focused screens.** Event Day check-in, Register (add and edit), Full List, Dashboard (totals by gender, organisation and state), and Data. A first-run guide, large touch targets and a dark mode are included.

## Results

Built for a Nigerian community charity's events, to replace paper sign-in with a searchable register that works without a connection and has zero dependencies to update.

## Tech stack

HTML, CSS (custom properties, dark mode), vanilla JavaScript, IndexedDB, Service Worker / Web App Manifest, Netlify.

## How to run

```bash
git clone https://github.com/OlisaAsielue/nidsg-attendance-pwa.git
cd nidsg-attendance-pwa
python3 -m http.server 8000     # then open http://localhost:8000
```

Opening `index.html` directly also works, without offline install. To try it with data, go to Data → Import a list and choose `sample-data.csv` (fictional people).

## Project layout

```
index.html            app shell
css/styles.css        design tokens (CSS variables) and components
js/config.js          branding, reference lists, reminder settings
js/db.js              IndexedDB wrapper (people, attendance, meta)
js/search.js          normalised, typo-tolerant name ranking
js/people.js, attendance.js, fulllist.js, dashboard.js, dataio.js   the five screens
js/app.js             navigation, theme, backup reminder, first-run help
sw.js                 offline cache (bump CACHE_VERSION after changing files)
```

## Limitations and next steps

- Data lives on one device. Multi-device events need a manual export and merge; a sync layer (for example CouchDB/PouchDB) would remove that step.
- Spreadsheet import is CSV only, to stay dependency-free. Direct `.xlsx` import would need a vendored library such as SheetJS.
- No automated tests yet. Search ranking and the CSV parser are the obvious first candidates.
