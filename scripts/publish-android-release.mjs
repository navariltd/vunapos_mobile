import { createHash } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const SHA256 = /^[a-f\d]{64}$/i;
const PACKAGE_ID = /^[A-Za-z][A-Za-z\d_]*(?:\.[A-Za-z][A-Za-z\d_]*)+$/;

export class UploadError extends Error {}

function requireValue(value, label) {
  if (!value || !String(value).trim()) throw new UploadError(`${label} is required.`);
  return String(value).trim();
}

function positiveInteger(value, label) {
  if (!/^\d+$/.test(String(value)) || Number(value) <= 0 || !Number.isSafeInteger(Number(value))) {
    throw new UploadError(`${label} must be a positive integer.`);
  }
  return Number(value);
}

export function parseArguments(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (!option.startsWith("--")) throw new UploadError(`Unexpected argument: ${option}`);
    const name = option.slice(2);
    if (!(name in { apk: 1, "application-id": 1, "version-name": 1, "version-code": 1, "release-channel": 1, "release-notes": 1, "git-commit-sha": 1, "github-run-url": 1, "expected-sha256": 1, "expected-file-size": 1 })) {
      throw new UploadError(`Unsupported option: ${option}`);
    }
    if (values[name] !== undefined || index + 1 >= args.length) {
      throw new UploadError(`Option ${option} requires exactly one value.`);
    }
    values[name] = args[++index];
  }

  const applicationId = requireValue(values["application-id"], "--application-id");
  if (!PACKAGE_ID.test(applicationId)) throw new UploadError("--application-id is not a valid Android package ID.");
  const versionName = requireValue(values["version-name"], "--version-name");
  const versionCode = positiveInteger(values["version-code"], "--version-code");
  const releaseChannel = requireValue(values["release-channel"], "--release-channel");
  const apk = requireValue(values.apk, "--apk");
  const expectedSha256 = values["expected-sha256"]?.toLowerCase();
  if (expectedSha256 && !SHA256.test(expectedSha256)) {
    throw new UploadError("--expected-sha256 must be a SHA-256 digest.");
  }
  return {
    apk,
    applicationId,
    versionName,
    versionCode,
    releaseChannel,
    releaseNotes: values["release-notes"] ?? "",
    gitCommitSha: values["git-commit-sha"] ?? "",
    githubRunUrl: values["github-run-url"] ?? "",
    expectedSha256,
    expectedFileSize: values["expected-file-size"]
      ? positiveInteger(values["expected-file-size"], "--expected-file-size")
      : undefined,
  };
}

export async function artifactMetadata(path) {
  const stat = await fs.stat(path);
  if (!stat.isFile() || stat.size <= 0) throw new UploadError("APK path must be a non-empty file.");
  const digest = createHash("sha256");
  await new Promise((resolveStream, rejectStream) => {
    createReadStream(path).on("data", (chunk) => digest.update(chunk)).on("error", rejectStream).on("end", resolveStream);
  });
  return { sha256: digest.digest("hex"), fileSize: stat.size };
}

export function validateUploadResponse(payload, expected) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || !("message" in payload)) {
    throw new UploadError("Frappe returned an invalid upload response.");
  }
  const response = payload.message;
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    throw new UploadError("Frappe returned an invalid release payload.");
  }
  const release = response;
  if (
    typeof release.release !== "string" ||
    !release.release ||
    release.status !== "Draft" ||
    release.application_id !== expected.applicationId ||
    release.version_name !== expected.versionName ||
    Number(release.version_code) !== expected.versionCode ||
    String(release.sha256).toLowerCase() !== expected.sha256 ||
    Number(release.file_size) !== expected.fileSize
  ) {
    throw new UploadError("Frappe did not confirm the expected Draft release metadata.");
  }
  return {
    release: release.release,
    status: release.status,
    applicationId: release.application_id,
    versionName: release.version_name,
    versionCode: Number(release.version_code),
    sha256: String(release.sha256).toLowerCase(),
    fileSize: Number(release.file_size),
  };
}

export function buildCurlArguments({ endpoint, apiKey, apiSecret, input, metadata }) {
  const form = (name, value) => ["--form-string", `${name}=${value}`];
  return [
    "--silent",
    "--show-error",
    "--fail-with-body",
    "--retry",
    "3",
    "--retry-delay",
    "2",
    "--retry-connrefused",
    "-H",
    `Authorization: token ${apiKey}:${apiSecret}`,
    "-F",
    `file=@${resolve(input.apk)};type=application/vnd.android.package-archive`,
    ...form("application_id", input.applicationId),
    ...form("version_name", input.versionName),
    ...form("version_code", input.versionCode),
    ...form("release_channel", input.releaseChannel),
    ...form("release_notes", input.releaseNotes),
    ...form("git_commit_sha", input.gitCommitSha),
    ...form("github_run_url", input.githubRunUrl),
    ...form("sha256", metadata.sha256),
    endpoint.toString(),
  ];
}

function runCurl(args) {
  return new Promise((resolveProcess, rejectProcess) => {
    const child = spawn("curl", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", rejectProcess);
    child.on("close", (code) => {
      if (code !== 0) {
        rejectProcess(new UploadError(`Frappe upload failed (curl exit ${code}): ${stderr.trim() || stdout.slice(0, 500)}`));
      } else {
        resolveProcess(stdout);
      }
    });
  });
}

export async function uploadRelease(input, environment = process.env, request = runCurl) {
  const frappeUrl = requireValue(environment.FRAPPE_URL, "FRAPPE_URL").replace(/\/$/, "");
  const apiKey = requireValue(environment.FRAPPE_API_KEY, "FRAPPE_API_KEY");
  const apiSecret = requireValue(environment.FRAPPE_API_SECRET, "FRAPPE_API_SECRET");
  let endpoint;
  try {
    endpoint = new URL("/api/method/mobile_release_manager.api.releases.upload_release", frappeUrl);
  } catch {
    throw new UploadError("FRAPPE_URL must be an absolute URL.");
  }
  if (endpoint.protocol !== "https:") throw new UploadError("FRAPPE_URL must use HTTPS.");

  const metadata = await artifactMetadata(input.apk);
  if (input.expectedSha256 && input.expectedSha256 !== metadata.sha256) {
    throw new UploadError("APK SHA-256 differs from the prior verification result.");
  }
  if (input.expectedFileSize && input.expectedFileSize !== metadata.fileSize) {
    throw new UploadError("APK file size differs from the prior verification result.");
  }

  const args = buildCurlArguments({ endpoint, apiKey, apiSecret, input, metadata });
  const body = await request(args);
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new UploadError("Frappe upload succeeded at HTTP level but returned invalid JSON.");
  }
  return validateUploadResponse(payload, { ...input, ...metadata });
}

export async function main() {
  const input = parseArguments(process.argv.slice(2));
  const result = await uploadRelease(input);
  console.log(JSON.stringify(result));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
