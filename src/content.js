/**
 * Copyright (c) 2026 Martial Systems LLC. All rights reserved.
 * https://martialsys.net/
 *
 * Isolated world: hide non-Japanese listing cards on Seasonal, Top, and
 * Search. Title pages stay visible. AniList JP keeps a card; any other
 * origin hides it. Japanese title cues keep a card up until AniList answers.
 */
(function () {
  "use strict";

  var S = window.MalJpOnly;
  if (!S) return;

  var settings = S.defaultSettings();
  var cacheMap = Object.create(null);
  var hiddenCount = 0;
  var mutating = false;
  var scanTimer = 0;
  var pendingIds = Object.create(null);
  var inflight = false;
  var failUntil = 0;

  function nodeInfo(el) {
    return {
      tag: el.tagName,
      id: el.id || "",
      className: S.classText(el.className),
    };
  }

  function pickCard(el) {
    var n = el;
    while (n && n.nodeType === 1) {
      var kind = S.classifyNode(nodeInfo(n));
      if (kind === "skip" || kind === "stop") return null;
      if (kind === "card") return n;
      n = n.parentElement;
    }
    return null;
  }

  function setHidden(el, hide) {
    if (!el || !el.classList) return;
    if (hide) el.classList.add("maljp-hide");
    else el.classList.remove("maljp-hide");
  }

  function originOf(id) {
    var key = String(id);
    if (Object.prototype.hasOwnProperty.call(cacheMap, key)) return cacheMap[key];
    return null;
  }

  function cardTitle(el) {
    var node = el.querySelector(
      ".js-title, .link-title, .h2_anime_title a, .h2_anime_title, .h3_character_name, h2 a, h3 a, h2, h3"
    );
    return node && node.textContent ? node.textContent.trim() : "";
  }

  function hideOpts(id, meta) {
    meta = meta || {};
    return {
      enabled: settings.enabled,
      country: originOf(id),
      title: meta.title || "",
    };
  }

  function send(msg) {
    return new Promise(function (resolve) {
      msg.source = S.MSG.SOURCE;
      try {
        chrome.runtime.sendMessage(msg, function (res) {
          void chrome.runtime.lastError;
          resolve(res || { ok: false });
        });
      } catch (_err) {
        resolve({ ok: false });
      }
    });
  }

  function unhideAll() {
    mutating = true;
    var hid = document.querySelectorAll(".maljp-hide");
    for (var i = 0; i < hid.length; i++) hid[i].classList.remove("maljp-hide");
    mutating = false;
    hiddenCount = 0;
  }

  function collect() {
    var cards = [];
    var seen = typeof WeakSet === "function" ? new WeakSet() : null;
    var links = document.querySelectorAll("a[href]");
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var id = S.malIdFromHref(a.href || a.getAttribute("href") || "");
      if (!id) continue;
      var card = pickCard(a);
      if (!card) continue;
      if (seen) {
        if (seen.has(card)) continue;
        seen.add(card);
      }
      cards.push({
        id: id,
        el: card,
        title: cardTitle(card),
      });
    }
    return cards;
  }

  function applyCards(cards) {
    var n = 0;
    mutating = true;
    for (var i = 0; i < cards.length; i++) {
      var hide = S.decideHide(hideOpts(cards[i].id, cards[i]));
      setHidden(cards[i].el, hide);
      if (hide) n += 1;
    }
    mutating = false;
    hiddenCount = n;
  }

  function requestUnknown(ids) {
    if (inflight || Date.now() < failUntil) return;
    var need = [];
    for (var i = 0; i < ids.length; i++) {
      var key = String(ids[i]);
      if (Object.prototype.hasOwnProperty.call(cacheMap, key)) continue;
      if (pendingIds[key]) continue;
      pendingIds[key] = true;
      need.push(ids[i]);
    }
    if (!need.length) return;
    inflight = true;
    send({ type: S.MSG.LOOKUP, ids: need }).then(function (res) {
      inflight = false;
      for (var i = 0; i < need.length; i++) delete pendingIds[String(need[i])];
      if (!res || !res.ok) {
        failUntil = Date.now() + 10000;
        return;
      }
      var map = res.map || {};
      var keys = Object.keys(map);
      for (var k = 0; k < keys.length; k++) cacheMap[keys[k]] = map[keys[k]];
      scan();
    });
  }

  function scan() {
    if (!document.body) return;
    if (!settings.enabled || !S.isListingPath(location.pathname || "")) {
      unhideAll();
      return;
    }
    var cards = collect();
    var ids = [];
    for (var c = 0; c < cards.length; c++) ids.push(cards[c].id);
    applyCards(cards);
    requestUnknown(S.uniqueIds(ids));
  }

  function scheduleScan() {
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(function () {
      scanTimer = 0;
      scan();
    }, 80);
  }

  function loadLocal() {
    return Promise.all([
      new Promise(function (resolve) {
        chrome.storage.sync.get(S.SETTINGS_KEY, function (data) {
          settings = S.parseSettings(data && data[S.SETTINGS_KEY]);
          resolve();
        });
      }),
      new Promise(function (resolve) {
        chrome.storage.local.get(S.CACHE_KEY, function (data) {
          var cache = (data && data[S.CACHE_KEY]) || {};
          var now = Date.now();
          var keys = Object.keys(cache);
          cacheMap = Object.create(null);
          for (var i = 0; i < keys.length; i++) {
            var hit = S.cacheGet(cache, keys[i], now);
            if (hit) cacheMap[keys[i]] = hit.c;
          }
          resolve();
        });
      }),
    ]);
  }

  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (!msg || msg.source !== S.MSG.SOURCE) return;
    if (msg.type !== S.MSG.GET_COUNTS) return;
    sendResponse({
      ok: true,
      enabled: !!settings.enabled,
      listing: S.isListingPath(location.pathname || ""),
      hidden: hiddenCount,
    });
    return true;
  });

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === "sync" && changes[S.SETTINGS_KEY]) {
      settings = S.parseSettings(changes[S.SETTINGS_KEY].newValue);
      scan();
    }
    if (area === "local" && changes[S.CACHE_KEY]) {
      var cache = changes[S.CACHE_KEY].newValue || {};
      var now = Date.now();
      var keys = Object.keys(cache);
      for (var i = 0; i < keys.length; i++) {
        var hit = S.cacheGet(cache, keys[i], now);
        if (hit) cacheMap[keys[i]] = hit.c;
      }
      scan();
    }
  });

  var mo = new MutationObserver(function () {
    if (mutating) return;
    scheduleScan();
  });

  loadLocal().then(function () {
    scan();
    try {
      mo.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
      });
    } catch (_err) {
      /* ignore */
    }
  });
})();
