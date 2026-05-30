import type { ChargingStation } from '@/types';
import {
  MapPin, Zap, Phone, Globe, ChevronDown, Heart, Clock, Plug,
  CheckCircle, AlertCircle, HelpCircle, Banknote,
} from 'lucide-react';
import {
  cn, getStationStatus, getMaxPower, isFastCharger,
  formatDistance, formatPower, formatDate, getConnectorBadgeColor,
} from '@/lib/utils';

function getTotalConnectors(station: ChargingStation): number {
  return station.connections.reduce((sum, c) => sum + (c.quantity ?? 1), 0);
}

const STATUS_CONFIG = {
  operational: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50', label: 'Operational', badge: 'bg-green-100 text-green-800' },
  planned:     { icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-50',  label: 'Not operational', badge: 'bg-amber-100 text-amber-800' },
  unknown:     { icon: HelpCircle,  color: 'text-gray-400',  bg: 'bg-gray-50',   label: 'Unknown',   badge: 'bg-gray-100 text-gray-600' },
};

interface StationCardDetailsProps {
  station: ChargingStation;
}

export function StationCardDetails({ station }: StationCardDetailsProps) {
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
    <div className="border-t border-gray-100 px-4 py-4 space-y-4">
      {/* Connectors */}
      {connections.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Connectors</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {connections.map((c, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', getConnectorBadgeColor(c.connectionType?.title ?? ''))}>
                    {c.connectionType?.title ?? 'Unknown'}
                  </span>
                  {c.levelTitle && (
                    <p className="text-xs text-gray-600 mt-1">{c.levelTitle}</p>
                  )}
                </div>
                <div className="text-right shrink-0 ml-2">
                  {c.powerKW && (
                    <p className="text-sm font-bold text-ev-700">{c.powerKW} kW</p>
                  )}
                  {c.quantity && (
                    <p className="text-xs text-gray-600">{c.quantity}×</p>
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
            <p className="text-xs text-gray-600 mb-1">Operator</p>
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
            <p className="text-xs text-gray-600 mb-1">Phone</p>
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
            <p className="text-xs text-gray-600 mb-1">Last verified</p>
            <p className="inline-flex items-center gap-1 text-xs text-gray-600">
              <Clock size={11} /> {formatDate(station.dateLastVerified)}
            </p>
          </div>
        )}
        {station.usageTypeTitle && (
          <div>
            <p className="text-xs text-gray-600 mb-1">Usage</p>
            <p className="text-xs text-gray-700">{station.usageTypeTitle}</p>
          </div>
        )}
        {station.usageCost && (
          <div>
            <p className="text-xs text-gray-600 mb-1">Cost</p>
            <p className="text-xs text-gray-700">{station.usageCost}</p>
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
  );
}