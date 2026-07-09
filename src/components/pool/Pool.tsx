import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MonitoramentoFrotaPool } from "./MonitoramentoFrotaPool";
import { VoucherTaxiDashboard } from "./VoucherTaxiDashboard";
import { Car, Gauge } from "lucide-react";

export default function Pool() {
  const [activeMainTab, setActiveMainTab] = useState<string>("frota_pool");

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="space-y-6">
        {/* Top level navigation headers */}
        <div className="flex justify-center border-b border-slate-200 dark:border-slate-800 pb-2">
          <TabsList className="bg-slate-100 dark:bg-slate-950 p-1 rounded-xl flex gap-1 border border-slate-200 dark:border-slate-800">
            <TabsTrigger 
              value="frota_pool" 
              className="text-xs font-black uppercase tracking-widest px-6 py-3 rounded-lg flex items-center gap-2 transition-all"
            >
              <Gauge className="h-4 w-4" /> MONITORAMENTO FROTA POOL
            </TabsTrigger>
            <TabsTrigger 
              value="voucher_taxi" 
              className="text-xs font-black uppercase tracking-widest px-6 py-3 rounded-lg flex items-center gap-2 transition-all"
            >
              <Car className="h-4 w-4" /> VOUCHER / TÁXI
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Content Tabs */}
        <TabsContent value="frota_pool" className="outline-none focus:outline-none focus-visible:outline-none">
          <MonitoramentoFrotaPool />
        </TabsContent>

        <TabsContent value="voucher_taxi" className="outline-none focus:outline-none focus-visible:outline-none">
          <VoucherTaxiDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
