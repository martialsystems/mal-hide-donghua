/**
 * Copyright (c) 2026 Martial Systems LLC. All rights reserved.
 * https://martialsys.net/
 *
 * Pure helpers for Japanese Only. Content script, service worker, popup,
 * and Node tests all load this file.
 *
 * Seasonal, Top, and Search: keep Japanese listings, hide the rest.
 * Title pages stay visible. AniList country JP is kept; any other origin
 * is hidden. Japanese title cues keep a card up until AniList answers.
 */
(function (root) {
  "use strict";

  var MSG = {
    SOURCE: "mal-jp-only",
    LOOKUP: "lookup",
    GET_SETTINGS: "get-settings",
    SET_ENABLED: "set-enabled",
    GET_COUNTS: "get-counts",
  };

  var SETTINGS_KEY = "maljp_settings";
  var CACHE_KEY = "maljp_cache";
  var CHUNK = 50;
  var KNOWN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  var UNKNOWN_TTL_MS = 2 * 24 * 60 * 60 * 1000;
  var ANILIST_URL = "https://graphql.anilist.co/";
  var LOOKUP_QUERY =
    "query($ids:[Int]){Page(page:1,perPage:50){media(idMal_in:$ids,type:ANIME){idMal countryOfOrigin}}}";

  var KANA_RE = /[\u3040-\u309F\u30A0-\u30FF]/;
  var JP_CUE_RE =
    /\b(no|ga|wa|kara|made|desu|shounen|shoujo|chan|kun|sama|sensei|tensei|isekai|senki|kaisen|jujutsu|kimetsu|shinai|shita|masu)\b|tsu|tte|cchi|ssh/i;

  function defaultSettings() {
    return { v: 1, enabled: true };
  }

  function parseSettings(raw) {
    var s = defaultSettings();
    if (!raw || typeof raw !== "object") return s;
    if (raw.enabled === false) s.enabled = false;
    return s;
  }

  function malIdFromHref(href) {
    if (!href || typeof href !== "string") return 0;
    var m = href.match(/\/anime\/(\d+)(?:[/?#]|$)/);
    if (m) return parseInt(m[1], 10) || 0;
    m = href.match(/\/anime\.php\?(?:[^#]*[?&])?id=(\d+)/);
    if (m) return parseInt(m[1], 10) || 0;
    return 0;
  }

  function malIdFromPath(path) {
    if (!path || typeof path !== "string") return 0;
    var m = path.match(/^\/anime\/(\d+)(?:\/|$)/);
    return m ? parseInt(m[1], 10) || 0 : 0;
  }

  function isListingPath(path) {
    var p = String(path || "");
    if (/^\/anime\/\d+/.test(p)) return false;
    if (/^\/anime\/season(\/|$)/.test(p)) return true;
    if (p === "/topanime.php" || p.indexOf("/topanime.php") === 0) return true;
    if (p === "/anime.php" || p.indexOf("/anime.php") === 0) return true;
    return false;
  }

  function uniqueIds(ids) {
    var seen = Object.create(null);
    var out = [];
    if (!ids) return out;
    for (var i = 0; i < ids.length; i++) {
      var n = ids[i] | 0;
      if (n <= 0 || seen[n]) continue;
      seen[n] = true;
      out.push(n);
    }
    return out;
  }

  function chunkIds(ids, size) {
    size = size || CHUNK;
    var out = [];
    for (var i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
    return out;
  }

  function classText(value) {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value.baseVal === "string") return value.baseVal;
    return String(value);
  }

  function paddedClass(value) {
    return " " + classText(value).replace(/\s+/g, " ").trim() + " ";
  }

  function classifyNode(node) {
    if (!node) return "continue";
    var tag = String(node.tag || node.tagName || "").toUpperCase();
    var id = String(node.id || "");
    var cls = paddedClass(node.className);

    if (tag === "HEADER" || tag === "FOOTER" || tag === "NAV") return "skip";
    if (
      id === "header" ||
      id === "headerSmall" ||
      id === "header-menu" ||
      id === "menu" ||
      id === "footer" ||
      id === "searchBar"
    ) {
      return "skip";
    }
    if (
      cls.indexOf(" header-list ") >= 0 ||
      cls.indexOf(" footer-ranking ") >= 0 ||
      cls.indexOf(" incrementalSearch ") >= 0
    ) {
      return "skip";
    }
    if (id === "content" || id === "contentWrapper" || id === "myanimelist") return "stop";
    if (tag === "BODY" || tag === "HTML") return "stop";
    if (cls.indexOf(" seasonal-anime ") >= 0) return "card";
    if (cls.indexOf(" ranking-list ") >= 0) return "card";
    if (cls.indexOf(" btn-anime ") >= 0) return "card";
    if (cls.indexOf(" list-table-data ") >= 0) return "card";
    if (tag === "TR" && cls.indexOf(" table-header ") < 0) return "card";
    return "continue";
  }

  function pickCardFromChain(chain) {
    if (!chain || !chain.length) return null;
    for (var i = 0; i < chain.length; i++) {
      var kind = classifyNode(chain[i]);
      if (kind === "skip" || kind === "stop") return null;
      if (kind === "card") return chain[i];
    }
    return null;
  }

  function countryKey(value) {
    return String(value || "").trim().toUpperCase();
  }

  function looksJapanese(title) {
    var t = String(title || "").trim();
    if (!t) return false;
    if (KANA_RE.test(t)) return true;
    return JP_CUE_RE.test(t);
  }

  function decideHide(opts) {
    opts = opts || {};
    if (opts.enabled === false) return false;
    var country = countryKey(opts.country);
    if (country === "JP") return false;
    if (country) return true;
    if (looksJapanese(opts.title) || looksJapanese(opts.nativeTitle)) return false;
    return true;
  }

  function lookupBody(ids) {
    return JSON.stringify({
      query: LOOKUP_QUERY,
      variables: { ids: uniqueIds(ids) },
    });
  }

  function parseLookupResponse(json) {
    var map = Object.create(null);
    var media = json && json.data && json.data.Page && json.data.Page.media;
    if (!Array.isArray(media)) return map;
    for (var i = 0; i < media.length; i++) {
      var row = media[i];
      if (!row || !row.idMal) continue;
      map[String(row.idMal)] = countryKey(row.countryOfOrigin);
    }
    return map;
  }

  function fillMissing(ids, map) {
    var out = Object.create(null);
    var have = map || Object.create(null);
    for (var i = 0; i < ids.length; i++) {
      var key = String(ids[i]);
      out[key] = Object.prototype.hasOwnProperty.call(have, key) ? have[key] : "";
    }
    return out;
  }

  function cacheTtl(country) {
    return country ? KNOWN_TTL_MS : UNKNOWN_TTL_MS;
  }

  function cacheGet(cache, id, now) {
    if (!cache) return null;
    var e = cache[String(id)];
    if (!e || typeof e !== "object") return null;
    var age = (now || 0) - (e.t || 0);
    if (age < 0 || age > cacheTtl(e.c)) return null;
    return { c: typeof e.c === "string" ? e.c : "", t: e.t || 0 };
  }

  function mergeCache(cache, updates, now) {
    var next = Object.create(null);
    var src = cache || {};
    var keys = Object.keys(src);
    var i;
    for (i = 0; i < keys.length; i++) {
      var keep = cacheGet(src, keys[i], now);
      if (keep) next[keys[i]] = keep;
    }
    var upd = updates || {};
    var ukeys = Object.keys(upd);
    for (i = 0; i < ukeys.length; i++) {
      var id = ukeys[i];
      if (!/^[1-9]\d*$/.test(id)) continue;
      next[id] = { c: countryKey(upd[id]), t: now };
    }
    return next;
  }

  var api = {
    MSG: MSG,
    SETTINGS_KEY: SETTINGS_KEY,
    CACHE_KEY: CACHE_KEY,
    CHUNK: CHUNK,
    KNOWN_TTL_MS: KNOWN_TTL_MS,
    UNKNOWN_TTL_MS: UNKNOWN_TTL_MS,
    ANILIST_URL: ANILIST_URL,
    LOOKUP_QUERY: LOOKUP_QUERY,
    defaultSettings: defaultSettings,
    parseSettings: parseSettings,
    malIdFromHref: malIdFromHref,
    malIdFromPath: malIdFromPath,
    isListingPath: isListingPath,
    uniqueIds: uniqueIds,
    chunkIds: chunkIds,
    classText: classText,
    classifyNode: classifyNode,
    pickCardFromChain: pickCardFromChain,
    countryKey: countryKey,
    looksJapanese: looksJapanese,
    decideHide: decideHide,
    lookupBody: lookupBody,
    parseLookupResponse: parseLookupResponse,
    fillMissing: fillMissing,
    cacheGet: cacheGet,
    mergeCache: mergeCache,
  };

  root.MalJpOnly = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
