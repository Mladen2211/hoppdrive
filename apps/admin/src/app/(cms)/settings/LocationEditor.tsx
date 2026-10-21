'use client';

/**
 * Standort / Karte: the location shown in the map section of the website (setting key "location").
 * Mapbox GL map with a draggable marker (click or drag to place it), address search through the
 * Mapbox geocoding API, and fine-tuning of latitude, longitude and zoom. Falls back to a notice
 * when NEXT_PUBLIC_MAPBOX_TOKEN is not set.
 */
import { MapPin, Search } from 'lucide-react';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { AppLocale, TranslatableLocale } from '@hoppdrive/shared';
import { Button, Field, Input, Spinner, Switch } from '@/components/ui';
import { LanguageNote, LanguageTabs } from '@/components/content/LanguageTabs';
import type { LocationSetting } from '@/lib/settings-defaults';
import { useTranslations } from 'next-intl';
import { LocationTranslationFields, locationStates } from './SettingTranslations';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

interface LocationEditorProps {
  location: LocationSetting;
  setLocation: Dispatch<SetStateAction<LocationSetting>>;
  saving: boolean;
  onSave: () => void;
}

export function LocationEditor({ location, setLocation, saving, onSave }: LocationEditorProps) {
  const t = useTranslations();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [mapLoaded, setMapLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [lang, setLang] = useState<AppLocale>('de');
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Load Mapbox GL JS from CDN
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).mapboxgl) { // eslint-disable-line @typescript-eslint/no-explicit-any
      setMapLoaded(true);
      return;
    }

    const css = document.createElement('link');
    css.id = 'mapbox-gl-admin-css';
    css.rel = 'stylesheet';
    css.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';
    document.head.appendChild(css);

    const script = document.createElement('script');
    script.id = 'mapbox-gl-admin-js';
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js';
    script.onload = () => setMapLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Initialize / update map
  useEffect(() => {
    if (!mapLoaded || !mapContainer.current || !MAPBOX_TOKEN) return;
    const mapboxgl = (window as any).mapboxgl; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!mapboxgl) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    if (!mapRef.current) {
      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [location.lng, location.lat],
        zoom: location.zoom,
        attributionControl: false,
      });

      map.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Click to place marker
      map.on('click', (e: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        const { lng, lat } = e.lngLat;
        setLocation((prev) => ({ ...prev, lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 }));
      });

      // Update zoom on zoom end
      map.on('zoomend', () => {
        setLocation((prev) => ({ ...prev, zoom: Math.round(map.getZoom()) }));
      });

      // Marker
      const marker = new mapboxgl.Marker({ color: '#A60E0E', draggable: true });
      marker.setLngLat([location.lng, location.lat]).addTo(map);

      marker.on('dragend', () => {
        const pos = marker.getLngLat();
        setLocation((prev) => ({
          ...prev,
          lat: Math.round(pos.lat * 1e6) / 1e6,
          lng: Math.round(pos.lng * 1e6) / 1e6,
        }));
      });

      markerRef.current = marker;
      mapRef.current = map;
    } else {
      // Update marker + center when location changes
      markerRef.current?.setLngLat([location.lng, location.lat]);
      mapRef.current.flyTo({ center: [location.lng, location.lat], zoom: location.zoom, duration: 600 });
    }
  }, [mapLoaded, location.lat, location.lng, location.zoom, setLocation]);

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Address autocomplete via Mapbox Geocoding API
  function handleSearchInput(query: string) {
    setSearchQuery(query);
    clearTimeout(searchTimeout.current);

    if (query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
            `access_token=${MAPBOX_TOKEN}&language=de&types=address,poi,place&limit=5&country=ch,de,at,li`
        );
        const data = await res.json();
        setSuggestions(data.features || []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  }

  function selectSuggestion(feature: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    const [lng, lat] = feature.center;
    setLocation((prev) => ({
      ...prev,
      address: feature.place_name,
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
      zoom: 16,
    }));
    setSearchQuery(feature.place_name);
    setSuggestions([]);
    setShowSuggestions(false);
  }

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <section className="panel" aria-labelledby="location-h">
      <div className="panel-h">
        <div className="min-w-0">
          <h2 className="h2" id="location-h">
            {t('settings.standortUndKarte')}
          </h2>
          <p className="sm mut mt-0.5">{t('settings.karteImBereichHier')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Switch
            checked={location.visible}
            onChange={(visible) => setLocation((l) => ({ ...l, visible }))}
            label={location.visible ? t('common.sichtbar') : t('common.ausgeblendet')}
          />
          <Button size="sm" loading={saving} onClick={onSave}>
            {t('common.speichern')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-2">
          <LanguageTabs value={lang} onChange={setLang} states={locationStates(location)} idPrefix="location-lang" />
          <LanguageNote locale={lang} />
        </div>
        {lang === 'de' ? (
          <Field label={t('common.titel')}>
            <Input
              value={location.title}
              onChange={(e) => setLocation((l) => ({ ...l, title: e.target.value }))}
              placeholder={t('settings.hierFindenSieUns')}
            />
          </Field>
        ) : (
          <LocationTranslationFields locale={lang as TranslatableLocale} location={location} onChange={setLocation} />
        )}

        {/* Address search */}
        <div className="relative" ref={suggestionsRef}>
          <Field label={t('settings.adresseSuchen')}>
            <div className="relative">
              <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-graphite" />
              <Input
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                className="pl-10 pr-10"
                placeholder={t('settings.adresseEingebenZB')}
                autoComplete="off"
              />
              {searching && <Spinner size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-graphite" />}
            </div>
          </Field>
          {showSuggestions && suggestions.length > 0 && (
            <ul
              aria-label={t('settings.adressvorschlaege')}
              className="absolute inset-x-0 z-20 m-0 mt-1 max-h-60 list-none overflow-y-auto rounded-xl border border-line bg-card p-1 shadow-modal"
            >
              {suggestions.map((feat: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                <li key={feat.id}>
                  <button
                    type="button"
                    onClick={() => selectSuggestion(feat)}
                    className="flex min-h-[44px] w-full items-start gap-2 rounded-lg px-3 py-2 text-left hover:bg-paper"
                  >
                    <MapPin size={16} className="mt-0.5 flex-none text-ruby-fg" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{feat.text}</span>
                      <span className="block truncate text-[13px] text-graphite">{feat.place_name}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Current address (editable) */}
        <Field label={t('settings.angezeigteAdresse')} hint={t('settings.wirdUnterDemKartentitel')}>
          <Input
            value={location.address}
            onChange={(e) => setLocation((l) => ({ ...l, address: e.target.value }))}
            placeholder={t('settings.musterstrasse18000Zuerich')}
          />
        </Field>

        {/* Map preview */}
        {MAPBOX_TOKEN ? (
          <div className="overflow-hidden rounded-xl border border-line">
            <div ref={mapContainer} className="h-[340px] w-full bg-paper max-md:h-[260px]" />
            <div className="flex flex-wrap items-center justify-between gap-2 bg-row px-4 py-2 text-[13px] text-graphite">
              <span>{t('settings.klickenSieAufDie')}</span>
              <span className="num">
                {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-line bg-row p-8 text-center">
            <MapPin size={32} className="mx-auto mb-2 text-cool" aria-hidden="true" />
            <p className="mut">
              {t.rich('settings.noMapboxToken', {
                code: (chunks) => <code className="rounded bg-line-soft px-1 text-[13px]">{chunks}</code>,
              })}
            </p>
          </div>
        )}

        {/* Fine-tune coords + zoom */}
        <div className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
          <Field label={t('settings.breitengrad')}>
            <Input
              type="number"
              step="any"
              value={location.lat}
              onChange={(e) => setLocation((l) => ({ ...l, lat: parseFloat(e.target.value) || 0 }))}
              className="num"
            />
          </Field>
          <Field label={t('settings.laengengrad')}>
            <Input
              type="number"
              step="any"
              value={location.lng}
              onChange={(e) => setLocation((l) => ({ ...l, lng: parseFloat(e.target.value) || 0 }))}
              className="num"
            />
          </Field>
          <Field label={t('settings.zoom118')}>
            <Input
              type="number"
              min={1}
              max={18}
              value={location.zoom}
              onChange={(e) => setLocation((l) => ({ ...l, zoom: parseInt(e.target.value) || 14 }))}
              className="num"
            />
          </Field>
        </div>
      </div>
    </section>
  );
}
