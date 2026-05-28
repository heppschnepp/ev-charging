// Shared types used by both client and server

export interface GeoLocation {
  lat: number;
  lon: number;
  displayName: string;
}

export interface ConnectionType {
  id: number;
  title: string;
  formalName?: string;
}

export interface Connection {
  connectionTypeId: number;
  connectionType?: ConnectionType;
  powerKW?: number;
  currentType?: string;
  levelTitle?: string;
  quantity?: number;
  statusTitle?: string;
}

export interface Operator {
  id: number;
  title: string;
  websiteUrl?: string;
  contactEmail?: string;
  contactTelephone1?: string;
}

export interface AddressInfo {
  title: string;
  addressLine1?: string;
  addressLine2?: string;
  town?: string;
  stateOrProvince?: string;
  postcode?: string;
  countryIso?: string;
  lat: number;
  lon: number;
  distance?: number;
  contactTelephone1?: string;
  contactTelephone2?: string;
  contactEmail?: string;
  relatedUrl?: string;
}

export interface ChargingStation {
  id: number;
  uuid: string;
  operatorId?: number;
  operator?: Operator;
  addressInfo: AddressInfo;
  connections: Connection[];
  statusTitle?: string;
  isOperational?: boolean;
  usageTypeTitle?: string;
  numberOfPoints?: number;
  dateLastVerified?: string;
  dateLastStatusUpdate?: string;
}

export interface SearchParams {
  city: string;
  latitude?: number;
  longitude?: number;
  distance: number;
  maxResults: number;
  minPowerKW?: number;
  operationalOnly?: boolean;
  operator?: string;
}

export interface SearchResult {
  stations: ChargingStation[];
  total: number;
  location: GeoLocation;
  cachedAt?: string;
}

export interface ApiError {
  message: string;
  code: string;
}
