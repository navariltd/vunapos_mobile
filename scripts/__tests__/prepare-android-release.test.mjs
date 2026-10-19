import assert from "node:assert/strict";
import test from "node:test";

import { releaseConfigurationBlock } from "../prepare-android-release.mjs";

test("release Gradle configuration runs before variant configuration", () => {
  const block = releaseConfigurationBlock();

  assert.doesNotMatch(block, /afterEvaluate/);
  assert.match(block, /android\.defaultConfig\.versionCode = vunaposReleaseVersionCode/);
  assert.match(block, /android\.defaultConfig\.versionName = vunaposReleaseVersionName/);
  assert.match(block, /abiFilters 'arm64-v8a'/);
  assert.match(block, /android\.buildTypes\.getByName\('release'\)\.signingConfig = vunaposReleaseSigning/);
});

test("release Gradle configuration fails closed without signing inputs", () => {
  const block = releaseConfigurationBlock();

  assert.match(block, /Release signing is required/);
  assert.match(block, /vunaposReleaseTaskRequested && !vunaposHasReleaseSigning/);
});
