import { apiClient } from "@/core/network/api-client";
import { createRankingContract } from "./ranking.contract";

export const rankingApi = createRankingContract(apiClient);
