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
  assert.strictEqual(map["40748"], "JP");
  assert.strictEqual(map["21"], "JP");
  assert.notStrictEqual(map["44074"], "JP");
  assert.notStrictEqual(map["56752"], "JP");
  assert.strictEqual(S.decideHide({ title: "Shiguang Dailiren", country: map["44074"], enabled: true }), true);
  assert.strictEqual(S.decideHide({ title: "Jujutsu Kaisen", country: map["40748"], enabled: true }), false);
  assert.strictEqual(S.decideHide({ title: "One Piece", country: map["21"], enabled: true }), false);
  assert.strictEqual(S.decideHide({ title: "Jujutsu Kaisen", country: map["40748"], enabled: false }), false);
  console.log("live anilist ok", map);
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
