# 项目架构

项目采用 Expo Router + Feature Modules 架构。

## 分层

- `src/app`：只负责路由和路由参数，不承载业务逻辑。
- `src/features`：按业务领域组织页面、数据查询、领域类型和业务组件。
- `src/core`：网络、环境变量、存储、日志、缓存和全局 Provider 等基础设施。
- `src/shared`：跨业务复用的 UI、主题、类型和工具。
- `src/state`：跨页面状态；服务端数据优先使用 TanStack Query。

## 依赖方向

```text
app → features → core
                 ↓
               shared
```

`shared` 不得依赖具体业务模块，`core` 不得依赖 `features`。

## 迁移约定

新增业务时，优先在 `src/features/<domain>` 内创建 Module；只有确认被两个以上业务复用时，才提升到 `src/shared`。
