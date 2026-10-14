#!/usr/bin/env sh
set -eu
SCRIPT_DIR="$(CDPATH= cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/"'../../../../..' && pwd)"
cd "$PROJECT_ROOT"
[ -n "${XCODE_PROJECT_FILE:-}" ] || XCODE_PROJECT_FILE='ios/app.xcodeproj/project.pbxproj'
[ -n "${XCODE_WORKSPACE:-}" ] || XCODE_WORKSPACE='ios/app.xcworkspace'
[ -n "${XCODE_SCHEME:-}" ] || XCODE_SCHEME='app'
[ -n "${BUNDLE_ID:-}" ] || BUNDLE_ID='com.esportsapp.apps'
export XCODE_PROJECT_FILE XCODE_WORKSPACE XCODE_SCHEME BUNDLE_ID
case "${1:-}" in
  ""|--clean|--fix|--check-settings) ;;
  -h|--help)
    echo "Usage: preflight-ios-build.sh [--clean|--check-settings]"
    echo "Preview by default; --clean normalizes the app Release configuration; --check-settings verifies resolved Xcode settings."
    exit 0 ;;
  *) echo "Unknown option: $1" >&2; exit 1 ;;
esac
if [ -f Gemfile ]; then
  set -- bundle exec ruby - "${1:-}"
else
  set -- ruby - "${1:-}"
fi
"$@" <<'RUBY'
require 'json'
require 'open3'
begin
  require 'xcodeproj'
rescue LoadError
  abort 'Missing xcodeproj. Install CocoaPods first (bundle install with Gemfile, otherwise gem install cocoapods).'
end

mode = ARGV.first
abort 'Release configuration is required for IPA packaging.' unless ENV.fetch('IOS_BUILD_CONFIGURATION', 'Release') == 'Release'
project_file = ENV.fetch('XCODE_PROJECT_FILE')
abort "Xcode project file not found: #{project_file}" unless File.file?(project_file)
package = JSON.parse(File.read('package.json'))
deps = (package['dependencies'] || {}).merge(package['devDependencies'] || {})
abort 'Expected a react-native dependency in package.json.' unless deps['react-native']
project = Xcodeproj::Project.open(File.dirname(project_file))
apps = project.targets.select { |t| t.product_type == 'com.apple.product-type.application' }
target_name = ENV['XCODE_TARGET'] || ENV.fetch('XCODE_SCHEME')
target = apps.find { |t| t.name == target_name }
target ||= apps.first if apps.length == 1 && !ENV['XCODE_TARGET']
abort 'Cannot identify a unique app target. Set XCODE_TARGET to the app target name.' unless target
release = target.build_configurations.find { |c| c.name == 'Release' }
abort "Target #{target.name} has no Release configuration." unless release
scripts = target.shell_script_build_phases.map { |p| p.shell_script.to_s }
abort 'Missing React Native bundle build phase invoking react-native-xcode.sh.' unless scripts.any? { |s| s.lines.any? { |l| !l.lstrip.start_with?('#') && l.include?('react-native-xcode.sh') } }

