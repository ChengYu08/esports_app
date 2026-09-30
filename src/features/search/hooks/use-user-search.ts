import { useQuery } from "@tanstack/react-query";
import { searchUsers } from "../api/search.api";

export function useUserSearch(keyword: string) {
  return useQuery({
    queryKey: ["user-search", keyword],
    queryFn: () => searchUsers(keyword),
    enabled: keyword.trim().length > 0,
  });
}
