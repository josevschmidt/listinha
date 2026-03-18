"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Camera,
  Send,
  CheckCircle2,
  Info,
  Trash2,
  TrendingUp,
  Pencil,
  Check,
  X,
  MoreVertical,
  LogOut as LogOutIcon
} from "lucide-react";
import { listService, List } from "@/lib/services/listService";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  addDoc,
  serverTimestamp,
  updateDoc,
  doc,
  deleteDoc,
  orderBy
} from "firebase/firestore";
import { use } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Item {
  id: string;
  name: string;
  status: "pending" | "bought";
  averagePrice?: number;
  priceHistory?: { date: string; price: number }[];
}

export default function ListPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const listId = resolvedParams.id;

  const { user, loading } = useAuth();
  const router = useRouter();

  const [list, setList] = useState<List | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Auth Guard
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Fetch List Details & Items
  useEffect(() => {
    if (!user || !listId) return;

    const unsubscribeList = onSnapshot(doc(db, "lists", listId), (docSnapshot) => {
      if (docSnapshot.exists()) {
        setList({ id: docSnapshot.id, ...docSnapshot.data() } as List);
      } else {
        router.push("/dashboard");
      }
    });

    const q = query(collection(db, "lists", listId, "items"), orderBy("created_at", "asc"));
    const unsubscribeItems = onSnapshot(q, (snapshot) => {
      const fetchedItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Item[];
      setItems(fetchedItems);
      setPageLoading(false);
    });

    return () => {
      unsubscribeList();
      unsubscribeItems();
    };
  }, [user, listId, router]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !user) return;

    const name = newItemName.trim();
    setNewItemName("");

    try {
      await addDoc(collection(db, "lists", listId, "items"), {
        name,
        status: "pending",
        created_at: serverTimestamp()
      });
    } catch (error) {
      console.error("Error adding item:", error);
    }
  };

  const toggleItemStatus = async (item: Item) => {
    const newStatus = item.status === "pending" ? "bought" : "pending";
    try {
      await updateDoc(doc(db, "lists", listId, "items", item.id), {
        status: newStatus
      });
    } catch (error) {
      console.error("Error toggling item status:", error);
    }
  };

  const deleteItem = async (itemId: string) => {
    try {
      await deleteDoc(doc(db, "lists", listId, "items", itemId));
    } catch (error) {
      console.error("Error deleting item:", error);
    }
  };

  const startEditing = () => {
    setEditingName(selectedItem?.name ?? "");
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditingName("");
  };

  const saveItemName = async () => {
    if (!selectedItem || !editingName.trim() || editingName.trim() === selectedItem.name) {
      cancelEditing();
      return;
    }

    setEditLoading(true);
    try {
      await updateDoc(doc(db, "lists", listId, "items", selectedItem.id), {
        name: editingName.trim()
      });
      setSelectedItem({ ...selectedItem, name: editingName.trim() });
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating item name:", error);
    } finally {
      setEditLoading(false);
    }
  };

  const isOwner = list?.owner_id === user?.uid;

  const handleDeleteOrLeaveList = async () => {
    if (!user || !list) return;
    setDeleteLoading(true);
    const result = isOwner
      ? await listService.deleteList(listId, user.uid)
      : await listService.leaveList(listId, user.uid);

    if (result.success) {
      router.push("/dashboard");
    } else {
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const openModal = (item: Item) => {
    setSelectedItem(item);
    setIsEditing(false);
    setEditingName("");
    setIsModalOpen(true);
  };

  if (loading || pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="glass border-b sticky top-0 z-20 w-full">
        <div className="w-full max-w-2xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden flex-1">
            <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")} className="mr-1 shrink-0 rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <span className="font-bold text-2xl tracking-tight text-foreground truncate w-full">
              {list?.name}
            </span>
          </div>
          <div className="flex items-center gap-2 pl-4 shrink-0">
            <Button variant="outline" size="sm" onClick={() => router.push(`/list/${listId}/scan`)} className="rounded-full font-bold border-2">
              <Camera className="w-4 h-4 mr-2" />
              Escanear
            </Button>
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-muted-foreground"
                onClick={() => setShowMenu(!showMenu)}
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-40 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[180px]">
                    <button
                      className="w-full px-4 py-2.5 text-sm text-left flex items-center gap-2.5 text-destructive hover:bg-destructive/10 transition-colors"
                      onClick={() => {
                        setShowMenu(false);
                        setShowDeleteConfirm(true);
                      }}
                    >
                      {isOwner ? <Trash2 className="w-4 h-4" /> : <LogOutIcon className="w-4 h-4" />}
                      {isOwner ? "Excluir lista" : "Sair da lista"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-5 py-6 flex flex-col items-stretch">
        {/* Share Code Section */}
        <div className="bg-primary/10 text-primary p-4 rounded-2xl text-sm flex items-center justify-between mb-6 border border-primary/20">
          <span className="font-medium">
            Convide pessoas usando o código: <strong className="font-mono bg-white/50 dark:bg-black/20 px-2 py-1 rounded-lg ml-1">{list?.share_code}</strong>
          </span>
        </div>

        {/* Items List */}
        <div className="flex-1 space-y-2 mb-28 overflow-y-auto">
          {items.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center text-muted-foreground/30">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <p className="text-lg font-medium">Nenhum item na lista. <br/>Adicione seu primeiro item abaixo!</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className={`flex items-center justify-between p-3 px-4 rounded-xl border transition-all duration-200 ${
                  item.status === "bought"
                    ? "bg-muted/20 border-transparent text-muted-foreground opacity-60 scale-[0.99]"
                    : "bg-card border-border/50 text-foreground hover:border-primary/30 shadow-sm active:scale-[0.99]"
                }`}
              >
                <div
                  className="flex items-center gap-3 cursor-pointer flex-1 overflow-hidden"
                  onClick={() => toggleItemStatus(item)}
                >
                  <div className={`transition-transform duration-300 ${item.status === "bought" ? "scale-90" : ""}`}>
                    {item.status === "bought" ? (
                      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/20 hover:border-primary/40" />
                    )}
                  </div>
                  <div className="flex flex-col flex-1 overflow-hidden">
                    <span className={`truncate text-base font-semibold transition-all ${item.status === "bought" ? "line-through opacity-50" : ""}`}>
                      {item.name}
                    </span>
                    {item.averagePrice != null && (
                      <span className="text-[10px] font-bold text-primary/70 uppercase tracking-tight">
                        Média: R$ {item.averagePrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground/40 hover:text-primary hover:bg-primary/10 shrink-0 ml-1 rounded-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    openModal(item);
                  }}
                >
                  <Info className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Item Details Modal */}
        <Dialog open={isModalOpen} onOpenChange={(open) => { setIsModalOpen(open); if (!open) { cancelEditing(); setSelectedItem(null); } }}>
          <DialogContent className="sm:max-w-[400px] rounded-[2rem] p-0 overflow-hidden border-none premium-shadow">
            <DialogHeader className="p-6 pb-4 bg-primary text-primary-foreground">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveItemName(); if (e.key === "Escape") cancelEditing(); }}
                    className="text-xl font-bold bg-white/20 border-white/30 text-primary-foreground placeholder:text-primary-foreground/50 focus-visible:ring-white/50 h-10"
                    autoFocus
                    disabled={editLoading}
                  />
                  <Button size="icon" variant="ghost" className="shrink-0 text-primary-foreground hover:bg-white/20 h-9 w-9" onClick={saveItemName} disabled={editLoading}>
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="shrink-0 text-primary-foreground hover:bg-white/20 h-9 w-9" onClick={cancelEditing} disabled={editLoading}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <DialogTitle className="text-2xl font-bold truncate">
                    {selectedItem?.name}
                  </DialogTitle>
                  <Button size="icon" variant="ghost" className="shrink-0 text-primary-foreground hover:bg-white/20 h-8 w-8 mt-0.5" onClick={startEditing}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                </div>
              )}
              <DialogDescription className="text-primary-foreground/80 font-medium">
                Resumo e histórico de preços
              </DialogDescription>
            </DialogHeader>

            <div className="p-6 space-y-6">
              {selectedItem?.averagePrice != null ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
                    <div className="text-[10px] font-bold text-primary/60 uppercase mb-1">Preço Médio</div>
                    <div className="text-xl font-black text-primary">
                      R$ {selectedItem.averagePrice.toFixed(2)}
                    </div>
                  </div>
                  {selectedItem.priceHistory && selectedItem.priceHistory.length > 0 && (
                    <div className="bg-green-500/5 p-4 rounded-2xl border border-green-500/10">
                      <div className="text-[10px] font-bold text-green-600/60 uppercase mb-1">Última Compra</div>
                      <div className="text-xl font-black text-green-600">
                        R$ {selectedItem.priceHistory[selectedItem.priceHistory.length - 1].price.toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-muted/30 p-4 rounded-2xl text-sm text-muted-foreground text-center">
                  Nenhum dado de preço disponível ainda.
                </div>
              )}

              {selectedItem?.priceHistory && selectedItem.priceHistory.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <TrendingUp className="w-3 h-3" /> Histórico Recente
                  </h4>
                  <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2">
                    {selectedItem.priceHistory.map((entry, idx) => (
                      <div key={idx} className="flex items-center justify-between py-2 border-b border-muted/50 last:border-0">
                        <span className="text-sm font-medium text-muted-foreground">{entry.date}</span>
                        <span className="text-sm font-bold text-foreground">R$ {entry.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <Button
                  className="flex-1 h-12 rounded-xl font-bold"
                  onClick={() => setIsModalOpen(false)}
                >
                  Fechar
                </Button>
                <Button
                  variant="ghost"
                  className="h-12 w-12 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => {
                    if (selectedItem) {
                      deleteItem(selectedItem.id);
                      setIsModalOpen(false);
                    }
                  }}
                >
                  <Trash2 className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete/Leave Confirmation Dialog */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="sm:max-w-[400px] rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg">
                {isOwner ? "Excluir lista" : "Sair da lista"}
              </DialogTitle>
              <DialogDescription>
                {isOwner
                  ? `Tem certeza que deseja excluir "${list?.name}"? Todos os itens serão removidos permanentemente.`
                  : `Tem certeza que deseja sair da lista "${list?.name}"? Você precisará do código de convite para entrar novamente.`}
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleteLoading}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDeleteOrLeaveList} disabled={deleteLoading}>
                {deleteLoading ? "Aguarde..." : isOwner ? "Excluir" : "Sair"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Item Form - Fixed at bottom */}
        <div className="fixed bottom-0 left-0 right-0 px-5 pt-6 pb-[max(1.25rem,env(safe-area-inset-bottom,1.25rem))] bg-gradient-to-t from-background via-background/95 to-transparent z-10 pointer-events-none">
          <form
            onSubmit={handleAddItem}
            className="w-full max-w-2xl mx-auto pointer-events-auto px-0"
          >
            <div className="glass p-2 rounded-3xl premium-shadow flex gap-2 border shadow-2xl">
              <Input
                placeholder="Adicionar item..."
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="flex-1 h-14 text-lg border-none bg-transparent focus-visible:ring-0 px-4"
              />
              <Button
                type="submit"
                size="icon"
                className="h-14 w-14 shrink-0 rounded-2xl shadow-lg transition-transform active:scale-95"
                disabled={!newItemName.trim()}
              >
                <Send className="w-6 h-6" />
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
