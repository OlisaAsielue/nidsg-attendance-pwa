/* Service worker: makes the app open with no internet once installed.
   Bump CACHE_VERSION whenever you change the app files, so devices refresh. */
"use strict";
var CACHE_VERSION = "nidsg-v4";
var ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./css/styles.css",
  "./js/config.js",
  "./js/db.js",
  "./js/search.js",
  "./js/ui.js",
  "./js/people.js",
  "./js/attendance.js",
  "./js/fulllist.js",
  "./js/dashboard.js",
  "./js/dataio.js",
  "./js/app.js"
];

self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_VERSION).then(function (c) { return c.addAll(ASSETS); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE_VERSION) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  // Cache-first: fast and works fully offline. Falls back to network for anything new.
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      return hit || fetch(e.request).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE_VERSION).then(function (c) { c.put(e.request, copy); }).catch(function () {});
        return res;
      }).catch(function () { return caches.match("./index.html"); });
    })
  );
});
