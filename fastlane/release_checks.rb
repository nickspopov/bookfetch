module ReleaseChecks
  # Bookfetch has one production identity on both platforms; there are no variants.
  IDENTITY = { name: "Bookfetch", application_id: "com.nickpopov.bookfetch" }.freeze

  # Permissions a book fetcher never needs. Anything else (INTERNET, ACCESS_NETWORK_STATE, what Expo modules
  # add) is printed for review but does not fail the check.
  FORBIDDEN_PERMISSION = /LOCATION|CAMERA|CONTACTS|GET_ACCOUNTS|RECORD_AUDIO|SMS|MMS|WAP_PUSH|PHONE|CALL_LOG|OUTGOING_CALLS|VOICEMAIL|USE_SIP/

  module_function

  # Stores reject a build number they already hold; version.json keeps the counter shared across platforms.
  def next_build(version_file_build, store_builds)
    [version_file_build.to_i, (store_builds.map(&:to_i).max || 0) + 1].max
  end

  def artifact_name(application_id, version_file, extension)
    "#{application_id}-#{version_file['version']}-#{version_file['build']}.#{extension}"
  end

  # info: Info.plist values as strings, the way PlistBuddy prints them (nil when a key is missing).
  # bundle_present: whether Payload/<App>.app/main.jsbundle exists (a release build embeds the JS bundle).
  def ipa_problems(info:, bundle_present:, identity:, version_file:)
    problems = []
    id = identity[:application_id]
    problems << "CFBundleIdentifier is #{info['CFBundleIdentifier'].inspect}, expected #{id}" unless info["CFBundleIdentifier"] == id
    { "CFBundleShortVersionString" => version_file["version"].to_s, "CFBundleVersion" => version_file["build"].to_s }.each do |key, expected|
      problems << "#{key} is #{info[key].inspect}, expected #{expected} from version.json" unless info[key] == expected
    end
    unless info["ITSAppUsesNonExemptEncryption"] == "false"
      problems << "ITSAppUsesNonExemptEncryption is #{info['ITSAppUsesNonExemptEncryption'].inspect}, expected false"
    end
    problems << "the app has no main.jsbundle (not a release build?)" unless bundle_present
    problems
  end

  def manifest_attribute(manifest, name)
    manifest[/<manifest\b[^>]*\b#{Regexp.escape(name)}\s*=\s*"([^"]*)"/m, 1]
  end

  # Permission names requested by the merged manifest; entries removed with tools:node="remove" do not count.
  def manifest_permissions(manifest)
    manifest.scan(/<uses-permission(?:-sdk-23)?\b[^>]*>/m).filter_map do |tag|
      next if tag.include?('tools:node="remove"')

      tag[/android:name\s*=\s*"([^"]+)"/, 1]
    end.uniq.sort
  end

  def forbidden_permissions(permissions)
    permissions.select { |name| name.start_with?("android.permission.") && name.match?(FORBIDDEN_PERMISSION) }
  end

  # Label => passed. LAN catalogs (Calibre-Web, Kavita, Komga at http://192.168.x.x) need cleartext traffic.
  def manifest_checks(manifest, identity, version_file)
    forbidden = forbidden_permissions(manifest_permissions(manifest))
    {
      "package #{identity[:application_id]}" => manifest_attribute(manifest, "package") == identity[:application_id],
      "versionCode #{version_file['build']} from version.json" => manifest_attribute(manifest, "android:versionCode") == version_file["build"].to_s,
      "versionName #{version_file['version']} from version.json" => manifest_attribute(manifest, "android:versionName") == version_file["version"].to_s,
      "usesCleartextTraffic=\"true\" (LAN catalogs over http)" => manifest.match?(/<application\b[^>]*android:usesCleartextTraffic\s*=\s*"true"/m),
      "INTERNET permission" => manifest_permissions(manifest).include?("android.permission.INTERNET"),
      "no location, camera, contacts, microphone, SMS or phone permission#{forbidden.empty? ? '' : " (found #{forbidden.join(', ')})"}" => forbidden.empty?
    }
  end
end
