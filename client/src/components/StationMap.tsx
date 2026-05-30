import { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { ChargingStation } from '@/types';
import { getStationStatus, isFastCharger, getMaxPower, formatDistance } from '@/lib/utils';
import { StationCardSummary } from '@/components/StationCardSummary';
import { StationCardDetails } from '@/components/StationCardDetails';

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
              sticky={true}
              className="station-tooltip"
            >
              <StationCardSummary station={station} />
            </Tooltip>
            <Popup 
              maxWidth={300}
              className="station-popup"
              autoPan={false}
            >
              <StationCardDetails station={station} />
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
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}