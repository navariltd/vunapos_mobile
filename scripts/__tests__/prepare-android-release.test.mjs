import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { prepareAndroidRelease, releaseConfigurationBlock } from "../prepare-android-release.mjs";

test("release Gradle configuration runs before variant configuration", () => {
  const block = releaseConfigurationBlock();

  assert.doesNotMatch(block, /afterEvaluate/);
  assert.match(block, /android\.defaultConfig\.versionCode = vunaposReleaseVersionCode/);
  assert.match(block, /android\.defaultConfig\.versionName = vunaposReleaseVersionName/);
  assert.match(block, /abiFilters 'armeabi-v7a', 'arm64-v8a'/);
  assert.match(block, /android\.buildTypes\.getByName\('release'\)\.signingConfig = vunaposReleaseSigning/);
});

test("release Gradle configuration fails closed without signing inputs", () => {
  const block = releaseConfigurationBlock();

  assert.match(block, /Release signing is required/);
  assert.match(block, /vunaposReleaseTaskRequested && !vunaposHasReleaseSigning/);
});

test("updates an existing generated release block when its ABI policy changes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vunapos-release-test-"));
  const buildFile = join(directory, "build.gradle");
  try {
    await writeFile(buildFile, "apply plugin: 'com.android.application'\n\n// @vunapos-release-signing\nabiFilters 'arm64-v8a'\n");
    assert.equal(await prepareAndroidRelease(buildFile), true);
    const prepared = await readFile(buildFile, "utf8");
    assert.match(prepared, /abiFilters 'armeabi-v7a', 'arm64-v8a'/);
    assert.doesNotMatch(prepared, /abiFilters 'arm64-v8a'/);
    assert.equal(await prepareAndroidRelease(buildFile), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
