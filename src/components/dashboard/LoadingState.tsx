import React from "react";

export const LoadingState = ({ message = "Carregando..." }: { message?: string }) => (
  <div className="h-[600px] flex flex-col items-center justify-center space-y-4">
    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">{message}</p>
  </div>
);
