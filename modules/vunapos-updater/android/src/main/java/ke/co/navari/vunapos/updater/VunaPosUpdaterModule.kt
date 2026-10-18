package ke.co.navari.vunapos.updater

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.content.pm.Signature
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import androidx.core.content.FileProvider
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

/**
 * Native boundary for APK distribution. DownloadManager owns transfers so a
 * download survives process death; this module owns only update APK files in
 * the app-specific external-files directory, never POS data or SQLite files.
 */
class VunaPosUpdaterModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: error("VunaPOS update module is not attached to an Android context.")

  private val preferences
    get() = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

  override fun definition() = ModuleDefinition {
    Name("VunaPosUpdater")

    AsyncFunction("getInstalledApplication") {
      installedApplication()
    }

    AsyncFunction("getSnapshot") {
      snapshot()
    }

    AsyncFunction("setLastCheckAt") { timestamp: Double ->
      preferences.edit().putLong(KEY_LAST_CHECK_AT, timestamp.toLong()).apply()
    }

    AsyncFunction("enqueueDownload") { release: Map<String, Any?> ->
      enqueueDownload(parseRelease(release))
    }

    AsyncFunction("verifyDownloadedUpdate") {
      verifyDownloadedUpdate()
    }

    AsyncFunction("clearUpdate") {
      clearUpdate()
    }

    AsyncFunction("isInstallPermissionGranted") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) true
      else context.packageManager.canRequestPackageInstalls()
    }

    AsyncFunction("openInstallPermissionSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
          data = Uri.parse("package:${context.packageName}")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
      }
    }

    AsyncFunction("installVerifiedUpdate") {
      installVerifiedUpdate()
    }
  }

  private fun installedApplication(): Map<String, Any> {
    val info = installedPackageInfo()
    return mapOf(
      "packageName" to context.packageName,
      "versionCode" to versionCode(info),
      "versionName" to (info.versionName ?: "")
    )
  }

  private fun enqueueDownload(release: Release): Map<String, Any?> {
    require(release.versionCode > versionCode(installedPackageInfo())) {
      "The available update is not newer than this installed application."
    }
    require(release.downloadUrl.startsWith("https://")) { "Only HTTPS update downloads are permitted." }

    val existing = readRelease()
    if (existing?.release == release) {
      val existingSnapshot = snapshot()
      if (existingSnapshot["status"] in setOf("pending", "running", "successful", "ready")) {
        return existingSnapshot
      }
    }
    clearUpdate()

    val file = updateFile(release)
    file.parentFile?.mkdirs()
    if (file.exists() && !file.delete()) error("Could not replace an obsolete update download.")

    val request = DownloadManager.Request(Uri.parse(release.downloadUrl)).apply {
      setMimeType(APK_MIME_TYPE)
      setTitle("VunaPOS update ${release.versionName}")
      setDescription("Downloading an application update")
      setAllowedOverMetered(true)
      setAllowedOverRoaming(false)
      setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
      setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, file.name)
    }
    val downloadId = downloadManager().enqueue(request)
    preferences.edit()
      .putString(KEY_RELEASE, release.toJson().toString())
      .putLong(KEY_DOWNLOAD_ID, downloadId)
      .putBoolean(KEY_VERIFIED, false)
      .remove(KEY_ERROR)
      .apply()
    return snapshot()
  }

  private fun verifyDownloadedUpdate(): Map<String, Any> {
    val release = readRelease()?.release ?: error("No application update is available to verify.")
    val current = snapshot()
    require(current["status"] == "successful" || current["status"] == "ready") {
      "The update download has not completed."
    }
    val file = updateFile(release)
    require(file.isFile && file.canRead()) { "The downloaded update file is unavailable." }
    require(file.length() == release.fileSize) { "The downloaded update size did not match the published release." }

    val digest = sha256(file)
    require(digest.equals(release.sha256, ignoreCase = true)) {
      "The downloaded update checksum did not match the published release."
    }

    val archiveInfo = archivePackageInfo(file) ?: error("The downloaded file is not a valid Android APK.")
    require(archiveInfo.packageName == context.packageName) {
      "The downloaded APK is for a different Android application."
    }
    require(versionCode(archiveInfo) > versionCode(installedPackageInfo())) {
      "The downloaded APK is not newer than the installed application."
    }
    require(signaturesAreCompatible(archiveInfo, installedPackageInfo())) {
      "The downloaded APK is not signed by a compatible VunaPOS signing identity."
    }

    preferences.edit().putBoolean(KEY_VERIFIED, true).remove(KEY_ERROR).apply()
    return mapOf(
      "fileUri" to Uri.fromFile(file).toString(),
      "packageName" to archiveInfo.packageName,
      "versionCode" to versionCode(archiveInfo)
    )
  }

  private fun installVerifiedUpdate() {
    require(preferences.getBoolean(KEY_VERIFIED, false)) {
      "Verify the downloaded update before installing it."
    }
    // Re-check all integrity and package invariants immediately before passing
    // the APK to Android's installer.
    verifyDownloadedUpdate()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !context.packageManager.canRequestPackageInstalls()) {
      error("Android permission to install updates from VunaPOS has not been granted.")
    }
    val release = readRelease()?.release ?: error("No verified update is available.")
    val file = updateFile(release)
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.updates.fileprovider", file)
    val intent = Intent(Intent.ACTION_VIEW).apply {
      setDataAndType(uri, APK_MIME_TYPE)
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
      clipData = android.content.ClipData.newRawUri("VunaPOS update", uri)
    }
    context.startActivity(intent)
  }

  private fun snapshot(): Map<String, Any?> {
    val stored = readRelease()
    val lastCheckAt = preferences.getLong(KEY_LAST_CHECK_AT, 0L).takeIf { it > 0L }
    if (stored == null) {
      return snapshotMap("idle", null, null, 0L, null, null, lastCheckAt)
    }
    // If Android completed an update while VunaPOS was closed, the old APK is
    // no longer installable and must not be offered again after relaunch.
    if (stored.release.versionCode <= versionCode(installedPackageInfo())) {
      clearUpdate()
      return snapshotMap("idle", null, null, 0L, null, null, lastCheckAt)
    }
    val file = updateFile(stored.release)
    if (preferences.getBoolean(KEY_VERIFIED, false) && file.isFile) {
      return snapshotMap("ready", stored.release, stored.downloadId, file.length(), Uri.fromFile(file).toString(), null, lastCheckAt)
    }
    val query = DownloadManager.Query().setFilterById(stored.downloadId)
    downloadManager().query(query).use { cursor ->
      if (!cursor.moveToFirst()) {
        return snapshotMap("failed", stored.release, stored.downloadId, 0L, null, "Android no longer has this update download.", lastCheckAt)
      }
      val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
      val downloaded = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
      return when (status) {
        DownloadManager.STATUS_PENDING -> snapshotMap("pending", stored.release, stored.downloadId, downloaded, null, null, lastCheckAt)
        DownloadManager.STATUS_RUNNING, DownloadManager.STATUS_PAUSED -> snapshotMap("running", stored.release, stored.downloadId, downloaded, null, null, lastCheckAt)
        DownloadManager.STATUS_SUCCESSFUL -> snapshotMap("successful", stored.release, stored.downloadId, downloaded, Uri.fromFile(file).toString(), null, lastCheckAt)
        else -> {
          val reason = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))
          snapshotMap("failed", stored.release, stored.downloadId, downloaded, null, "Android download failed (reason $reason).", lastCheckAt)
        }
      }
    }
  }

  private fun clearUpdate() {
    val stored = readRelease()
    if (stored != null) {
      downloadManager().remove(stored.downloadId)
      updateFile(stored.release).delete()
    }
    preferences.edit()
      .remove(KEY_RELEASE)
      .remove(KEY_DOWNLOAD_ID)
      .remove(KEY_VERIFIED)
      .remove(KEY_ERROR)
      .apply()
  }

  private fun snapshotMap(
    status: String,
    release: Release?,
    downloadId: Long?,
    bytesDownloaded: Long,
    fileUri: String?,
    error: String?,
    lastCheckAt: Long?
  ) = mapOf(
    "status" to status,
    "release" to release?.toMap(),
    "downloadId" to downloadId,
    "bytesDownloaded" to bytesDownloaded,
    "fileUri" to fileUri,
    "error" to error,
    "lastCheckAt" to lastCheckAt
  )

  private fun updateFile(release: Release): File {
    val directory = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
      ?: error("Android storage for update downloads is unavailable.")
    return File(directory, "vunapos-update-${release.versionCode}.apk")
  }

  private fun readRelease(): StoredRelease? {
    val encoded = preferences.getString(KEY_RELEASE, null) ?: return null
    return try {
      val release = Release.fromJson(JSONObject(encoded))
      StoredRelease(release, preferences.getLong(KEY_DOWNLOAD_ID, -1L))
        .takeIf { it.downloadId >= 0L }
    } catch (_: Exception) {
      null
    }
  }

  private fun parseRelease(value: Map<String, Any?>): Release = Release(
    release = value["release"] as? String ?: error("Update release identifier is required."),
    versionName = value["versionName"] as? String ?: error("Update version name is required."),
    versionCode = (value["versionCode"] as? Number)?.toLong()?.toInt() ?: error("Update version code is required."),
    downloadUrl = value["downloadUrl"] as? String ?: error("Update download URL is required."),
    fileSize = (value["fileSize"] as? Number)?.toLong() ?: error("Update file size is required."),
    sha256 = value["sha256"] as? String ?: error("Update checksum is required.")
  )

  private fun installedPackageInfo(): PackageInfo = packageInfo(context.packageName)

  private fun archivePackageInfo(file: File): PackageInfo? {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.packageManager.getPackageArchiveInfo(file.absolutePath, PackageManager.PackageInfoFlags.of(PackageManager.GET_SIGNING_CERTIFICATES.toLong()))
    } else {
      @Suppress("DEPRECATION")
      context.packageManager.getPackageArchiveInfo(file.absolutePath, PackageManager.GET_SIGNING_CERTIFICATES)
    }
  }

  private fun packageInfo(packageName: String): PackageInfo {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.packageManager.getPackageInfo(packageName, PackageManager.PackageInfoFlags.of(PackageManager.GET_SIGNING_CERTIFICATES.toLong()))
    } else {
      @Suppress("DEPRECATION")
      context.packageManager.getPackageInfo(packageName, PackageManager.GET_SIGNING_CERTIFICATES)
    }
  }

  private fun versionCode(info: PackageInfo): Int = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
    info.longVersionCode.toInt()
  } else {
    @Suppress("DEPRECATION") info.versionCode
  }

  private fun signaturesAreCompatible(archive: PackageInfo, installed: PackageInfo): Boolean {
    val archiveSignatures = signingCertificates(archive)
    val installedSignatures = signingCertificates(installed)
    return archiveSignatures.any { candidate ->
      installedSignatures.any { installedSignature -> candidate.toByteArray().contentEquals(installedSignature.toByteArray()) }
    }
  }

  private fun signingCertificates(info: PackageInfo): List<Signature> {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      val signingInfo = info.signingInfo ?: return emptyList()
      return if (signingInfo.hasMultipleSigners()) {
        signingInfo.apkContentsSigners?.toList() ?: emptyList()
      } else {
        signingInfo.signingCertificateHistory?.toList() ?: signingInfo.apkContentsSigners?.toList() ?: emptyList()
      }
    }
    @Suppress("DEPRECATION")
    return info.signatures?.toList() ?: emptyList()
  }

  private fun sha256(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    FileInputStream(file).use { stream ->
      val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
      while (true) {
        val count = stream.read(buffer)
        if (count < 0) break
        digest.update(buffer, 0, count)
      }
    }
    return digest.digest().joinToString("") { "%02x".format(it) }
  }

  private fun downloadManager(): DownloadManager = context.getSystemService(DownloadManager::class.java)
    ?: error("Android Download Manager is unavailable on this device.")

  private data class StoredRelease(val release: Release, val downloadId: Long)

  private data class Release(
    val downloadUrl: String,
    val fileSize: Long,
    val release: String,
    val sha256: String,
    val versionCode: Int,
    val versionName: String
  ) {
    fun toJson() = JSONObject().apply {
      put("downloadUrl", downloadUrl)
      put("fileSize", fileSize)
      put("release", release)
      put("sha256", sha256)
      put("versionCode", versionCode)
      put("versionName", versionName)
    }

    fun toMap(): Map<String, Any> = mapOf(
      "downloadUrl" to downloadUrl,
      "fileSize" to fileSize,
      "release" to release,
      "sha256" to sha256,
      "versionCode" to versionCode,
      "versionName" to versionName
    )

    companion object {
      fun fromJson(json: JSONObject) = Release(
        downloadUrl = json.getString("downloadUrl"),
        fileSize = json.getLong("fileSize"),
        release = json.getString("release"),
        sha256 = json.getString("sha256"),
        versionCode = json.getInt("versionCode"),
        versionName = json.getString("versionName")
      )
    }
  }

  companion object {
    private const val APK_MIME_TYPE = "application/vnd.android.package-archive"
    private const val PREFERENCES = "vunapos_app_update"
    private const val KEY_DOWNLOAD_ID = "download_id"
    private const val KEY_ERROR = "error"
    private const val KEY_LAST_CHECK_AT = "last_check_at"
    private const val KEY_RELEASE = "release"
    private const val KEY_VERIFIED = "verified"
  }
}
