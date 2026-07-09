"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";

import styles from "./ContactBuildingMap.module.css";

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const DEFAULT_ZOOM = 16;

interface ContactBuildingMapProps {
  lat: number;
  lng: number;
  name: string;
}

export function ContactBuildingMap({ lat, lng, name }: ContactBuildingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      if (cancelled || !containerRef.current) {
        return;
      }

      const map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom: DEFAULT_ZOOM,
        scrollWheelZoom: true,
      });

      L.tileLayer(TILE_URL, {
        attribution: TILE_ATTRIBUTION,
        maxZoom: 19,
      }).addTo(map);

      const icon = L.divIcon({
        className: "contact-map-marker",
        html: '<span class="contact-map-marker-dot"></span>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      L.marker([lat, lng], { icon }).addTo(map).bindPopup(`<strong>${name}</strong>`).openPopup();

      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [lat, lng, name]);

  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container) {
      return;
    }

    const invalidate = () => {
      map.invalidateSize();
    };

    invalidate();
    const observer = new ResizeObserver(invalidate);
    observer.observe(container);
    window.addEventListener("orientationchange", invalidate);

    return () => {
      observer.disconnect();
      window.removeEventListener("orientationchange", invalidate);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    map.setView([lat, lng], DEFAULT_ZOOM);
  }, [lat, lng]);

  return (
    <div
      ref={containerRef}
      className={styles.mapContainer}
      role="application"
      aria-label={`Carte interactive — ${name}`}
    />
  );
}
