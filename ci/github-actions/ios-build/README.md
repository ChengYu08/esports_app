# GitHub Actions iOS 构建初始化说明

本目录由 `ipa-cli actions init-ios-build` 生成，用来给当前项目初始化 GitHub Actions iOS 构建配置、签名材料目录，以及 GitHub Secrets 填写说明。

## 生成了什么

- Workflow: `.github/workflows/ios-build.yml`
- 说明文档: `ci/github-actions/ios-build/README.md`
- Secrets 模板: `ci/github-actions/ios-build/secrets.example.env`
- 签名材料目录: `ci/github-actions/ios-build/signing`
- Secrets 导出脚本: `ci/github-actions/ios-build/signing/scripts/print-secrets.sh`
- iOS 构建预检脚本: `ci/github-actions/ios-build/signing/scripts/preflight-ios-build.sh`

默认目录结构如下：

```text
.
|-- .github/
|   `-- workflows/
|       `-- ios-build.yml
`-- ci/github-actions/ios-build/
    |-- README.md
    |-- secrets.example.env
    `-- signing/
        |-- .gitignore
        |-- certs/
        |   `-- .gitkeep
        |-- profiles/
        |   `-- .gitkeep
        `-- scripts/
            |-- print-secrets.sh
            `-- preflight-ios-build.sh
```

## 这个模板当前假设什么

- Xcode workspace: `ios/app.xcworkspace`
- Xcode project.pbxproj: `ios/app.xcodeproj/project.pbxproj`
- Scheme: `app`
- Runner: `macos-latest`，Xcode 默认使用 GitHub 托管 runner 当前选择的版本；如果手动触发时填写 `xcode_path`，会先执行 `xcode-select`
- 当前写入 workflow 的 Bundle ID 是 `com.esportsapp.apps`。它必须和 provisioning profile 里的 App ID 保持一致。
- 初始化时没有检测到 `pubspec.yaml`。workflow 里仍保留了 Flutter 步骤，但它们通过 `hashFiles('pubspec.yaml')` 做了条件判断；如果你的项目不是 Flutter，会自动走原生 iOS 的 `xcodebuild archive` / `xcodebuild -exportArchive` 分支。

初始化时检测到了 `package.json` 且包含 `react-native` 依赖，所以生成的 workflow 会：

1. **Node.js 环境**: 默认使用最新 LTS 版本（可通过 `node_version` 输入自定义）
2. **包管理器**: 自动检测为 `npm`（基于 lockfile），可通过 `package_manager` 输入强制指定
3. **依赖安装**: 根据包管理器类型执行相应的安装命令（`npm ci` / `yarn install --frozen-lockfile` / `pnpm install --frozen-lockfile`）
4. **Metro 缓存**: 默认启用 Metro bundler 缓存以加速构建，可通过 `metro_cache` 输入禁用
5. **Hermes 引擎**: 保留 Podfile 中的项目配置，不通过文本替换强制切换引擎。
6. **发布打包**: 统一执行 Release 的 `xcodebuild archive` 和 `xcodebuild -exportArchive`，由工程中的 React Native bundle build phase 生成 JS bundle。

### React Native 发布预检

- 先安装 CocoaPods，再清理和检查工程；有根目录 Gemfile 时统一使用 Bundler 环境。
- 清理仅修改主 App Target 的 Release 配置，保留 Debug、测试和扩展 Target，以及项目原有 iOS 最低版本。
- Release 限定 iPhone：`TARGETED_DEVICE_FAMILY=1`，`SUPPORTED_PLATFORMS=iphoneos iphonesimulator`，并禁用 Mac Catalyst、Designed for Mac、Designed for Vision。
- 检查 bundle build phase 是否调用 `react-native-xcode.sh`，拒绝 `SKIP_BUNDLING`、显式 `DEV=true` 和 Release 中生效的 DEBUG/RCT_DEV 配置。
- 通过 `xcodebuild -showBuildSettings -json` 检查实际生效的 Release、平台、设备族和签名配置；检查失败会停止构建。
- 导出后校验非空 `main.jsbundle`、iPhoneOS 平台、iPhone 设备族、签名、Distribution 身份、Bundle ID、Team ID、发布权限与 Profile 有效期；失败会阻止上传。
- 当前模板采用单个 App Store Profile；包含扩展 Target 的项目会在预检中明确失败，需要先定制多 Profile 签名方案。
- Expo 项目必须先生成并提交 `ios/`。自定义 JS bundle 文件名或自定义打包阶段需要相应调整预检；标准模板要求 `main.jsbundle`。
- 工程设置不代替 App Store Connect 的分发可用性设置；不希望在 Mac 或 Apple Vision Pro 商店提供应用时，还需在 App Store Connect 关闭对应可用性。

