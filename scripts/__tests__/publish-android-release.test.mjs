import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  UploadError,
  buildCurlArguments,
  parseArguments,
  uploadRelease,
  validateUploadResponse,
} from "../publish-android-release.mjs";

const input = {
  applicationId: "ke.co.navari.vunapos",
  versionName: "1.2.0",
  versionCode: 120,
  sha256: "a".repeat(64),
  fileSize: 1234,
};

test("rejects incomplete upload arguments", () => {
  assert.throws(() => parseArguments(["--apk", "release.apk"]), UploadError);
});

test("parses safe upload arguments", () => {
  const result = parseArguments([
    "--apk", "release.apk", "--application-id", input.applicationId, "--version-name", input.versionName,
    "--version-code", "120", "--release-channel", "Production", "--expected-sha256", input.sha256,
  ]);
  assert.equal(result.versionCode, 120);
  assert.equal(result.expectedSha256, input.sha256);
});

test("accepts only a matching Draft response", () => {
  const result = validateUploadResponse(
    { message: { release: "MRM-REL-00001", status: "Draft", application_id: input.applicationId, version_name: input.versionName, version_code: 120, sha256: input.sha256, file_size: 1234 } },
    input,
  );
  assert.equal(result.release, "MRM-REL-00001");
  assert.throws(
    () => validateUploadResponse({ message: { release: "MRM-REL-00001", status: "Published" } }, input),
    UploadError,
  );
});

test("formats the expected multipart request without shell interpolation", () => {
  const args = buildCurlArguments({
    endpoint: new URL("https://nl-vms.frappe.cloud/api/method/mobile_release_manager.api.releases.upload_release"),
    apiKey: "key",
    apiSecret: "secret",
    input: {
      apk: "release.apk",
      ...input,
      releaseChannel: "Production",
      releaseNotes: "Safe notes",
      gitCommitSha: "abcdef1",
      githubRunUrl: "https://github.com/navariltd/vunapos_mobile/actions/runs/1",
    },
    metadata: { sha256: input.sha256, fileSize: input.fileSize },
  });
  assert.ok(args.includes("file=@" + process.cwd() + "/release.apk;type=application/vnd.android.package-archive"));
  assert.ok(args.includes("application_id=ke.co.navari.vunapos"));
  assert.ok(args.includes("sha256=" + input.sha256));
  assert.ok(args.includes("--form-string"));
  assert.equal(args.at(-1), "https://nl-vms.frappe.cloud/api/method/mobile_release_manager.api.releases.upload_release");
});

test("surfaces an upload transport failure", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vunapos-upload-test-"));
  const apk = join(directory, "release.apk");
  try {
    await writeFile(apk, "test apk");
    await assert.rejects(
      uploadRelease(
        {
          apk,
          ...input,
          releaseChannel: "Production",
          releaseNotes: "",
          gitCommitSha: "",
          githubRunUrl: "",
        },
        {
          FRAPPE_URL: "https://nl-vms.frappe.cloud",
          FRAPPE_API_KEY: "key",
          FRAPPE_API_SECRET: "secret",
        },
        async () => {
          throw new UploadError("network unavailable");
        },
      ),
      /network unavailable/,
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
