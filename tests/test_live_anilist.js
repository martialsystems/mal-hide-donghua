"use strict";

const assert = require("assert");
const https = require("https");
const S = require("../src/shared.js");

function post(body) {
  return new Promise(function (resolve, reject) {
    var req = https.request(
      S.ANILIST_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      function (res) {
        var chunks = [];
        res.on("data", function (c) {
          chunks.push(c);
        });
        res.on("end", function () {
          var raw = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error("anilist " + res.statusCode + " " + raw.slice(0, 200)));
            return;
          }
          try {
            resolve(JSON.parse(raw));
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(20000, function () {
      req.destroy(new Error("anilist timeout"));
    });
    req.end(body);
  });
}

(async function main() {
  var ids = [44074, 40748, 21, 56752];
  var json = await post(S.lookupBody(ids));
  var map = S.fillMissing(ids, S.parseLookupResponse(json));
  assert.strictEqual(map["44074"], "CN", "Link Click origin");
  assert.strictEqual(map["56752"], "CN", "Link Click Bridon origin");
  assert.strictEqual(map["40748"], "JP", "Jujutsu Kaisen origin");
  assert.strictEqual(map["21"], "JP", "One Piece origin");
  var hide = S.idsToHide(ids, map, { enabled: true }, {});
  assert.deepStrictEqual(hide, [44074, 56752]);
  var off = S.idsToHide(ids, map, { enabled: false }, {});
  assert.deepStrictEqual(off, []);
  console.log("live anilist ok", map);
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
