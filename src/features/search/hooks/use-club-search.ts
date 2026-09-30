import { useQuery } from "@tanstack/react-query";
import { searchClubs } from "../api/search.api";

export function useClubSearch(keyword: string) {
  return useQuery({
    queryKey: ["club-search", keyword],
    queryFn: () => searchClubs(keyword),
    enabled: keyword.trim().length > 0,
  });
}
