#!/usr/bin/env bash
# Interaction-path checks for Hide Donghua.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
fail=0

say() { printf '%s\n' "$*"; }
ok() { say "  PASS  $*"; }
bad() { say "  FAIL  $*"; fail=1; }

say "== files =="
for f in \
  manifest.json popup.html README.md LICENSE NOTICE \
  src/shared.js src/background.js src/content.js src/content.css src/popup.js \
  icons/icon16.png icons/icon48.png icons/icon128.png \
  tests/test_shared.js tests/test_live_anilist.js \
  docs/PRIVACY_POLICY.md docs/TERMS_OF_USE.md \
  vbd.runtime.json
do
  if [[ -f "$f" ]]; then ok "exists $f"; else bad "missing $f"; fi
done

say "== manifest =="
node -e '
const fs = require("fs");
const m = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
if (m.manifest_version !== 3) throw new Error("not MV3");
if (!m.background || m.background.service_worker !== "src/background.js") {
  throw new Error("service worker path");
}
const cs = (m.content_scripts || [])[0];
if (!cs) throw new Error("content_scripts");
if (!cs.js.includes("src/shared.js") || !cs.js.includes("src/content.js")) throw new Error("js list");
if (!cs.css || !cs.css.includes("src/content.css")) throw new Error("css");
if (!(cs.matches || []).some((x) => x.includes("myanimelist.net"))) throw new Error("MAL matches");
const hosts = m.host_permissions || [];
if (!hosts.some((x) => x.includes("myanimelist.net"))) throw new Error("MAL host");
if (!hosts.some((x) => x.includes("graphql.anilist.co"))) throw new Error("AniList host");
const perms = m.permissions || [];
if (!perms.includes("storage")) throw new Error("storage");
if (perms.includes("tabs")) throw new Error("tabs permission is unused");
if (m.action.default_popup !== "popup.html") throw new Error("popup");
if ((m.description || "").toLowerCase().indexOf("do not save") < 0) {
  throw new Error("manifest must say we do not save data");
}
if (m.author !== "Martial Systems LLC") throw new Error("author");
console.log("manifest ok");
' || bad "manifest schema"

say "== syntax =="
for f in src/shared.js src/background.js src/content.js src/popup.js tests/test_shared.js tests/test_live_anilist.js; do
  if node --check "$f"; then ok "syntax $f"; else bad "syntax $f"; fi
done

say "== unit =="
if node tests/test_shared.js; then ok "test_shared.js"; else bad "test_shared.js"; fi

say "== live AniList (production query + hide plan) =="
if node tests/test_live_anilist.js; then ok "test_live_anilist.js"; else bad "test_live_anilist.js"; fi

say "== static paths =="
if grep -q 'Hide Chinese animation' popup.html src/popup.js README.md; then
  ok "enable label present"
else
  bad "missing enable label"
fi
if grep -q '<h1' popup.html; then
  bad "popup must not repeat the extension title; Chrome already shows it"
else
  ok "popup has no duplicate title"
