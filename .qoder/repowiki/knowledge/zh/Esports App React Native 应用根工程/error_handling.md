## 1. 采用的体系

仓库采用「单一 HTTP 客户端 + 自定义 Error 类型 + 全局中间件式拦截」的方式统一处理错误：
- 所有后端请求通过 `src/core/network/api-client.ts` 暴露的 `apiClient<T>()` 发起，业务模块不直接调用 axios。
- 统一的 `ApiError extends Error` 作为所有网络层错误的载体，携带 `status: number`、`code?: string`（后端返回的业务码）和通用 `message`。
- 在 `apiClient` 内部对响应进行统一校验，根据 HTTP status / 后端 code 触发两类全局副作用：
  - 鉴权过期（401 或 `UNAUTHORIZED` / `NOT_LOGIN` / `NOT_LOGGED_IN`）→ 调用注册的 `authExpiredHandler`。
  - 未实名认证 → 当后端响应 `info === '未进行实名认证'` 时，冷却期内只触发一次 `realNameRequiredHandler`，并跳转到 `/real-name-verification`。
- 全局 handler 在根布局 `src/app/_layout.tsx` 中通过 `setAuthExpiredHandler` / `setRealNameRequiredHandler` 注册。

日志方面使用 `src/core/logging/logger.ts`，按 `debug|info|warn|error` 四级输出 JSON，自动过滤敏感 key（token/password/secret/authorization/phone/email），生产环境丢弃 `debug`。

Toast 展示走 `src/shared/ui/app-toast.ts`，封装 `react-native-root-toast` 提供 `showToast`，默认居中短提示。

React Query 配置位于 `src/core/query/query-client.ts`：queries 默认 `retry: 1`、`refetchOnReconnect: true`；mutations 默认 `retry: 0`。

## 2. 关键文件

- `src/core/network/api-client.ts` — `ApiError` 定义、`apiClient`、鉴权过期与未实名全局拦截器。
- `src/core/network/axios-instance.ts` — 共享 Axios 实例（baseURL、timeout=15s、Referer WAF 头）。
- `src/core/logging/logger.ts` — 结构化日志（带敏感字段脱敏）。
- `src/core/query/query-client.ts` — React Query 重试策略。
- `src/shared/ui/app-toast.ts` — Toast 封装。
- `src/app/_layout.tsx` — 全局注册鉴权过期与未实名处理器。
- `src/features/message/customer-service.api.ts` — 业务域内对 `ApiError.code` 做二次分流的示例（客服忙码映射为固定文案）。

## 3. 架构与约定

### 3.1 错误类型与传播

- 非 2xx 响应：构造 `ApiError(message, status, code)` 后抛出。
- 纯网络异常（无 response）：记录 `api.network_error` 日志，抛出 `ApiError('网络连接失败，请检查网络后重试', 0)`。
- Axios Cancel（React Query 取消）：原样向上抛出，不视为网络失败。
- 业务层 API 函数可进一步将后端 envelope 的 `{code, info}` 包装成新的 `ApiError` 再抛出（见 `customer-service.api.ts` 中 `response.code !== 'SUCCESS'` 分支）。

### 3.2 鉴权过期处理

- 判定条件：HTTP 401 或 `code ∈ {UNAUTHORIZED, NOT_LOGIN, NOT_LOGGED_IN}`。
- 忽略路径：包含 `/client/v1/user/logout` 的请求跳过。
- 仅当请求携带 `token` 且当前 store 中的 `accessToken` 与本次请求 token 一致时才执行刷新流程，避免并发刷新。
- 刷新成功后，由调用方自行决定是否重放原请求（由上层逻辑决定）。handler 本身只负责清理会话。

### 3.3 未实名认证拦截

- 精确匹配后端 BusinessException 的 `info` 文本 `'未进行实名认证'`（注释明确说明是为了对齐 Web 端行为，并避免误命中「老板未进行实名认证」等近似文案）。
- 3 秒冷却期（`REAL_NAME_TRIGGER_COOLDOWN_MS = 3000`），防止多个接口同时失败重复压入实名页。
- 处理器抛错会被捕获并以 `api.real_name_handler_error` 告警，不影响主流程继续抛出原始 `ApiError`。

### 3.4 业务域内的错误细化

业务 API 通常先调用 `apiClient`，再根据返回 envelope 的 `code` 做二次判断。例如客服模块定义了 `BUSY_CODES = {CS_NO_AGENT_ONLINE, CS_AGENT_NOT_FOUND, CS_SESSION_CONFLICT}`，并通过 `resolveCustomerServiceError` 将这类 `ApiError` 映射为用户可读文案 `"客服繁忙，请稍后再试"`，其它错误则回退到 `error.message`。

## 4. 观察到的约定与约束

- **所有对外部服务的 HTTP 调用必须经过 `apiClient`**：`axios-instance.ts` 注释写明它是「JSON 传输与默认配置的唯一来源」，业务模块导入的是 `@/core/network/api-client` 而非直接使用 axios。
- **网络层错误一律以 `ApiError` 形式抛出**：`apiClient` 内部对所有异常路径都构造 `ApiError`，业务层 catch 处用 `instanceof ApiError` 做类型区分（如 activity、message、voice-room 等多处模式一致）。
- **后端业务码通过 `ApiError.code` 传递**：全局拦截器据此判断鉴权过期，业务层据此做细分错误文案（如客服忙码、未登录码）。
- **敏感信息不得落盘到日志**：`logger.redact` 使用正则 `/token|password|secret|authorization|phone|email/i` 把匹配 key 的值替换为 `[REDACTED]`。
- **生产环境关闭 debug 日志**：`env.environment === 'production' && level === 'debug'` 时直接 return。
- **React Query mutation 禁止自动重试**：默认 `retry: 0`，业务侧需自行处理幂等与重试。
- **Toast 不直接依赖具体库**：通过 `app-toast.ts` 封装，便于测试替换与统一样式。

该方案没有使用第三方错误上报 SDK、也没有 panic/recover 机制（JS 环境不适用），而是围绕 `ApiError` + 全局中间件式的 handler 注册完成错误收集、鉴权恢复与引导跳转。