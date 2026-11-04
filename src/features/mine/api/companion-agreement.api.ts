import { apiClient } from "@/core/network/api-client";
import { Platform } from "react-native";
import { createCompanionAgreementApi } from "./companion-agreement.contract";

export const companionAgreementApi = createCompanionAgreementApi(apiClient, Platform.OS);