fi
if grep -nE '<[^>]+\son[a-zA-Z]+=' popup.html src/*.js; then
  bad "inline on* handlers (MV3 CSP)"
else
  ok "no inline on* handlers"
fi
if grep -n 'innerHTML' src/*.js popup.html; then
  bad "innerHTML used"
else
  ok "no innerHTML"
fi
if grep -q 'malIdFromHref' src/content.js && grep -q 'classifyNode' src/content.js && grep -q 'decideHide' src/content.js; then
  ok "content uses production id/card/hide helpers"
else
  bad "content.js bypasses shared helpers"
fi
if grep -q 'titleSignal' src/shared.js && grep -q 'isStrongChineseHost' src/shared.js && grep -q 'pinyinUnique' src/shared.js; then
  ok "title language and strong-host helpers present"
else
  bad "title/host helpers missing"
fi
if grep -q 'baike.baidu.com' tests/test_shared.js && grep -q 'movie.douban.com' tests/test_shared.js; then
  ok "Baidu/Douban wiki links are tested as non-hiding"
else
  bad "Baidu/Douban non-hide untested"
fi
if grep -q 'Youkoso Ninchishou Sekai e' tests/test_shared.js && grep -q 'Youjo Senki II' tests/test_shared.js; then
  ok "Japanese titles asserted not hidden from pinyin"
else
  bad "Japanese title safety untested"
fi
if grep -q 'document_end' manifest.json; then
  ok "content script runs at document_end"
else
  bad "document_end missing"
fi
if grep -q 'writeChain' src/background.js && grep -q 'mergeCache' src/background.js && grep -q 'allowChain' src/background.js; then
  ok "cache and allow writes serialized"
else
  bad "serialized write path missing"
fi
if grep -q 'lookupBody' src/background.js && grep -q 'parseLookupResponse' src/background.js; then
  ok "background uses production AniList parse"
else
  bad "AniList parse not wired"
fi
if grep -q 'graphql.anilist.co' src/shared.js src/background.js docs/PRIVACY_POLICY.md README.md; then
  ok "AniList destination named"
else
  bad "AniList destination missing from privacy/readme"
fi
if grep -q 'BLOCKED = { CN: true, TW: true, HK: true }' src/shared.js; then
  ok "blocked set is CN/TW/HK"
else
  bad "blocked set drifted"
fi
if grep -n 'BLOCKED = {.*KR' src/shared.js; then
  bad "Korean is not in the default hide set"
else
  ok "KR not default-blocked"
fi
if grep -q 'malhd-hide' src/content.js src/content.css && grep -q 'malhd-page-hide' src/content.js src/content.css; then
  ok "card hide and title-page hide both present"
else
  bad "hide CSS/class missing"
fi
if grep -q 'ALLOW_PAGE' src/content.js src/background.js src/shared.js; then
  ok "Show this page allow path wired"
else
  bad "allow-page missing"
fi
if grep -q 'MutationObserver' src/content.js && grep -q 'storage.onChanged' src/content.js; then
  ok "rescan on DOM and settings change"
else
  bad "observer or storage listener missing"
fi
if grep -q '/manga/' tests/test_shared.js; then
  ok "manga hrefs excluded"
else
  bad "manga exclusion untested"
fi

say "== prose (no decorative dashes) =="
if python3 - <<'PY'
from pathlib import Path
bad = []
for p in [
    Path("README.md"), Path("popup.html"), Path("NOTICE"),
    Path("docs/PRIVACY_POLICY.md"), Path("docs/TERMS_OF_USE.md"),
    Path("src/content.js"), Path("src/shared.js"),
    Path("src/popup.js"), Path("src/background.js"),
]:
    text = p.read_text(encoding="utf-8")
    for i, line in enumerate(text.splitlines(), 1):
        if "\u2014" in line or "\u2013" in line:
            bad.append(f"{p}:{i}:{line}")
if bad:
    print("\n".join(bad))
    raise SystemExit(1)
print("clean")
PY
then
  ok "no em/en dashes in docs/UI"
else
  bad "decorative em/en dash in prose or UI"
fi

say "== icons =="
for f in icons/icon16.png icons/icon48.png icons/icon128.png; do
  if ! python3 - "$f" <<'PY'
import struct, sys
p = sys.argv[1]
data = open(p, "rb").read()
assert data.startswith(b"\x89PNG\r\n\x1a\n"), p + " not PNG"
w, h = struct.unpack(">II", data[16:24])
want = int("".join(c for c in p if c.isdigit()) or "0")
assert w == h == want, f"{p} is {w}x{h}, expected {want}x{want}"
print(f"{p} {w}x{h}")
PY
  then
    bad "icon $f"
  else
    ok "icon $f"
  fi
done

if [[ "$fail" -ne 0 ]]; then
  say "VERIFY FAILED"
  exit 1
fi
say "VERIFY OK"
