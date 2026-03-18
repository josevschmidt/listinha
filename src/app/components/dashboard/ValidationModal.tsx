import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, AlertCircle } from "lucide-react";

export interface AIValidationData {
  matched: Array<{
    user_item_id: string;
    user_item_name: string;
    sefaz_name: string;
    price: number;
  }>;
  unmatched_sefaz: Array<{
    sefaz_name: string;
    price: number;
  }>;
  unmatched_user: Array<{
    user_item_id: string;
    user_item_name: string;
  }>;
}

interface ValidationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: AIValidationData | null;
  onConfirm: (finalMatches: Array<{ user_item_id: string; sefaz_name: string; price: number }>) => void;
}

export function ValidationModal({ open, onOpenChange, data, onConfirm }: ValidationModalProps) {
  // State for tracking which AI matches the user kept checked
  const [approvedMatches, setApprovedMatches] = useState<Set<string>>(new Set());
  // State for manual matches: Record<user_item_id, sefaz_name (as stringified json string with price)>
  const [manualMatches, setManualMatches] = useState<Record<string, string>>({});
  // Track previous data to reset state when new data arrives
  const [prevData, setPrevData] = useState(data);

  if (data !== prevData) {
    setPrevData(data);
    if (data?.matched) {
      setApprovedMatches(new Set(data.matched.map(m => m.user_item_id)));
      setManualMatches({});
    }
  }

  if (!data) return null;

  const toggleApprovedMatch = (itemId: string) => {
    const newSet = new Set(approvedMatches);
    if (newSet.has(itemId)) {
      newSet.delete(itemId);
    } else {
      newSet.add(itemId);
    }
    setApprovedMatches(newSet);
  };

  const handleSave = () => {
    const finalMatches = [];

    // 1. Add approved AI Matches
    for (const match of data.matched) {
      if (approvedMatches.has(match.user_item_id)) {
        finalMatches.push({
          user_item_id: match.user_item_id,
          sefaz_name: match.sefaz_name,
          price: match.price
        });
      }
    }

    // 2. Add manual matches
    for (const userItemId of Object.keys(manualMatches)) {
      const sefazString = manualMatches[userItemId];
      if (sefazString && sefazString !== "none") {
        try {
          const parsed = JSON.parse(sefazString);
          finalMatches.push({
            user_item_id: userItemId,
            sefaz_name: parsed.sefaz_name,
            price: parsed.price
          });
        } catch {
          console.error("Failed to parse manual match data for item:", userItemId);
        }
      }
    }

    onConfirm(finalMatches);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Revisão Inteligente</DialogTitle>
          <DialogDescription>
            A IA analisou sua nota fiscal. Verifique as correspondências abaixo antes de salvar.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* Automatically Matched Items */}
          {data.matched && data.matched.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center text-green-600 dark:text-green-500">
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Correspondências Encontradas
              </h3>
              <div className="border rounded-lg divide-y dark:border-zinc-800 dark:divide-zinc-800">
                {data.matched.map((match) => (
                  <div key={match.user_item_id} className="p-3 flex items-start gap-3 bg-zinc-50/50 dark:bg-zinc-900/50">
                    <Checkbox 
                      id={`match-${match.user_item_id}`} 
                      checked={approvedMatches.has(match.user_item_id)}
                      onCheckedChange={() => toggleApprovedMatch(match.user_item_id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <label 
                        htmlFor={`match-${match.user_item_id}`}
                        className="font-medium text-sm leading-none cursor-pointer"
                      >
                        {match.user_item_name}
                      </label>
                      <div className="text-sm text-zinc-500 mt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4">
                        <span className="truncate flex-1">↳ {match.sefaz_name}</span>
                        <span className="font-medium shrink-0 text-zinc-900 dark:text-zinc-100">
                          R$ {match.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unmatched Items (Manual Mapping) */}
          {data.unmatched_user && data.unmatched_user.length > 0 && (
             <div className="space-y-3">
             <h3 className="font-semibold flex items-center text-amber-600 dark:text-amber-500">
               <AlertCircle className="w-5 h-5 mr-2" />
               Itens Pendentes
             </h3>
             <p className="text-sm text-zinc-500">
               Estes itens da sua lista não foram encontrados na nota. Selecione manualmente se desejar:
             </p>
             
             <div className="space-y-3">
               {data.unmatched_user.map((unmatchedUser) => (
                 <div key={unmatchedUser.user_item_id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 border rounded-lg dark:border-zinc-800 bg-white dark:bg-zinc-950">
                   <span className="font-medium min-w-[140px] truncate">{unmatchedUser.user_item_name}</span>
                   <div className="flex-1">
                     <Select 
                       value={manualMatches[unmatchedUser.user_item_id] || "none"}
                       onValueChange={(val) => setManualMatches(prev => ({ ...prev, [unmatchedUser.user_item_id]: val || "none" }))}
                     >
                       <SelectTrigger className="w-full">
                         <SelectValue placeholder="Selecione na nota..." />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="none" className="text-zinc-500 italic">Não comprei / Ignorar</SelectItem>
                         {data.unmatched_sefaz?.map((sefazItem, idx) => (
                           <SelectItem 
                             key={`sefaz-${idx}`} 
                             value={JSON.stringify({ sefaz_name: sefazItem.sefaz_name, price: sefazItem.price })}
                           >
                             <span className="truncate max-w-[200px] inline-block align-bottom">{sefazItem.sefaz_name}</span> - 
                             <span className="font-medium ml-1">R$ {sefazItem.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                           </SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                   </div>
                 </div>
               ))}
             </div>
           </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-4 mt-2 border-t dark:border-zinc-800">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            Salvar e Atualizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
