import { useEffect, useRef, useState } from 'react';
import { Map, Marker, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError, apiRequest } from '@/shared/api/http';

setWorkerUrl(workerUrl);

type MapProvider = 'OSM' | 'GOOGLE';

type MapSettings = {
  mapProvider: MapProvider;
  googleMapsApiKey: string;
};

type Pin = { latitude: number; longitude: number; areaOnly: boolean };

let settingsCache: { at: number; value: MapSettings } | null = null;

async function loadMapSettings(): Promise<MapSettings> {
  const now = Date.now();
  if (settingsCache && now - settingsCache.at < 30_000) return settingsCache.value;
  const data = await apiRequest<Record<string, unknown>>('/api/v1/platform/settings/public', {
    timeoutMs: 8_000,
  });
  const value: MapSettings = {
    mapProvider: String(data?.mapProvider ?? '').toUpperCase() === 'GOOGLE' ? 'GOOGLE' : 'OSM',
    googleMapsApiKey: typeof data?.googleMapsApiKey === 'string' ? data.googleMapsApiKey.trim() : '',
  };
  settingsCache = { at: now, value };
  return value;
}

async function geocodeAddress(token: string, address: string): Promise<Pin> {
  const data = await apiRequest<{ latitude: number; longitude: number; areaOnly?: boolean }>
    (`/api/v1/geo/geocode?q=${encodeURIComponent(address)}`, { token, timeoutMs: 20_000 });
  return { latitude: data.latitude, longitude: data.longitude, areaOnly: data.areaOnly === true };
}

function googleEmbedUrl(key: string, address: string): string {
  return `https://www.google.com/maps/embed/v1/search?key=${encodeURIComponent(key)}&q=${encodeURIComponent(address)}`;
}

export function DropMap({ address }: { address: string }) {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [settings, setSettings] = useState<MapSettings | null>(settingsCache?.value ?? null);
  const [pin, setPin] = useState<Pin | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void loadMapSettings()
      .then((value) => {
        if (!cancelled) setSettings(value);
      })
      .catch(() => {
        if (!cancelled) setSettings({ mapProvider: 'OSM', googleMapsApiKey: '' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!settings || settings.mapProvider !== 'OSM' || !token) return;
    let cancelled = false;
    setPin(null);
    setNote(null);
    void geocodeAddress(token, address)
      .then((value) => {
        if (!cancelled) setPin(value);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof ApiError ? err.message : 'Map lookup is busy. Use Open in Maps.';
        setNote(message);
      });
    return () => {
      cancelled = true;
    };
  }, [address, settings, token]);

  useEffect(() => {
    if (!pin || !frameRef.current) return;
    const map = new Map({
      container: frameRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [pin.longitude, pin.latitude],
      zoom: 16,
      attributionControl: { compact: true },
      cooperativeGestures: true,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    const marker = new Marker({ color: '#0f766e' }).setLngLat([pin.longitude, pin.latitude]).addTo(map);
    return () => {
      marker.remove();
      map.remove();
    };
  }, [pin]);

  if (!settings) {
    return <p style={noteStyle}>Loading map…</p>;
  }

  if (settings.mapProvider === 'GOOGLE') {
    if (!settings.googleMapsApiKey) {
      return <p style={noteStyle}>Google is on. Add the Maps key in Platform settings to show the pin here.</p>;
    }
    return (
      <iframe
        title="Drop on Google Maps"
        src={googleEmbedUrl(settings.googleMapsApiKey, address)}
        style={frameStyle}
        loading="lazy"
        referrerPolicy="origin"
      />
    );
  }

  if (note) return <p style={noteStyle}>{note}</p>;
  if (!pin) return <p style={noteStyle}>Placing the pin…</p>;

  return (
    <div>
      <div ref={frameRef} className="drop-map" style={frameStyle} />
      {pin.areaOnly ? <p style={noteStyle}>Area pin. The landmark above is the door.</p> : null}
    </div>
  );
}

const frameStyle = {
  width: '100%',
  height: 168,
  border: '1px solid var(--border)',
  borderRadius: 8,
  marginTop: '0.2rem',
} as const;

const noteStyle = {
  margin: '0.15rem 0 0',
  fontSize: '0.72rem',
  fontWeight: 650,
  color: 'var(--text-muted)',
  lineHeight: 1.3,
} as const;
