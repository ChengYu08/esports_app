/** 禁用 react-native-update 的 iOS 自动链接（仅接入 Android） */
module.exports = {
  dependencies: {
    "react-native-update": {
      platforms: {
        ios: null,
      },
    },
  },
};
