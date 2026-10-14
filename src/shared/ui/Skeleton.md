# 公共骨架屏

复用已安装的 Reanimated 和 expo-linear-gradient，无新增依赖。动画卸载时清理，遵循系统减少动态效果设置。

## 通用加载

现有 `LoadingState` 已接入三行骨架屏，首页、搜索、订单、榜单等原有调用直接生效。只在首次加载、没有数据时展示；下拉刷新和分页继续保留已有内容。

```tsx
import { LoadingState } from "@/shared/ui/AsyncStates";

if (query.isLoading) return <LoadingState message="内容加载中…" />;
```

## 自定义布局

```tsx
import { Skeleton, SkeletonCircle, SkeletonText, SkeletonList } from "@/shared/ui/Skeleton";

// 图片或卡片占位：尽量匹配真实内容尺寸，减少内容出现时的跳动。
<Skeleton width="100%" height={160} radius={12} />
<SkeletonCircle size={48} />
<SkeletonText lines={3} lastLineWidth="60%" />
<SkeletonList rows={4} message="列表加载中" />
```

`Skeleton` 支持 `width`、`height`、`radius`、`baseColor`、`highlightColor`、`duration`、`animate`、`style` 和 `testID`。`animate={false}` 显示静态占位。自定义组合的外层应提供一次加载状态的无障碍描述。

## 第三方方案评估

- react-native-skeleton-placeholder 5.2.4：额外依赖 masked-view 和 react-native-linear-gradient；当前项目未安装这两个原生库。
- moti 0.30.0 的 skeleton：可结合 Expo 使用，但引入 Moti 和 framer-motion；发布元数据仍以 Reanimated 3 为基础，需要额外验证当前 Reanimated 4 的兼容性。

当前需求采用已有依赖封装更轻量。上述版本和依赖来自 npm registry 查询。
