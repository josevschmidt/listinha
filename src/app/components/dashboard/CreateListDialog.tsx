import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { listService, ListType } from "@/lib/services/listService";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, ShoppingCart, ListChecks } from "lucide-react";
import { useRouter } from "next/navigation";

export function CreateListDialog() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<ListType>("shopping");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;

    try {
      setLoading(true);
      const listId = await listService.createList(name, user.uid, user.email ?? "", type);
      setOpen(false);
      setName("");
      setType("shopping");
      router.push(`/list/${listId}`);
    } catch (error) {
      console.error("Error creating list:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setName(""); setType("shopping"); } }}>
      <DialogTrigger>
        <Button className="w-full sm:w-auto h-11 px-6 shadow-sm">
          <Plus className="w-5 h-5 mr-2" />
          Nova Lista
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Criar nova lista</DialogTitle>
            <DialogDescription>
              Escolha o tipo de lista e dê um nome para começar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Type selection */}
            <div className="flex flex-col gap-3">
              <Label>Tipo de Lista</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setType("shopping")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                    type === "shopping"
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border hover:border-primary/30 bg-background"
                  }`}
                  disabled={loading}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    type === "shopping" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                  <span className={`text-sm font-bold ${type === "shopping" ? "text-primary" : "text-muted-foreground"}`}>
                    Mercado
                  </span>
                  <span className="text-[10px] text-muted-foreground text-center leading-tight">
                    Compras, preços e categorias
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setType("todo")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                    type === "todo"
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border hover:border-primary/30 bg-background"
                  }`}
                  disabled={loading}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    type === "todo" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    <ListChecks className="w-5 h-5" />
                  </div>
                  <span className={`text-sm font-bold ${type === "todo" ? "text-primary" : "text-muted-foreground"}`}>
                    Afazeres
                  </span>
                  <span className="text-[10px] text-muted-foreground text-center leading-tight">
                    Tarefas com datas e histórico
                  </span>
                </button>
              </div>
            </div>

            {/* Name input */}
            <div className="flex flex-col gap-3">
              <Label htmlFor="name">Nome da Lista</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={type === "shopping" ? "Ex: Churrasco de Domingo, Mercado Mensal" : "Ex: Tarefas da Semana, Mudança"}
                className="col-span-3"
                autoFocus
                disabled={loading}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim() || loading}>
              {loading ? "Criando..." : "Criar Lista"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
