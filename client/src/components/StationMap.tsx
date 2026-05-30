import { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { ChargingStation } from '@/types';
import { getStationStatus, isFastCharger, getMaxPower, formatDistance } from '@/lib/utils';

interface Props {
  stations: ChargingStation[];
  onSelectStation?: (station: ChargingStation) => void;
}

export function StationMap({ stations, onSelectStation }: Props) {
  const [selectedStation, setSelectedStation] = useState<ChargingStation | null>(null);

  if (stations.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        No stations to display
      </div>
    );
  }

  // Calculate center point from stations
  const centerLat = stations.reduce((sum, s) => sum + s.addressInfo.lat, 0) / stations.length;
  const centerLon = stations.reduce((sum, s) => sum + s.addressInfo.lon, 0) / stations.length;

  return (
    <MapContainer
      center={[centerLat, centerLon]}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={true}
    >
      {/* OpenStreetMap tiles */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {/* Station markers */}
      {stations.map((station) => {
        const status = getStationStatus(station);
        const isOperational = status === 'operational';
        const fast = isFastCharger(station);
        const maxPower = getMaxPower(station);
        const { addressInfo: addr } = station;
        
        // Determine icon color based on status and speed
        let iconColor = 'green';
        if (!isOperational) iconColor = 'red';
        else if (fast) iconColor = 'orange';
        
        const icon = new L.Icon({
          iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${iconColor}.png`,
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          tooltipAnchor: [16, -28],
          shadowSize: [41, 41]
        });

        return (
          <Marker
            key={station.id}
            position={[addr.lat, addr.lon]}
            icon={icon}>
            <Tooltip 
              direction="top"
              offset={[0, -10]}
              sticky="true"
              className="station-tooltip"
            >
              <div className="px-2 py-1 bg-white rounded-lg shadow-md text-sm">
                <div className="font-medium">{addr.title}</div>
                <div className="flex items-center gap-2 mt-1">
                  {fast && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Fast</span>}
                  <span className={`text-xs ${isOperational ? 'text-green-600' : 'text-red-600'}`}>
                    {isOperational ? 'Operational' : 'Not Operational'}
                  </span>
                </div>
                {addr.distance != null && (
                  <div className="text-xs text-gray-500 mt-1">
                    {formatDistance(addr.distance)} away
                  </div>
                )}
              </div>
            </Tooltip>
            <Popup 
              maxWidth="300"
              className="station-popup"
              onOpen={() => setSelectedStation(station)}
              onClose={() => setSelectedStation(null)}
            >
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center">
                    {status === 'operational' ? (
                      <div className="bg-green-100 text-green-600 flex items-center justify-center">
                        ●
                      </div>
                    ) : (
                      <div className="bg-red-100 text-red-600 flex items-center justify-center">
                        ○
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{addr.title}</h3>
                    <p className="text-xs text-gray-500 truncate">
                      {[addr.addressLine1, addr.town, addr.postcode].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>
                
                <div className="border-t border-gray-200 pt-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-gray-400">Operator</p>
                      <p className="font-medium">{station.operator?.title || 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Connectors</p>
                      <p className="font-medium">
                        {station.connections.reduce((sum, c) => sum + (c.quantity ?? 1), 0)}
                      </p>
                    </div>
                    {maxPower > 0 && (
                      <div>
                        <p className="text-gray-400">Max Power</p>
                        <p className="font-medium text-ev-700">{maxPower} kW</p>
                      </div>
                    )}
                    <div>
                      <p className="text-gray-400">Usage Type</p>
                      <p className="font-medium">{station.usageTypeTitle || 'Standard'}</p>
                    </div>
                  </div>
                </div>
                
                {station.dateLastVerified && (
                  <div className="border-t border-gray-200 pt-3">
                    <p className="text-xs text-gray-400">Last verified</p>
                    <p className="font-medium text-gray-600">
                      {new Date(station.dateLastVerified).toLocaleDateString()}
                    </p>
                  </div>
                )}
                
                {onSelectStation && (
                  <div className="pt-3 border-t border-gray-200">
                    <button
                      onClick={() => {
                        onSelectStation(station);
                      }}
                      className="w-full text-left text-ev-600 hover:text-ev-700 underline"
                    >
                      View Details
                    </button>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}