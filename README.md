# Japanese Only

<p align="right">
  <a href="https://ko-fi.com/martialgames"><img src="https://img.shields.io/badge/Donate-Ko--fi-ff5e5b?style=flat-square&amp;logo=ko-fi&amp;logoColor=white" alt="Donate on Ko-fi" /></a>
  &nbsp;
  <a href="https://martialsys.net/"><img src="https://img.shields.io/badge/Martial%20Systems-site-1a3a2a?style=flat-square" alt="Martial Systems" /></a>
</p>

**Martial Systems LLC** product: Chrome extension that keeps Japanese animation listings on MyAnimeList Seasonal, Top, and Search.

| | |
|--|--|
| **Publisher** | Martial Systems LLC |
| **Support** | martialsys@gmail.com · [Ko-fi](https://ko-fi.com/martialgames) |
| **Web** | https://martialsys.net/ |
| **Version** | 1.3.0 |
| **License** | Proprietary: see [LICENSE](LICENSE) and [Terms](docs/TERMS_OF_USE.md) |

**We do not save your data.** Your list and page HTML are not uploaded to Martial Systems LLC. MAL ids are sent to AniList (`https://graphql.anilist.co/`) to read `countryOfOrigin`. [Privacy Policy](docs/PRIVACY_POLICY.md).

Not affiliated with Google LLC, MyAnimeList, or AniList.

## Load unpacked

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. **Load unpacked** and choose this folder
4. Open MyAnimeList Seasonal, Top, or Search
5. Reload the extension, then reload the tab

Toolbar popup: **Hide non-Japanese listings**. Off leaves listings as MAL shows them.

## What it does

On Seasonal, Top, and Search, a listing card stays if it is Japanese. Everything else on those pages is hidden.

| Signal | Result on listings |
|--------|--------------------|
| AniList origin `JP` | shown |
| AniList origin any other country | hidden |
| Japanese title cues (kana, `no`/`ga`/`wa`, `tsu`, `tensei`, `isekai`) before AniList answers | shown |
| No Japanese cue and no AniList origin yet | hidden until AniList says `JP` |

The title page (`/anime/{id}/...`) is never hidden.

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

- English Japanese titles with no Japanese cue (One Piece) hide for a moment, then AniList `JP` brings them back.
- Home sliders and your list are left as MAL shows them.
- After Load unpacked, reload the extension and the MAL tab.
