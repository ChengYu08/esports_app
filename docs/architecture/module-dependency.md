# Module 依赖清单

| Module | 可以依赖 | 不应依赖 |
| --- | --- | --- |
| 路由 `src/app` | features、core、shared | 具体 API 实现细节 |
| 业务 `src/features/*` | core、shared、本业务内部 Module | 其他业务的内部文件 |
| 基础设施 `src/core` | shared、第三方库 | features |
| 共享 `src/shared` | React Native、Expo 基础能力 | features、具体页面 |

页面的数据读取通过业务 Hook 完成；网络请求统一经过 `src/core/network/api-client.ts`；敏感凭证统一使用 `src/core/storage/storage.ts` 中的 `secureStorage`。
