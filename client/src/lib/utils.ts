import type { ChargingStation, FilterType } from '@/types';
import { clsx, type ClassValue } from 'clsx';
import { CheckCircle, AlertCircle, HelpCircle } from 'lucide-react';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export const STATUS_CONFIG = {
  operational: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/30', label: 'Operational', badge: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  planned:     { icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30',  label: 'Not operational', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  unknown:     { icon: HelpCircle,  color: 'text-gray-400',  bg: 'bg-gray-50 dark:bg-gray-800/50',   label: 'Unknown',   badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
} as const;

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
      return stations.filter((s) => {
        const cost = (s.usageCost ?? '').toLowerCase().trim();
        if (!cost || cost === 'free' || cost === '0' || cost === '0.00') return true;
        return s.usageTypeTitle?.toLowerCase().includes('free') ?? false;
      });
    default:
      return stations;
  }
}

export function getConnectorBadgeColor(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('ccs') || t.includes('combo')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
  if (t.includes('chademo')) return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300';
  if (t.includes('type 2') || t.includes('iec')) return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
  if (t.includes('type 1')) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300';
  if (t.includes('tesla')) return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
  if (t.includes('schuko') || t.includes('domestic')) return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
}

export function getTotalConnectors(station: ChargingStation): number {
  return station.connections.reduce((sum, c) => sum + (c.quantity ?? 1), 0);
}
