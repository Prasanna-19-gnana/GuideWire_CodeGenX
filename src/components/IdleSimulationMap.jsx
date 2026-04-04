import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const STATUS_COLOR = {
  normal: '#3b82f6',
  approved: '#22c55e',
  flagged: '#facc15',
  rejected: '#ef4444',
};

function RecenterMap({ center }) {
  const map = useMap();

  useEffect(() => {
    if (!Array.isArray(center) || center.length !== 2) return;
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);

  return null;
}

export default function IdleSimulationMap({
  initialCenter = { lat: 13.0827, lng: 80.2707 },
  mode = 'SIMULATION',
  livePosition = null,
  markerStatus = 'normal',
  onLocationUpdate,
  movementIntervalMs = 1500,
  className = '',
}) {
  const [simPosition, setSimPosition] = useState({
    lat: Number(initialCenter?.lat) || 13.0827,
    lng: Number(initialCenter?.lng) || 80.2707,
    accuracy: 12,
    timestamp: Date.now(),
  });

  const phaseRef = useRef(0);

  useEffect(() => {
    if (String(mode).toUpperCase() !== 'SIMULATION') return;

    const timerId = setInterval(() => {
      phaseRef.current += 1;
      const driftLat = Math.sin(phaseRef.current / 6) * 0.00028;
      const driftLng = Math.cos(phaseRef.current / 7) * 0.00032;
      const next = {
        lat: (Number(initialCenter?.lat) || 13.0827) + driftLat,
        lng: (Number(initialCenter?.lng) || 80.2707) + driftLng,
        accuracy: 8 + ((phaseRef.current % 5) * 2),
        timestamp: Date.now(),
      };

      setSimPosition(next);
      if (typeof onLocationUpdate === 'function') {
        onLocationUpdate(next);
      }
    }, Math.max(1000, Number(movementIntervalMs || 1500)));

    return () => clearInterval(timerId);
  }, [initialCenter?.lat, initialCenter?.lng, mode, movementIntervalMs, onLocationUpdate]);

  const displayPosition = useMemo(() => {
    if (String(mode).toUpperCase() === 'LIVE' && Number.isFinite(livePosition?.lat) && Number.isFinite(livePosition?.lng)) {
      return {
        lat: Number(livePosition.lat),
        lng: Number(livePosition.lng),
        accuracy: Number(livePosition?.accuracy || 0),
        timestamp: Number(livePosition?.timestamp || livePosition?.ts || Date.now()),
      };
    }

    return simPosition;
  }, [livePosition, mode, simPosition]);

  const markerColor = STATUS_COLOR[String(markerStatus || 'normal').toLowerCase()] || STATUS_COLOR.normal;
  const center = [displayPosition.lat, displayPosition.lng];

  return (
    <div className={`rounded-2xl overflow-hidden border border-white/15 h-full min-h-[420px] w-full ${className}`.trim()}>
      <MapContainer center={center} zoom={16} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <RecenterMap center={center} />

        <CircleMarker
          center={center}
          radius={10}
          pathOptions={{
            color: markerColor,
            fillColor: markerColor,
            fillOpacity: 0.75,
            weight: 2,
          }}
        >
          <Popup>
            <div style={{ minWidth: 160 }}>
              <div><strong>Status:</strong> {String(markerStatus || 'normal')}</div>
              <div><strong>Lat:</strong> {displayPosition.lat.toFixed(6)}</div>
              <div><strong>Lng:</strong> {displayPosition.lng.toFixed(6)}</div>
              <div><strong>Accuracy:</strong> {Math.round(Number(displayPosition.accuracy || 0))} m</div>
            </div>
          </Popup>
        </CircleMarker>
      </MapContainer>
    </div>
  );
}
