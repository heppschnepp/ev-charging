import type { ChargingStation, GeoLocation } from '../types/index.js';
import { getCachedReverseGeocode, setCachedReverseGeocode } from '../db/index.js';

const OCM_BASE = process.env.OCM_BASE_URL ?? 'https://api.openchargemap.io/v3';
const OCM_KEY = process.env.OCM_API_KEY ?? '';
const NOMINATIM_BASE = process.env.NOMINATIM_BASE_URL ?? 'https://nominatim.openstreetmap.org';
const NOMINATIM_USER_AGENT = process.env.NOMINATIM_USER_AGENT ?? 'ev-charging-finder/1.0 (contact@example.com)';
const NOMINATIM_MIN_DELAY_MS = 1100;

interface GeoLocationOption {
  lat: number;
  lon: number;
  displayName: string;
  placeId?: number;
}

let nominatimLastRequest = 0;
let nominatimQueue: Promise<void> = Promise.resolve();

async function nominatimDelay() {
  const now = Date.now();
  const wait = Math.max(0, NOMINATIM_MIN_DELAY_MS - (now - nominatimLastRequest));
  if (wait > 0) {
    await new Promise(resolve => setTimeout(resolve, wait));
  }
  nominatimLastRequest = Date.now();
}

async function nominatimLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = nominatimQueue.then(() => fn());
  nominatimQueue = result.then(() => Promise.resolve(), () => Promise.resolve());
  return result;
}

// Reverse geocode coordinates to get a place name
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const cached = getCachedReverseGeocode(lat, lon);
  if (cached !== null) {
    return cached;
  }

  return nominatimLock(async () => {
    const maxRetries = 2;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await nominatimDelay();
        const url = `${NOMINATIM_BASE}/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;
        const res = await fetch(url, {
          headers: { 'User-Agent': NOMINATIM_USER_AGENT, 'Accept-Language': 'en' },
        });
        if (!res.ok) {
          let body = '';
          try {
            body = await res.text();
          } catch { /* ignore */ }
          throw new Error(`Reverse geocoding failed ${res.status}: ${res.statusText}${body ? ` - ${body.slice(0, 500)}` : ''}`);
        }
        const data = await res.json();
        let displayName: string;
        if (data.display_name) {
          displayName = data.display_name;
        } else {
          const address = data.address ?? {};
          const parts = [
            address.city || address.town || address.village || address.hamlet,
            address.state,
            address.country
          ].filter(Boolean);
          displayName = parts.length > 0 ? parts.join(', ') : `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`;
        }

        setCachedReverseGeocode(lat, lon, displayName);
        return displayName;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Reverse geocoding failed');
        const message = lastError.message;
        if (message.includes('429') && attempt < maxRetries) {
          const delay = (attempt + 1) * 5000;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw lastError;
      }
    }
    throw lastError!;
  });
}
export async function geocodeCity(city: string): Promise<GeoLocationOption[]> {
  return nominatimLock(async () => {
    const maxRetries = 2;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await nominatimDelay();
        const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(city)}&format=json&limit=5`;
        const res = await fetch(url, {
          headers: { 'User-Agent': NOMINATIM_USER_AGENT, 'Accept-Language': 'en' },
        });
        if (!res.ok) {
          let body = '';
          try {
            body = await res.text();
          } catch { /* ignore */ }
          throw new Error(`Geocoding failed ${res.status}: ${res.statusText}${body ? ` - ${body.slice(0, 500)}` : ''}`);
        }
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
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Geocoding failed');
        const message = lastError.message;
        if (message.includes('429') && attempt < maxRetries) {
          const delay = (attempt + 1) * 5000;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw lastError;
      }
    }
    throw lastError!;
  });
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
  if (!res.ok) {
    let body = '';
    try {
      body = await res.text();
    } catch { /* ignore */ }
    throw new Error(`OCM API error ${res.status}: ${res.statusText}${body ? ` - ${body.slice(0, 500)}` : ''}`);
  }
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
