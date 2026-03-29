/**
 * MARKETPLACE PROVIDER SEARCH API CLIENT
 * Online service domains only (pet_sitting, dog_walking, grooming, transport, daycare).
 * NOT for K9000.
 */

import type {
  ProviderSearchFilters,
  ProviderSearchResponse,
} from "@shared/provider-search-types";

export async function fetchProviderSearch(
  filters: ProviderSearchFilters
): Promise<ProviderSearchResponse> {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === false)
      return;
    params.set(key, String(value));
  });

  const response = await fetch(`/api/providers/search?${params.toString()}`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Search request failed: ${response.status}`);
  }

  return response.json();
}
