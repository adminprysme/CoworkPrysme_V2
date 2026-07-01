import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";

import type { Building } from "../types.js";
import styles from "./BuildingsMap.module.css";

/** Rhône (69) — centre carte par défaut */
const RHONE_CENTER: L.LatLngExpression = [45.75, 4.85];
const DEFAULT_ZOOM = 10;

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

function createBuildingIcon(inactive: boolean): L.DivIcon {
  return L.divIcon({
    className: "building-marker",
    html: `<span class="building-marker-dot ${inactive ? "inactive" : ""}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function createClusterIcon(count: number): L.DivIcon {
  const size = count < 10 ? 40 : count < 100 ? 48 : 56;

  return L.divIcon({
    className: "building-cluster-marker",
    html: `<span class="building-cluster-dot"><span class="building-cluster-count">${count}</span></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

interface BuildingsMapProps {
  buildings: Building[];
  selectedId?: string;
  onSelect: (buildingId: string) => void;
}

export function BuildingsMap({ buildings, selectedId, onSelect }: BuildingsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const markerByIdRef = useRef<Map<string, L.Marker>>(new Map());
  const onSelectRef = useRef(onSelect);

  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(containerRef.current, {
      center: RHONE_CENTER,
      zoom: DEFAULT_ZOOM,
      scrollWheelZoom: true,
    });

    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map);

    const clusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: false,
      maxClusterRadius: 72,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster) => createClusterIcon(cluster.getChildCount()),
    });

    clusterGroup.addTo(map);
    clusterGroupRef.current = clusterGroup;
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      clusterGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const clusterGroup = clusterGroupRef.current;
    if (!clusterGroup) {
      return;
    }

    clusterGroup.clearLayers();
    markerByIdRef.current.clear();

    for (const building of buildings) {
      const marker = L.marker([building.lat, building.lng], {
        icon: createBuildingIcon(building.status === "inactive"),
      });

      marker.bindPopup(`<strong>${building.name}</strong>`);
      marker.on("click", () => onSelectRef.current(building.id));
      clusterGroup.addLayer(marker);
      markerByIdRef.current.set(building.id, marker);
    }

    if (selectedId) {
      markerByIdRef.current.get(selectedId)?.openPopup();
    }
  }, [buildings, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    const clusterGroup = clusterGroupRef.current;
    if (!map || !clusterGroup) {
      return;
    }

    if (buildings.length === 0) {
      map.setView(RHONE_CENTER, DEFAULT_ZOOM);
      return;
    }

    const bounds = clusterGroup.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.2));
    }
  }, [buildings]);

  return (
    <div
      ref={containerRef}
      className={styles.mapContainer}
      role="application"
      aria-label="Carte des bâtiments dans le Rhône"
    />
  );
}
