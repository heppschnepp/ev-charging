import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Tooltip, Popup, useMap } from 'react-leaflet';
import * as L from 'leaflet';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import {
  BatteryCharging, Car as CarIcon, Zap, Clock, Route, AlertTriangle, ChevronDown, Plug, Building2,
} from 'lucide-react';
import { CityAutocomplete } from '@/components/CityAutocomplete';
import { StationCardSummary } from '@/components/StationCardSummary';
import { useCars } from '@/hooks/useCars';
import { api } from '@/lib/api';
import { geocodeCity, fetchRoute, formatRouteDuration, formatRouteDistance } from '@/utils/routingUtils';
import {
  computeChargePlan,
  anchorPlanToStations,
  pointAtDistance,
  availableConnectors,
  rankStations,
  DEFAULT_CHARGE_10_80_MIN,
  type ChargeStop,
  type AnchoredPlanResult,
} from '@/utils/chargePlan';
import { getStationStatus, getTotalConnectors, formatDistance, cn } from '@/lib/utils';
import type { GeoLocation, Car, ChargingStation } from '@/types';

function FitBounds({ coords }: { coords: [number, number][] | null }) {
  const map = useMap();
  useEffect(() => {
    if (coords?.length) {
      map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] });
    }
  }, [coords, map]);
  return null;
}

const stopIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});

const getStationIcon = (status: string, fast: boolean) => {
  let color = 'green';
  if (!status || status !== 'operational') color = 'red';
  else if (fast) color = 'orange';

  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41],
  });
};

function formatChargeMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function CarSelector({ cars, value, onChange }: { cars: Car[]; value: string; onChange: (id: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Car <span className="text-gray-400 font-normal">(from Settings → Electric cars)</span>
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-ev-400"
      >
        {cars.map((c) => (
          <option key={c.id} value={c.id}>
            {c.brand} {c.model} · {c.range_km} km · 10→80% {c.charge_time_10_80_min ?? DEFAULT_CHARGE_10_80_MIN} min
          </option>
        ))}
      </select>
    </div>
  );
}

export function ChargePlanView() {
  const { cars, isLoading } = useCars();

  const [carId, setCarId] = useState('');
  const [startSocPct, setStartSocPct] = useState(100);
  const [minSocPct, setMinSocPct] = useState(10);
  const [chargeTargetPct, setChargeTargetPct] = useState<80 | 100>(80);
  const [stationRadiusKm, setStationRadiusKm] = useState(10);
  const [preferredOperator, setPreferredOperator] = useState('');

  const [sourceCity, setSourceCity] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [sourceLoc, setSourceLoc] = useState<GeoLocation | null>(null);
  const [destLoc, setDestLoc] = useState<GeoLocation | null>(null);

  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][] | null>(null);
  const [routeSummary, setRouteSummary] = useState<{ distanceMeters: number; durationSeconds: number } | null>(null);
  const [stops, setStops] = useState<ChargeStop[]>([]);
  const [arrivalSocPct, setArrivalSocPct] = useState<number | null>(null);
  const [usesEstimates, setUsesEstimates] = useState(false);

  const [stopNearby, setStopNearby] = useState<Record<number, ChargingStation[]>>({});
  const [manual, setManual] = useState<Record<number, number>>({});
  const [stationLoading, setStationLoading] = useState<Record<number, boolean>>({});
  const [expandedStops, setExpandedStops] = useState<Record<number, boolean>>({});

  const abortRef = useRef<AbortController | null>(null);
  const stationAbortRef = useRef<AbortController | null>(null);
  const manualRef = useRef<Record<number, number>>({});
  const hasPlanRef = useRef(false);

  const selectedCar = cars.find((c) => c.id === Number(carId));

  useEffect(() => {
    if (!carId && cars.length > 0) setCarId(String(cars[0].id));
  }, [cars, carId]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      stationAbortRef.current?.abort();
    };
  }, []);

  const setManualFor = (stopIndex: number, stationId: number) => {
    const next = { ...manualRef.current, [stopIndex]: stationId };
    manualRef.current = next;
    setManual(next);
  };

  const loadStationsNearStops = async (
    coords: [number, number][],
    stopList: ChargeStop[],
    radiusKm: number,
    signal: AbortSignal,
  ) => {
    const loading: Record<number, boolean> = {};
    stopList.forEach((_, i) => { loading[i] = true; });
    setStationLoading((prev) => ({ ...prev, ...loading }));

    const results = await Promise.allSettled(
      stopList.map((s, i) => {
        const [lat, lon] = pointAtDistance(coords, s.distanceKm * 1000);
        return api.stations
          .search(undefined, lat, lon, radiusKm, 10, undefined, undefined, signal)
          .then((d) => d.stations);
      }),
    );

    const nearby: Record<number, ChargingStation[]> = {};
    const doneLoading: Record<number, boolean> = {};
    let aborted = false;

    results.forEach((res, i) => {
      doneLoading[i] = false;
      if (res.status === 'fulfilled') {
        nearby[i] = res.value;
      } else {
        if ((res.reason as Error)?.name === 'AbortError') {
          aborted = true;
          return;
        }
        console.warn('Station fetch failed for a stop:', res.reason);
        nearby[i] = [];
      }
    });

    if (aborted) return;

    // Keep only manual picks whose station still exists in the new result set
    setManual((prev) => {
      const next: Record<number, number> = {};
      for (const [k, stationId] of Object.entries(prev)) {
        const idx = Number(k);
        if (nearby[idx]?.some((st) => st.id === stationId)) next[idx] = stationId;
      }
      manualRef.current = next;
      return next;
    });

    setStopNearby((prev) => ({ ...prev, ...nearby }));
    setStationLoading((prev) => ({ ...prev, ...doneLoading }));
  };

  const plan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedCar) return;
    abortRef.current?.abort();
    stationAbortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    setIsCalculating(true);
    setError(null);
    setRouteCoords(null);
    setRouteSummary(null);
    setStops([]);
    setArrivalSocPct(null);
    setStopNearby({});
    setManual({});
    manualRef.current = {};
    setStationLoading({});
    setExpandedStops({});
    hasPlanRef.current = false;

    try {
      const start = sourceLoc ?? (await geocodeCity(sourceCity, signal));
      const dest = destLoc ?? (await geocodeCity(destinationCity, signal));

      if (!start) throw new Error(`Could not find "${sourceCity}". Try a more specific name.`);
      if (!dest) throw new Error(`Could not find "${destinationCity}". Try a more specific name.`);

      const { coords, summary } = await fetchRoute(start, dest, signal);
      setRouteCoords(coords);
      setRouteSummary(summary);

      const result = computeChargePlan({
        totalDistanceKm: summary.distanceMeters / 1000,
        rangeKm: selectedCar.range_km,
        startSocPct,
        minSocPct,
        chargeTargetPct,
        chargeTime10To80Min: selectedCar.charge_time_10_80_min,
        chargeTime10To100Min: selectedCar.charge_time_10_100_min,
      });
      setStops(result.stops);
      setArrivalSocPct(result.arrivalSocPct);
      setUsesEstimates(result.usesEstimates);
      hasPlanRef.current = true;

      if (result.stops.length > 0) {
        await loadStationsNearStops(coords, result.stops, stationRadiusKm, signal);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(message);
    } finally {
      if (abortRef.current === controller) setIsCalculating(false);
    }
  };

  // Re-fetch nearby stations when search radius changes (after a plan exists)
  useEffect(() => {
    if (!hasPlanRef.current || !routeCoords || stops.length === 0) return;
    stationAbortRef.current?.abort();
    const controller = new AbortController();
    stationAbortRef.current = controller;
    loadStationsNearStops(routeCoords, stops, stationRadiusKm, controller.signal);
  }, [stationRadiusKm]); // eslint-disable-line react-hooks/exhaustive-deps

  // Station-anchored plan: snap stops to real chargers and recompute the legs
  const anchored = useMemo<AnchoredPlanResult | null>(() => {
    if (!routeCoords || stops.length === 0 || !selectedCar || !routeSummary) return null;
    return anchorPlanToStations({
      routeCoords,
      totalDistanceKm: routeSummary.distanceMeters / 1000,
      rangeKm: selectedCar.range_km,
      startSocPct,
      chargeTargetPct,
      baseStops: stops,
      baseArrivalSocPct: arrivalSocPct ?? 0,
      stopsNearby: stops.map((_, i) => stopNearby[i] ?? []),
      preferredOperator,
      forced: manual,
      chargeTime10To80Min: selectedCar.charge_time_10_80_min,
      chargeTime10To100Min: selectedCar.charge_time_10_100_min,
    });
  }, [routeCoords, stops, stopNearby, manual, preferredOperator, selectedCar, routeSummary, arrivalSocPct, startSocPct, chargeTargetPct]);

  // Stop markers: anchored to the chosen station when available, else route point
  const stopMarkers = useMemo(() => {
    if (!routeCoords) return [];
    const source = anchored
      ? anchored.stops.map((a, i) => ({ ...a, stopIndex: i }))
      : stops.map((s, i) => ({
          idealDistanceKm: s.distanceKm,
          routeDistanceKm: s.distanceKm,
          socOnArrivalPct: s.socOnArrivalPct,
          socOnDeparturePct: s.socOnDeparturePct,
          chargeMinutes: s.chargeMinutes,
          station: null,
          infeasible: false,
          stopIndex: i,
        }));
    return source.map((mk) => ({
      ...mk,
      pos: mk.station
        ? [mk.station.addressInfo.lat, mk.station.addressInfo.lon] as [number, number]
        : pointAtDistance(routeCoords, mk.routeDistanceKm * 1000),
    }));
  }, [anchored, stops, routeCoords]);

  if (isLoading) {
    return <div className="text-sm text-gray-400">Loading car inventory…</div>;
  }

  if (cars.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center space-y-3">
        <BatteryCharging size={40} className="mx-auto text-gray-300" />
        <h2 className="text-lg font-bold text-gray-900">EV Charging Trip Planner</h2>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          No cars in your inventory yet. Add an EV in <span className="font-medium">Settings → Electric cars</span> to
          plan charging stops for a trip.
        </p>
      </div>
    );
  }

  const totalChargeMinutes = (anchored ?? { stops, totalChargeMinutes: 0 })?.stops.reduce(
    (sum, s) => sum + s.chargeMinutes,
    0,
  );
  const totalTripMinutes = (routeSummary?.durationSeconds ?? 0) / 60 + totalChargeMinutes;
  const displayArrival = anchored ? anchored.arrivalSocPct : arrivalSocPct;
  const displayStops = anchored ? anchored.stops : stops.map((s) => ({
    idealDistanceKm: s.distanceKm,
    routeDistanceKm: s.distanceKm,
    socOnArrivalPct: s.socOnArrivalPct,
    socOnDeparturePct: s.socOnDeparturePct,
    chargeMinutes: s.chargeMinutes,
    station: null,
    infeasible: false,
  }));

  const anchoredStationFor = (stopIndex: number): ChargingStation | null | undefined =>
    anchored?.stops[stopIndex]?.station;

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <form onSubmit={plan} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <BatteryCharging className="text-ev-600" size={20} /> EV Charging Trip Planner
        </h2>

        <CarSelector cars={cars} value={carId || ''} onChange={setCarId} />

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between">
              <span>Start charge</span>
              <span className="text-ev-700 font-semibold">{startSocPct}%</span>
            </label>
            <input
              type="range" min={5} max={100} step={5} value={startSocPct}
              onChange={(e) => setStartSocPct(Number(e.target.value))}
              className="w-full accent-ev-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Charge when below
            </label>
            <select
              value={minSocPct}
              onChange={(e) => setMinSocPct(Number(e.target.value))}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none"
            >
              <option value={10}>10%</option>
              <option value={20}>20%</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Charge up to
            </label>
            <select
              value={chargeTargetPct}
              onChange={(e) => setChargeTargetPct(Number(e.target.value) as 80 | 100)}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none"
            >
              <option value={80}>80%</option>
              <option value={100}>100%</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between">
              <span>Stations within</span>
              <span className="text-ev-700 font-semibold">{stationRadiusKm} km</span>
            </label>
            <input
              type="range" min={1} max={50} step={1} value={stationRadiusKm}
              onChange={(e) => setStationRadiusKm(Number(e.target.value))}
              className="w-full accent-ev-600"
            />
          </div>
          <div className="col-span-2 sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Preferred operator <span className="text-gray-400 font-normal">(optional — ranked, never blocks the trip)</span>
            </label>
            <input
              type="text"
              value={preferredOperator}
              onChange={(e) => setPreferredOperator(e.target.value)}
              placeholder="e.g. EnBW"
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-ev-400"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source City</label>
            <CityAutocomplete
              value={sourceCity}
              onChange={setSourceCity}
              onSelect={(loc, label) => { setSourceCity(label); setSourceLoc(loc); }}
              placeholder="Enter source city"
              disabled={isCalculating}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Destination City</label>
            <CityAutocomplete
              value={destinationCity}
              onChange={setDestinationCity}
              onSelect={(loc, label) => { setDestinationCity(label); setDestLoc(loc); }}
              placeholder="Enter destination city"
              disabled={isCalculating}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isCalculating || !sourceCity || !destinationCity || !selectedCar}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-4 py-2 bg-ev-600 text-white rounded-md hover:bg-ev-700 transition-colors disabled:opacity-50',
            isCalculating && 'animate-pulse',
          )}
        >
          {isCalculating ? 'Planning…' : 'Plan charges'}
        </button>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">⚠️ {error}</div>
        )}
      </form>

      {/* Summary */}
      {routeSummary && (
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-400 flex items-center gap-1"><Route size={12} /> Distance</p>
              <p className="font-bold text-gray-900">{formatRouteDistance(routeSummary.distanceMeters)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 flex items-center gap-1"><Clock size={12} /> Driving</p>
              <p className="font-bold text-gray-900">{formatRouteDuration(routeSummary.durationSeconds)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 flex items-center gap-1"><Zap size={12} /> Total charging</p>
              <p className="font-bold text-ev-700">{formatChargeMinutes(totalChargeMinutes)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 flex items-center gap-1"><Clock size={12} /> Trip total</p>
              <p className="font-bold text-gray-900">{formatChargeMinutes(Math.round(totalTripMinutes))}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Arrival SoC</p>
              <p className={cn('font-bold', displayArrival !== null && displayArrival < minSocPct ? 'text-red-600' : 'text-green-600')}>
                {displayArrival === null ? '–' : `${Math.round(displayArrival)}%`}
              </p>
            </div>
          </div>
          {anchored?.infeasible && anchored.reasons.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
              <p className="text-xs font-semibold text-red-700 flex items-center gap-1">
                <AlertTriangle size={12} /> This plan may not take you to the destination:
              </p>
              {anchored.reasons.map((r, i) => (
                <p key={i} className="text-xs text-red-600">{r}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Map */}
      {routeCoords && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            Charging plan · {displayStops.length === 0 ? 'no stops needed' : `${displayStops.length} stop${displayStops.length > 1 ? 's' : ''}`}
          </h3>
          {usesEstimates && (
            <p className="flex items-center gap-1 text-xs text-amber-700 mb-3">
              <AlertTriangle size={12} /> Some charge times are estimates (no data stored for this car — edit in Settings).
            </p>
          )}
          <MapContainer
            center={[20, 0]} zoom={2}
            style={{ height: '400px', width: '100%' }}
            scrollWheelZoom
          >
            <FitBounds coords={routeCoords} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {routeCoords.length > 0 && (
              <Polyline positions={routeCoords} color="blue" weight={5} opacity={0.7}>
                <Popup>Route</Popup>
              </Polyline>
            )}
            {Object.entries(stopNearby).flatMap(([stopIndexKey, stations]) => {
              const stopIndex = Number(stopIndexKey);
              const anchoredSelected = anchoredStationFor(stopIndex);
              return stations
                .filter((st) => anchoredSelected?.id !== st.id)
                .map((st) => {
                  const status = getStationStatus(st);
                  const fast = getMaxPowerFor(st) >= 50;
                  return (
                    <Marker
                      key={st.id}
                      position={[st.addressInfo.lat, st.addressInfo.lon]}
                      icon={getStationIcon(status, fast)}
                    >
                      <Tooltip direction="top" offset={[0, -10]} sticky>
                        <StationCardSummary station={st} />
                      </Tooltip>
                      <Popup maxWidth={300} autoPan={false}>
                        <StationCardSummary station={st} />
                        <div className="pt-3 border-t border-gray-200">
                          <button
                            onClick={() => setManualFor(stopIndex, st.id)}
                            className="w-full text-left text-ev-600 hover:text-ev-700 underline"
                          >
                            Use this station for stop {stopIndex + 1}
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  );
                });
            })}
            {stopMarkers.map((mk) => (
              <Marker key={mk.stopIndex} position={mk.pos} icon={stopIcon}>
                <Tooltip direction="top" offset={[0, -10]} sticky>
                  <div className="text-xs">
                    <p className="font-semibold">Charge stop {mk.stopIndex + 1}</p>
                    <p>km {mk.routeDistanceKm.toFixed(1)} · {mk.chargeMinutes} min</p>
                  </div>
                </Tooltip>
                <Popup maxWidth={260} autoPan={false}>
                  <div className="text-sm space-y-0.5">
                    <p className="font-semibold text-gray-900">Charge stop {mk.stopIndex + 1} — km {mk.routeDistanceKm.toFixed(1)}</p>
                    {mk.station && (
                      <p className="text-ev-700 font-medium">{mk.station.operator?.title ?? 'Unknown operator'} · {mk.station.addressInfo.title}</p>
                    )}
                    <p className="text-gray-600">Arrive at {Math.round(mk.socOnArrivalPct)}% · depart at {Math.round(mk.socOnDeparturePct)}%</p>
                    <p className="text-ev-700 font-medium">Charging: {formatChargeMinutes(mk.chargeMinutes)}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}

      {/* Stop list */}
      {displayStops.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-2">
          <h3 className="text-lg font-bold text-gray-900">Where to charge</h3>
          {displayStops.map((s, i) => {
            const nearby = s.station
              ? rankStations(stopNearby[i] ?? [], preferredOperator)
              : rankStations(stopNearby[i] ?? [], preferredOperator);
            const loading = stationLoading[i] === true;
            const selected = s.infeasible
              ? undefined
              : s.station ?? (manual[i] != null ? (stopNearby[i] ?? []).find((st) => st.id === manual[i]) : undefined);
            const expanded = expandedStops[i] === true;
            const reason = anchored?.reasons.find((r) => r.startsWith(`Stop ${i + 1}:`));

            return (
              <div key={i} className={cn('border rounded-lg', s.infeasible ? 'border-red-200 bg-red-50/30' : 'border-gray-100')}>
                <div
                  className="flex items-center gap-3 px-3 py-3 cursor-pointer"
                  onClick={() => setExpandedStops((prev) => ({ ...prev, [i]: !prev[i] }))}
                >
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', s.infeasible ? 'bg-red-50' : 'bg-ev-50')}>
                    <CarIcon size={16} className={s.infeasible ? 'text-red-500' : 'text-ev-600'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">
                      Stop {i + 1} · after {s.routeDistanceKm.toFixed(1)} km
                    </p>
                    <p className="text-xs text-gray-500">
                      Arrive {Math.round(s.socOnArrivalPct)}% → depart {Math.round(s.socOnDeparturePct)}%
                    </p>
                    {selected && (
                      <p className="text-xs text-ev-700 truncate">
                        {selected.operator?.title ?? 'Unknown operator'} · {selected.addressInfo.title}
                      </p>
                    )}
                    {!selected && !loading && (
                      <p className="text-xs text-amber-600">No usable charging point in reach</p>
                    )}
                    {!selected && loading && (
                      <p className="text-xs text-gray-400">Looking for charging points…</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-ev-700">{formatChargeMinutes(s.chargeMinutes)}</p>
                    <p className="text-xs text-gray-400">charging</p>
                  </div>
                  <ChevronDown
                    size={15}
                    className={cn('text-gray-400 transition-transform shrink-0', expanded && 'rotate-180')}
                  />
                </div>

                {expanded && (
                  <div className="border-t border-gray-100 px-3 py-3 space-y-2">
                    <p className="text-xs text-gray-500">
                      Nearby charging points within {stationRadiusKm} km
                      {preferredOperator.trim() ? ` · preferring ${preferredOperator.trim()}` : ''}
                      {loading ? ' …' : ` (${nearby.length})`}
                    </p>
                    {loading && (
                      <p className="text-xs text-gray-400 animate-pulse">Fetching nearby stations…</p>
                    )}
                    {!loading && nearby.length === 0 && (
                      <p className="text-xs text-gray-400">No stations within {stationRadiusKm} km of this stop.</p>
                    )}
                    {s.infeasible && reason && (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <AlertTriangle size={11} /> {reason}
                      </p>
                    )}
                    {!loading &&
                      nearby.map((st) => {
                        const total = getTotalConnectors(st);
                        const avail = availableConnectors(st.connections);
                        const hasAvailability = st.connections.some((c) => c.statusTitle);
                        const isSelected = selected?.id === st.id;
                        const isPreferred = (preferredOperator.trim() && st.operator?.title?.toLowerCase().includes(preferredOperator.trim().toLowerCase())) || false;
                        return (
                          <div
                            key={st.id}
                            className={cn(
                              'flex items-start gap-2 rounded-lg border px-3 py-2',
                              isSelected ? 'border-ev-300 bg-ev-50' : 'border-gray-200 bg-white hover:border-gray-300',
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold text-gray-900 truncate">{st.addressInfo.title}</p>
                                {isPreferred && (
                                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-ev-100 text-ev-700">
                                    preferred
                                  </span>
                                )}
                                <span className={cn('px-1.5 py-0.5 rounded-full text-[10px] font-semibold',
                                  getStationStatus(st) === 'operational' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                                  {getStationStatus(st) === 'operational' ? 'Operational' : 'Not operational'}
                                </span>
                              </div>
                              {st.operator && (
                                <p className="text-xs text-gray-600 flex items-center gap-1 mt-0.5">
                                  <Building2 size={11} /> {st.operator.title}
                                </p>
                              )}
                              <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-gray-600">
                                <span className="inline-flex items-center gap-1">
                                  <Zap size={11} className="text-ev-700" /> {getMaxPowerFor(st)} kW max
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <Plug size={11} /> {total} connector{total !== 1 ? 's' : ''}
                                </span>
                                {hasAvailability && (
                                  <span className={cn('inline-flex items-center gap-1 font-medium',
                                    avail > 0 ? 'text-green-600' : 'text-red-500')}>
                                    {avail} free
                                  </span>
                                )}
                              </div>
                              {st.addressInfo.distance != null && (
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                  {formatDistance(st.addressInfo.distance)} from route point
                                </p>
                              )}
                            </div>
                            {isSelected ? (
                              <span className="text-xs font-semibold text-ev-700 shrink-0">Selected</span>
                            ) : (
                              <button
                                onClick={() => setManualFor(i, st.id)}
                                className="text-xs font-medium text-ev-700 hover:text-ev-800 hover:underline shrink-0"
                              >
                                Use this station
                              </button>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })}
          {displayArrival !== null && (
            <p className="text-sm text-gray-600 pt-1">
              Arrive at destination with <span className="font-semibold">{Math.round(displayArrival)}%</span> battery.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function getMaxPowerFor(station: ChargingStation): number {
  return Math.max(0, ...station.connections.map((c) => c.powerKW ?? 0));
}