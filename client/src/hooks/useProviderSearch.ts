/**
 * MARKETPLACE PROVIDER SEARCH HOOK
 * URL-synced search state. Runs on mount from URL params.
 * Online service domains only. NOT for K9000.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ProviderSearchFilters,
  ProviderSearchResponse,
  ProviderSortMode,
} from "@shared/provider-search-types";
import { fetchProviderSearch } from "@/api/providerSearchApi";

function parseFiltersFromUrl(): ProviderSearchFilters {
  const q = new URLSearchParams(window.location.search);
  return {
    q: q.get("q") || "",
    serviceType: (q.get("serviceType") || "") as any,
    startDate: q.get("startDate") || undefined,
    endDate: q.get("endDate") || undefined,
    postcode: q.get("postcode") || undefined,
    lat: q.get("lat") ? Number(q.get("lat")) : undefined,
    lng: q.get("lng") ? Number(q.get("lng")) : undefined,
    radiusKm: q.get("radiusKm") ? Number(q.get("radiusKm")) : 15,
    verifiedOnly: q.get("verifiedOnly") === "true",
    instantBookOnly: q.get("instantBookOnly") === "true",
    insuredOnly: q.get("insuredOnly") === "true",
    minRating: q.get("minRating") ? Number(q.get("minRating")) : 0,
    minReviews: q.get("minReviews") ? Number(q.get("minReviews")) : 0,
    priceMin: q.get("priceMin") ? Number(q.get("priceMin")) : 0,
    priceMax: q.get("priceMax") ? Number(q.get("priceMax")) : 999999,
    petType: (q.get("petType") || "") as any,
    petSize: (q.get("petSize") || "") as any,
    sort: (q.get("sort") || "recommended") as ProviderSortMode,
    page: q.get("page") ? Number(q.get("page")) : 1,
    pageSize: 20,
  };
}

function syncFiltersToUrl(filters: ProviderSearchFilters) {
  const url = new URL(window.location.href);
  url.search = "";
  Object.entries(filters).forEach(([key, value]) => {
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      value === false ||
      value === 0 ||
      value === 999999
    )
      return;
    url.searchParams.set(key, String(value));
  });
  window.history.replaceState({}, "", url.toString());
}

export const DEFAULT_FILTERS: ProviderSearchFilters = {
  q: "",
  serviceType: "",
  radiusKm: 15,
  verifiedOnly: false,
  instantBookOnly: false,
  insuredOnly: false,
  minRating: 0,
  minReviews: 0,
  priceMin: 0,
  priceMax: 999999,
  petType: "",
  petSize: "",
  sort: "recommended",
  page: 1,
  pageSize: 20,
};

export function useProviderSearch() {
  const [filters, setFilters] = useState<ProviderSearchFilters>(
    parseFiltersFromUrl
  );
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ProviderSearchResponse | null>(null);
  const [error, setError] = useState("");

  // Debounce ref for text search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (nextFilters?: ProviderSearchFilters) => {
    const merged = nextFilters || filters;
    setLoading(true);
    setError("");
    try {
      syncFiltersToUrl(merged);
      const result = await fetchProviderSearch(merged);
      setData(result);
    } catch (err: any) {
      setError(err?.message || "Search failed");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Debounced text search — fires 300 ms after the user stops typing
  const runSearchDebounced = useCallback((nextFilters: ProviderSearchFilters) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch(nextFilters);
    }, 300);
  }, [runSearch]);

  // Run on mount from URL params
  useEffect(() => {
    runSearch(filters);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.verifiedOnly) n++;
    if (filters.instantBookOnly) n++;
    if (filters.insuredOnly) n++;
    if ((filters.minRating || 0) > 0) n++;
    if ((filters.minReviews || 0) > 0) n++;
    if ((filters.priceMin || 0) > 0) n++;
    if ((filters.priceMax || 999999) < 999999) n++;
    if ((filters.radiusKm || 15) !== 15 && filters.lat) n++;
    return n;
  }, [filters]);

  function resetFilters() {
    const next: ProviderSearchFilters = {
      ...DEFAULT_FILTERS,
      q: filters.q || "",
      serviceType: filters.serviceType,
      startDate: filters.startDate,
      endDate: filters.endDate,
      lat: filters.lat,
      lng: filters.lng,
    };
    setFilters(next);
    runSearch(next);
  }

  return {
    filters,
    setFilters,
    loading,
    data,
    error,
    runSearch,
    runSearchDebounced,
    activeFilterCount,
    resetFilters,
  };
}