本地先安装 JS 依赖及 CocoaPods，再执行：

```bash
./ci/github-actions/ios-build/signing/scripts/preflight-ios-build.sh                 # 预览，不修改
./ci/github-actions/ios-build/signing/scripts/preflight-ios-build.sh --clean         # 规范主 App Release 配置
./ci/github-actions/ios-build/signing/scripts/preflight-ios-build.sh --check-settings # 验证实际构建配置
```

默认选择与 Scheme 同名的 App Target；只有一个 App Target 时可自动选中。多个 App Target 且 Scheme 不同名时，在 workflow env 中设置 `XCODE_TARGET`。本地检查签名时，可设置 `DEVELOPMENT_TEAM`、`IOS_SIGNING_IDENTITY` 和 `IOS_PROVISION_PROFILE_NAME`。

### 包管理器检测

workflow 会按以下优先级检测包管理器：
1. 检查 `inputs.package_manager`（如果不是 `auto`）
2. 检查 `pnpm-lock.yaml` → 使用 pnpm
3. 检查 `yarn.lock` → 使用 yarn
4. 默认使用 npm

构建行为补充说明：

- Flutter 项目默认安装 Flutter stable 最新版；手动触发 workflow 时填写 `flutter_version` 可以固定到指定版本，例如 `3.32.0`
- IPA 版本默认读取 `pubspec.yaml`；如果要像 `1.0.0` 这样固定版本名，手动触发 workflow 时填写 `app_version`
- IPA 构建号默认读取 `pubspec.yaml` 的 `version:`。例如 `version: 1.2.3+45` 会生成 `--build-name=1.2.3` 和 `--build-number=45`；手动触发 workflow 时填写 `app_build_number` 可以覆盖构建号
- IPA 文件名默认保留 Flutter/Xcode 生成的名称；手动触发 workflow 时填写 `ipa_file_name` 可统一重命名（可省略 `.ipa`，不能包含路径）
- 重命名目标默认允许覆盖；将 `ipa_overwrite` 设为 `false` 可在目标文件已存在时让 workflow 失败，避免静默覆盖
- 非 Flutter / Xcode 归档分支会把 `app_version` 写入 `MARKETING_VERSION`，把 `app_build_number` 写入 `CURRENT_PROJECT_VERSION`
- iOS 预检清理会把 Xcode 工程的 `TARGETED_DEVICE_FAMILY` 规范为 `1`，即只保留 iPhone，去掉 iPad 等其它设备族。
- CI 上默认禁用 Swift Package Manager（`flutter config --no-enable-swift-package-manager`），统一走 CocoaPods，规避 xcodebuild 静默解析远程 SPM 包导致卡死。手动触发 workflow 时可把 `disable_swift_package_manager` 切到 `false` 以启用 SPM（仅当项目存在 SPM-only 插件时才需要）
- CocoaPods 缓存以 `ios/Podfile.lock` 为 key 命中 `~/Library/Caches/CocoaPods` 与 `~/.cocoapods/repos`，加速重复构建
- `flutter-build-ipa` 模式下会在构建前显式执行 `cd ios && pod install --repo-update`，把依赖解析从 `flutter build ipa` 内部剥离出来，便于排错
- Flutter 项目默认走 `flutter build ipa --release --verbose --export-options-plist="$EXPORT_OPTIONS_PLIST"`，并开启 `set -x` 打印每条命令，方便 CI 日志排查
- 如果 `flutter build ipa` 在某个项目上不适配，手动触发 workflow 时把 `flutter_build_mode` 切到 `xcodebuild-archive`，会改走 `flutter build ios --release --no-codesign` + `xcodebuild archive` / `xcodebuild -exportArchive`
- 如果 `XCODE_WORKSPACE` 存在，优先 `xcodebuild -workspace ...`
- 如果 `XCODE_WORKSPACE` 不存在，workflow 会从 `XCODE_PROJECT_FILE` 推导出上层 `.xcodeproj`，再走 `xcodebuild -project ...`

