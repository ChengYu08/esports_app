// Re-export the native module. On web, it will be resolved to PzOneClickModule.web.ts
// and on native platforms to PzOneClickModule.ts
export { default } from './src/PzOneClickModule';
export * from './src/PzOneClick.types';
