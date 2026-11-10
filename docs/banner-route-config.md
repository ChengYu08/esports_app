# Banner App 内跳转配置说明

后台素材「端跳转配置」中，App（`IOS` / `ANDROID`）使用：

```json
{
  "jumpType": "ROUTE",
  "jumpUrl": "<路由模板>",
  "params": { "<key>": "<string value>" }
}
```

- `jumpUrl` 必须以 `/` 开头
- `params` 的 value **必须是字符串**
- 缺参时由目标页自行兜底（可能 toast / 空白 / 返回），解析层不再拦截
- 命中 [敏感路径黑名单](../src/features/home/banner-route-deny.ts) 的路由会被 App 拒绝跳转

PC 端请用 `jumpType: "URL"` + https 外链，不走本文 App 路由表。

---

## 推荐投放页面

| 页面       | jumpUrl                   | 必填 params    | 可选 params                | 说明                                                             |
| ---------- | ------------------------- | -------------- | -------------------------- | ---------------------------------------------------------------- |
| 活动落地页 | `/activity`               | `activityCode` | —                          | 缺 `activityCode` 会 toast 并返回                                |
| 俱乐部首页 | `/club/[id]`              | `id`           | `fromUserId`、`fromSearch` | `id` 为俱乐部主键，不是对外俱乐部号；`fromSearch=1` 表示来自搜索 |
| 个人主页   | `/profile`                | `userId`       | `clubId`、`fromSearch`     | 不传 `userId` 时进入当前登录用户主页                             |
| 钻石充值   | `/star-recharge`          | —              | `shortfall`                | 差额提示用                                                       |
| 我的钻石   | `/my-diamonds`            | —              | —                          | —                                                                |
| 搜索       | `/search`                 | —              | `type`、`clubId`           | `type`：`club` / `user` / `message`                              |
| 关于我们   | `/about`                  | —              | —                          | —                                                                |
| 协议页     | `/protocol`               | —              | `kind`                     | `kind=privacy` 隐私政策，其它/缺省为用户协议                     |
| 实名认证   | `/real-name-verification` | —              | —                          | 需登录；未在黑名单                                               |
| 登录       | `/login`                  | —              | `mode`、`phone`            | 一般不建议运营投放                                               |

### 配置示例

俱乐部首页：

```json
{
  "jumpType": "ROUTE",
  "jumpUrl": "/club/[id]",
  "params": { "id": "1234567890" }
}
```

活动落地页：

```json
{
  "jumpType": "ROUTE",
  "jumpUrl": "/activity",
  "params": { "activityCode": "SECKILL001" }
}
```

个人主页：

```json
{
  "jumpType": "ROUTE",
  "jumpUrl": "/profile",
  "params": { "userId": "10001" }
}
```

---

## 可用但不建议随意投放

以下路由技术上可通过（未在黑名单），但依赖会话/业务上下文，运营误配易进空页或异常流：

| 页面         | jumpUrl                       | 主要 params                             |
| ------------ | ----------------------------- | --------------------------------------- |
| 俱乐部价目表 | `/club/price-list`            | `groupId`（必填语义）                   |
| 订单详情     | `/order/[id]`                 | `id`；可选 `scope`=`place`/`accept`     |
| 派单页       | `/order/dispatch/[requestNo]` | `requestNo`                             |
| 开黑房       | `/voice-room/[id]`            | `id`；可选 `v`、`scene`、`requestNo` 等 |
| 匹配中       | `/match/matching/[requestNo]` | `requestNo`                             |
| 匹配入口     | `/match`                      | —                                       |
| 小法庭详情   | `/court/[id]`                 | `id`；可选 `mine`                       |
| 小法庭工单   | `/court/ticket/[id]`          | `id`；可选 `mine`                       |
| 聊天         | `/chat/[id]`                  | 会话相关 id                             |
| 举报         | `/report`                     | `userId`                                |
| 大神工作台   | `/companion-dashboard`        | 可选 `gameId`                           |
| 大神相册     | `/companion-gallery`          | 可选 `gameId`                           |
| 大神介绍编辑 | `/companion-intro`            | 可选 `gameId`                           |
| 大神收入     | `/companion-income`           | —                                       |
| 排行榜 Tab   | `/ranking`                    | —                                       |
| 消息 Tab     | `/message`                    | —                                       |
| 订单 Tab     | `/order`                      | 可选 `scope`                            |
| 我的 Tab     | `/mine`                       | —                                       |
| 首页 Tab     | `/`                           | —                                       |

动态段写法与站内一致：模板路径 + params，例如订单详情用 `jumpUrl: "/order/[id]"` + `params.id`，不要写成 `/order/123`（也可试，但不作为约定）。

---

## 禁止投放（黑名单）

以下 `jumpUrl` 会被 App 直接忽略（回退内容图 / 外链 / 无动作）：

| jumpUrl                 | 原因                             |
| ----------------------- | -------------------------------- |
| `/forgot-password`      | 找回密码                         |
| `/change-password`      | 修改密码                         |
| `/account-cancellation` | 注销账号                         |
| `/account-security`     | 账号安全                         |
| `/account-settings`     | 账号设置                         |
| `/basic-settings`       | 基础设置                         |
| `/teen-mode`            | 青少年模式                       |
| `/edit-profile`         | 编辑资料                         |
| `/edit-nickname`        | 编辑昵称                         |
| `/edit-signature`       | 编辑签名                         |
| `/avatar-crop`          | 头像裁剪                         |
| `/media-picker`         | 选图器                           |
| `/blacklist`            | 黑名单                           |
| `/message-notification` | 消息通知设置                     |
| `/web-view`             | 内嵌 WebView（避免绕过外链校验） |

黑名单源文件：[`src/features/home/banner-route-deny.ts`](../src/features/home/banner-route-deny.ts)。

外链请使用 `jumpType: "URL"` + `http(s)://...`，不要用 `/web-view`。

---

## 首页开屏弹窗（`APP_HOME_POPUP`）

与楼层 Banner 共用素材字段与 `linkConfig` 跳转协议，独立资源位编码：`APP_HOME_POPUP`。

| 项   | 约定                                                               |
| ---- | ------------------------------------------------------------------ |
| 展示 | 弹层内轮播投放中的全部有效展示图（按 `sort`）；仅 1 张时不自动轮播 |
| 间隔 | 接口 `intervalSec`，非法时默认 5s                                  |
| 频控 | 每次冷启动进首页有素材弹一次（进程内只弹一次）                     |
| 点击 | 与 Banner 相同：`ROUTE` / `URL` / 内容图预览；**不自动关闭弹窗**   |
| UI   | 图片按比例 contain 适配且不超出屏幕；底部关闭按钮                  |

App 请求示例：`{ "slotCodes": ["APP_HOME_POPUP"] }`（不与楼层 `APP_HOME_FLOOR*` 混渲染）。
