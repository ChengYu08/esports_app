// Re-export the native module. On web, it resolves to AlipayPaymentModule.web.ts;
// on native platforms to AlipayPaymentModule.ts.
export { default } from './src/AlipayPaymentModule';
export * from './src/AlipayPayment.Types';
