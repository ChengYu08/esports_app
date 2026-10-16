import { useQuery } from "@tanstack/react-query";
import { searchClubs } from "../api/search.api";

export function useClubSearch(keyword: string) {
  return useQuery({
    queryKey: ["club-search", keyword],
    queryFn: ({ signal }) => searchClubs(keyword, 1, 20, signal),
    enabled: keyword.trim().length > 0,
  });
}
