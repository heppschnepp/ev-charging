import type { ChargingStation, FilterType } from '@/types';
import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function getStationStatus(station: ChargingStation): 'operational' | 'planned' | 'unknown' {
  if (station.isOperational === true) return 'operational';
  if (station.isOperational === false) return 'planned';
  return 'unknown';
}

export function getMaxPower(station: ChargingStation): number {
  return Math.max(0, ...station.connections.map((c) => c.powerKW ?? 0));
}

export function isFastCharger(station: ChargingStation): boolean {
  return getMaxPower(station) >= 50;
}

export function formatDistance(km?: number): string {
  if (km == null) return '';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function formatPower(kw?: number): string {
  if (kw == null) return 'Unknown';
  return `${kw} kW`;
}

export function formatDate(iso?: string): string {
  if (!iso) return 'Unknown';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(iso));
}

export function filterStations(stations: ChargingStation[], filter: FilterType): ChargingStation[] {
  switch (filter) {
    case 'operational':
      return stations.filter((s) => s.isOperational === true);
    case 'fast':
      return stations.filter(isFastCharger);
    case 'free':
      return stations.filter(
        (s) => s.usageTypeTitle?.toLowerCase().includes('free') ?? false,
      );
    default:
      return stations;
  }
}

export function getConnectorBadgeColor(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('ccs') || t.includes('combo')) return 'bg-blue-100 text-blue-800';
  if (t.includes('chademo')) return 'bg-purple-100 text-purple-800';
  if (t.includes('type 2') || t.includes('iec')) return 'bg-green-100 text-green-800';
  if (t.includes('type 1')) return 'bg-yellow-100 text-yellow-800';
  if (t.includes('tesla')) return 'bg-red-100 text-red-800';
  if (t.includes('schuko') || t.includes('domestic')) return 'bg-gray-100 text-gray-700';
  return 'bg-gray-100 text-gray-700';
}

export function getTotalConnectors(station: ChargingStation): number {
  return station.connections.reduce((sum, c) => sum + (c.quantity ?? 1), 0);
}
