'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { api } from '@/lib/api';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

interface LocationConfig {
  visible: boolean;
  title: string;
  address: string;
  lat: number;
  lng: number;
  zoom: number;
}

const DEFAULTS: LocationConfig = {
  visible: true,
  title: 'Hier finden Sie uns',
  address: '',
  lat: 47.3769,
  lng: 8.5417,
  zoom: 14,
};

export interface MapContent {
  heading?: string;
}

interface MapSectionProps {
  content?: MapContent;
}

export function MapSection({ content }: MapSectionProps) {
  const mapHeading = content?.heading;
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [config, setConfig] = useState<LocationConfig | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Fetch location settings
  useEffect(() => {
    api
      .getSetting<Partial<LocationConfig>>('location')
      .then((data) => setConfig({ ...DEFAULTS, ...data }))
      .catch(() => setConfig(DEFAULTS));
  }, []);

  // Load Mapbox GL JS from CDN
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (document.getElementById('mapbox-gl-css')) {
      setLoaded(true);
      return;
    }

    const css = document.createElement('link');
    css.id = 'mapbox-gl-css';
    css.rel = 'stylesheet';
    css.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';
    document.head.appendChild(css);

    const script = document.createElement('script');
    script.id = 'mapbox-gl-js';
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js';
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Initialize map once config + library are ready
  useEffect(() => {
    if (!loaded || !config || !mapContainer.current || mapRef.current) return;

    const mapboxgl = (window as any).mapboxgl;
    if (!mapboxgl) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [config.lng, config.lat],
      zoom: config.zoom,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Custom marker
    const markerEl = document.createElement('div');
    markerEl.innerHTML = `
      <div style="
        width:40px; height:40px; background:#A60E0E; border-radius:50%;
        display:flex; align-items:center; justify-content:center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
          fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
    `;

    new mapboxgl.Marker({ element: markerEl })
      .setLngLat([config.lng, config.lat])
      .addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [loaded, config]);

  // Don't render if hidden or not loaded
  if (config && !config.visible) return null;

  return (
    <section id="location" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold text-charcoal mb-3">
            {mapHeading || config?.title || DEFAULTS.title}
          </h2>
          {config?.address && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(config.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 text-graphite text-lg hover:text-brand-600 transition-colors group"
            >
              <MapPin className="w-5 h-5 text-brand-600" />
              <span className="underline decoration-neutral-300 underline-offset-4 group-hover:decoration-brand-600 transition-colors">
                {config.address}
              </span>
            </a>
          )}
        </div>

        {/* Map */}
        <div className="rounded-2xl overflow-hidden shadow-lg border border-neutral-200">
          <div
            ref={mapContainer}
            className="w-full h-[400px] sm:h-[480px] bg-neutral-100"
          />
        </div>
      </div>
    </section>
  );
}