如果你的工程不是默认 Flutter Runner 结构，优先修改 workflow 顶部的这些环境变量：

- `BUNDLE_ID`
- `XCODE_WORKSPACE`
- `XCODE_PROJECT_FILE`
- `XCODE_SCHEME`

## 最省事流程

1. 把 `.p12` 放到 `ci/github-actions/ios-build/signing/certs/`。
2. 把 `.mobileprovision` 放到 `ci/github-actions/ios-build/signing/profiles/`。
3. 在项目根目录执行：

```bash
./ci/github-actions/ios-build/signing/scripts/print-secrets.sh
```

脚本只按扩展名识别文件，不要求特定文件名：分别取目录里唯一的 `.p12` 和 `.mobileprovision`（大小写不敏感）。它会询问一次 `.p12` 导出密码，并在每次执行时覆盖 `ci/github-actions/ios-build/secrets.example.env` 中对应的 4 个 key/value，保留其它内容。

如果本机已经安装并登录 GitHub CLI，也可以直接执行：

```bash
./ci/github-actions/ios-build/signing/scripts/print-secrets.sh --apply
```

`--apply` 会先同步 `ci/github-actions/ios-build/secrets.example.env`，再通过 GitHub CLI 直接写入 4 个 Repository secrets。写完后到 GitHub Actions 页面手动触发 `ios-build.yml`；Flutter 版本不填就是最新 stable。

## 你应该把哪些文件放到哪里

把签名相关文件放到下面目录即可；文件名可以任意，脚本按扩展名查找：

- `ci/github-actions/ios-build/signing/certs/ios_distribution.cer`（示例文件名）
- `ci/github-actions/ios-build/signing/certs/ios_distribution.p12`（示例文件名）
- `ci/github-actions/ios-build/signing/profiles/app_store.mobileprovision`（示例文件名）

这三个文件的作用分别是：

| 文件 | 作用 | 是否直接用于 workflow |
| --- | --- | --- |
| `.cer` | Apple Distribution 证书的公钥证书文件，便于你确认自己用的是哪张证书 | 否 |
| `.p12` | “证书 + 私钥”打包文件 | 是 |
| `.mobileprovision` | App Store 发布用 provisioning profile | 是 |

关键说明：

- **只有 `.cer` 不够**。GitHub Actions 导入签名身份时真正需要的是带私钥的 `.p12`。
- 如果你只有 `.cer`，还需要创建该 CSR 时生成的私钥。推荐用 `ipa-cli cert` 生成 CSR 和 P12，全程不经过钥匙串。
- `.mobileprovision` 必须是 **App Store 发布** profile，不能是 Development、Ad Hoc 或 Enterprise profile。

## 这些文件一般从哪里来

### 1. `.cer`

常见来源：

1. Apple Developer 后台的 Certificates 页面下载。
2. 团队成员导出的证书文件。

把它放到：

```text
ci/github-actions/ios-build/signing/certs/ios_distribution.cer
```

### 2. `.p12`

推荐在申请证书前，用本工具离线生成私钥与 CSR：

```bash
ipa-cli cert csr
```

把生成的 `./ios-signing/ios_distribution.csr` 上传到 Apple Developer 后台创建证书。下载 `.cer` 后，在保存私钥的同一台机器执行：

```bash
ipa-cli cert p12 ./AppleDistribution.cer
```

命令会由 OpenSSL 询问 P12 密码；记住该密码，后面填到 `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD`。工具会使用兼容 macOS `security import` 的 3DES PKCS#12 格式；不要手工改用 AES/PBES2 重新导出，否则 GitHub macOS Runner 可能报 `Unable to decode the provided data`。整个流程不会读取或写入 macOS 钥匙串。

把导出的文件放到：

```text
ci/github-actions/ios-build/signing/certs/ios_distribution.p12
```

### 3. `.mobileprovision`

常见来源：

1. Apple Developer 后台的 Profiles 页面下载。
2. Xcode 自动管理签名后，从本机 `~/Library/MobileDevice/Provisioning Profiles/` 找到对应 profile。

要求：

- 类型是 App Store / App Store Connect 发布用 profile
- Bundle ID 和 workflow 里的 `BUNDLE_ID` 一致

把它放到：

```text
ci/github-actions/ios-build/signing/profiles/app_store.mobileprovision
```

## 需要创建哪些 GitHub Secrets

到仓库页面：

```text
Settings -> Secrets and variables -> Actions
```

