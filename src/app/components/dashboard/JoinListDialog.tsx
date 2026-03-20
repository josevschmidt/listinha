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
import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";

export function JoinListDialog() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !code.trim()) return;

    setError("");
    setLoading(true);
    try {
      const result = await listService.joinListByCode(code, user.uid, user.email ?? "");
      if (result.success && result.listId) {
        setOpen(false);
        setCode("");
        router.push(`/list/${result.listId}`);
      } else if (result.listId) {
        // Already a member — navigate there
        setOpen(false);
        setCode("");
        router.push(`/list/${result.listId}`);
      } else {
        setError(result.error || "Erro ao entrar na lista.");
      }
    } catch {
      setError("Ocorreu um erro. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); setError(""); }}>
      <DialogTrigger
        render={
          <Button variant="outline" className="w-full sm:w-auto h-11 px-6">
            <LogIn className="w-5 h-5 mr-2" />
            Entrar com Código
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Entrar em uma lista</DialogTitle>
            <DialogDescription>
              Digite o código de convite que você recebeu para acessar a lista.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-3">
              <Label htmlFor="code">Código de Convite</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(""); }}
                placeholder="Ex: LST-AB12CD"
                className="font-mono"
                autoFocus
                disabled={loading}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!code.trim() || loading}>
              {loading ? "Entrando..." : "Entrar na Lista"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
