# Bookfetch

Your book server, in your pocket. Browse, download, open in your favorite reader.

Bookfetch is a small iPhone and Android client for OPDS 1.x catalogs you add yourself — Calibre-Web, Kavita, Komga,
Project Gutenberg or any OPDS 1.2 server. It is a fetcher, not a reader: browse or search a catalog, download a book,
then open it in Apple Books, Kindle, KOReader, Moon+ or save it to Files.

- No account, no backend, no analytics, no ads.
- Logins and catalog keys stay in the iOS Keychain / Android Keystore.
- Downloads appear in Files → On My iPhone → Bookfetch.

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
`src/opds` the OPDS parser and HTTP client. The 2023 SwiftUI version of the app lives in `legacy/swiftui`.

Version and build number come from `version.json`.

## License

MIT
