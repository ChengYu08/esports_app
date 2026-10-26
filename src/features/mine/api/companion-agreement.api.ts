import { apiClient } from "@/core/network/api-client";
import { createCompanionAgreementApi } from "./companion-agreement.contract";

export const companionAgreementApi = createCompanionAgreementApi(apiClient);
