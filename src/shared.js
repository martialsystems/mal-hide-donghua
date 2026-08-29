/**
 * Copyright (c) 2026 Martial Systems LLC. All rights reserved.
 * https://martialsys.net/
 *
 * Pure helpers for Hide Donghua. Content script, service worker, popup,
 * and Node tests all load this file.
 *
 * Listings (seasonal, top, search): hide non-Japanese cards. Title pages
 * stay visible. AniList JP always shown; other AniList countries hidden;
 * else title language and strong Chinese hosts/text. Baidu/Douban wiki
 * links are not enough: Japanese title pages often have those.
 */
(function (root) {
  "use strict";

  var MSG = {
    SOURCE: "mal-hide-donghua",
    LOOKUP: "lookup",
    GET_SETTINGS: "get-settings",
    SET_ENABLED: "set-enabled",
    GET_COUNTS: "get-counts",
  };

  var SETTINGS_KEY = "malhd_settings";
  var CACHE_KEY = "malhd_cache";

  var BLOCKED = { CN: true, TW: true, HK: true, KR: true };
  var KEEP_COUNTRY = { JP: true };
  var CHUNK = 50;
  var KNOWN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  var UNKNOWN_TTL_MS = 2 * 24 * 60 * 60 * 1000;
  var ANILIST_URL = "https://graphql.anilist.co/";
  var LOOKUP_QUERY =
    "query($ids:[Int]){Page(page:1,perPage:50){media(idMal_in:$ids,type:ANIME){idMal countryOfOrigin}}}";

  var KANA_RE = /[\u3040-\u309F\u30A0-\u30FF]/;
  var HAN_RE = /[\u4E00-\u9FFF]/;
  var SIMPLIFIED_RE = /[时们这个来对会说语经与发门车东还过为开关长书无电见头实产兴吗么从爱听钱买卖问齐龙广气飞风专声处际页题戏观话认识让论记谁请轻转轮边达进远运连选刘郑狱]/;
  var JP_WORD_RE = /\b(no|ga|wa|kara|made|desu|shounen|shoujo|chan|kun|sama|sensei)\b/i;
  var JP_ROMAJI_RE = /tsu|tte|cchi|ssh|aa|ee|ii|oo|uu/i;
  var SKIP_WORD_RE =
    /^(the|a|an|of|and|or|to|be|season|special|movie|part|final|recap|ova|ona|tv|pv|cm|vs|ver|version|picture|drama|series|edition|uncensored|uncut|mini|anime|gekijou|movie|2nd|3rd|4th|5th|6th|7th|8th|9th|10th|st|nd|rd|th|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)$/i;
  var CN_TEXT_RE = /\b(bilibili|tencent|iqiyi|youku|wetv|mgtv|haoliners)\b/i;
  var STRONG_CN_HOST_RE =
    /(^|\.)(bilibili\.com|b23\.tv|v\.qq\.com|film\.qq\.com|wetv\.vip|wetv\.net|iqiyi\.com|iq\.com|youku\.com|mgtv\.com|acfun\.cn|tencent\.com)$/i;

  var PINYIN_INITIALS = [
    "zh",
    "ch",
    "sh",
    "b",
    "p",
    "m",
    "f",
    "d",
    "t",
    "n",
    "l",
    "g",
    "k",
    "h",
    "j",
    "q",
    "x",
    "r",
    "z",
    "c",
    "s",
    "y",
    "w",
  ];
  var PINYIN_FINALS = [
    "uang",
    "iong",
    "iang",
    "uai",
    "uan",
    "iao",
    "ian",
    "ang",
    "eng",
    "ong",
    "ing",
    "ia",
    "ie",
    "iu",
    "in",
    "ua",
    "uo",
    "ui",
    "un",
    "ue",
    "ve",
    "er",
    "ai",
    "ei",
    "ao",
    "ou",
    "an",
    "en",
    "a",
    "o",
    "e",
    "i",
    "u",
    "v",
  ];

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

  function decodeEntities(value) {
    return String(value || "")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }

  function hostOf(href) {
    if (!href || typeof href !== "string") return "";
    try {
      return new URL(href, "https://myanimelist.net/").hostname.toLowerCase();
    } catch (_err) {
      return "";
    }
  }

  function isStrongChineseHost(href) {
    var host = hostOf(href);
    if (!host) return false;
    return STRONG_CN_HOST_RE.test(host);
  }

  function pinyinOk(init, fin) {
    if (!fin) return false;
    var i0 = fin.charAt(0);
    if (init === "j" || init === "q" || init === "x") {
      return i0 === "i" || i0 === "u" || i0 === "v";
    }
    if (init === "g" || init === "k" || init === "h") {
      return i0 !== "i" && i0 !== "v";
    }
    if (init === "y") {
      return /^(i|e|a|ao|ou|an|in|ang|ing|ong|u|ue|uan|un)$/.test(fin);
    }
    if (init === "w") {
      return /^(u|a|o|ai|ei|an|en|ang|eng)$/.test(fin);
    }
    if (!init) {
      return /^(a|o|e|ai|ei|ao|ou|an|en|ang|eng|er)$/.test(fin);
    }
    return true;
  }

  function pinyinUnique(init, fin) {
    if (init === "q" || init === "x" || init === "zh") return true;
    if (fin === "uang" || fin === "iong" || fin === "iao") return true;
    if (fin === "ong" && init !== "y" && init !== "w" && init !== "") return true;
    if (fin === "uan" && init !== "" && init !== "w") return true;
    if (fin === "iu") return true;
    return false;
  }

  function pinyinSyllablesAt(s, pos) {
    var i;
    var j;
    var out = [];
    function consider(init, fin) {
      if (!pinyinOk(init, fin)) return;
      var whole = init + fin;
      if (s.indexOf(whole, pos) !== pos) return;
      out.push({ len: whole.length, init: init, fin: fin });
    }
    for (i = 0; i < PINYIN_INITIALS.length; i++) {
      var init = PINYIN_INITIALS[i];
      if (s.indexOf(init, pos) !== pos) continue;
      for (j = 0; j < PINYIN_FINALS.length; j++) consider(init, PINYIN_FINALS[j]);
    }
    if (pos === 0) {
      for (j = 0; j < PINYIN_FINALS.length; j++) consider("", PINYIN_FINALS[j]);
    }
    out.sort(function (a, b) {
      return b.len - a.len;
    });
    return out;
  }

  function scanPinyin(word) {
    var s = String(word || "")
      .toLowerCase()
      .replace(/[^a-z]/g, "");
    if (!s) return null;
    if (JP_ROMAJI_RE.test(s)) return null;
    function rec(pos) {
      if (pos === s.length) return { n: 0, unique: false };
      var cands = pinyinSyllablesAt(s, pos);
      for (var i = 0; i < cands.length; i++) {
        var rest = rec(pos + cands[i].len);
        if (!rest) continue;
        return {
          n: rest.n + 1,
          unique: rest.unique || pinyinUnique(cands[i].init, cands[i].fin),
        };
      }
      return null;
    }
    return rec(0);
  }

  function pinyinSyllableCount(word) {
    var info = scanPinyin(word);
    return info ? info.n : 0;
  }

  function isPinyinWord(word) {
    return pinyinSyllableCount(word) > 0;
  }

  function titleWords(title) {
    var raw = decodeEntities(title);
    var parts = raw.split(/[^A-Za-z]+/);
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var w = parts[i];
      if (!w || w.length < 2) continue;
      if (SKIP_WORD_RE.test(w)) continue;
      out.push(w);
    }
    return out;
  }

  function titleSignal(title) {
    var t = decodeEntities(title).trim();
    if (!t) return "unknown";
    if (KANA_RE.test(t)) return "jp";
    if (JP_WORD_RE.test(t)) return "jp";
    if (HAN_RE.test(t)) {
      if (SIMPLIFIED_RE.test(t) && !KANA_RE.test(t)) return "cn";
      return "unknown";
    }
    var words = titleWords(t);
    if (!words.length) return "unknown";
    var unique = false;
    var syllables = 0;
    for (var i = 0; i < words.length; i++) {
      var info = scanPinyin(words[i]);
      if (!info) return "unknown";
      syllables += info.n;
      if (info.unique) unique = true;
    }
    if (unique) return "cn";
    if (words.length >= 4) return "cn";
    return "unknown";
  }

  function nativeSignal(nativeTitle) {
    var t = decodeEntities(nativeTitle).trim();
    if (!t) return "unknown";
    if (KANA_RE.test(t)) return "jp";
    if (SIMPLIFIED_RE.test(t) && HAN_RE.test(t) && !KANA_RE.test(t)) return "cn";
    return "unknown";
  }

  function hrefsHaveStrongChinese(hrefs) {
    if (!hrefs) return false;
    for (var i = 0; i < hrefs.length; i++) {
      if (isStrongChineseHost(hrefs[i])) return true;
    }
    return false;
  }

  function localVerdict(opts) {
    opts = opts || {};
    var native = nativeSignal(opts.nativeTitle);
    if (native === "jp") return "jp";
    var title = titleSignal(opts.title);
    if (title === "jp") return "jp";
    if (title === "cn" || native === "cn") return "cn";
    if (hrefsHaveStrongChinese(opts.hrefs)) return "cn";
    if (CN_TEXT_RE.test(String(opts.text || ""))) return "cn";
    return "unknown";
  }

  function decideHide(opts) {
    opts = opts || {};
    if (opts.enabled === false) return false;
    if (opts.allowed) return false;
    var country = countryKey(opts.country);
    if (KEEP_COUNTRY[country]) return false;
    if (BLOCKED[country]) return true;
    return localVerdict(opts) === "cn";
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
    BLOCKED: BLOCKED,
    KEEP_COUNTRY: KEEP_COUNTRY,
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
    isStrongChineseHost: isStrongChineseHost,
    isPinyinWord: isPinyinWord,
    pinyinSyllableCount: pinyinSyllableCount,
    titleSignal: titleSignal,
    nativeSignal: nativeSignal,
    localVerdict: localVerdict,
    decideHide: decideHide,
    lookupBody: lookupBody,
    parseLookupResponse: parseLookupResponse,
    fillMissing: fillMissing,
    cacheGet: cacheGet,
    mergeCache: mergeCache,
  };

  root.MalHideDonghua = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
