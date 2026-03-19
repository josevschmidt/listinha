"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, ArrowRight, ShoppingCart, ListPlus, Trash2, LogOutIcon, Files } from "lucide-react";
import { CreateListDialog } from "@/app/components/dashboard/CreateListDialog";
import { JoinListDialog } from "@/app/components/dashboard/JoinListDialog";
import { listService, List } from "@/lib/services/listService";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [lists, setLists] = useState<List[]>([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [listsError, setListsError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    // Subscribe to all lists where the user is a member (owned + shared)
    const unsubscribe = listService.subscribeToMemberLists(user.uid, (fetchedLists, error) => {
      if (error) {
        setListsError("Não foi possível carregar suas listas. Verifique sua conexão e tente novamente.");
        setListsLoading(false);
        return;
      }
      const sortedLists = fetchedLists.sort((a, b) => {
        const timeA = a.created_at ? ("seconds" in a.created_at ? a.created_at.seconds : a.created_at.getTime()) : 0;
        const timeB = b.created_at ? ("seconds" in b.created_at ? b.created_at.seconds : b.created_at.getTime()) : 0;
        return timeB - timeA;
      });
      setLists(sortedLists);
      setListsError(null);
      setListsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
      </div>
    );
  }

  const ownedLists = lists.filter(l => l.owner_id === user.uid);
  const sharedLists = lists.filter(l => l.owner_id !== user.uid);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-border">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shadow-sm">
              <ShoppingCart className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight text-foreground">Listinha</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-xs text-muted-foreground font-medium truncate max-w-[180px]">
              {user.email}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              title="Sair"
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-5 sm:px-6 py-6 space-y-6">
        {/* Hero section */}
        <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-5 sm:p-6 shadow-sm">
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground mb-1">
            Suas Listas
          </h1>
          <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
            Gerencie suas compras e acompanhe os preços com inteligência.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
            <JoinListDialog />
            <CreateListDialog />
          </div>
        </div>

        {/* Lists */}
        {listsLoading ? (
          <div className="flex justify-center p-12">
            <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
          </div>
        ) : listsError ? (
          <div className="py-12 px-6 text-center border-2 border-dashed border-destructive/30 rounded-2xl bg-destructive/5">
            <p className="text-destructive font-medium text-sm leading-relaxed">{listsError}</p>
          </div>
        ) : (
          <>
            <ListGrid
              lists={ownedLists}
              userId={user.uid}
              userEmail={user.email ?? ""}
              onNavigate={(id) => router.push(`/list/${id}`)}
              emptyMessage="Você ainda não possui nenhuma lista."
            />

            {sharedLists.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground px-1">
                  Compartilhadas comigo
                </h2>
                <ListGrid
                  lists={sharedLists}
                  userId={user.uid}
                  userEmail={user.email ?? ""}
                  onNavigate={(id) => router.push(`/list/${id}`)}
                  emptyMessage=""
                />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function ListGrid({
  lists,
  userId,
  userEmail,
  onNavigate,
  emptyMessage,
}: {
  lists: List[];
  userId: string;
  userEmail: string;
  onNavigate: (id: string) => void;
  emptyMessage: string;
}) {
  const router = useRouter();
  const [confirmDialog, setConfirmDialog] = useState<{ list: List; action: "delete" | "leave" } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const handleDeleteOrLeave = async () => {
    if (!confirmDialog) return;
    setActionLoading(true);
    setActionError(null);
    const { list, action } = confirmDialog;
    const result = action === "delete"
      ? await listService.deleteList(list.id, userId)
      : await listService.leaveList(list.id, userId);
    if (result.success) {
      setConfirmDialog(null);
    } else {
      setActionError(result.error ?? "Erro desconhecido.");
    }
    setActionLoading(false);
  };

  const handleDuplicate = async (e: React.MouseEvent, listId: string) => {
    e.stopPropagation();
    setDuplicatingId(listId);
    const result = await listService.duplicateList(listId, userId, userEmail);
    setDuplicatingId(null);
    if (result.success && result.listId) router.push(`/list/${result.listId}`);
  };

  if (lists.length === 0 && emptyMessage) {
    return (
      <div className="py-14 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-muted rounded-2xl">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <ListPlus className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground font-medium">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {lists.map((list) => {
          const isOwner = list.owner_id === userId;
          return (
            <div
              key={list.id}
              onClick={() => onNavigate(list.id)}
              className="group relative bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer flex flex-col gap-3 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-primary/60 to-transparent rounded-t-2xl" />

              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold text-base text-foreground truncate leading-tight">{list.name}</h3>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 -mt-1 -mr-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full text-muted-foreground/60 hover:text-primary hover:bg-primary/10"
                    onClick={(e) => handleDuplicate(e, list.id)}
                    title="Duplicar lista"
                    disabled={duplicatingId === list.id}
                  >
                    <Files className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => { e.stopPropagation(); setConfirmDialog({ list, action: isOwner ? "delete" : "leave" }); setActionError(null); }}
                    title={isOwner ? "Excluir lista" : "Sair da lista"}
                  >
                    {isOwner ? <Trash2 className="w-3.5 h-3.5" /> : <LogOutIcon className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Código</span>
                <span className="font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-md text-xs font-bold tracking-wider">
                  {list.share_code}
                </span>
              </div>

              <div className="flex items-center gap-1 text-primary text-xs font-bold group-hover:gap-2 transition-all mt-auto">
                Ver itens <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!confirmDialog} onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {confirmDialog?.action === "delete" ? "Excluir lista" : "Sair da lista"}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog?.action === "delete"
                ? `Tem certeza que deseja excluir "${confirmDialog?.list.name}"? Todos os itens serão removidos permanentemente.`
                : `Tem certeza que deseja sair da lista "${confirmDialog?.list.name}"? Você precisará do código de convite para entrar novamente.`}
            </DialogDescription>
          </DialogHeader>
          {actionError && <p className="text-sm text-destructive font-medium">{actionError}</p>}
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setConfirmDialog(null)} disabled={actionLoading}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteOrLeave} disabled={actionLoading}>
              {actionLoading ? "Aguarde..." : confirmDialog?.action === "delete" ? "Excluir" : "Sair"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
