/*
 * sw.js — 火星時計の Service Worker
 * 版: 2026-08-29-#56533d
 *
 * 初回アクセスで本体一式を保存し、以後はオフラインでも開けるようにする。
 * 版が変わると CACHE の名前も変わるので、古い保存分は自動で捨てられる。
 */
'use strict';
var CACHE = 'mars-clock-2026-08-29-#56533d';
var ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) {
          return k === CACHE ? null : caches.delete(k);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  // ページを開く要求：まずネットを試し、つながらなければ保存した本体を返す
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { return c.put('./index.html', copy); })
          .catch(function () {});
        return res;
      }).catch(function () {
        return caches.match('./index.html', { ignoreSearch: true });
      })
    );
    return;
  }

  // それ以外：保存済みがあればそれを使い、無ければ取りに行って保存しておく
  // （Google Fonts もここで保存されるので、2 回目からはオフラインでも同じ書体になる）
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { return c.put(req, copy); })
            .catch(function () {});
        }
        return res;
      }).catch(function () {
        return undefined;   // 取れないものは諦める（書体など。端末の書体で代替される）
      });
    })
  );
});
