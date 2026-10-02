import type {
  GeoLocation,
  ConnectionType,
  Connection,
  Operator,
  AddressInfo,
  ChargingStation,
  SearchResult,
  SearchParams as SharedSearchParams,
  ApiError,
} from '@ev-charging/shared-types';
export type {
  GeoLocation,
  ConnectionType,
  Connection,
  Operator,
  AddressInfo,
  ChargingStation,
  SearchResult,
  ApiError,
} from '@ev-charging/shared-types';

export interface SearchParams {
  city?: string;
  lat?: number;
  lon?: number;
  distance: number;
  maxResults: number;
}

export interface FavoriteStation {
  id: number;
  station_id: number;
  station_uuid: string;
  station_name: string;
  address: string;
  lat: number;
  lon: number;
  added_at: string;
}

export interface SearchHistoryEntry {
  city: string;
  lat: number;
  lon: number;
  distance: number;
  results: number;
  searched_at: string;
}

export type FilterType = 'all' | 'operational' | 'fast' | 'free';

export interface Car {
  id: number;
  external_id: string | null;
  brand: string;
  model: string;
  variant_name: string | null;
  model_year: number | null;
  range_km: number;
  charge_time_10_80_min: number | null;
  charge_time_10_100_min: number | null;
  added_at: string;
}

export interface CarSearchResult {
  externalId: string;
  brand: string;
  model: string;
  variantName: string | null;
  modelYear: number | null;
  rangeKm: number | null;
}
