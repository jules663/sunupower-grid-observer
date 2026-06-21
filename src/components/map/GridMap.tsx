"use client";

import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { GridFilter } from "@/app/page";

// Popups live in a pane that is a direct child of .leaflet-container, NOT inside
// .leaflet-map-pane. Reason: .leaflet-map-pane has a CSS transform which creates
// its own stacking context at z-index 400, trapping popup z-index below the glass
// overlay panels (z-index 2000). By parenting this pane to the container at
// z-index 3000, popups escape that stacking context and render above panels.
//
// Positioning correctness: Leaflet pans by applying transform:translate(dx,dy) to
// .leaflet-map-pane. Our pane does not receive that transform automatically.
// We mirror the map-pane transform here on every 'move' and 'viewreset' so that
// latLngToLayerPoint coordinates placed inside our pane land at the same screen
// position as they would inside the map-pane.
function PopupPaneSetup() {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane('popupAboveAll')) {
      const pane = map.createPane('popupAboveAll', map.getContainer());
      pane.style.zIndex = '3000';
    }

    const pane = map.getPane('popupAboveAll')!;
    const mapPane = map.getPanes().mapPane;

    const syncTransform = () => {
      L.DomUtil.setPosition(pane, L.DomUtil.getPosition(mapPane));
    };

    map.on('move viewreset', syncTransform);
    syncTransform();

    return () => {
      map.off('move viewreset', syncTransform);
    };
  }, [map]);
  return null;
}

