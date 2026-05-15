import * as React from "react";
import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface SearchableMultiSelectProps {
  label?: string;
  options: string[];
  selected: string[];
  onChange: (vals: string[]) => void;
  placeholder: string;
  className?: string;
}

export const SearchableMultiSelect = ({ 
  label, 
  options, 
  selected, 
  onChange, 
  placeholder,
  className
}: SearchableMultiSelectProps) => {
  const [search, setSearch] = useState("");
  const filteredOptions = options.filter(o => String(o).toLowerCase().includes(search.toLowerCase()));

  return (
    <div className={cn("space-y-1.5 flex-1 w-full", className)}>
      {label && <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1 font-mono tracking-tight text-primary/80">{label}</label>}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-9 w-full justify-between text-xs font-bold px-3 transition-all duration-200 bg-white/50 border-primary/20 hover:border-primary/40 text-left">
            <span className="truncate pr-4">
              {selected.length === 0 ? placeholder : 
               selected.length === 1 ? selected[0] : 
               `${selected.length} selecionados`}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-white dark:bg-slate-950 border-primary/10 shadow-2xl z-[100]" align="start">
          <div className="p-2 border-b bg-muted/20">
            <Input 
              placeholder="Pesquisar..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-xs focus-visible:ring-primary/50 border-primary/10"
            />
          </div>
          <ScrollArea className="h-[250px]">
            <div className="p-1 space-y-0.5">
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full justify-start text-[10px] h-8 px-2 font-black uppercase tracking-widest text-primary/60 hover:text-primary hover:bg-primary/5"
                onClick={() => {
                   onChange([]);
                   setSearch("");
                }}
              >
                Limpar Seleção
              </Button>
              {filteredOptions.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground uppercase font-medium italic">Nenhum resultado</div>
              ) : (
                filteredOptions.map((opt) => (
                  <div 
                    key={opt}
                    className="flex items-center space-x-2 px-2 py-1.5 hover:bg-primary/5 rounded-md cursor-pointer transition-colors group"
                    onClick={() => {
                      if (selected.includes(opt)) {
                        onChange(selected.filter(s => s !== opt));
                      } else {
                        onChange([...selected, opt]);
                      }
                    }}
                  >
                    <Checkbox 
                      checked={selected.includes(opt)} 
                      onCheckedChange={(checked) => {
                        if (checked) {
                          onChange([...selected, opt]);
                        } else {
                          onChange(selected.filter(s => s !== opt));
                        }
                      }}
                      className="h-4 w-4 border-primary/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary" 
                    />
                    <span className={cn(
                        "text-xs uppercase truncate transition-colors",
                        selected.includes(opt) ? "font-bold text-primary" : "text-muted-foreground group-hover:text-foreground"
                    )}>
                      {opt}
                    </span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
};
