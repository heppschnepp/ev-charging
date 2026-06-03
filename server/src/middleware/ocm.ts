import type { ChargingStation, GeoLocation } from '../types/index.js';

const OCM_BASE = process.env.OCM_BASE_URL ?? 'https://api.openchargemap.io/v3';
const OCM_KEY = process.env.OCM_API_KEY ?? '';
const NOMINATIM_BASE = process.env.NOMINATIM_BASE_URL ?? 'https://nominatim.openstreetmap.org';

interface GeoLocationOption {
  lat: number;
  lon: number;
  displayName: string;
  placeId?: number;
}

// Reverse geocode coordinates to get a place name
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const url = `${NOMINATIM_BASE}/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'ev-charging-finder/1.0' },
  });
  if (!res.ok) throw new Error(`Reverse geocoding failed: ${res.statusText}`);
  const data = await res.json();
  // Return the display name, or construct one from address parts if needed
  if (data.display_name) {
    return data.display_name;
  }
  // Fallback: construct from address components
  const address = data.address ?? {};
  const parts = [
    address.city || address.town || address.village || address.hamlet,
    address.state,
    address.country
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`;
}

export async function geocodeCity(city: string): Promise<GeoLocationOption[]> {
  const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(city)}&format=json&limit=5`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'ev-charging-finder/1.0' },
  });
  if (!res.ok) throw new Error(`Geocoding failed: ${res.statusText}`);
  const data = (await res.json()) as {
    lat: string;
    lon: string;
    display_name: string;
    place_id: number;
  }[];
  if (!data.length) throw new Error(`City not found: ${city}`);
  return data.map((item) => ({
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
    displayName: item.display_name,
    placeId: item.place_id,
  }));
}

interface OcmRaw {
  ID: number;
  UUID: string;
  OperatorID?: number;
  OperatorInfo?: {
    ID: number;
    Title: string;
    WebsiteURL?: string;
    ContactEmail?: string;
    ContactTelephone1?: string;
  };
  AddressInfo: {
    Title: string;
    AddressLine1?: string;
    AddressLine2?: string;
    Town?: string;
    StateOrProvince?: string;
    Postcode?: string;
    Country?: { ISOCode?: string };
    Latitude: number;
    Longitude: number;
    Distance?: number;
    ContactTelephone1?: string;
    ContactTelephone2?: string;
    ContactEmail?: string;
    RelatedURL?: string;
  };
  Connections?: {
    ConnectionTypeID: number;
    ConnectionType?: { ID: number; Title: string; FormalName?: string };
    PowerKW?: number;
    CurrentType?: { Description?: string };
    Level?: { Title?: string };
    Quantity?: number;
    StatusType?: { Title?: string };
  }[];
  StatusType?: { IsOperational?: boolean; Title?: string };
  UsageType?: { Title?: string };
  NumberOfPoints?: number;
  DateLastVerified?: string;
  DateLastStatusUpdate?: string;
  UsageCost?: string;
}

export async function fetchStations(
  lat: number,
  lon: number,
  distance: number,
  maxResults: number,
): Promise<ChargingStation[]> {
  const params = new URLSearchParams({
    output: 'json',
    latitude: String(lat),
    longitude: String(lon),
    distance: String(distance),
    distanceunit: 'KM',
    maxresults: String(maxResults),
    verbose: 'true',
    key: OCM_KEY,
  });

  const res = await fetch(`${OCM_BASE}/poi/?${params}`);
  if (!res.ok) throw new Error(`OCM API error: ${res.statusText}`);
  const raw = (await res.json()) as OcmRaw[];

  return raw.map((p): ChargingStation => ({
    id: p.ID,
    uuid: p.UUID,
    operatorId: p.OperatorID,
    operator: p.OperatorInfo
      ? {
          id: p.OperatorInfo.ID,
          title: p.OperatorInfo.Title,
          websiteUrl: p.OperatorInfo.WebsiteURL,
          contactEmail: p.OperatorInfo.ContactEmail,
          contactTelephone1: p.OperatorInfo.ContactTelephone1,
        }
      : undefined,
    addressInfo: {
      title: p.AddressInfo.Title,
      addressLine1: p.AddressInfo.AddressLine1,
      addressLine2: p.AddressInfo.AddressLine2,
      town: p.AddressInfo.Town,
      stateOrProvince: p.AddressInfo.StateOrProvince,
      postcode: p.AddressInfo.Postcode,
      countryIso: p.AddressInfo.Country?.ISOCode,
      lat: p.AddressInfo.Latitude,
      lon: p.AddressInfo.Longitude,
      distance: p.AddressInfo.Distance,
      contactTelephone1: p.AddressInfo.ContactTelephone1,
      contactTelephone2: p.AddressInfo.ContactTelephone2,
      contactEmail: p.AddressInfo.ContactEmail,
      relatedUrl: p.AddressInfo.RelatedURL,
    },
    connections: (p.Connections ?? []).map((c) => ({
      connectionTypeId: c.ConnectionTypeID,
      connectionType: c.ConnectionType
        ? { id: c.ConnectionType.ID, title: c.ConnectionType.Title, formalName: c.ConnectionType.FormalName }
        : undefined,
      powerKW: c.PowerKW,
      currentType: c.CurrentType?.Description,
      levelTitle: c.Level?.Title,
      quantity: c.Quantity,
      statusTitle: c.StatusType?.Title,
    })),
    statusTitle: p.StatusType?.Title,
    isOperational: p.StatusType?.IsOperational,
    usageTypeTitle: p.UsageType?.Title,
    numberOfPoints: p.NumberOfPoints,
    dateLastVerified: p.DateLastVerified,
    dateLastStatusUpdate: p.DateLastStatusUpdate,
    usageCost: p.UsageCost,
  }));
}
