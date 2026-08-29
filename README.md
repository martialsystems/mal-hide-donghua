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
| **Version** | 1.0.0 |
| **License** | Proprietary: see [LICENSE](LICENSE) and [Terms](docs/TERMS_OF_USE.md) |

**We do not save your data.** Your list and page HTML are not uploaded to Martial Systems LLC. MAL ids are sent to AniList (`https://graphql.anilist.co/`) to read `countryOfOrigin`. On/off and the id cache stay in your Chrome profile. [Privacy Policy](docs/PRIVACY_POLICY.md).

Not affiliated with Google LLC, MyAnimeList, or AniList.

## Load unpacked

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. **Load unpacked** and choose this folder
4. Open [MyAnimeList](https://myanimelist.net/)
5. Seasonal, Top, Search, home sliders, and title pages hide CN / TW / HK origins

Toolbar popup: **Hide Chinese animation**. Off leaves the page as MAL shows it. On a hidden title page, **Show this page** keeps that id visible until Chrome exits.

## What it does

MAL has no country filter. AniList does (`CN`, `TW`, `HK`, `JP`, `KR`). The Extension reads MAL anime ids from `/anime/{id}` links, asks AniList, and hides the listing card when origin is China, Taiwan, or Hong Kong.

| Surface | Behavior |
|---------|----------|
| Seasonal tiles | `.seasonal-anime` hidden |
| Top ranking rows | `tr.ranking-list` hidden |
| Search rows | result `tr` hidden |
| Home / rec sliders | `li.btn-anime` hidden |
| Your list rows | `.list-table-data` hidden |
| Title page | `#content` hidden, with Show this page |
| Manga / manhua | Ignored |
| Korean aeni | Left visible |
| Id missing on AniList | Left visible |

## Checks

```bash
./scripts/verify.sh
```

## Residual limits

- First visit of an uncached id waits on AniList; the card can flash once.
- Co-productions use the one country AniList stores.
- Forum text links are not listing cards, so they stay.
- MAL markup changes can miss a layout until selectors are updated.
