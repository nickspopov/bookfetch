/// <reference types="jest" />
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { applyUploadSigning } = require('../../plugins/with-android-signing') as {
  applyUploadSigning: (contents: string) => string;
};

const TEMPLATE = `apply plugin: "com.android.application"

android {
    namespace 'com.nickpopov.bookfetch'
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            signingConfig signingConfigs.debug
            minifyEnabled enableMinifyInReleaseBuilds
        }
    }
}
`;

describe('with-android-signing', () => {
  const out = applyUploadSigning(TEMPLATE);

  it('adds an upload signing config read from the BOOKFETCH_UPLOAD_* Gradle properties', () => {
    for (const name of ['STORE_FILE', 'STORE_PASSWORD', 'KEY_ALIAS', 'KEY_PASSWORD']) {
      expect(out).toContain(`project.property('BOOKFETCH_UPLOAD_${name}')`);
    }
    expect(out).not.toContain('SIDESEEN');
    expect(out.indexOf('upload {')).toBeGreaterThan(out.indexOf('signingConfigs {'));
    expect(out.indexOf('upload {')).toBeLessThan(out.indexOf('buildTypes {'));
  });

  it('signs release with the upload key when present and keeps debug on the debug key', () => {
    expect(out).toContain("signingConfig signingConfigs.findByName('upload') ?: signingConfigs.debug");
    const debugBlock = out.slice(out.indexOf('debug {', out.indexOf('buildTypes')), out.indexOf('release {'));
    expect(debugBlock).toContain('signingConfig signingConfigs.debug');
  });

  it('is idempotent', () => {
    expect(applyUploadSigning(out)).toBe(out);
  });

  it('fails loudly when the template changes shape', () => {
    expect(() => applyUploadSigning('android {\n}\n')).toThrow(/with-android-signing/);
  });
});
