"use client";

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPin, Loader2, AlertTriangle } from 'lucide-react';
import cityCoordinates from '../../data/city-coordinates.json';

// Mapbox API Key provided by user
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

/**
 * Deep link into Google Maps for an event's venue.
 *
 * Uses Google's documented universal `search` URL with a free-text query rather
 * than raw coordinates: the cached coordinates are city-level (from
 * scripts/geocode-event-cities.mjs), while Google resolves "<venue>, <city>,
 * <country>" to the venue itself and drops its red pin there. No API key is
 * needed, so this works for every event in the catalog.
 */
export function googleMapsUrl(locationName: string) {
  // Unknown venues reach here either as the seed's raw "?" or as the catalog's
  // rendered "Venue to be announced". Both are dropped so the query falls back
  // to city + country rather than searching for the placeholder text.
  const PLACEHOLDERS = ["?", "venue to be announced", "city to be announced"];
  const query = locationName
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && !PLACEHOLDERS.includes(part.toLowerCase()))
    .join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

interface EventMapProps {
  locationName: string; // e.g., "Messe Berlin, Berlin, Germany"
  /** Raw seed city string, e.g. "London (UK - United Kingdom)" — used to hit the
   *  pre-geocoded coordinate cache instead of calling Mapbox at runtime. */
  cityKey?: string;
  className?: string;
}

export function EventMap({ locationName, cityKey, className }: EventMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    const initializeMap = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Resolve coordinates. `cityKey` hits the pre-geocoded cache built by
        //    scripts/geocode-event-cities.mjs (1,434 of 1,435 cities), so the
        //    common path costs no network call. Anything missing falls back to a
        //    live geocode of the full location string.
        const cached = cityKey
          ? (cityCoordinates as Record<string, number[] | null>)[cityKey]
          : null;
        let coords: [number, number] | null =
          cached && cached.length >= 2 ? [cached[0], cached[1]] : null;

        if (!coords) {
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(locationName)}.json?access_token=${MAPBOX_TOKEN}&limit=1`
          );
          const data = await response.json();

          if (!data.features || data.features.length === 0) {
            throw new Error("Location not found");
          }
          coords = data.features[0].center as [number, number];
        }

        const [lng, lat] = coords;

        // 2. Initialize Mapbox
        mapboxgl.accessToken = MAPBOX_TOKEN;
        
        map.current = new mapboxgl.Map({
          container: mapContainer.current!,
          // Light street cartography in both themes so the panel reads as a
          // Google-Maps-style outline (roads, labels, parks) rather than the
          // former dark globe.
          style: 'mapbox://styles/mapbox/streets-v12',
          center: [lng, lat],
          zoom: 13,
          attributionControl: false,
        });

        // 3. Google-style red teardrop pin, anchored at its tip.
        const el = document.createElement('div');
        el.className = 'custom-marker';
        el.innerHTML = `
          <svg width="30" height="42" viewBox="0 0 24 34" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <ellipse cx="12" cy="31.5" rx="5" ry="2" fill="rgba(0,0,0,0.25)" />
            <path d="M12 0.75c-5.66 0-10.25 4.59-10.25 10.25 0 7.3 9.1 18.3 9.49 18.77a1 1 0 0 0 1.52 0c.39-.47 9.49-11.47 9.49-18.77C22.25 5.34 17.66.75 12 .75Z" fill="#EA4335" stroke="#B31412" stroke-width="0.75"/>
            <circle cx="12" cy="11" r="3.75" fill="#8B1A11"/>
          </svg>
        `;

        new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([lng, lat])
          .addTo(map.current);

        map.current.on('load', () => {
          setLoading(false);
        });

      } catch (err) {
        console.error("Mapbox error:", err);
        setError("Could not load map for this location");
        setLoading(false);
      }
    };

    initializeMap();

    return () => map.current?.remove();
  }, [locationName, cityKey]);

  return (
    <div className={`relative rounded-xl overflow-hidden border border-slate-200 dark:border-[#22304A] bg-slate-100 dark:bg-[#0B1220] ${className}`}>
      <div ref={mapContainer} className="w-full h-full" />
      
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100/50 dark:bg-[#0B1220]/50 backdrop-blur-sm z-10">
          <Loader2 className="size-6 text-indigo-500 animate-spin mb-2" />
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Generating Map Intelligence...</span>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 dark:bg-[#0B1220] z-10 p-6 text-center">
          <AlertTriangle className="size-8 text-amber-500 mb-3 opacity-50" />
          <p className="text-[12px] font-bold text-slate-900 dark:text-white mb-1">{error}</p>
          <p className="text-[11px] text-slate-500 leading-relaxed max-w-[200px]">
            We couldn't pinpoint the exact location. Please verify the address.
          </p>
        </div>
      )}

      {/* Map Overlay Stats */}
      {!loading && !error && (
        <div className="absolute bottom-3 left-3 flex flex-col gap-1 z-10 pointer-events-none">
          {/* The map is light in both themes, so this pill stays light too. */}
          <div className="px-3 py-1.5 rounded-lg bg-white/90 border border-slate-200 backdrop-blur-md shadow-lg flex items-center gap-2">
            <div className="size-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">Live Geo-Sync Active</span>
          </div>
        </div>
      )}

      <style jsx global>{`
        .custom-marker {
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
