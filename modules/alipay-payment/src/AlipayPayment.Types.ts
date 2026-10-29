export type AliPayResultCode =
  | 'SUCCESS'
  | 'DEALING'
  | 'CANCELLED'
  | 'ERROR'
  | 'INVALID_PARAM'
  | 'NO_ACTIVITY';

export type AliPayResult = {
  success: boolean;
  code: AliPayResultCode;
  message?: string;
};
