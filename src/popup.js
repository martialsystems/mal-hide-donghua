/**
 * Copyright (c) 2026 Martial Systems LLC. All rights reserved.
 * https://martialsys.net/
 *
 * Toolbar popup. One on/off for hiding Chinese animation on MAL.
 */
(function () {
  "use strict";

  var S = window.MalHideDonghua;
  if (!S) return;

  var enableBox = document.getElementById("enable");
  var statusEl = document.getElementById("status");
  var busy = false;

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text || "";
  }

  function send(msg) {
    return new Promise(function (resolve) {
      msg.source = S.MSG.SOURCE;
      chrome.runtime.sendMessage(msg, function (res) {
        void chrome.runtime.lastError;
        resolve(res || { ok: false });
      });
    });
  }

  function currentTab() {
    return new Promise(function (resolve) {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        resolve((tabs && tabs[0]) || null);
      });
    });
  }

  function loadCounts(tab) {
    if (!tab || typeof tab.id !== "number") {
      setStatus("Open MyAnimeList to hide Chinese animation.");
      return;
    }
    var url = tab.url || "";
    if (!/https:\/\/(www\.)?myanimelist\.net\//i.test(url)) {
      setStatus("Open MyAnimeList to hide Chinese animation.");
      return;
    }
    chrome.tabs.sendMessage(tab.id, { source: S.MSG.SOURCE, type: S.MSG.GET_COUNTS }, function (res) {
      if (chrome.runtime.lastError || !res || !res.ok) {
        setStatus("Reload the MyAnimeList tab after installing.");
        return;
      }
      if (!res.enabled) {
        setStatus("Off. Listings stay as MAL shows them.");
        return;
      }
      var n = res.hidden | 0;
      var extra = res.pageHidden ? " This title page is hidden." : "";
      setStatus("Hidden on this page: " + n + "." + extra);
    });
  }

  function refresh() {
    return send({ type: S.MSG.GET_SETTINGS }).then(function (res) {
      var settings = S.parseSettings(res && res.settings);
      if (enableBox) enableBox.checked = !!settings.enabled;
      return currentTab().then(loadCounts);
    });
  }

  if (enableBox) {
    enableBox.addEventListener("change", function () {
      if (busy) return;
      busy = true;
      enableBox.disabled = true;
      send({ type: S.MSG.SET_ENABLED, enabled: !!enableBox.checked }).then(function (res) {
        busy = false;
        enableBox.disabled = false;
        if (!res || !res.ok) {
          enableBox.checked = !enableBox.checked;
          setStatus("Could not update.");
          return;
        }
        return refresh();
      });
    });
  }

  refresh();
})();
