"use strict";

const assert = require("assert");
const S = require("../src/shared.js");

function section(name) {
  console.log("  " + name);
}

section("malIdFromHref");
assert.strictEqual(S.malIdFromHref("https://myanimelist.net/anime/44074/Shiguang_Dailiren"), 44074);
assert.strictEqual(S.malIdFromHref("/anime/44074"), 44074);
assert.strictEqual(S.malIdFromHref("/anime/44074/Shiguang_Dailiren/characters"), 44074);
assert.strictEqual(S.malIdFromHref("https://myanimelist.net/anime.php?id=44074"), 44074);
assert.strictEqual(S.malIdFromHref("https://myanimelist.net/anime.php?q=foo&id=44074"), 44074);
assert.strictEqual(S.malIdFromHref("/anime/season/2026/summer"), 0);
assert.strictEqual(S.malIdFromHref("/anime/producer/1774/LAN_Studio"), 0);
assert.strictEqual(S.malIdFromHref("/anime/genre/1/Action"), 0);
assert.strictEqual(S.malIdFromHref("/manga/44074/Something"), 0);
assert.strictEqual(S.malIdFromHref(""), 0);
assert.strictEqual(S.malIdFromHref(null), 0);

section("malIdFromPath");
assert.strictEqual(S.malIdFromPath("/anime/44074"), 44074);
assert.strictEqual(S.malIdFromPath("/anime/44074/Shiguang_Dailiren"), 44074);
assert.strictEqual(S.malIdFromPath("/anime/season"), 0);
assert.strictEqual(S.malIdFromPath("/anime.php"), 0);
assert.strictEqual(S.malIdFromPath("/topanime.php"), 0);

section("shouldHide");
assert.strictEqual(S.shouldHide("CN"), true);
assert.strictEqual(S.shouldHide("cn"), true);
assert.strictEqual(S.shouldHide("TW"), true);
assert.strictEqual(S.shouldHide("HK"), true);
assert.strictEqual(S.shouldHide("JP"), false);
assert.strictEqual(S.shouldHide("KR"), false);
assert.strictEqual(S.shouldHide(""), false);
assert.strictEqual(S.shouldHide("CN", { enabled: false }), false);
assert.strictEqual(S.shouldHide("CN", { enabled: true }, true), false);

section("idsToHide");
assert.deepStrictEqual(
  S.idsToHide([44074, 40748, 21, 56752], { 44074: "CN", 40748: "JP", 21: "JP", 56752: "CN" }, { enabled: true }, {}),
  [44074, 56752]
);
assert.deepStrictEqual(
  S.idsToHide([44074, 40748], { 44074: "CN", 40748: "JP" }, { enabled: false }, {}),
  []
);
assert.deepStrictEqual(
  S.idsToHide([44074, 56752], { 44074: "CN", 56752: "CN" }, { enabled: true }, { 44074: 1 }),
  [56752]
);
assert.deepStrictEqual(S.idsToHide([40748], { 40748: "JP" }, { enabled: true }, {}), []);
assert.deepStrictEqual(S.idsToHide([123], {}, { enabled: true }, {}), []);

section("pickCardFromChain");
assert.strictEqual(
  S.pickCardFromChain([
    { tag: "A", className: "link-title" },
    { tag: "H2", className: "h2_anime_title" },
    { tag: "DIV", className: "title-text" },
    { tag: "DIV", className: "js-anime-category-producer seasonal-anime js-seasonal-anime" },
    { tag: "DIV", id: "content" },
  ]).className.indexOf("seasonal-anime") >= 0,
  true
);
assert.strictEqual(
  S.pickCardFromChain([
    { tag: "A", className: "hoverinfo_trigger" },
    { tag: "TD", className: "title" },
    { tag: "TR", className: "ranking-list" },
    { tag: "TABLE", className: "top-ranking-table" },
  ]).className,
  "ranking-list"
);
assert.strictEqual(
  S.pickCardFromChain([
    { tag: "A", className: "hoverinfo_trigger" },
    { tag: "DIV", className: "picSurround" },
    { tag: "TD", className: "borderClass" },
    { tag: "TR", className: "" },
    { tag: "TABLE", className: "" },
  ]).tag,
  "TR"
);
assert.strictEqual(
  S.pickCardFromChain([
    { tag: "A", className: "link" },
    { tag: "LI", className: "btn-anime" },
    { tag: "UL", className: "widget-slide" },
  ]).className,
  "btn-anime"
);
assert.strictEqual(
  S.pickCardFromChain([
    { tag: "A", className: "" },
    { tag: "LI", className: "" },
    { tag: "NAV", className: "" },
  ]),
  null
);
assert.strictEqual(
  S.pickCardFromChain([
    { tag: "A", className: "" },
    { tag: "H1", className: "h1" },
    { tag: "DIV", id: "contentWrapper" },
  ]),
  null
);

section("parseLookupResponse");
var parsed = S.parseLookupResponse({
  data: {
    Page: {
      media: [
        { idMal: 44074, countryOfOrigin: "CN" },
        { idMal: 40748, countryOfOrigin: "JP" },
      ],
    },
  },
});
assert.strictEqual(parsed["44074"], "CN");
assert.strictEqual(parsed["40748"], "JP");
var filled = S.fillMissing([44074, 999999], { 44074: "CN" });
assert.strictEqual(filled["44074"], "CN");
assert.strictEqual(filled["999999"], "");

section("mergeCache N>1");
var now = 1_700_000_000_000;
var once = S.mergeCache({}, { 44074: "CN", 40748: "JP" }, now);
assert.strictEqual(once["44074"].c, "CN");
assert.strictEqual(once["40748"].c, "JP");
var twice = S.mergeCache(once, { 56752: "CN", 21: "JP" }, now + 1);
assert.strictEqual(twice["44074"].c, "CN");
assert.strictEqual(twice["40748"].c, "JP");
assert.strictEqual(twice["56752"].c, "CN");
assert.strictEqual(twice["21"].c, "JP");
assert.strictEqual(S.cacheGet(twice, 40748, now + 1).c, "JP");
assert.strictEqual(S.cacheGet(twice, 44074, now + S.KNOWN_TTL_MS + 5), null);

section("chunkIds");
assert.deepStrictEqual(S.chunkIds([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
assert.deepStrictEqual(S.uniqueIds([1, 1, 0, -3, 2, 2]), [1, 2]);

section("parseSettings");
assert.deepStrictEqual(S.parseSettings(null), { v: 1, enabled: true });
assert.strictEqual(S.parseSettings({ enabled: false }).enabled, false);
assert.strictEqual(S.parseSettings({ enabled: true }).enabled, true);

section("lookupBody");
var body = JSON.parse(S.lookupBody([44074, 40748]));
assert.strictEqual(body.query, S.LOOKUP_QUERY);
assert.deepStrictEqual(body.variables.ids, [44074, 40748]);

console.log("ok");
