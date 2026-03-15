import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { listService } from "@/lib/services/listService";
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
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

export function CreateListDialog() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;

    try {
      setLoading(true);
      const listId = await listService.createList(name, user.uid);
      setOpen(false);
      setName("");
      router.push(`/list/${listId}`);
    } catch (error) {
      console.error("Error creating list:", error);
      // We could add a toast notification here later
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
              Dê um nome para sua lista de compras para começar a adicionar itens e convidar amigos.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-3">
              <Label htmlFor="name">Nome da Lista</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Churrasco de Domingo, Mercado Mensal"
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