创建下面 4 个 Repository secrets：

| Secret 名称 | 填什么 | 值从哪里来 |
| --- | --- | --- |
| `IOS_DISTRIBUTION_CERTIFICATE_BASE64` | `ci/github-actions/ios-build/signing/certs/ios_distribution.p12` 的 base64 单行文本 | 用 `print-secrets.sh` 自动生成 |
| `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD` | 导出 `.p12` 时设置的密码 | 你导出 `.p12` 时自己输入的那个密码 |
| `IOS_PROVISION_PROFILE_BASE64` | `ci/github-actions/ios-build/signing/profiles/app_store.mobileprovision` 的 base64 单行文本 | 用 `print-secrets.sh` 自动生成 |
| `IOS_KEYCHAIN_PASSWORD` | workflow 临时 keychain 的随机密码 | 可以用 `print-secrets.sh` 自动生成一份 |

## 值怎么生成

当你把 `.p12` 和 `.mobileprovision` 放好之后，直接运行：

```bash
./ci/github-actions/ios-build/signing/scripts/print-secrets.sh
```

它会把对应 key/value 写入：

```text
ci/github-actions/ios-build/secrets.example.env
```

如果你希望同时写入 GitHub Secrets，可以运行：

```bash
./ci/github-actions/ios-build/signing/scripts/print-secrets.sh --apply
```

`--apply` 的前提是本机已经安装 GitHub CLI，并且在当前仓库登录过：

```bash
gh auth status
```

如果你只想在终端查看即将设置的值，可以运行：

```bash
./ci/github-actions/ios-build/signing/scripts/print-secrets.sh --print
```

输出格式是：

```text
IOS_DISTRIBUTION_CERTIFICATE_BASE64=...
IOS_DISTRIBUTION_CERTIFICATE_PASSWORD=<fill-your-p12-export-password>
IOS_PROVISION_PROFILE_BASE64=...
IOS_KEYCHAIN_PASSWORD=...
```

你把右侧的值逐个复制到 GitHub Secrets 即可。

如果你只想打印 `gh secret set` 命令而不立即执行，也可以运行：

```bash
./ci/github-actions/ios-build/signing/scripts/print-secrets.sh --gh
```

它会打印出 `gh secret set ...` 命令。

## workflow 里已经做了哪些校验

生成的 `.github/workflows/ios-build.yml` 已经内置这些检查：

- profile 解码后会读取 UUID、Name、Team ID、application-identifier
- profile 的 Bundle ID 不匹配 `BUNDLE_ID` 时直接失败
- profile 里包含 `ProvisionedDevices` 时直接失败，避免错用 Development / Ad Hoc profile
- profile 是 Enterprise profile 时直接失败
- 解码后的 P12 会先用密码通过 OpenSSL 校验，再交给 macOS Keychain 导入
- 导入证书后找不到 Distribution 签名身份时直接失败

## 推荐执行顺序

1. 把 `.cer`、`.p12`、`.mobileprovision` 放到指定目录。
2. 运行 `./ci/github-actions/ios-build/signing/scripts/print-secrets.sh`，生成 `ci/github-actions/ios-build/secrets.example.env`。
3. 如果有 GitHub CLI，运行 `./ci/github-actions/ios-build/signing/scripts/print-secrets.sh --apply` 直接写入 GitHub Secrets。
4. 检查 `.github/workflows/ios-build.yml` 顶部的 `BUNDLE_ID`、`XCODE_WORKSPACE`、`XCODE_PROJECT_FILE`、`XCODE_SCHEME`。
5. 运行 `./ci/github-actions/ios-build/signing/scripts/preflight-ios-build.sh` 预览当前 iOS 工程的 Bundle ID、签名方式和 profile 类型；确认无误后可运行 `./ci/github-actions/ios-build/signing/scripts/preflight-ios-build.sh --clean` 清理成发布打包配置。
6. 提交 workflow 和文档，但不要提交真实签名文件。
7. 在 GitHub Actions 里手动触发 `ios-build.yml`。

## 安全注意事项

- `signing/` 目录里生成了单独的 `.gitignore`，真实证书和 profile 默认不会被提交。
- 不要把 `.p12`、`.mobileprovision`、导出密码写进仓库。
- 如果你更换了证书或 profile，重新运行 `./ci/github-actions/ios-build/signing/scripts/print-secrets.sh` 并更新 GitHub Secrets。
