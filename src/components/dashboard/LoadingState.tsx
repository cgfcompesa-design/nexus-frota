import React from "react";
import { motion } from "motion/react";

export const LoadingState = ({ message = "Carregando..." }: { message?: string }) => {
  return (
    <div className="h-[450px] w-full flex flex-col items-center justify-center space-y-6 bg-transparent">
      {/* Container visual ultra-limpo com bordas sutis */}
      <div className="flex flex-col items-center p-8 rounded-3xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border border-slate-100/50 dark:border-slate-800/50 shadow-sm max-w-xs w-full">
        {/* Animação minimalista: Círculo rotante com arco duplo */}
        <div className="relative w-12 h-12">
          {/* Círculo externo de fundo */}
          <div className="absolute inset-0 rounded-full border-2 border-slate-100 dark:border-slate-800" />
          
          {/* Arco animado */}
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-t-indigo-600 border-r-indigo-400 dark:border-t-indigo-500 dark:border-r-indigo-300"
            style={{ borderBottomColor: "transparent", borderLeftColor: "transparent" }}
            animate={{ rotate: 360 }}
            transition={{
              repeat: Infinity,
              duration: 1,
              ease: "linear"
            }}
          />
          
          {/* Pulsador interior */}
          <motion.div
            className="absolute inset-3 rounded-full bg-indigo-500/10 dark:bg-indigo-400/10"
            animate={{ scale: [0.8, 1.1, 0.8] }}
            transition={{
              repeat: Infinity,
              duration: 2,
              ease: "easeInOut"
            }}
          />
        </div>

        {/* Texto do Loading */}
        <div className="mt-5 text-center">
          <motion.h4 
            className="text-[10px] font-black uppercase tracking-widest text-[#1e293b] dark:text-white"
            animate={{ opacity: [1, 0.6, 1] }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            {message}
          </motion.h4>
          
          {/* Pequena linha de carregamento minimalista sob o texto */}
          <div className="mt-3 w-16 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mx-auto">
            <motion.div 
              className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600"
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{
                repeat: Infinity,
                duration: 1.5,
                ease: "easeInOut"
              }}
              style={{ width: "60%" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
