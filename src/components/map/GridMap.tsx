"use client";

import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { GridFilter } from "@/app/page";

const setupIcons = () => {
  if (typeof window === "undefined") return;
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  });
};

interface Props {
    lang: "EN" | "FR";
    filter: GridFilter;
}

export default function GridMap({ lang, filter }: Props) {
  const [data, setData] = useState<{
    grid: any,
    plants: any,
    regionalGrid: any,
    regionalNodes: any,
    tieLines: any,
    consumers: any
  }>({ grid: null, plants: null, regionalGrid: null, regionalNodes: null, tieLines: null, consumers: null });

  useEffect(() => {
    setupIcons();
    const urls = {
      grid: "/data/senegal-grid-existing.json",
      plants: "/data/senegal-plants.json",
      regionalGrid: "/data/regional-interconnections.json",
      regionalNodes: "/data/regional-nodes.json",
      tieLines: "/data/infrastructure-tie-lines.json",
      consumers: "/data/industrial-consumers.json"
    };

    Promise.all(Object.entries(urls).map(([key, url]) => 
      fetch(url).then(r => r.json()).then(d => [key, d])
    )).then(results => {
      const newData: any = {};
      results.forEach(([k, v]) => newData[k] = v);
      setData(newData);
    });
  }, []);

  // --- REFINED SNAPPING & FILTERING ENGINE ---
  const processedData = useMemo(() => {
    if (!data.grid || !data.plants) return data;

    const allNodes = [
        ...(data.plants?.features || []), 
        ...(data.regionalNodes?.features || []),
        ...(data.consumers?.features || [])
    ];
    const nodeCoords = allNodes.map(n => ({
      coords: n.geometry.coordinates as [number, number]
    }));

    const processLine = (lineFeature: any) => {
      if (lineFeature.geometry.type !== "LineString") return lineFeature;
      
      const v = Number(lineFeature.properties.voltage_kV);
      
      // Snapping thresholds: 40km for HV/Regional backbones, 15km for others
      const snapThreshold = (v >= 90) ? 0.40 : 0.15;

      const coords = [...lineFeature.geometry.coordinates];
      [0, coords.length - 1].forEach(idx => {
        const pt = coords[idx];
        let closestNode = null;
        let minDist = snapThreshold;
        nodeCoords.forEach(node => {
          const d = Math.sqrt(Math.pow(pt[0] - node.coords[0], 2) + Math.pow(pt[1] - node.coords[1], 2));
          if (d < minDist) { minDist = d; closestNode = node.coords; }
        });
        if (closestNode) coords[idx] = closestNode;
      });

      return {
        ...lineFeature,
        geometry: { ...lineFeature.geometry, coordinates: coords }
      };
    };

    return {
      ...data,
      grid: { ...data.grid, features: data.grid.features.map(processLine) },
      regionalGrid: data.regionalGrid ? { ...data.regionalGrid, features: data.regionalGrid.features.map(processLine) } : null,
      tieLines: data.tieLines ? { ...data.tieLines, features: data.tieLines.features.map(processLine) } : null
    };
  }, [data]);

  const geoJsonFilter = (feature: any) => {
    if (filter === "ALL") return true;
    const v = Number(feature.properties.voltage_kV);
    if (filter === "225") return v === 225;
    if (filter === "90") return v === 90;
    if (filter === "MV") return v < 90;
    return true;
  };

  const gridStyle = (feature: any) => {
    const voltage = Number(feature.properties.voltage_kV);
    if (voltage === 225) return { color: "#2579fc", weight: 3.5, opacity: 0.9, className: "hv-225-line" };
    if (voltage === 90) return { color: "#FDA206", weight: 2.2, opacity: 0.85, className: "hv-90-line" };
    return { color: "#00F2FF", weight: 1.5, opacity: 0.7, className: "mv-line" };
  };

  const onEachGridFeature = (feature: any, layer: any) => {
    if (feature.properties) {
      const { voltage_kV, length_km, name } = feature.properties;
      const title = name || (lang === "EN" ? "Transmission Line" : "Ligne de Transmission");
      const unit = lang === "EN" ? "kV Circuit" : "kV Circuit";
      const lengthLabel = lang === "EN" ? "Length" : "Longueur";
      const lengthDisplay = length_km ? Number(length_km).toFixed(1) : "N/A";

      layer.bindPopup(`
        <div class="text-sunu-arsenic font-sans p-2">
          <div class="text-[10px] uppercase tracking-widest font-bold text-sunu-graphite mb-2 border-b border-white/5 pb-1">${title}</div>
          <div class="text-sm font-bold text-[#EDEFF7]">${voltage_kV} ${unit}</div>
          <div class="text-[11px] mt-2.5 text-sunu-graphite font-medium">
            ${lengthLabel}: <span class="text-sunu-cloud">${lengthDisplay} km</span>
          </div>
        </div>
      `, { className: 'custom-popup' });
    }
  };

  const pointToLayer = (feature: any, latlng: L.LatLng) => {
    const p = feature.properties;
    const isConsumer = p.demand_profile !== undefined;
    
    let color = "#2579fc";
    if (p.fuel === "Wind") color = "#66BB6A";
    if (p.fuel === "Solar") color = "#FDA206";
    if (p.fuel === "Coal") color = "#EF5350";
    if (p.fuel === "Hydro") color = "#42A5F5";
    if (p.fuel === "Substation") color = "#6E7180";
    if (isConsumer) color = "#E91E63";

    const isSubstation = p.fuel === "Substation";
    const size = isConsumer ? 14 : (isSubstation ? 8 : 12);
    const iconHtml = isConsumer 
        ? `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border: 2px solid rgba(255,255,255,1); clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%); box-shadow: 0 0 15px ${color}CC;"></div>`
        : `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border: 2px solid rgba(255,255,255,1); border-radius: 50%; box-shadow: 0 0 15px ${color}CC;"></div>`;

    return L.marker(latlng, { icon: L.divIcon({ className: "custom-div-icon", html: iconHtml, iconSize: [size, size], iconAnchor: [size/2, size/2] }) });
  };

  const onEachPlantFeature = (feature: any, layer: any) => {
    if (feature.properties) {
      const p = feature.properties;
      const isSub = p.fuel === "Substation";
      const isCon = p.demand_profile !== undefined;
      const label = lang === "EN" ? (isCon ? "Industrial Off-taker" : (isSub ? "Network Node" : "Power Plant")) : (isCon ? "Consommateur Industriel" : (isSub ? "Nœud du Réseau" : "Centrale Électrique"));
      const cap = Number(p.capacity_mw);
      const capDisplay = !isNaN(cap) && cap > 0 ? ` · ${cap} MW` : "";
      const storage = p.storage_mwh ? `<div class="mt-1"><span class="bg-sunu-blue/20 text-sunu-blue text-[9px] px-1.5 py-0.5 rounded font-bold">BESS: ${p.storage_mwh} MWh</span></div>` : "";
      let metadata = isCon ? `
        <div class="mt-3 space-y-1.5 border-t border-white/5 pt-2">
            <div class="flex justify-between text-[10px]"><span class="text-sunu-graphite uppercase font-bold">${lang === 'EN' ? 'Sector' : 'Secteur'}</span><span class="text-sunu-cloud">${p.sector}</span></div>
            <div class="flex justify-between text-[10px]"><span class="text-sunu-graphite uppercase font-bold">${lang === 'EN' ? 'Profile' : 'Profil'}</span><span class="text-sunu-cloud">${p.demand_profile}</span></div>
        </div>` : (!isSub ? `
        <div class="mt-3 space-y-1.5 border-t border-white/5 pt-2">
          ${p.operator ? `<div class="flex justify-between text-[10px]"><span class="text-sunu-graphite uppercase font-bold">${lang === 'EN' ? 'Operator' : 'Opérateur'}</span><span class="text-sunu-cloud">${p.operator}</span></div>` : ''}
          ${p.commissioned ? `<div class="flex justify-between text-[10px]"><span class="text-sunu-graphite uppercase font-bold">${lang === 'EN' ? 'Commissioned' : 'Mise en service'}</span><span class="text-sunu-cloud">${p.commissioned}</span></div>` : ''}
          ${p.annual_gen ? `<div class="flex justify-between text-[10px]"><span class="text-sunu-graphite uppercase font-bold">${lang === 'EN' ? 'Annual Gen' : 'Prod. Annuelle'}</span><span class="text-sunu-cloud font-mono">${p.annual_gen}</span></div>` : ''}
        </div>` : '');

      layer.bindPopup(`<div class="text-sunu-arsenic font-sans p-2"><div class="text-[10px] uppercase tracking-widest font-bold text-sunu-graphite mb-2 border-b border-white/5 pb-1">${label}</div><div class="text-sm font-bold text-[#EDEFF7]">${p.name}</div><div class="text-[11px] mt-2.5 text-sunu-graphite uppercase font-bold tracking-wider">${p.fuel || p.type}${capDisplay}</div>${storage}${metadata}${p.country ? `<div class="text-[9px] text-sunu-space uppercase mt-2 opacity-60">${p.country}</div>` : ""}</div>`, { className: 'custom-popup' });
    }
  };

  return (
    <div className="w-full h-full relative bg-[#121212]">
      <style jsx global>{`
        .leaflet-container { background: #121212 !important; }
        .hv-225-line { filter: drop-shadow(0 0 4px #2579fcCC); }
        .hv-90-line { filter: drop-shadow(0 0 3px #FDA206CC); }
        .mv-line { filter: drop-shadow(0 0 2px #00F2FF99); }
        .custom-popup .leaflet-popup-content-wrapper { background: rgba(255, 255, 255, 0.03) !important; backdrop-filter: blur(40px) saturate(180%) !important; -webkit-backdrop-filter: blur(40px) saturate(180%) !important; color: #EDEFF7 !important; border-radius: 12px !important; border: 1px solid rgba(255, 255, 255, 0.1) !important; box-shadow: none !important; }
        .custom-popup .leaflet-popup-tip { background: rgba(255, 255, 255, 0.03) !important; backdrop-filter: blur(40px) !important; border: 1px solid rgba(255, 255, 255, 0.1) !important; box-shadow: none !important; }
        .leaflet-popup-content { margin: 16px 20px !important; width: auto !important; min-width: 220px; }
      `}</style>
      <MapContainer center={[13.8, -13.5] as any} zoom={7} scrollWheelZoom={true} zoomControl={false} className="w-full h-full">
        <TileLayer attribution='&copy; CARTO' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        {processedData.grid && <GeoJSON key={`grid-${filter}`} data={processedData.grid} filter={geoJsonFilter} style={gridStyle} onEachFeature={onEachGridFeature} />}
        {processedData.regionalGrid && <GeoJSON key={`reg-${filter}`} data={processedData.regionalGrid} filter={geoJsonFilter} style={gridStyle} onEachFeature={onEachGridFeature} />}
        {processedData.tieLines && <GeoJSON key={`tie-${filter}`} data={processedData.tieLines} filter={geoJsonFilter} style={gridStyle} onEachFeature={onEachGridFeature} />}
        {processedData.plants && <GeoJSON data={processedData.plants} pointToLayer={pointToLayer} onEachFeature={onEachPlantFeature} />}
        {processedData.regionalNodes && <GeoJSON data={processedData.regionalNodes} pointToLayer={pointToLayer} onEachFeature={onEachPlantFeature} />}
        {processedData.consumers && <GeoJSON data={processedData.consumers} pointToLayer={pointToLayer} onEachFeature={onEachPlantFeature} />}
      </MapContainer>
    </div>
  );
}
