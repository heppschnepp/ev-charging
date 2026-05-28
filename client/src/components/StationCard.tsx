import { useState } from 'react';
import {
  MapPin, Zap, Phone, Globe, ChevronDown, Heart, Clock, Plug,
  CheckCircle, AlertCircle, HelpCircle,
} from 'lucide-react';
import type { ChargingStation } from '@/types';
import {
  cn, getStationStatus, getMaxPower, isFastCharger,
  formatDistance, formatPower, formatDate, getConnectorBadgeColor,
} from '@/lib/utils';

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

  const addressStr = [addr.addressLine1, addr.town, addr.postcode].filter(Boolean).join(', ');

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

          <p className="text-xs text-gray-500 mt-0.5 truncate">{addressStr}</p>
          {operator && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">Operator: {operator.title}</p>
          )}

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {addr.distance != null && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                <MapPin size={12} /> {formatDistance(addr.distance)}
              </span>
            )}
            {connections.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                <Plug size={12} /> {connections.length} connector{connections.length !== 1 ? 's' : ''}
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
              isFavorite ? 'text-red-500 bg-red-50' : 'text-gray-300 hover:text-red-400 hover:bg-red-50',
            )}
            title={isFavorite ? 'Remove from favourites' : 'Add to favourites'}
          >
            <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
          <ChevronDown
            size={16}
            className={cn('text-gray-400 transition-transform', expanded && 'rotate-180')}
          />
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4">
          {/* Connectors */}
          {connections.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Connectors</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {connections.map((c, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', getConnectorBadgeColor(c.connectionType?.title ?? ''))}>
                        {c.connectionType?.title ?? 'Unknown'}
                      </span>
                      {c.levelTitle && (
                        <p className="text-xs text-gray-500 mt-1">{c.levelTitle}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      {c.powerKW && (
                        <p className="text-sm font-bold text-ev-700">{c.powerKW} kW</p>
                      )}
                      {c.quantity && (
                        <p className="text-xs text-gray-400">{c.quantity}×</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contact / meta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {operator && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Operator</p>
                <p className="font-medium text-gray-800 text-xs">{operator.title}</p>
                {operator.websiteUrl && (
                  <a href={operator.websiteUrl} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-ev-600 hover:underline mt-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Globe size={11} /> Website
                  </a>
                )}
              </div>
            )}
            {addr.contactTelephone1 && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Phone</p>
                <a href={`tel:${addr.contactTelephone1}`}
                  className="inline-flex items-center gap-1 text-xs text-ev-600 hover:underline font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Phone size={11} /> {addr.contactTelephone1}
                </a>
              </div>
            )}
            {station.dateLastVerified && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Last verified</p>
                <p className="inline-flex items-center gap-1 text-xs text-gray-600">
                  <Clock size={11} /> {formatDate(station.dateLastVerified)}
                </p>
              </div>
            )}
            {station.usageTypeTitle && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Usage</p>
                <p className="text-xs text-gray-700">{station.usageTypeTitle}</p>
              </div>
            )}
          </div>

          {/* Map link */}
          <a
            href={`https://www.google.com/maps?q=${addr.lat},${addr.lon}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-ev-600 hover:text-ev-700 hover:underline"
          >
            <MapPin size={13} /> Open in Google Maps
          </a>
        </div>
      )}
    </div>
  );
}
