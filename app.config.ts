import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ConfigContext, ExpoConfig } from 'expo/config';

const applicationId = 'com.nickpopov.bookfetch';
const appleTeamId = process.env.APPLE_TEAM_ID || undefined;

const brandColor = '#1F3A5F';
const brandColorDark = '#0E1B2C';

type VersionFile = { version: string; build: number };

function readVersionFile(projectRoot: string): VersionFile {
  const parsed: unknown = JSON.parse(readFileSync(join(projectRoot, 'version.json'), 'utf8'));
  const { version, build } = (parsed ?? {}) as Partial<VersionFile>;
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error('version.json: "version" must be MAJOR.MINOR.PATCH digits such as "1.0.0"');
  }
  if (typeof build !== 'number' || !Number.isInteger(build) || build < 1) {
    throw new Error('version.json: "build" must be a positive integer');
  }
  return { version, build };
}

export default ({ config, projectRoot }: ConfigContext): ExpoConfig => {
  const { version, build } = readVersionFile(projectRoot);
  return {
    ...config,
    name: 'Bookfetch',
    slug: 'bookfetch',
    scheme: 'bookfetch',
    version,
    platforms: ['ios', 'android'],
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    userInterfaceStyle: 'automatic',
    ios: {
      bundleIdentifier: applicationId,
      buildNumber: String(build),
      ...(appleTeamId ? { appleTeamId } : {}),
      supportsTablet: false,
      infoPlist: {
        CFBundleDisplayName: 'Bookfetch',
        ITSAppUsesNonExemptEncryption: false,
        // People connect their own servers, often over plain http on a home network.
        NSAppTransportSecurity: { NSAllowsArbitraryLoads: true, NSAllowsLocalNetworking: true },
        NSLocalNetworkUsageDescription: 'Bookfetch connects to book servers on your local network that you add.',
        // Downloads show up in Files → On My iPhone → Bookfetch.
        UIFileSharingEnabled: true,
        LSSupportsOpeningDocumentsInPlace: true,
      },
      privacyManifests: {
        NSPrivacyTracking: false,
        NSPrivacyTrackingDomains: [],
        NSPrivacyCollectedDataTypes: [],
        NSPrivacyAccessedAPITypes: [
          {
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
            NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
          },
          {
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
            NSPrivacyAccessedAPITypeReasons: ['C617.1'],
          },
        ],
      },
    },
    android: {
      package: applicationId,
      versionCode: build,
      adaptiveIcon: {
        foregroundImage: './assets/images/android-icon-foreground.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
        backgroundColor: brandColor,
      },
      blockedPermissions: [
        'android.permission.RECORD_AUDIO',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.SYSTEM_ALERT_WINDOW',
        'android.permission.READ_PHONE_STATE',
      ],
      predictiveBackGestureEnabled: false,
    },
    plugins: [
      'expo-router',
      'expo-dev-client',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 120,
          resizeMode: 'contain',
          backgroundColor: brandColor,
          dark: { image: './assets/images/splash-icon.png', backgroundColor: brandColorDark },
        },
      ],
      'expo-secure-store',
      'expo-sharing',
      'expo-image',
      ['expo-build-properties', { ios: { enableSceneSupport: true }, android: { usesCleartextTraffic: true } }],
      './plugins/with-android-signing',
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
  };
};
