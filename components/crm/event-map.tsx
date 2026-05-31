"use client";

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPin, Loader2, AlertTriangle } from 'lucide-react';

// Mapbox API Key provided by user
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

interface EventMapProps {
  locationName: string; // e.g., "Messe Berlin, Berlin, Germany"
  className?: string;
}

export function EventMap({ locationName, className }: EventMapProps) {
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

        // 1. Geocode the location
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(locationName)}.json?access_token=${MAPBOX_TOKEN}&limit=1`
        );
        const data = await response.json();

        if (!data.features || data.features.length === 0) {
          throw new Error("Location not found");
        }

        const [lng, lat] = data.features[0].center;

        // 2. Initialize Mapbox
        mapboxgl.accessToken = MAPBOX_TOKEN;
        
        map.current = new mapboxgl.Map({
          container: mapContainer.current!,
          style: 'mapbox://styles/mapbox/dark-v11', // Futuristic dark theme
          center: [lng, lat],
          zoom: 13,
          attributionControl: false,
        });

        // 3. Add Pulse Effect Marker
        const el = document.createElement('div');
        el.className = 'custom-marker';
        el.innerHTML = `
          <div class="relative flex items-center justify-center">
            <div class="absolute size-10 bg-indigo-500/30 rounded-full animate-ping"></div>
            <div class="relative size-4 bg-indigo-500 rounded-full border-2 border-white shadow-lg"></div>
          </div>
        `;

        new mapboxgl.Marker(el)
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
  }, [locationName]);

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
          <div className="px-3 py-1.5 rounded-lg bg-white/90 dark:bg-[#0B1220]/90 border border-white/20 backdrop-blur-md shadow-lg flex items-center gap-2">
            <div className="size-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-tighter">Live Geo-Sync Active</span>
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
