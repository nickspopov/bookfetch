# Bookfetch

An iPhone and Android client for OPDS 1.x book catalogs you add yourself — Calibre-Web, Kavita, Komga, Project
Gutenberg or any OPDS 1.2 server. It fetches, it does not read: browse or search a catalog, download a book, then open
it in Apple Books, Kindle, KOReader, Moon+ or save it to Files.

- No account, no backend, no analytics, no ads.
- Logins and catalog keys stay in the iOS Keychain / Android Keystore.
- Downloads appear in Files → On My iPhone → Bookfetch.

Website: https://nickpopov.com/bookfetch/

## How it was built

Bookfetch is the Expo successor of [opdsreader](https://github.com/nickspopov/opdsreader), a SwiftUI OPDS reader I
wrote by hand in 2023 for a single hard-coded catalog. This version was built with AI coding agents, from idea to store
builds in one night:

- Product brief, name, v1 scope and App Review risks from three models working independently, merged into one plan.
- Claude Code agents in parallel git worktrees: one wrote the OPDS core (`src/opds`) test-first against real feeds
  from Gutenberg, Kavita, Komga and Calibre-Web, another built the app screens.
- Every branch reviewed by a different model (OpenAI Codex, Kimi) before merge; findings — credentials leaking across
  origins, catalog keys reaching storage, stale results from a dismissed sheet — went back to fix lanes and were
  re-reviewed.
- Release through fastlane: signed IPA and AAB, store screenshots from Release builds, smoke runs on a Pixel and the
  iOS simulator.

My part was the product calls, the review gates and the release; the code is the agents'.

## Development

Expo SDK 57, Expo Router, React Native 0.86.

```bash
npm ci
npx expo run:ios        # development build on the simulator
npm run typecheck
npm test
npm run lint
```

`src/app` holds the routes, `src/lib` storage, downloads and catalog logic, `src/ui` shared components and
`src/opds` the OPDS parser and HTTP client. Building and uploading: `docs/technical-solutions/build-release.md`.
Version and build number come from `version.json`.

`site/` has the generators for the sample OPDS catalog, the app icons and the store screenshots.

## License

MIT
