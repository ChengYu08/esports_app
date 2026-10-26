import { apiClient } from "@/core/network/api-client";
import { createCompanionManagementApi } from "./companion-management.contract";

export const companionManagementApi = createCompanionManagementApi(apiClient);
