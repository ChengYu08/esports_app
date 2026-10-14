/**
 * Keep CI supplied iOS metadata in Expo's native project during prebuild.
 * Local builds continue to use the defaults from app.json when these values
 * are not provided.
 */
module.exports = ({ config }) => {
  const appVersion = process.env.APP_VERSION?.trim();
  const appBuildNumber = process.env.APP_BUILD_NUMBER?.trim();

  return {
    ...config,
    ...(appVersion ? { version: appVersion } : {}),
    ios: {
      ...config.ios,
      ...(appBuildNumber ? { buildNumber: appBuildNumber } : {}),
    },
  };
};
