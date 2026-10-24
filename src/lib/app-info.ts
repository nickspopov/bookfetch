import versionFile from '../../version.json';

export const APP_VERSION: string = versionFile.version;
export const APP_BUILD: number = versionFile.build;

export const USER_AGENT = `Bookfetch/${APP_VERSION} (+https://bookfetch.nickpopov.com)`;

export const LINKS = {
  privacy: 'https://bookfetch.nickpopov.com/privacy',
  support: 'https://bookfetch.nickpopov.com/support',
  source: 'https://github.com/nickspopov/opdsreader',
} as const;
