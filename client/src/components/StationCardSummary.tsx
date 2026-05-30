import type { ChargingStation } from '@/types';
import { MapPin, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStationStatus, isFastCharger, formatDistance } from '@/lib/utils';

interface StationCardSummaryProps {
  station: ChargingStation;
}

export function StationCardSummary({ station }: StationCardSummaryProps) {
  const status = getStationStatus(station);
  const isOperational = status === 'operational';
  const fast = isFastCharger(station);
  const { addressInfo: addr } = station;
  
  // Determine status color
  let statusColor = 'text-green-600';
  if (status === 'planned') statusColor = 'text-red-600';
  else if (status === 'unknown') statusColor = 'text-gray-600';
  
  const totalConnectors = station.connections.reduce((sum, c) => sum + (c.quantity ?? 1), 0);

  return (
    <div className="px-2 py-1 bg-white rounded-lg shadow-md text-sm space-y-1.5">
      <div className="font-medium">{addr.title}</div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          {fast && (
            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
              <Zap size={10} /> Fast
            </span>
          )}
          <span className={cn('text-xs', statusColor)}>
            {status === 'operational' ? 'Operational' : status === 'planned' ? 'Not Operational' : 'Unknown'}
          </span>
        </div>
        {addr.distance != null && (
          <span className="text-xs text-gray-500">
            <MapPin size={12} /> {formatDistance(addr.distance)} away
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <MapPin size={12} /> {totalConnectors} connector{totalConnectors !== 1 ? 's' : ''}
      </div>
    </div>
  );
}