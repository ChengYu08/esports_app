## 概述
项目使用一个极简的自实现结构化日志模块，位于 `src/core/logging/logger.ts`。它不依赖任何第三方日志框架（如 winston、bunyan、pino），而是直接对 `console.debug/info/warn/error` 进行封装，按环境过滤输出并附加统一的 JSON payload。

## 核心文件
- `src/core/logging/logger.ts`：唯一的日志门面，导出 `logger` 对象（`debug/info/warn/error`）。

## 架构与约定
- **日志级别**：固定为 `'debug' | 'info' | 'warn' | 'error'` 四个级别，对应 `logger.debug/info/warn/error` 四个方法。
- **结构化字段**：每次写入统一产出如下 JSON 对象：
  - `level`：日志级别
  - `message`：业务消息字符串
  - `version`：取自 `Constants.expoConfig.version`（Expo 应用版本）
  - 其余字段来自调用方传入的 `context: Record<string, string | number | boolean | null | undefined>`，作为扩展字段拼接到 payload 末尾。
- **敏感信息脱敏**：通过正则 `/token|password|secret|authorization|phone|email/i` 匹配 context 键名，命中则替换为 `[REDACTED]`，再参与序列化。该策略是白名单式「按 key 名」判断，而非对值本身做清洗。
- **环境过滤**：当 `env.environment === 'production'` 时，所有 `debug` 级别日志直接丢弃；`info/warn/error` 在 production 仍可输出。
- **输出目标**：仅通过 `console.log` / `console.info` / `console.warn` / `console.error` 输出 JSON 字符串，没有独立的 sink、文件或远程上报逻辑。生产端收集能力取决于宿主平台（React Native 控制台或浏览器开发者工具）。
- **配置来源**：环境判断走 `@/core/config/env` 中的 `env.environment`，版本信息走 `expo-constants`。

## 观察到的约束
- 当前仓库中未发现对 `logger` 的广泛引用——搜索结果显示仅有 `src/features/match/components/MatchListHeader.tsx` 一处显式 import 并使用 `logger.debug`，说明该日志模块尚未被全仓采用，更多模块可能仍直接使用 `console.*`。
- 由于没有集中拦截器或自定义 sink，日志的持久化、聚合、告警等能力不在本仓库内实现。
- 脱敏规则仅针对 context 对象的 key 名称做匹配，不校验 value 类型，也不支持嵌套对象递归脱敏。

## 总结
这是一个面向 React Native + Expo 项目的最小化结构化日志门面：提供统一的 level、JSON payload、版本号注入和敏感 key 脱敏，并通过环境变量抑制 debug 输出。其 sink 仅为 `console`，未实现日志分级存储、远程上报或采样等高级特性。