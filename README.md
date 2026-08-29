# Hide Donghua

<p align="right">
  <a href="https://ko-fi.com/martialgames"><img src="https://img.shields.io/badge/Donate-Ko--fi-ff5e5b?style=flat-square&amp;logo=ko-fi&amp;logoColor=white" alt="Donate on Ko-fi" /></a>
  &nbsp;
  <a href="https://martialsys.net/"><img src="https://img.shields.io/badge/Martial%20Systems-site-1a3a2a?style=flat-square" alt="Martial Systems" /></a>
</p>

**Martial Systems LLC** product: Chrome extension that hides Chinese animation (donghua) on MyAnimeList.

| | |
|--|--|
| **Publisher** | Martial Systems LLC |
| **Support** | martialsys@gmail.com · [Ko-fi](https://ko-fi.com/martialgames) |
| **Web** | https://martialsys.net/ |
| **Version** | 1.1.0 |
| **License** | Proprietary: see [LICENSE](LICENSE) and [Terms](docs/TERMS_OF_USE.md) |

**We do not save your data.** Your list and page HTML are not uploaded to Martial Systems LLC. Titles and links are classified on your device. MAL ids are sent to AniList (`https://graphql.anilist.co/`) so Japanese origin can unhide a bad title match, and so English-titled donghua still hide. [Privacy Policy](docs/PRIVACY_POLICY.md).

Not affiliated with Google LLC, MyAnimeList, or AniList.

## Load unpacked

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. **Load unpacked** and choose this folder
4. Open [MyAnimeList](https://myanimelist.net/)
5. Reload the tab. Seasonal tiles with pinyin titles (Shiguang Dailiren, Zhu Xian, and the rest) disappear immediately.

Toolbar popup: **Hide Chinese animation**. Off leaves the page as MAL shows it. On a hidden title page, **Show this page** keeps that id visible until Chrome exits.

## What it does

Hide if any of these fire, unless AniList says Japan or Korea:

| Signal | When |
|--------|------|
| Title language | Simplified Chinese in the title, or a pinyin title (`Shiguang Dailiren`, `Zhu Xian`) |
| Strong Chinese hosts | Official/streaming links to Bilibili, Tencent Video (`v.qq.com`), iQIYI, Youku, WeTV |
| Card text | `Bilibili` / `Tencent` / `iQIYI` / `Youku` in the tile (synopsis source line) |
| AniList origin | `CN` / `TW` / `HK` for English titles such as To Be Hero X |

AniList `JP` or `KR` always wins, so a bad pinyin read of a Japanese title comes back. Baidu Baike and Douban wiki links are ignored: Japanese title pages often have those.

| Surface | Behavior |
|---------|----------|
| Seasonal tiles | `.seasonal-anime` hidden |
| Top ranking rows | `tr.ranking-list` hidden |
| Search rows | result `tr` hidden |
| Home / rec sliders | `li.btn-anime` hidden |
| Your list rows | `.list-table-data` hidden |
| Title page | `#content` hidden, with Show this page |

## Checks

```bash
./scripts/verify.sh
```

## Residual limits

- English-titled donghua wait on AniList (To Be Hero X, The Ribbon Hero).
- A few pinyin titles with no q/x/zh/ong/uan syllable wait on AniList too (Yao Shen Ji).
- Co-productions use the one country AniList stores.
- Forum text links are not listing cards, so they stay.
- After Load unpacked, reload the MAL tab so the content script attaches.
