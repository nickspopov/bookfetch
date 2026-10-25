Bookfetch is an Expo (SDK 57) / React Native app: an OPDS 1.x catalog client that downloads books and hands them to
other reader apps. iPhone and Android, English only.

## Expo changes every SDK — check before using an API

Read the versioned docs at https://docs.expo.dev/versions/v57.0.0/ (or the package's `.d.ts` in `node_modules`) before
touching an Expo, EAS or React Native API. `expo-file-system` uses the `File`/`Directory`/`Paths` API.

## Commands

```bash
npx expo install <package>  # add dependencies with SDK-compatible versions
npx expo run:ios            # development build
npm run typecheck && npm test && npm run lint
```

## Layout and rules

- Routes live in `src/app` (Expo Router); non-route code in `src/lib`, `src/ui`, `src/features`.
- `src/opds` is the OPDS core (parser, OpenSearch, HTTP client); the app imports it from `@/opds` only.
- `ios/` and `android/` are generated (CNG): configure native behaviour in `app.config.ts` and `plugins/`.
- Native UI first: `NativeTabs`, native stack headers and search, `formSheet` routes for sheets, SF Symbols on iOS
  with Material Symbols on Android.
- No analytics, crash SDKs, accounts or JS crypto. MMKV without an encryption key; secrets in `expo-secure-store`.
