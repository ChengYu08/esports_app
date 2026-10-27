// Metro 资源导入在 TS 里是 AssetRegistry 的数字引用，测试环境由 vitest 资源桩代替。
declare module "*.png" {
  const value: number;
  export default value;
}

declare module "*.jpg" {
  const value: number;
  export default value;
}

declare module "*.jpeg" {
  const value: number;
  export default value;
}

declare module "*.gif" {
  const value: number;
  export default value;
}

declare module "*.webp" {
  const value: number;
  export default value;
}

declare module "*.svg" {
  const value: number;
  export default value;
}
