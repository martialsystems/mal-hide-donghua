/**
 * Copyright (c) 2026 Martial Systems LLC. All rights reserved.
 * https://martialsys.net/
 *
 * Session owner: settings, AniList origin lookup, id cache.
 * Cache lives in chrome.storage.local. Enabled flag in chrome.storage.sync.
 * MAL ids go to AniList only. Nothing is uploaded to Martial Systems LLC.
 */
try {
  importScripts("shared.js");
} catch (_err) {
  /* unit syntax checks have no importScripts */
}

var S = self.MalHideDonghua;
var writeChain = Promise.resolve();
var allowChain = Promise.resolve();

function loadSettings() {
  return chrome.storage.sync.get(S.SETTINGS_KEY).then(function (data) {
    return S.parseSettings(data[S.SETTINGS_KEY]);
  });
}

function saveSettings(settings) {
  var payload = {};
  payload[S.SETTINGS_KEY] = settings;
  return chrome.storage.sync.set(payload);
}

function loadCache() {
  return chrome.storage.local.get(S.CACHE_KEY).then(function (data) {
    return data[S.CACHE_KEY] || {};
  });
}

function writeCache(updates) {
  writeChain = writeChain.catch(function () {}).then(function () {
    return loadCache().then(function (cache) {
      var next = S.mergeCache(cache, updates, Date.now());
      var payload = {};
      payload[S.CACHE_KEY] = next;
      return chrome.storage.local.set(payload);
    });
  });
  return writeChain;
}

function fetchChunk(ids) {
  return fetch(S.ANILIST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: S.lookupBody(ids),
  }).then(function (res) {
    if (res.status === 429) {
      return new Promise(function (resolve) {
        setTimeout(resolve, 1500);
      }).then(function () {
        return fetch(S.ANILIST_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: S.lookupBody(ids),
        });
      });
    }
    return res;
  }).then(function (res) {
    if (!res.ok) throw new Error("anilist " + res.status);
    return res.json();
  }).then(function (json) {
    return S.fillMissing(ids, S.parseLookupResponse(json));
  });
}

function fetchMissing(ids) {
  var chunks = S.chunkIds(ids, S.CHUNK);
  var map = Object.create(null);
  var i = 0;
  function next() {
    if (i >= chunks.length) return Promise.resolve(map);
    var chunk = chunks[i++];
    return fetchChunk(chunk).then(function (part) {
      var keys = Object.keys(part);
      for (var k = 0; k < keys.length; k++) map[keys[k]] = part[keys[k]];
      return next();
    });
  }
  return next();
}

function handleLookup(ids) {
  var want = S.uniqueIds(ids);
  if (!want.length) return Promise.resolve({ ok: true, map: {} });
  var now = Date.now();
  return loadCache().then(function (cache) {
    var map = Object.create(null);
    var missing = [];
    for (var i = 0; i < want.length; i++) {
      var id = want[i];
      var hit = S.cacheGet(cache, id, now);
      if (hit) map[String(id)] = hit.c;
      else missing.push(id);
    }
    if (!missing.length) return { ok: true, map: map };
    return fetchMissing(missing).then(function (got) {
      var keys = Object.keys(got);
      for (var k = 0; k < keys.length; k++) map[keys[k]] = got[keys[k]];
      return writeCache(got).then(function () {
        return { ok: true, map: map };
      });
    });
  });
}

function handleGetSettings() {
  return loadSettings().then(function (settings) {
    return { ok: true, settings: settings };
  });
}

function handleSetEnabled(msg) {
  var settings = S.defaultSettings();
  settings.enabled = !!(msg && msg.enabled);
  return saveSettings(settings).then(function () {
    return { ok: true, settings: settings };
  });
}

function handleAllowPage(msg) {
  var id = msg && msg.id ? msg.id | 0 : 0;
  if (id <= 0) return Promise.resolve({ ok: false, reason: "no-id" });
  allowChain = allowChain.catch(function () {}).then(function () {
    return chrome.storage.session.get(S.ALLOW_KEY).then(function (data) {
      var allow = data[S.ALLOW_KEY] || {};
      allow[String(id)] = 1;
      var payload = {};
      payload[S.ALLOW_KEY] = allow;
      return chrome.storage.session.set(payload).then(function () {
        return { ok: true, id: id };
      });
    });
  });
  return allowChain;
}

function onMessage(msg, _sender, sendResponse) {
  if (!S || !msg || msg.source !== S.MSG.SOURCE) return;
  var task = null;
  if (msg.type === S.MSG.LOOKUP) task = handleLookup(msg.ids);
  else if (msg.type === S.MSG.GET_SETTINGS) task = handleGetSettings();
  else if (msg.type === S.MSG.SET_ENABLED) task = handleSetEnabled(msg);
  else if (msg.type === S.MSG.ALLOW_PAGE) task = handleAllowPage(msg);
  if (!task) return;
  task
    .then(function (result) {
      sendResponse(result);
    })
    .catch(function (err) {
      sendResponse({ ok: false, reason: String(err && err.message ? err.message : err) });
    });
  return true;
}

if (S && typeof chrome !== "undefined") {
  chrome.runtime.onMessage.addListener(onMessage);
}
