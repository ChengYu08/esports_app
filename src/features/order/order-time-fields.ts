export type OrderTimeFields = {
  createTime?: string;
  paidTime?: string;
  acceptedTime?: string;
  serviceStartTime?: string;
  serviceEndTime?: string;
  completedTime?: string;
};

function stringValue(item: Record<string, unknown>, key: string) {
  const value = item[key];
  return value === undefined || value === null || value === "" ? undefined : String(value);
}

export function readOrderTimeFields(item: Record<string, unknown>): OrderTimeFields {
  return {
    createTime: stringValue(item, "createTime"),
    paidTime: stringValue(item, "paidTime"),
    acceptedTime: stringValue(item, "acceptedTime"),
    serviceStartTime: stringValue(item, "serviceStartTime"),
    serviceEndTime: stringValue(item, "serviceEndTime"),
    completedTime: stringValue(item, "completedTime"),
  };
}
