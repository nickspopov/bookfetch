require "minitest/autorun"
require_relative "../release_checks"

class ReleaseChecksTest < Minitest::Test
  VERSION_FILE = { "version" => "1.0.0", "build" => 3 }.freeze
  IDENTITY = ReleaseChecks::IDENTITY

  def plist(id = "com.nickpopov.bookfetch", version: "1.0.0", build: "3", encryption: "false")
    {
      "CFBundleIdentifier" => id,
      "CFBundleShortVersionString" => version,
      "CFBundleVersion" => build,
      "ITSAppUsesNonExemptEncryption" => encryption
    }
  end

  def problems(info: plist, bundle_present: true)
    ReleaseChecks.ipa_problems(info: info, bundle_present: bundle_present, identity: IDENTITY, version_file: VERSION_FILE)
  end

  def test_identity_is_fixed
    assert_equal "Bookfetch", IDENTITY[:name]
    assert_equal "com.nickpopov.bookfetch", IDENTITY[:application_id]
  end

  def test_next_build_passes_the_store_and_keeps_version_json
    assert_equal 1, ReleaseChecks.next_build(1, [])
    assert_equal 1, ReleaseChecks.next_build(1, [0])
    assert_equal 5, ReleaseChecks.next_build(2, [4, 3])
    assert_equal 7, ReleaseChecks.next_build(7, ["4"])
  end

  def test_artifact_name
    assert_equal "com.nickpopov.bookfetch-1.0.0-3.aab", ReleaseChecks.artifact_name(IDENTITY[:application_id], VERSION_FILE, "aab")
  end

  def test_matching_ipa_passes
    assert_empty problems
  end

  def test_wrong_numbers_ids_and_encryption_fail
    assert_equal 1, problems(info: plist(build: "4")).length
    assert_equal 1, problems(info: plist(version: "1.0.1")).length
    assert_equal 1, problems(info: plist("com.nickpopov.bookfetch.dev")).length
    assert_equal 1, problems(info: plist(encryption: nil)).length
    assert_equal 1, problems(info: plist(encryption: "true")).length
  end

  def test_missing_js_bundle_fails
    assert_equal 1, problems(bundle_present: false).length
  end

  def manifest(package: "com.nickpopov.bookfetch", code: "3", name: "1.0.0", cleartext: true, extra: [])
    permissions = ["android.permission.INTERNET", "android.permission.ACCESS_NETWORK_STATE", *extra]
    <<~XML
      <?xml version="1.0" encoding="utf-8"?>
      <manifest xmlns:android="http://schemas.android.com/apk/res/android"
          xmlns:tools="http://schemas.android.com/tools"
          package="#{package}"
          android:versionCode="#{code}"
          android:versionName="#{name}">
        #{permissions.map { |p| %(<uses-permission android:name="#{p}" />) }.join("\n  ")}
        <uses-permission android:name="android.permission.RECORD_AUDIO" tools:node="remove" />
        <application android:name=".MainApplication" android:usesCleartextTraffic="#{cleartext}">
          <activity android:name=".MainActivity" />
        </application>
      </manifest>
    XML
  end

  def checks(**options)
    ReleaseChecks.manifest_checks(manifest(**options), IDENTITY, VERSION_FILE)
  end

  def test_matching_manifest_passes
    assert checks.values.all?, checks.reject { |_, ok| ok }.keys.inspect
  end

  def test_manifest_identity_numbers_and_cleartext_are_checked
    refute checks(package: "com.example").values.all?
    refute checks(code: "2").values.all?
    refute checks(name: "0.9.0").values.all?
    refute checks(cleartext: false).values.all?
  end

  def test_expo_module_permissions_are_allowed
    extra = %w[android.permission.VIBRATE android.permission.SYSTEM_ALERT_WINDOW
               com.nickpopov.bookfetch.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION]
    assert checks(extra: extra).values.all?
  end

  def test_sensitive_permissions_fail
    %w[android.permission.ACCESS_FINE_LOCATION android.permission.ACCESS_COARSE_LOCATION android.permission.CAMERA
       android.permission.READ_CONTACTS android.permission.RECORD_AUDIO android.permission.SEND_SMS
       android.permission.READ_PHONE_STATE android.permission.CALL_PHONE android.permission.READ_CALL_LOG].each do |permission|
      result = checks(extra: [permission])
      refute result.values.all?, "#{permission} should fail"
      assert(result.keys.any? { |label| label.include?(permission) }, "the label names #{permission}")
    end
  end

  def test_permission_list_skips_removed_entries
    assert_equal %w[android.permission.ACCESS_NETWORK_STATE android.permission.INTERNET], ReleaseChecks.manifest_permissions(manifest)
  end
end