// Renders ESI site markers only when map zoom >= 8 (region-level detail).
// Below that threshold returns null — sites are too dense to read at country zoom.
function EsiLayerManager({ data }: { data: any }) {
  const [zoom, setZoom] = useState<number>(7);

  useMapEvents({
    zoomend: (e) => setZoom((e.target as L.Map).getZoom()),
  });

  if (!data || zoom < 8) return null;

  const esiPointToLayer = (_feat: any, latlng: L.LatLng) => {
    const html = `<div style="width:16px;height:16px;filter:drop-shadow(0 0 6px #F59E0BCC) drop-shadow(0 0 1.5px rgba(255,255,255,0.55));"><div style="background-color:#F59E0B;width:100%;height:100%;clip-path:polygon(50% 0%,100% 50%,50% 100%,0% 50%);"></div></div>`;
    return L.marker(latlng, {
      icon: L.divIcon({ className: 'custom-div-icon', html, iconSize: [16, 16], iconAnchor: [8, 8], popupAnchor: [0, -8] }),
    });
  };

  const esiOnEachFeature = (feature: any, layer: any) => {
    const p = feature.properties;
    const capacityMwh = (p.capacity_kwh / 1000).toFixed(1);
    layer.bindPopup(`
      <div class="font-sans p-2">
        <div class="text-[10px] uppercase tracking-widest font-bold text-sunu-graphite mb-2 border-b border-white/5 pb-1">ESI ASSET</div>
        <div class="text-sm font-bold text-[#EDEFF7]">${p.name}</div>
        <div class="text-[11px] mt-1 font-bold" style="color:#F59E0B;">${p.state}</div>
        <div class="mt-3 space-y-2 border-t border-white/5 pt-2">
          <div class="flex justify-between text-[10px]">
            <span class="text-sunu-graphite uppercase font-bold">Capacity</span>
            <span class="text-sunu-cloud font-mono">${capacityMwh} MWh</span>
          </div>
          <div class="text-[10px]">
            <span class="text-sunu-graphite uppercase font-bold">Design Intent</span>
            <div class="text-sunu-cloud mt-1 leading-relaxed">${p.intent}</div>
          </div>
        </div>
      </div>
    `, { className: 'custom-popup', pane: 'popupAboveAll' });
  };

  return (
    <GeoJSON
      key="esi-sites"
      data={data}
      pointToLayer={esiPointToLayer}
      onEachFeature={esiOnEachFeature}
    />
  );
}

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
    consumers: any,
    esiSites: any,
  }>({ grid: null, plants: null, regionalGrid: null, regionalNodes: null, tieLines: null, consumers: null, esiSites: null });

  useEffect(() => {
    setupIcons();
    const urls = {
      grid: "/data/senegal-grid-existing.json",
      plants: "/data/senegal-plants.json",
      regionalGrid: "/data/regional-interconnections.json",
      regionalNodes: "/data/regional-nodes.json",
      tieLines: "/data/infrastructure-tie-lines.json",
      consumers: "/data/industrial-consumers.json",
      esiSites: "/data/sunupower-esi-sites.json",
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
    if (voltage === 225) {
      const name = (feature.properties.name || '') as string;
      const isOMVG = name.includes('OMVG') || name.includes('EDM') || name.includes('Trans-Gambia');
      return isOMVG
        ? { color: "#A78BFA", weight: 3.5, opacity: 0.9, className: "hv-225-intl-line" }
        : { color: "#2579fc", weight: 3.5, opacity: 0.9, className: "hv-225-line" };
    }
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
      `, { className: 'custom-popup', pane: 'popupAboveAll' });
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
    // Consumer hex: border+clip-path deforms at vertices — use wrapper+drop-shadow instead
    const iconHtml = isConsumer
        ? `<div style="width:${size}px;height:${size}px;filter:drop-shadow(0 0 5px ${color}CC) drop-shadow(0 0 1px rgba(255,255,255,0.65));"><div style="background-color:${color};width:100%;height:100%;clip-path:polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%);"></div></div>`
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

      layer.bindPopup(`<div class="text-sunu-arsenic font-sans p-2"><div class="text-[10px] uppercase tracking-widest font-bold text-sunu-graphite mb-2 border-b border-white/5 pb-1">${label}</div><div class="text-sm font-bold text-[#EDEFF7]">${p.name}</div><div class="text-[11px] mt-2.5 text-sunu-graphite uppercase font-bold tracking-wider">${p.fuel || p.type}${capDisplay}</div>${storage}${metadata}${p.country ? `<div class="text-[9px] text-sunu-space uppercase mt-2 opacity-60">${p.country}</div>` : ""}</div>`, { className: 'custom-popup', pane: 'popupAboveAll' });
    }
  };

  return (
    <div className="w-full h-full relative bg-[#121212]">
      <style jsx global>{`
        .leaflet-container { background: #121212 !important; }
        .hv-225-line { filter: drop-shadow(0 0 4px #2579fcCC); }
        .hv-225-intl-line { filter: drop-shadow(0 0 4px #A78BFACC); }
        .hv-90-line { filter: drop-shadow(0 0 3px #FDA206CC); }
        .mv-line { filter: drop-shadow(0 0 2px #00F2FF99); }
        .custom-popup .leaflet-popup-content-wrapper { background: rgba(14, 14, 18, 0.48) !important; backdrop-filter: blur(14px) saturate(160%) brightness(0.96) !important; -webkit-backdrop-filter: blur(14px) saturate(160%) brightness(0.96) !important; color: #EDEFF7 !important; border-radius: 12px !important; border: 1px solid rgba(255, 255, 255, 0.10) !important; box-shadow: 0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.07) !important; }
        .custom-popup .leaflet-popup-tip { background: rgba(14, 14, 18, 0.48) !important; backdrop-filter: blur(14px) !important; border: 1px solid rgba(255, 255, 255, 0.10) !important; box-shadow: none !important; }
        .leaflet-popup-content { margin: 16px 20px !important; width: auto !important; min-width: 220px; }
      `}</style>
      <MapContainer center={[13.8, -13.5] as any} zoom={7} scrollWheelZoom={true} zoomControl={false} zoomSnap={0.25} zoomDelta={0.5} wheelDebounceTime={40} wheelPxPerZoomLevel={100} className="w-full h-full">
        <PopupPaneSetup />
        <TileLayer attribution='Tiles &copy; <a href="https://www.esri.com/">Esri</a>' url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}" />
        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}" />
        {processedData.grid && <GeoJSON key={`grid-${filter}`} data={processedData.grid} filter={geoJsonFilter} style={gridStyle} onEachFeature={onEachGridFeature} />}
        {processedData.regionalGrid && <GeoJSON key={`reg-${filter}`} data={processedData.regionalGrid} filter={geoJsonFilter} style={gridStyle} onEachFeature={onEachGridFeature} />}
        {processedData.tieLines && <GeoJSON key={`tie-${filter}`} data={processedData.tieLines} filter={geoJsonFilter} style={gridStyle} onEachFeature={onEachGridFeature} />}
        {processedData.plants && <GeoJSON data={processedData.plants} pointToLayer={pointToLayer} onEachFeature={onEachPlantFeature} />}
        {processedData.regionalNodes && <GeoJSON data={processedData.regionalNodes} pointToLayer={pointToLayer} onEachFeature={onEachPlantFeature} />}
        {processedData.consumers && <GeoJSON data={processedData.consumers} pointToLayer={pointToLayer} onEachFeature={onEachPlantFeature} />}
        <EsiLayerManager data={processedData.esiSites} />
      </MapContainer>
    </div>
  );
}
