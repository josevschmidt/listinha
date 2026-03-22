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
import { CheckCircle2, AlertCircle, Plus, Pencil } from "lucide-react";

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
    suggested_name?: string;
  }>;
  unmatched_user: Array<{
    user_item_id: string;
    user_item_name: string;
  }>;
}

export interface NewItemSuggestion {
  sefaz_name: string;
  suggested_name: string;
  price: number;
}

interface ValidationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: AIValidationData | null;
  onConfirm: (
    finalMatches: Array<{ user_item_id: string; sefaz_name: string; price: number }>,
    newItems?: NewItemSuggestion[]
  ) => void;
}

export function ValidationModal({ open, onOpenChange, data, onConfirm }: ValidationModalProps) {
  // State for tracking which AI matches the user kept checked
  const [approvedMatches, setApprovedMatches] = useState<Set<string>>(new Set());
  // State for tracking which suggested new items the user wants to add
  const [selectedNewItems, setSelectedNewItems] = useState<Set<number>>(new Set());
  // State for edited suggested names
  const [editedNames, setEditedNames] = useState<Record<number, string>>({});
  // Track previous data to reset state when new data arrives
  const [prevData, setPrevData] = useState(data);

  if (data !== prevData) {
    setPrevData(data);
    if (data?.matched) {
      setApprovedMatches(new Set(data.matched.map(m => m.user_item_id)));
    }
    setSelectedNewItems(new Set());
    setEditedNames({});
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

  const toggleNewItem = (idx: number) => {
    const newSet = new Set(selectedNewItems);
    if (newSet.has(idx)) {
      newSet.delete(idx);
    } else {
      newSet.add(idx);
    }
    setSelectedNewItems(newSet);
  };

  const suggestedItems = (data?.unmatched_sefaz ?? []).filter(item => item.suggested_name);

  const handleSave = () => {
    const finalMatches = [];

    // Add approved AI Matches
    for (const match of data.matched) {
      if (approvedMatches.has(match.user_item_id)) {
        finalMatches.push({
          user_item_id: match.user_item_id,
          sefaz_name: match.sefaz_name,
          price: match.price
        });
      }
    }

    // Collect selected new items
    const newItems: NewItemSuggestion[] = [];
    suggestedItems.forEach((item, idx) => {
      if (selectedNewItems.has(idx)) {
        newItems.push({
          sefaz_name: item.sefaz_name,
          suggested_name: editedNames[idx]?.trim() || item.suggested_name!,
          price: item.price,
        });
      }
    });

    onConfirm(finalMatches, newItems.length > 0 ? newItems : undefined);
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

          {/* Suggested new items from unmatched receipt items */}
          {suggestedItems.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center text-blue-600 dark:text-blue-400">
                <Plus className="w-5 h-5 mr-2" />
                Sugestões para Adicionar à Lista
              </h3>
              <p className="text-sm text-zinc-500">
                Estes itens da nota não estão na sua lista. Selecione os que deseja adicionar:
              </p>
              <div className="border rounded-lg divide-y dark:border-zinc-800 dark:divide-zinc-800">
                {suggestedItems.map((item, idx) => (
                  <div key={`suggest-${idx}`} className="p-3 flex items-start gap-3 bg-blue-50/50 dark:bg-blue-950/20">
                    <Checkbox
                      id={`suggest-${idx}`}
                      checked={selectedNewItems.has(idx)}
                      onCheckedChange={() => toggleNewItem(idx)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <Pencil className="w-3 h-3 text-zinc-400 shrink-0" />
                        <input
                          type="text"
                          value={editedNames[idx] ?? item.suggested_name}
                          onChange={(e) => setEditedNames(prev => ({ ...prev, [idx]: e.target.value }))}
                          className="font-medium text-sm bg-transparent border-b border-dashed border-zinc-300 dark:border-zinc-600 focus:border-blue-500 focus:outline-none py-0.5 w-full"
                        />
                      </div>
                      <div className="text-sm text-zinc-500 mt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4">
                        <span className="truncate flex-1 text-xs">↳ {item.sefaz_name}</span>
                        <span className="font-medium shrink-0 text-zinc-900 dark:text-zinc-100">
                          R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unmatched receipt items without suggestions */}
          {data.unmatched_sefaz && data.unmatched_sefaz.filter(i => !i.suggested_name).length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center text-amber-600 dark:text-amber-500">
                <AlertCircle className="w-5 h-5 mr-2" />
                Outros Itens da Nota
              </h3>
              <p className="text-sm text-zinc-500">
                Estes itens estão na nota fiscal mas não foram associados a nenhum item da sua lista:
              </p>
              <div className="border rounded-lg divide-y dark:border-zinc-800 dark:divide-zinc-800">
                {data.unmatched_sefaz.filter(i => !i.suggested_name).map((item, idx) => (
                  <div key={`sefaz-extra-${idx}`} className="p-3 flex items-center justify-between bg-white dark:bg-zinc-950">
                    <span className="text-sm font-medium truncate flex-1">{item.sefaz_name}</span>
                    <span className="text-sm font-medium shrink-0 text-zinc-900 dark:text-zinc-100 ml-4">
                      R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
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
