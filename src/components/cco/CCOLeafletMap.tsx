import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for marker icons
const movingIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `
    <div class="relative flex items-center justify-center">
      <div class="absolute w-6 h-6 bg-indigo-500 rounded-full animate-ping opacity-20"></div>
      <div style="background-color: #6366f1; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(99,102,241,0.8); z-index: 10;"></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const alertIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `
    <div class="relative flex items-center justify-center">
      <div class="absolute w-8 h-8 bg-rose-500 rounded-full animate-pulse opacity-40"></div>
      <div style="background-color: #f43f5e; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 15px rgba(244,63,94,0.9); z-index: 10; display: flex; align-items: center; justify-content: center;">
        <div style="width: 4px; height: 4px; background: white; border-radius: 50%;"></div>
      </div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const stoppedIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `
    <div style="background-color: #475569; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>
  `,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

interface CCOLeafletMapProps {
  assets: any[];
  mapType: 'roadmap' | 'satellite' | 'hybrid';
}

function MapUpdater({ assets }: { assets: any[] }) {
  const map = useMap();
  
  useEffect(() => {
    // Only auto-fit if we have a small subset (e.g. someone searched for a plate)
    // or on first load if needed. If assets > 10, keep the manual Pernambuco view.
    if (assets.length > 0 && assets.length < 5) {
      const bounds = L.latLngBounds(assets.map(a => [
        parseFloat(String(a.latitude || 0).replace(',', '.')), 
        parseFloat(String(a.longitude || 0).replace(',', '.'))
      ]).filter(coord => !isNaN(coord[0]) && !isNaN(coord[1])) as L.LatLngExpression[]);
      
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [100, 100], maxZoom: 16 });
      }
    }
  }, [assets, map]);
  
  return null;
}

export function CCOLeafletMap({ assets, mapType }: CCOLeafletMapProps) {
  const defaultCenter: [number, number] = [-8.3, -37.5]; // Central Pernambuco

  const getTileUrl = () => {
    if (mapType === 'satellite') {
      return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    }
    if (mapType === 'hybrid') {
      return 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
    }
    return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
  };

  return (
    <div className="w-full h-full relative">
      <MapContainer 
        center={defaultCenter} 
        zoom={7} 
        style={{ height: '100%', width: '100%', background: '#0f172a' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; CARTO'
          url={getTileUrl()}
          subdomains={mapType === 'hybrid' ? ['mt0', 'mt1', 'mt2', 'mt3'] : 'abcd'}
        />
        <ZoomControl position="bottomright" />
        <MapUpdater assets={assets} />
        
        {assets.map((asset, idx) => {
          const finalLat = parseFloat(String(asset.latitude || "").replace(",", "."));
          const finalLng = parseFloat(String(asset.longitude || "").replace(",", "."));

          if (isNaN(finalLat) || isNaN(finalLng) || finalLat === 0) return null;

          const isMoving = Number(asset.Velocidade || 0) > 0;
          const hasAlert = (asset.Tensao && asset.Tensao < 11.5);

          return (
            <Marker 
              key={`${asset.Placa}-${idx}`} 
              position={[finalLat, finalLng]} 
              icon={hasAlert ? alertIcon : isMoving ? movingIcon : stoppedIcon}
            >
              <Popup>
                <div className="p-2 min-w-[150px] bg-slate-900 text-white rounded-lg">
                  <h3 className="font-black border-b border-white/10 pb-1 mb-2 text-indigo-400 uppercase tracking-tighter text-sm">{asset.Placa}</h3>
                  <div className="text-[10px] space-y-1 font-bold">
                    <p><span className="text-slate-500 uppercase tracking-widest text-[8px]">Condutor:</span> {asset.Condutor}</p>
                    <p><span className="text-slate-500 uppercase tracking-widest text-[8px]">Velocidade:</span> {asset.Velocidade} KM/H</p>
                    <p><span className="text-slate-500 uppercase tracking-widest text-[8px]">Status:</span> {isMoving ? 'EM MOVIMENTO' : 'PARADO'}</p>
                    <p><span className="text-slate-500 uppercase tracking-widest text-[8px]">Tensão:</span> {asset.Tensao}V</p>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
