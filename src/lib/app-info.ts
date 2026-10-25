import versionFile from '../../version.json';

export const APP_VERSION: string = versionFile.version;
export const APP_BUILD: number = versionFile.build;

export const USER_AGENT = `Bookfetch/${APP_VERSION} (+https://nickpopov.com/bookfetch)`;

export const LINKS = {
  privacy: 'https://nickpopov.com/bookfetch/privacy/',
  support: 'https://nickpopov.com/bookfetch/support/',
  source: 'https://github.com/nickspopov/bookfetch',
} as const;
