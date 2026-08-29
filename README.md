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
| **Version** | 1.2.0 |
| **License** | Proprietary: see [LICENSE](LICENSE) and [Terms](docs/TERMS_OF_USE.md) |

**We do not save your data.** Your list and page HTML are not uploaded to Martial Systems LLC. Titles and links are classified on your device. MAL ids are sent to AniList (`https://graphql.anilist.co/`) so Japanese origin can unhide a bad title match, and so English-titled donghua still hide. [Privacy Policy](docs/PRIVACY_POLICY.md).

Not affiliated with Google LLC, MyAnimeList, or AniList.

## Load unpacked

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. **Load unpacked** and choose this folder
4. Open [MyAnimeList](https://myanimelist.net/)
5. Reload the tab. Seasonal, Top, and Search hide non-Japanese listing cards. Open a title URL and that page stays visible.

Toolbar popup: **Hide non-Japanese listings**. Off leaves listings as MAL shows them.

## What it does

On Seasonal, Top, and Search only, hide a listing card if any of these fire, unless AniList says Japan:

| Signal | When |
|--------|------|
| Title language | Simplified Chinese in the title, or a pinyin title (`Shiguang Dailiren`, `Niu Lai`) |
| Strong Chinese hosts | Official/streaming links to Bilibili, Tencent Video (`v.qq.com`), iQIYI, Youku, WeTV |
| Card text | `Bilibili` / `Tencent` / `iQIYI` / `Youku` in the tile |
| AniList origin | Any country other than `JP` (`CN`, `TW`, `HK`, `KR`) |

The anime title page (`/anime/{id}/...`) is never hidden, including Niu Lai. AniList `JP` always wins on listings, so a bad pinyin read of a Japanese title comes back. Baidu Baike and Douban wiki links are ignored.

| Surface | Behavior |
|---------|----------|
| Seasonal | non-Japanese tiles hidden |
| Top | non-Japanese ranking rows hidden |
| Search | non-Japanese result rows hidden |
| Title page | shown |

## Checks

```bash
./scripts/verify.sh
```

## Residual limits

- English-titled donghua wait on AniList (To Be Hero X, The Ribbon Hero).
- A few pinyin titles with no q/x/zh/ong/uan/iu syllable wait on AniList (Yao Shen Ji).
- Co-productions use the one country AniList stores.
- Home sliders and your list are left as MAL shows them.
- After Load unpacked, reload the extension and the MAL tab.
