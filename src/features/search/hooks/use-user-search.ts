import { useQuery } from "@tanstack/react-query";
import { searchUsers } from "../api/search.api";

export function useUserSearch(keyword: string) {
  return useQuery({
    queryKey: ["user-search", keyword],
    queryFn: ({ signal }) => searchUsers(keyword, 1, 20, signal),
    enabled: keyword.trim().length > 0,
  });
}
