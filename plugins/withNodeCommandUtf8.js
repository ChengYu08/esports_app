const { createRunOncePlugin, withPodfile } = require('@expo/config-plugins');

const TAG = 'rn-hermes-node-utf8';
const PATCH = `# @generated begin ${TAG} - expo prebuild (DO NOT MODIFY)\nclass << Pod::Executable\n  alias_method :execute_command_without_utf8, :execute_command\n\n  def execute_command(executable, command, raise_on_failure = true)\n    output = execute_command_without_utf8(executable, command, raise_on_failure)\n    executable == 'node' ? output.force_encoding(Encoding::UTF_8) : output\n  end\nend\n# @generated end ${TAG}`;

function withNodeCommandUtf8(config) {
  return withPodfile(config, (config) => {
    if (config.modResults.contents.includes(TAG)) {
      return config;
    }

    const anchor = "require 'json'";
    if (!config.modResults.contents.includes(anchor)) {
      throw new Error(`Unable to apply ${TAG}: Podfile does not contain ${anchor}.`);
    }

    config.modResults.contents = config.modResults.contents.replace(anchor, `${anchor}\n\n${PATCH}`);
    return config;
  });
}

module.exports = createRunOncePlugin(withNodeCommandUtf8, TAG, '1.0.0');
