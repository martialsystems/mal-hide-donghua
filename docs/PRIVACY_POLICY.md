# Privacy Policy

**Hide Donghua** (the “Extension”)

**Effective date:** August 29, 2026
**Last updated:** August 29, 2026
**Developer / Data controller:** Martial Systems LLC
**Contact:** martialsys@gmail.com
**Website:** https://martialsys.net/

## 1. Summary

**We do not save your MyAnimeList list or page HTML.**

| Question | Answer |
|----------|--------|
| Do we save the pages you visit? | **No.** |
| Do we upload your anime list? | **No.** |
| Do we sell or share personal data with advertisers? | **No.** |
| Do we run analytics or tracking pixels? | **No.** |
| What is written to disk? | On/off in `chrome.storage.sync`. MAL id to country cache in `chrome.storage.local`. “Show this page” ids in `chrome.storage.session`. |
| Who sees MAL ids? | AniList (`https://graphql.anilist.co/`), so the Extension can read `countryOfOrigin`. |

## 2. Who we are

The Extension is developed and offered by **Martial Systems LLC**, an Indiana limited liability company (“we,” “us,” or “our”).

Privacy inquiries: **martialsys@gmail.com**
Company site: **https://martialsys.net/**

## 3. Scope

This Policy applies only to the Extension as an unpacked build you install yourself or as later distributed through the Chrome Web Store. It does not apply to Google LLC, Chrome, MyAnimeList, or AniList.

## 4. Information the Extension processes

On your device the Extension may:

- Read **MyAnimeList anime ids** from links and the current URL;
- Send those ids to **AniList GraphQL** (`https://graphql.anilist.co/`) to read `countryOfOrigin`;
- Keep id to country pairs in **`chrome.storage.local`** so the same titles are not looked up on every scan;
- Keep the on/off flag in **`chrome.storage.sync`**;
- Keep “Show this page” ids in **`chrome.storage.session`** until Chrome exits.

This happens **on your device**, except the AniList lookup. We do **not** operate a backend that receives your URLs, list, or page HTML.

We do not collect accounts, passwords, payment data, geolocation, or advertising identifiers.

## 5. Permissions

| Permission | Why |
|------------|-----|
| `storage` | Remember on/off, the origin cache, and session allows |
| Host access to `myanimelist.net` | Run the content script that hides listings |
| Host access to `graphql.anilist.co` | Look up country of origin by MAL id |

## 6. Contact

martialsys@gmail.com
