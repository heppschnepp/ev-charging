import { Zap, CheckCircle, Plug, MapPin } from 'lucide-react';
import type { ChargingStation } from '@/types';
import { isFastCharger } from '@/lib/utils';

interface Props {
  stations: ChargingStation[];
  location: { displayName: string };
  cachedAt?: string;
}

export function SummaryBar({ stations, location, cachedAt }: Props) {
  const operational = stations.filter((s) => s.isOperational === true).length;
  const fastCount = stations.filter(isFastCharger).length;
  const totalConnectors = stations.reduce((sum, s) => sum + s.connections.length, 0);

  const city = location.displayName.split(',')[0];

  const stats = [
    { icon: Plug, label: 'Stations', value: stations.length, color: 'text-gray-700' },
    { icon: CheckCircle, label: 'Operational', value: operational, color: 'text-green-600' },
    { icon: Zap, label: 'Fast charge', value: fastCount, color: 'text-blue-600' },
    { icon: Plug, label: 'Connectors', value: totalConnectors, color: 'text-purple-600' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-ev-600" />
          <span className="font-semibold text-gray-900">{city}</span>
        </div>
        {cachedAt && (
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            cached
          </span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {stats.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <Icon size={16} className={`${color} mx-auto mb-1`} />
            <p className={`text-xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
