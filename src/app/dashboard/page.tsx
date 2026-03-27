"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, ArrowRight, ShoppingCart, ListPlus, Trash2, LogOutIcon, Files, ListChecks, ChevronUp, ChevronDown } from "lucide-react";
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
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";

// ── Color palette for list tags in the footer panel ───────────────────────────
const LIST_TAG_COLORS = [
  "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
  "bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300",
];

interface TodoItem {
  id: string;
  name: string;
  listId: string;
  listName: string;
  colorIdx: number;
}

function listColorIndex(listId: string): number {
  let h = 0;
  for (let i = 0; i < listId.length; i++) h = (h * 31 + listId.charCodeAt(i)) % LIST_TAG_COLORS.length;
  return h;
}

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [lists, setLists] = useState<List[]>([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [listsError, setListsError] = useState<string | null>(null);
  const [todoItems, setTodoItems] = useState<TodoItem[]>([]);
  const [footerExpanded, setFooterExpanded] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    listService.migrateListsWithoutType(user.uid).catch(console.error);
  }, [user]);

  useEffect(() => {
    if (!user) return;
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

  // Subscribe to pending items from all todo lists
  useEffect(() => {
    const todoLists = lists.filter(l => (l.type ?? "shopping") === "todo");

    if (todoLists.length === 0) {
      // setState must be in a callback, not directly in the effect body
      const t = setTimeout(() => setTodoItems([]), 0);
      return () => clearTimeout(t);
    }

    const itemsByList = new Map<string, TodoItem[]>();
    const unsubscribers = todoLists.map((list) => {
      const colorIdx = listColorIndex(list.id);
      return onSnapshot(collection(db, "lists", list.id, "items"), (snap) => {
        itemsByList.set(
          list.id,
          snap.docs
            .map(d => ({ id: d.id, ...(d.data() as { name: string; status: string }) }))
            .filter(item => item.status === "pending")
            .map(item => ({ id: item.id, name: item.name, listId: list.id, listName: list.name, colorIdx }))
        );
        setTodoItems(Array.from(itemsByList.values()).flat());
      });
    });

    return () => unsubscribers.forEach(u => u());
  }, [lists]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
      </div>
    );
  }

  const ownedLists = lists.filter(l => l.owner_id === user.uid);
  const sharedLists = lists.filter(l => l.owner_id !== user.uid);
  const hasTodoLists = lists.some(l => (l.type ?? "shopping") === "todo");

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

      <main className={`flex-1 max-w-5xl w-full mx-auto px-5 sm:px-6 py-6 space-y-6 ${hasTodoLists ? "pb-16" : ""}`}>
        {/* Hero section */}
        <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-4 sm:p-5 shadow-sm">
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            Gerencie suas compras e acompanhe os preços com inteligência.
          </p>
          <div className="flex gap-2">
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

      {/* Fixed todo footer panel */}
      {hasTodoLists && (
        <div className="fixed bottom-0 left-0 right-0 z-20">
          <div className="bg-card/95 backdrop-blur-md border-t border-border shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
            {/* Header bar */}
            <button
              className="w-full flex items-center justify-between px-5 h-12 hover:bg-muted/30 transition-colors"
              onClick={() => setFooterExpanded(prev => !prev)}
            >
              <div className="flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold text-foreground">Minhas tarefas</span>
                {todoItems.length > 0 && (
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary leading-none">
                    {todoItems.length}
                  </span>
                )}
              </div>
              {footerExpanded
                ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                : <ChevronUp className="w-4 h-4 text-muted-foreground" />
              }
            </button>
            {/* Expanded content */}
            {footerExpanded && (
              <div className="max-h-[40vh] overflow-y-auto divide-y divide-border/50 border-t border-border/50">
                {todoItems.length === 0 ? (
                  <div className="px-5 py-4 text-sm text-muted-foreground text-center">
                    Nenhuma tarefa pendente.
                  </div>
                ) : (
                  todoItems.map(item => (
                    <div
                      key={`${item.listId}-${item.id}`}
                      className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/20 cursor-pointer transition-colors"
                      onClick={() => router.push(`/list/${item.listId}`)}
                    >
                      <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/20 shrink-0" />
                      <span className="text-sm flex-1 min-w-0 break-words text-foreground">{item.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 max-w-[120px] truncate ${LIST_TAG_COLORS[item.colorIdx]}`}>
                        {item.listName}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
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
          const isTodo = (list.type ?? "shopping") === "todo";
          return (
            <div
              key={list.id}
              onClick={() => onNavigate(list.id)}
              className="group relative bg-card border border-border rounded-xl p-3.5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer flex flex-col gap-2 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-primary/60 to-transparent rounded-t-xl" />

              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold text-sm text-foreground break-words min-w-0 flex-1 leading-tight">{list.name}</h3>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 -mt-1 -mr-1.5">
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

              <div className="flex items-center justify-between gap-2 mt-auto">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                  {isTodo ? <><ListChecks className="w-3 h-3" /> Afazeres</> : <><ShoppingCart className="w-3 h-3" /> Mercado</>}
                </span>
                <span className="flex items-center gap-1 text-primary text-xs font-bold group-hover:gap-1.5 transition-all shrink-0">
                  {isTodo ? "Ver tarefas" : "Ver itens"} <ArrowRight className="w-3 h-3" />
                </span>
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