# RN treats any nonempty SKIP_BUNDLING value (even "0") as a request to skip.
abort 'SKIP_BUNDLING must be unset for Release.' unless ENV.fetch('SKIP_BUNDLING', '').empty?
abort 'DEV=true is not allowed for Release.' if ENV['DEV'] == 'true'
sources = scripts + ['ios/.xcode.env', 'ios/.xcode.env.local'].select { |f| File.file?(f) }.map { |f| File.read(f) }
sources.each do |source|
  debug_guard = false
  source.lines.reject { |line| line.lstrip.start_with?('#') }.each do |line|
    stripped = line.strip
    # Expo's generated React Native phase intentionally skips bundling for
    # Debug builds. That assignment is harmless for Release packaging; only
    # assignments that can execute in Release should fail this check.
    debug_guard = true if stripped.match?(/\Aif\b.*\$CONFIGURATION.*Debug.*then\s*\z/)
    if stripped.match?(/\Afi\b/)
      debug_guard = false
      next
    end
    if line.match?(/\bSKIP_BUNDLING\s*=\s*(?!["']{2}(?:\s|;|$))[^\s;#]+/)
      abort 'SKIP_BUNDLING assignment found in Xcode environment/build phase. Remove it for Release packaging.' unless debug_guard
    end
    abort 'DEV=true or --dev true is not allowed in a Release bundle build phase.' if line.match?(/\bDEV\s*=\s*["']?true\b|--dev(?:\s+|=)["']?true\b/)
  end
end

expected = {
  'PRODUCT_BUNDLE_IDENTIFIER' => ENV.fetch('BUNDLE_ID'),
  'TARGETED_DEVICE_FAMILY' => '1',
  'SUPPORTED_PLATFORMS' => 'iphoneos iphonesimulator',
  'SUPPORTS_MACCATALYST' => 'NO',
  'SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD' => 'NO',
  'SUPPORTS_XR_DESIGNED_FOR_IPHONE_IPAD' => 'NO',
  'CODE_SIGN_STYLE' => 'Manual',
  'CODE_SIGN_IDENTITY' => ENV.fetch('IOS_SIGNING_IDENTITY', 'Apple Distribution'),
  'CODE_SIGN_IDENTITY[sdk=iphoneos*]' => ENV.fetch('IOS_SIGNING_IDENTITY', 'Apple Distribution')
}
%w[DEVELOPMENT_TEAM IOS_PROVISION_PROFILE_NAME APP_VERSION APP_BUILD_NUMBER].zip(
  %w[DEVELOPMENT_TEAM PROVISIONING_PROFILE_SPECIFIER MARKETING_VERSION CURRENT_PROJECT_VERSION]
).each { |env, key| expected[key] = ENV[env] unless ENV.fetch(env, '').empty? }

puts "React Native iOS build preflight: #{target.name} / Release"
puts 'Policy: iPhone only; Mac Catalyst, Designed for Mac and Designed for Vision disabled.'
if ['--clean', '--fix'].include?(mode)
  # Only the selected application's Release configuration is mutated.
  release.build_settings.merge!(expected)
  project.save
  puts 'Cleaned app Release settings; Debug, tests and extension targets preserved.'
elsif mode == '--check-settings'
  # A single supplied provisioning profile cannot sign embedded extensions.
  extensions = project.targets.select { |t| t.product_type.to_s.include?('app-extension') }
  abort 'Embedded extension targets require separate provisioning profiles; this template supports a single app profile.' unless extensions.empty?
  workspace = ENV.fetch('XCODE_WORKSPACE')
  args = ['xcodebuild'] + (File.directory?(workspace) ? ['-workspace', workspace] : ['-project', File.dirname(project_file)])
  args += ['-scheme', ENV.fetch('XCODE_SCHEME'), '-configuration', 'Release', '-sdk', 'iphoneos', '-destination', 'generic/platform=iOS', '-showBuildSettings', '-json']
  output, error, status = Open3.capture3(*args)
  abort "xcodebuild -showBuildSettings failed:\n#{error}" unless status.success?
  entries = JSON.parse(output)
  entry = entries.find { |item| item['target'] == target.name }
  abort "Scheme does not build app target #{target.name}." unless entry
  settings = entry.fetch('buildSettings')
  checks = expected.reject { |key, _| key.include?('[') || key == 'SUPPORTED_PLATFORMS' }
  checks.merge!('CONFIGURATION' => 'Release', 'PLATFORM_NAME' => 'iphoneos')
  checks.each do |key, value|
    abort "Release preflight failed: #{key}=#{settings[key].inspect}, expected #{value.inspect}." unless settings[key].to_s == value
  end
  platforms = settings.fetch('SUPPORTED_PLATFORMS', '').split
  abort 'SUPPORTED_PLATFORMS must contain only iPhoneOS/iPhoneSimulator.' unless platforms.include?('iphoneos') && (platforms - %w[iphoneos iphonesimulator]).empty?
  abort 'SKIP_BUNDLING must be unset in resolved build settings.' unless settings.fetch('SKIP_BUNDLING', '').empty?
  definitions = settings.fetch('GCC_PREPROCESSOR_DEFINITIONS', '').split
  %w[OTHER_CFLAGS OTHER_CPLUSPLUSFLAGS].each { |key| definitions += settings.fetch(key, '').scan(/-D\s*([^\s]+)/).flatten }
  abort 'DEBUG/RCT_DEV is enabled in Release.' if definitions.any? { |d| d.match?(/\A(?:DEBUG|RCT_DEV)(?:=(?!0\z).*)?\z/) }
  abort 'Swift DEBUG compilation condition is enabled in Release.' if settings.fetch('SWIFT_ACTIVE_COMPILATION_CONDITIONS', '').split.include?('DEBUG')
  puts 'Resolved Release, iOS platform, device family and signing settings verified.'
else
  expected.each { |key, value| puts "#{key}: #{release.build_settings[key].inspect} -> #{value.inspect}" }
  puts 'Preview only. Run with --clean to normalize app Release settings, then --check-settings after pod install.'
end
RUBY

