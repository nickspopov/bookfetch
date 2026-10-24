const { withAppBuildGradle } = require('expo/config-plugins');

const PROPERTIES = [
  'BOOKFETCH_UPLOAD_STORE_FILE',
  'BOOKFETCH_UPLOAD_STORE_PASSWORD',
  'BOOKFETCH_UPLOAD_KEY_ALIAS',
  'BOOKFETCH_UPLOAD_KEY_PASSWORD',
];

const UPLOAD_CONFIG = `        if ([${PROPERTIES.map((name) => `'${name}'`).join(', ')}].every { project.hasProperty(it) }) {
            upload {
                storeFile file(project.property('BOOKFETCH_UPLOAD_STORE_FILE'))
                storePassword project.property('BOOKFETCH_UPLOAD_STORE_PASSWORD')
                keyAlias project.property('BOOKFETCH_UPLOAD_KEY_ALIAS')
                keyPassword project.property('BOOKFETCH_UPLOAD_KEY_PASSWORD')
            }
        }
`;

const DEBUG_SIGNING = 'signingConfig signingConfigs.debug';
const RELEASE_SIGNING = "signingConfig signingConfigs.findByName('upload') ?: signingConfigs.debug";

function closingBrace(contents, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < contents.length; i += 1) {
    if (contents[i] === '{') depth += 1;
    else if (contents[i] === '}' && --depth === 0) return i;
  }
  return -1;
}

function block(contents, pattern, from = 0, to = contents.length) {
  const match = pattern.exec(contents.slice(from, to));
  if (!match) return null;
  const open = from + match.index + match[0].lastIndexOf('{');
  const close = closingBrace(contents, open);
  return close === -1 || close > to ? null : { open, close };
}

function lineStart(contents, index) {
  return contents.lastIndexOf('\n', index) + 1;
}

function applyUploadSigning(contents) {
  if (contents.includes(RELEASE_SIGNING)) return contents;

  const android = block(contents, /^android\s*\{/m);
  const signingConfigs = android && block(contents, /^\s*signingConfigs\s*\{/m, android.open, android.close);
  const buildTypes = android && block(contents, /^\s*buildTypes\s*\{/m, android.open, android.close);
  const release = buildTypes && block(contents, /^\s*release\s*\{/m, buildTypes.open, buildTypes.close);
  const releaseBody = release && contents.slice(release.open, release.close);
  if (!signingConfigs || !releaseBody?.includes(DEBUG_SIGNING) || signingConfigs.close > release.open) {
    throw new Error(
      'with-android-signing: app/build.gradle has no signingConfigs block or release signingConfig to update',
    );
  }

  const uploadAt = lineStart(contents, signingConfigs.close);
  const signedRelease = releaseBody.replace(DEBUG_SIGNING, RELEASE_SIGNING);
  return (
    contents.slice(0, uploadAt) +
    UPLOAD_CONFIG +
    contents.slice(uploadAt, release.open) +
    signedRelease +
    contents.slice(release.close)
  );
}

/** @type {import('expo/config-plugins').ConfigPlugin} */
function withAndroidSigning(config) {
  return withAppBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.language !== 'groovy') {
      throw new Error('with-android-signing: app/build.gradle must be Groovy');
    }
    gradleConfig.modResults.contents = applyUploadSigning(gradleConfig.modResults.contents);
    return gradleConfig;
  });
}

module.exports = withAndroidSigning;
module.exports.applyUploadSigning = applyUploadSigning;
