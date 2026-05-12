import React, { useState } from "react";
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow } from "@vis.gl/react-google-maps";
import { TelemetryRealtimeData } from "../../types";
import { MapPin, Truck, Power } from "lucide-react";

interface TelemetryWorkshopMapProps {
  assets: TelemetryRealtimeData[];
  mapType?: string;
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

export const TelemetryWorkshopMap = ({ assets, mapType: externalMapType }: TelemetryWorkshopMapProps) => {
  const [selectedAsset, setSelectedAsset] = useState<TelemetryRealtimeData | null>(null);
  const [internalMapType, setInternalMapType] = useState<string>("roadmap");

  const mapType = externalMapType || internalMapType;

  // Center on original region (Pernambuco/Recife roughly) if no assets
  const defaultCenter = { lat: -8.0476, lng: -34.8770 };

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="bg-slate-100 dark:bg-slate-800 rounded-3xl p-12 text-center border-4 border-dashed border-slate-200 dark:border-slate-700">
        <MapPin size={48} className="mx-auto text-slate-400 mb-4" />
        <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tighter">Google Maps Indisponível</h3>
        <p className="text-sm text-slate-500 max-w-sm mx-auto mt-2">
          Por favor, configure sua chave de API em <code className="bg-white dark:bg-slate-900 px-2 py-1 rounded text-indigo-500 font-bold">VITE_GOOGLE_MAPS_API_KEY</code> para visualizar o mapa real-time.
        </p>
      </div>
    );
  }

  // Filtrar ativos que possuem coordenadas válidas
  const markers = assets.filter(a => {
    const lat = parseFloat(String(a.latitude || a.Latitude || "").replace(",", "."));
    const lng = parseFloat(String(a.longitude || a.Longitude || "").replace(",", "."));
    return !isNaN(lat) && !isNaN(lng);
  });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden h-[500px]">
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
        <div className="relative w-full h-full">
          <div className="absolute top-4 right-4 z-10 flex gap-2">
            {["roadmap", "satellite", "hybrid"].map((type) => (
              <button
                key={type}
                onClick={() => setInternalMapType(type)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all shadow-lg border ${
                  mapType === type 
                    ? "bg-indigo-600 border-indigo-500 text-white" 
                    : "bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-white"
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <Map
            defaultCenter={defaultCenter}
            defaultZoom={10}
            mapId="NEXUS_FROTA_MONITORING"
            mapTypeId={mapType}
            disableDefaultUI={false}
            className="w-full h-full"
          >
          {markers.map((asset, idx) => {
            const lat = parseFloat(String(asset.latitude || asset.Latitude || "").replace(",", "."));
            const lng = parseFloat(String(asset.longitude || asset.Longitude || "").replace(",", "."));
            const isLigado = ["LIGADA", "1", 1].includes(String(asset.Ignicao || "").toUpperCase()) || asset.Ignicao === 1;

            return (
              <AdvancedMarker
                key={idx}
                position={{ lat, lng }}
                onClick={() => setSelectedAsset(asset)}
              >
                <div className={`p-1.5 rounded-full border-2 border-white shadow-lg ${isLigado ? 'bg-emerald-500' : 'bg-slate-400'}`}>
                  <Truck size={14} className="text-white" />
                </div>
              </AdvancedMarker>
            );
          })}

          {selectedAsset && (
            <InfoWindow
              position={{
                lat: parseFloat(String(selectedAsset.latitude || selectedAsset.Latitude || "").replace(",", ".")),
                lng: parseFloat(String(selectedAsset.longitude || selectedAsset.Longitude || "").replace(",", "."))
              }}
              onCloseClick={() => setSelectedAsset(null)}
            >
              <div className="p-2 min-w-[150px]">
                <div className="flex items-center space-x-2 mb-2 border-b pb-1">
                   <div className={`w-2 h-2 rounded-full ${["LIGADA", "1", 1].includes(String(selectedAsset.Ignicao || "").toUpperCase()) || selectedAsset.Ignicao === 1 ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                   <span className="font-mono font-bold text-slate-800">{selectedAsset.Placa || selectedAsset.placa}</span>
                </div>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Velocidade: <span className="text-slate-800">{selectedAsset.Velocidade || 0} KM/H</span></p>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Unidade: <span className="text-slate-800">{selectedAsset.Unidade || selectedAsset.unidade || "-"}</span></p>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">Condutor: {selectedAsset.Condutor || "N/A"}</p>
              </div>
            </InfoWindow>
          )}
        </Map>
        </div>
      </APIProvider>
    </div>
  );
};
