# 盼友圈发视频（Vid 直传 + 发布）实现文档

> 状态：已实现（as-built）。本文记录协议逆向结论、文件结构与验证要点，供后续维护对照。
> 入口：盼友圈顶部左侧相机 icon → `/circle/publish`。

**目标：** 盼友圈新增「发视频」页：本地选视频 → 火山 VOD 直传拿 vid → 发布（话题/@实体、自主声明、社区公约勾选），交互与文案对齐 PC 端 pzdj-pc publish.vue。

**技术栈：** Expo Router / react-query / crypto-js / expo-file-system(next) / expo-media-library(legacy) / expo-video-thumbnails / rn-emoji-keyboard。

## 一、火山 VOD 直传协议（逆向自 tt-uploader@1.6.2）

PC 端用官方 Web SDK `tt-uploader`；RN 无官方 SDK，本实现按 SDK 反编译源码移植了完整协议：

### 1. 上传凭证
- 业务侧：`POST /client/v1/media/video/uploadSign` `{filename}` → `UploadVideoSignVO`（STS 四件套 + spaceName + handlerTemplateId + currentTime）。
- RN 端 X-Date 优先取后端 `currentTime`（服务端时钟），避免设备时钟偏差导致签名失败。

### 2. ApplyUploadInfo（火山 OpenAPI，V4 签名）
- `GET https://vod.volcengineapi.com/?Action=ApplyUploadInfo&Version=2022-01-01&SpaceName&FileSize&FileType=video&NeedFallback=true&FileName`
- 签名（`src/features/circle/vod-sign.ts`）：
  - 算法 `HMAC-SHA256`，Credential 尾缀 `/{date8}/cn-north-1/vod/request`；
  - 头：`X-Date`（`YYYYMMDDTHHMMSSZ`）、`x-security-token`；有 body 时补 `X-Content-Sha256`；
  - `content-type/content-length/user-agent` 等不参与签名（SDK unsigned 名单）；
  - Canonical Request：`METHOD\n/\n排序编码query\n规范头\n\n签名头列表\nbody sha256hex`；
  - 密钥链：`Hmac(date8, secret) → Hmac(region) → Hmac(vod) → Hmac("request")`。
- 响应 `Result.CandidateUploadAddresses.MainUploadAddresses[0]`（兜底 `Result.UploadAddress`）→ `{StoreInfos[0].Auth/StoreUri, UploadHosts[0], SessionKey, UploadHeader}`。

### 3. TOS 直传 / 分片（`src/features/circle/vod-upload.ts`）
- `< 10MB`（2×5MB）：单次 `PUT {host}/{oid}`，headers `authorization: Auth`、`content-crc32`（8 位小写十六进制）、`Content-Type: application/octet-stream`，body `{uri}`（RN 原生文件流，带进度）。
- `≥ 10MB`：5MB 分片 ——
  1. `POST {host}/{oid}?uploads` → `{success:0, payload:{uploadID}}`；
  2. `PUT {host}/{oid}?partNumber={n}&uploadID={id}`（每片带 content-crc32，body Uint8Array，RN 转 base64 上送）；
  3. `POST {host}/{oid}?uploadID={id}`，body `"1:crc,2:crc"`（无 Content-Type）。
- 分片读取用 `File.readableStream()` 顺序切片（不整文件进内存）；取消检查在分片之间。

### 4. CommitUploadInfo
- `POST vod.volcengineapi.com/?Action=CommitUploadInfo&Version=2022-01-01&SpaceName`，
  body `{SessionKey, Functions:[{Name:"StartWorkflow", Input:{TemplateId: handlerTemplateId}}]}`（模板为空则不带 Functions），`Content-Type: application/json` + `X-Content-Sha256` → `Result.Vid`。

## 二、发布契约（pzdj-service）

- `POST /client/v1/moments/video/publish`：
  `{vid, title(必填,≤200), content(必填), topics:[{id,label,offset,length}], mentions:[...], declarations:[string](必填非空)}`
- `offset/length` 按 **Unicode 码点** 计；`slice(offset, offset+length)` 必须等于 `触发符+label`，否则实体降级为纯文本（PC mention-core 契约）。
- `GET /client/v1/moments/topic/list?keyword=&mode=default` → `[{topicId, topicName}]`（空关键词=热榜前 N）。
- `GET /client/v1/moments/video/declaration/list` → `[{code,name}]`（code==name，Nacos 下发）。
- RN 无富文本编辑器：正文为纯 TextInput，**只有经面板选中过的话题/@用户**才在提交时扫描正文生成实体（`circle-publish-entities.ts`，手打不成为实体，与 PC「渲染只认 entities」规则一致）。

## 三、文件清单

| 文件 | 职责 |
| --- | --- |
| `src/features/circle/vod-sign.ts` (+test) | V4 签名 / crc32 / query 规范化纯函数 |
| `src/features/circle/vod-upload.ts` | ApplyUploadInfo → 直传/分片 → Commit → vid |
| `src/features/circle/circle-publish.api.ts` | uploadSign / topic list / declaration list / publish |
| `src/features/circle/circle-publish-entities.ts` (+test) | 码点实体提取 / 结尾草稿识别与回写 |
| `src/shared/media-picker/media-picker-session.ts` | 新增 `beginVideoPick/completeVideoPick`（与图片会话独立） |
| `src/shared/media-picker/MediaPickerScreen.tsx` | `media=video` 模式：video 权限粒度、单选、格式/时长校验、200M 校验、深色+播放图标占位 |
| `src/features/circle/screens/CirclePublishScreen.tsx` | 发视频页（话题/@/表情面板、声明弹层、上传进度、发布校验） |
| `src/app/circle/publish.tsx` | 路由入口 |
| `src/features/circle/screens/CircleScreen.tsx` | 相机 icon 改跳 `/circle/publish` |
| `src/core/config/links.ts` | 新增 `communityAgreement`（code `community_agreement`） |

新增依赖：`expo-video-thumbnails ~57.0.2`（选视频封面，**含原生代码，需重新出包**）。

## 四、校验与文案（对齐 PC）

请先选择视频 / 请输入视频标题 / 请输入正文内容 / 标题不能超过 20 字（码点）/ 正文不能超过 1000 字（码点）/ 请先阅读并同意《盼之电竞社区公约》/ 请至少选择一项自主声明 / 视频上传中，请稍候 / 视频上传未完成，请重试 / 发布失败，请重试 / 仅支持 mp4 / mkv / mov 格式 / 文件大小不能超过 200M / 视频时长不能超过 5 分钟 / 发布成功，待审核。

选视频即自动起传；上传失败点卡片重试；删除卡片会置取消标记（分片间隔生效）。

## 五、验证状态与待办

- ✅ `npx tsc --noEmit` 通过（含 `.expo/types` 已生成 `circle/publish` typed route）
- ✅ `npx expo lint` 新增/改动文件零告警
- ✅ `npx vitest run`：972 用例通过（ProfileScreen.test.tsx 为存量 transform 失败，与本次无关）
- ⬜ 真机回归（需先出包含 expo-video-thumbnails 的新包）：
  - Android content:// / iOS ph:// 视频读取与 200M 分片上传；
  - X-Date 用服务端时钟的签名被火山接受（真 STS 环境）；
  - 话题/@ 面板自动唤起（结尾输入 # 或 @）、表情面板、声明多选、公约 webview；
  - 发布后 myList/他人主页可见审核中状态。
