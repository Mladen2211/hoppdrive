'use client';

import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui';
import { phoneHref, type ContactInfo } from '@/lib/site';
import type { MapContent } from '@/types/homepage-sections';

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
  // The visible default heading is translated (map.defaultTitle); an empty title falls through to it.
  title: '',
  address: '',
  lat: 47.3769,
  lng: 8.5417,
  zoom: 14,
};

export type { MapContent };

interface MapSectionProps {
  content?: MapContent;
  locationConfig?: Partial<LocationConfig> | null;
  /** Address, opening hours, e-mail and phone (rows without data are hidden). */
  contact?: ContactInfo;
}

function InfoRow({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3.5">
      <div
        className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-line bg-white text-ruby"
        aria-hidden="true"
      >
        {icon}
      </div>
      <div className="min-w-0">
        <b>{title}</b>
        <div className="mut break-words">{children}</div>
      </div>
    </li>
  );
}

/** Static stand-in for the map (no Mapbox token or the library could not be loaded). */
function MapFallback({ address }: { address: string | null }) {
  return (
    <div className="absolute inset-0 bg-[#E6E9E4]" aria-hidden="true">
      <svg viewBox="0 0 640 400" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <rect width="640" height="400" fill="#E6E9E4" />
        <path d="M-20 300 C120 260 220 340 360 300 S560 230 680 270 L680 330 C560 290 420 370 340 350 S120 310 -20 350Z" fill="#C9D9E3" />
        <rect x="40" y="40" width="130" height="90" rx="14" fill="#D5E2CF" />
        <rect x="470" y="60" width="120" height="80" rx="14" fill="#D5E2CF" />
        <g stroke="#fff" strokeWidth="12" fill="none" strokeLinecap="round">
          <path d="M-10 190 L650 170" />
          <path d="M200 -10 L260 410" />
          <path d="M420 -10 L380 410" />
        </g>
        <g stroke="#fff" strokeWidth="6" fill="none" strokeLinecap="round">
          <path d="M-10 90 L650 70" />
          <path d="M80 -10 L120 410" />
          <path d="M540 -10 L580 410" />
          <path d="M-10 260 L650 250" />
        </g>
      </svg>
      <div className="absolute left-[52%] top-[46%] flex -translate-x-1/2 -translate-y-full flex-col items-center">
        <span className="relative block h-11 w-11 -rotate-45 rounded-[50%_50%_50%_0] bg-ruby shadow-[0_6px_14px_rgba(0,0,0,.25)]">
          <span className="absolute inset-3.5 rounded-full bg-white" />
        </span>
      </div>
      <div className="absolute bottom-4 left-4 max-w-[calc(100%-2rem)] rounded-10 bg-white px-3 py-2 text-[13px] shadow-[0_2px_8px_rgba(0,0,0,.12)]">
        <b>HoppDrive</b>
        {address ? ` · ${address}` : ''}
      </div>
    </div>
  );
}

export function MapSection({ content, locationConfig, contact }: MapSectionProps) {
  const t = useTranslations('map');
  const mapHeading = content?.heading;
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [config] = useState<LocationConfig>({ ...DEFAULTS, ...locationConfig });
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(!MAPBOX_TOKEN);

  // Load Mapbox GL JS from CDN
  useEffect(() => {
    if (typeof window === 'undefined' || !MAPBOX_TOKEN) return;
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
    script.onerror = () => setFailed(true);
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

  // Don't render if hidden
  if (config && !config.visible) return null;

  const info: ContactInfo = contact ?? {
    address: config.address || null,
    routeAddress: config.address || null,
    hours: null,
    email: 'info@hoppdrive.ch',
    phone: null,
  };
  const routeHref = info.routeAddress
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(info.routeAddress)}`
    : null;

  return (
    <section id="location" className="sec">
      <div className="wrap">
        <div className="grid grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] gap-x-12 gap-y-[26px] max-lg:grid-cols-1 max-lg:gap-6 lg:grid-rows-[auto_1fr]">
          <div className="flex flex-col gap-3.5 lg:col-start-1 lg:row-start-1">
            <p className="kick">{t('kicker')}</p>
            <h2 className="h2">{mapHeading || config?.title || t('defaultTitle')}</h2>
          </div>

          <div className="flex flex-col gap-[26px] max-md:order-3 max-md:gap-5 lg:col-start-1 lg:row-start-2">
            <ul className="flex flex-col gap-[18px] md:max-lg:grid md:max-lg:grid-cols-2">
              {info.address && (
                <InfoRow icon={<MapPin size={22} />} title={t('pickup')}>
                  {info.address}
                </InfoRow>
              )}
              {info.hours && (
                <InfoRow icon={<Clock size={22} />} title={t('hours')}>
                  <span className="whitespace-pre-line">{info.hours}</span>
                </InfoRow>
              )}
              <InfoRow icon={<Mail size={22} />} title={t('email')}>
                <a href={`mailto:${info.email}`} className="hover:text-ruby">
                  {info.email}
                </a>
              </InfoRow>
              {info.phone && (
                <InfoRow icon={<Phone size={22} />} title={t('phone')}>
                  <a href={phoneHref(info.phone)} className="hover:text-ruby">
                    {info.phone}
                  </a>
                </InfoRow>
              )}
            </ul>
            {routeHref && (
              <Button
                href={routeHref}
                target="_blank"
                variant="outline"
                className="self-start max-md:w-full max-md:self-stretch"
              >
                {t('route')}
              </Button>
            )}
          </div>

          <div className="relative min-h-[380px] overflow-hidden rounded-20 border border-line bg-[#E6E9E4] max-lg:min-h-[320px] max-md:order-2 max-md:min-h-[260px] lg:col-start-2 lg:row-span-2 lg:row-start-1">
            {failed ? (
              <MapFallback address={info.address} />
            ) : (
              <div ref={mapContainer} className="absolute inset-0 bg-neutral-100" />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
