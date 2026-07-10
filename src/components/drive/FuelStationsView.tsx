import React, { useState, useMemo } from 'react';
import { useFuelStationsData } from '@/hooks/useFuelStations';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, ChevronLeft, ExternalLink, Filter, Fuel } from "lucide-react";

interface FuelStationsViewProps {
  onBack: () => void;
}

export default function FuelStationsView({ onBack }: FuelStationsViewProps) {
  const { data: stations = [], isLoading } = useFuelStationsData();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCity, setSelectedCity] = useState("all");

  const cities = useMemo(() => {
    const c = stations.map(s => s.cidade);
    return Array.from(new Set(c)).sort();
  }, [stations]);

  const filteredStations = useMemo(() => {
    return stations.filter(s => {
      const matchesSearch = 
        s.estabelecimentoRaw.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.enderecoRaw.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCity = selectedCity === "all" || s.cidade === selectedCity;
      
      return matchesSearch && matchesCity;
    });
  }, [stations, searchTerm, selectedCity]);

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBack}
            className="rounded-full hover:bg-white dark:hover:bg-slate-800"
          >
            <ChevronLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter italic">
              Relação de Postos
            </h1>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Rede de postos credenciados Compesa
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="bg-white dark:bg-slate-900 px-6 py-2 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-6 w-full justify-around md:w-auto">
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total de Postos</p>
              <p className="text-lg font-black text-indigo-600">{stations.length}</p>
            </div>
            <div className="w-px h-8 bg-slate-100 dark:bg-slate-800" />
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cidades</p>
              <p className="text-lg font-black text-emerald-500">{cities.length}</p>
            </div>
          </div>
        </div>
      </div>

      <Card className="border-none shadow-2xl shadow-slate-200/50 dark:shadow-none bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl md:rounded-[2.5rem] overflow-hidden">
        <CardHeader className="p-4 sm:p-6 md:p-8 border-b border-slate-100 dark:border-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
              <Input 
                placeholder="BUSCAR POR NOME OU ENDEREÇO..." 
                className="pl-12 h-12 bg-slate-50 border-none rounded-2xl font-bold text-[10px] uppercase tracking-widest focus-visible:ring-2 focus-visible:ring-indigo-500/20"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3 bg-slate-50 px-4 rounded-2xl">
              <Filter size={16} className="text-slate-400" />
              <select 
                className="bg-transparent border-none w-full h-12 font-bold text-[10px] uppercase tracking-widest focus:ring-0"
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
              >
                <option value="all">TODAS AS CIDADES</option>
                {cities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
            <Table>
              <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50 sticky top-0 z-10 backdrop-blur-md">
                <TableRow className="border-none hover:bg-transparent">
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-6 px-8">Estabelecimento</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-6">Cidade</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-6">Endereço</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-6 text-right px-8">Localização</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={4} className="h-16 animate-pulse bg-slate-50/50" />
                    </TableRow>
                  ))
                ) : filteredStations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-slate-400 font-bold uppercase text-xs">
                      Nenhum posto encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStations.map((station) => (
                    <TableRow key={station.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 transition-colors">
                      <TableCell className="py-6 px-8">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-800 dark:text-white tracking-tighter uppercase">{station.estabelecimentoRaw}</span>
                          <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1">
                            <Fuel size={10} /> {station.fields["Rede Preferencial / Conveniada"] || "Rede Credenciada"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-6">
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-none font-black text-[10px] uppercase">
                          {station.cidade}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-6 max-w-xs">
                        <span className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed">
                          {station.enderecoRaw}
                        </span>
                      </TableCell>
                      <TableCell className="py-6 px-8 text-right">
                        <a 
                          href={station.mapsLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-4 py-2 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest"
                        >
                          <MapPin size={12} />
                          Ver no Maps
                          <ExternalLink size={10} />
                        </a>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards View */}
          <div className="block md:hidden max-h-[600px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-5 animate-pulse space-y-4">
                  <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-2/3" />
                  <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/4" />
                  <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-5/6" />
                  <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded w-full" />
                </div>
              ))
            ) : filteredStations.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-bold uppercase text-xs">
                Nenhum posto encontrado.
              </div>
            ) : (
              filteredStations.map((station) => (
                <div key={station.id} className="p-5 space-y-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                  {/* Estabelecimento */}
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Estabelecimento</span>
                    <span className="text-sm font-black text-slate-800 dark:text-white tracking-tighter uppercase block">
                      {station.estabelecimentoRaw}
                    </span>
                    <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1 mt-0.5">
                      <Fuel size={10} /> {station.fields["Rede Preferencial / Conveniada"] || "Rede Credenciada"}
                    </span>
                  </div>

                  {/* Cidade */}
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Cidade</span>
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-none font-black text-[10px] uppercase">
                      {station.cidade}
                    </Badge>
                  </div>

                  {/* Endereço */}
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Endereço</span>
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase leading-relaxed block">
                      {station.enderecoRaw}
                    </span>
                  </div>

                  {/* Localização (Link) */}
                  <div className="pt-1">
                    <a 
                      href={station.mapsLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-4 py-2.5 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest w-full text-center"
                    >
                      <MapPin size={12} />
                      Ver no Maps
                      <ExternalLink size={10} />
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
