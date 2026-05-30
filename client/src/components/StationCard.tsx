import { useState } from 'react';
import {
  MapPin, Zap, Phone, Globe, ChevronDown, Heart, Clock, Plug,
  CheckCircle, AlertCircle, HelpCircle, Banknote,
} from 'lucide-react';
import type { ChargingStation } from '@/types';
import {
  cn, getStationStatus, getMaxPower, isFastCharger,
  formatDistance, formatPower, formatDate, getConnectorBadgeColor,
} from '@/lib/utils';
import { StationCardDetails } from '@/components/StationCardDetails';

function getTotalConnectors(station: ChargingStation): number {
  return station.connections.reduce((sum, c) => sum + (c.quantity ?? 1), 0);
}

interface Props {
  station: ChargingStation;
  isFavorite: boolean;
  onToggleFavorite: (station: ChargingStation) => void;
}

const STATUS_CONFIG = {
  operational: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50', label: 'Operational', badge: 'bg-green-100 text-green-800' },
  planned:     { icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-50',  label: 'Not operational', badge: 'bg-amber-100 text-amber-800' },
  unknown:     { icon: HelpCircle,  color: 'text-gray-400',  bg: 'bg-gray-50',   label: 'Unknown',   badge: 'bg-gray-100 text-gray-600' },
};

export function StationCard({ station, isFavorite, onToggleFavorite }: Props) {
  const [expanded, setExpanded] = useState(false);
  const status = getStationStatus(station);
  const cfg = STATUS_CONFIG[status];
  const StatusIcon = cfg.icon;
  const maxPower = getMaxPower(station);
  const fast = isFastCharger(station);
  const { addressInfo: addr, connections, operator } = station;
  const { usageCost } = station;

  const addressStr = [addr.addressLine1, addr.town, addr.postcode].filter(Boolean).join(', ');
  const totalConnectors = getTotalConnectors(station);

  return (
    <div
      className={cn(
        'bg-white rounded-xl border transition-all duration-200',
        expanded ? 'border-ev-200 shadow-md' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm',
      )}
    >
      {/* Header */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Icon */}
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', cfg.bg)}>
          <StatusIcon size={20} className={cfg.color} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-900 text-sm leading-snug truncate">{addr.title}</h3>
            <div className="flex items-center gap-1.5 shrink-0">
              {fast && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                  <Zap size={10} />
                  Fast
                </span>
              )}
              <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold', cfg.badge)}>
                {cfg.label}
              </span>
            </div>
          </div>

          <p className="text-xs text-gray-600 mt-0.5 truncate">{addressStr}</p>
          {operator && (
            <p className="text-xs text-gray-600 mt-0.5 truncate">Operator: {operator.title}</p>
          )}

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {addr.distance != null && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                <MapPin size={12} /> {formatDistance(addr.distance)}
              </span>
            )}
            {connections.length > 0 && totalConnectors > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                <Plug size={12} /> {totalConnectors} connector{totalConnectors !== 1 ? 's' : ''}
              </span>
            )}
            {maxPower > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-ev-700">
                <Zap size={12} /> {formatPower(maxPower)} max
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0 ml-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(station);
            }}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              isFavorite ? 'text-red-500 bg-red-50' : 'text-gray-400 hover:text-gray-500 hover:bg-gray-100',
            )}
            title={isFavorite ? 'Remove from favourites' : 'Add to favourites'}
          >
            <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
          <ChevronDown
            size={16}
            className={cn('text-gray-500 transition-transform', expanded && 'rotate-180')}
          />
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && <StationCardDetails station={station} />}
    </div>
  );
}