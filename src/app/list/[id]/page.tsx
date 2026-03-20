"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
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
  LogOut as LogOutIcon,
  Copy,
  CopyCheck,
  Search,
  Users,
  Download,
  Files,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Undo2,
  UserMinus,
  Sparkles,
} from "lucide-react";
import { listService, List, MemberInfo } from "@/lib/services/listService";
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
  orderBy,
} from "firebase/firestore";
import { use } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  "Hortifruti",
  "Carnes",
  "Laticínios",
  "Padaria",
  "Bebidas",
  "Limpeza",
  "Higiene",
  "Mercearia",
  "Congelados",
  "Outros",
] as const;

const UNITS = ["un", "kg", "g", "L", "mL", "dz", "pct"] as const;

const CATEGORY_COLORS: Record<string, string> = {
  Hortifruti: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  Carnes: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  "Laticínios": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  Padaria: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  Bebidas: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Limpeza: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  Higiene: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  Mercearia: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
  Congelados: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  Outros: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Item {
  id: string;
  name: string;
  status: "pending" | "bought";
  quantity?: number;
  unit?: string;
  category?: string;
  averagePrice?: number;
  priceHistory?: { date: string; price: number }[];
}

type SortKey = "default" | "az" | "category" | "price";

interface UndoState {
  item: Item;
  timeoutId: ReturnType<typeof setTimeout>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: listId } = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();

  // Core data
  const [list, setList] = useState<List | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  // List name editing
  const [isEditingListName, setIsEditingListName] = useState(false);
  const [listNameDraft, setListNameDraft] = useState("");
  const [listNameSaving, setListNameSaving] = useState(false);

  // Item filtering / sorting
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("default");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Item modal
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditingItemName, setIsEditingItemName] = useState(false);
  const [itemNameDraft, setItemNameDraft] = useState("");
  const [itemEditLoading, setItemEditLoading] = useState(false);
  // modal field edits
  const [modalQty, setModalQty] = useState<string>("");
  const [modalUnit, setModalUnit] = useState<string>("");
  const [modalCategory, setModalCategory] = useState<string>("");
  const [modalFieldsDirty, setModalFieldsDirty] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);

  // Add item form
  const [newItemName, setNewItemName] = useState("");
  const [showAddExtras, setShowAddExtras] = useState(false);
  const [addQty, setAddQty] = useState("");
  const [addUnit, setAddUnit] = useState("");
  const [addCategory, setAddCategory] = useState("");
  const [aiSuggestedCategory, setAiSuggestedCategory] = useState("");
  const [isCategorizing, setIsCategorizing] = useState(false);

  // Undo
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const undoRef = useRef<UndoState | null>(null);

  // Copy code
  const [codeCopied, setCodeCopied] = useState(false);

  // Menu / dialogs
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  // ── Firestore subscriptions ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !listId) return;

    const unsubList = onSnapshot(doc(db, "lists", listId), (snap) => {
      if (snap.exists()) {
        setList({ id: snap.id, ...snap.data() } as List);
      } else {
        router.push("/dashboard");
      }
    });

    const q = query(collection(db, "lists", listId, "items"), orderBy("created_at", "asc"));
    const unsubItems = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Item[]);
      setPageLoading(false);
    });

    return () => {
      unsubList();
      unsubItems();
    };
  }, [user, listId, router]);

  // ── AI auto-categorize existing uncategorized items ─────────────────────────
  const categorizingRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!listId || !items.length) return;
    const uncategorized = items.filter((i) => !i.category && !categorizingRef.current.has(i.id));
    if (!uncategorized.length) return;

    uncategorized.forEach((item) => {
      categorizingRef.current.add(item.id);
      fetch("/api/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemName: item.name }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.category) {
            updateDoc(doc(db, "lists", listId, "items", item.id), { category: data.category }).catch(console.error);
          }
        })
        .catch(() => {
          // silently ignore — will retry on next load
          categorizingRef.current.delete(item.id);
        });
    });
  }, [items, listId]);

  // ── AI auto-categorize (debounced) ─────────────────────────────────────────
  useEffect(() => {
    if (!newItemName.trim() || addCategory) {
      setAiSuggestedCategory("");
      return;
    }
    const timer = setTimeout(async () => {
      setIsCategorizing(true);
      try {
        const res = await fetch("/api/categorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemName: newItemName.trim() }),
        });
        if (res.ok) {
          const data = await res.json();
          setAiSuggestedCategory(data.category || "");
        }
      } catch {
        // silently ignore
      } finally {
        setIsCategorizing(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [newItemName, addCategory]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const isOwner = list?.owner_id === user?.uid;

  const visibleItems = items
    .filter((item) => undoState?.item.id !== item.id) // hide item pending undo
    .filter((item) => !search || item.name.toLowerCase().includes(search.toLowerCase()))
    .filter((item) => !categoryFilter || item.category === categoryFilter)
    .sort((a, b) => {
      // Always show pending items on top, bought items on bottom
      if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
      if (sortBy === "az") return a.name.localeCompare(b.name, "pt-BR");
      if (sortBy === "category") return (a.category ?? "").localeCompare(b.category ?? "", "pt-BR");
      if (sortBy === "price") return (b.averagePrice ?? 0) - (a.averagePrice ?? 0);
      return 0; // default: insertion order from Firestore
    });

  const pendingCount = visibleItems.filter((i) => i.status === "pending").length;
  const boughtCount = visibleItems.filter((i) => i.status === "bought").length;

  const usedCategories = Array.from(new Set(items.map((i) => i.category).filter(Boolean))) as string[];

  // ── List name editing ───────────────────────────────────────────────────────
  const startEditingListName = () => {
    setListNameDraft(list?.name ?? "");
    setIsEditingListName(true);
  };

  const saveListName = async () => {
    if (!listNameDraft.trim() || listNameDraft.trim() === list?.name) {
      setIsEditingListName(false);
      return;
    }
    setListNameSaving(true);
    await listService.renameList(listId, listNameDraft.trim());
    setListNameSaving(false);
    setIsEditingListName(false);
  };

  // ── Add item ────────────────────────────────────────────────────────────────
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !user) return;
    const name = newItemName.trim();
    const categoryToSave = addCategory || aiSuggestedCategory;
    setNewItemName("");
    setAddQty("");
    setAddUnit("");
    setAddCategory("");
    setAiSuggestedCategory("");
    setShowAddExtras(false);
    try {
      await addDoc(collection(db, "lists", listId, "items"), {
        name,
        status: "pending",
        ...(addQty && !isNaN(Number(addQty)) && { quantity: Number(addQty) }),
        ...(addUnit && { unit: addUnit }),
        ...(categoryToSave && { category: categoryToSave }),
        created_at: serverTimestamp(),
      });
    } catch (err) {
      console.error("Error adding item:", err);
    }
  };

  // ── Toggle status ───────────────────────────────────────────────────────────
  const toggleItemStatus = async (item: Item) => {
    const newStatus = item.status === "pending" ? "bought" : "pending";
    try {
      await updateDoc(doc(db, "lists", listId, "items", item.id), { status: newStatus });
    } catch (err) {
      console.error("Error toggling status:", err);
    }
  };

  // ── Delete item with undo ───────────────────────────────────────────────────
  const deleteItemWithUndo = (item: Item) => {
    // Cancel previous undo if any
    if (undoRef.current) {
      clearTimeout(undoRef.current.timeoutId);
      deleteDoc(doc(db, "lists", listId, "items", undoRef.current.item.id)).catch(console.error);
    }

    const timeoutId = setTimeout(async () => {
      await deleteDoc(doc(db, "lists", listId, "items", item.id)).catch(console.error);
      setUndoState(null);
      undoRef.current = null;
    }, 5000);

    const state: UndoState = { item, timeoutId };
    undoRef.current = state;
    setUndoState(state);
  };

  const handleUndo = async () => {
    if (!undoRef.current) return;
    clearTimeout(undoRef.current.timeoutId);
    // Item is still in Firestore (not yet deleted), just clear visual hide
    setUndoState(null);
    undoRef.current = null;
  };

  // ── Item modal ──────────────────────────────────────────────────────────────
  const openModal = (item: Item) => {
    setSelectedItem(item);
    setItemNameDraft(item.name);
    setIsEditingItemName(false);
    setModalQty(item.quantity != null ? String(item.quantity) : "");
    setModalUnit(item.unit ?? "");
    setModalCategory(item.category ?? "");
    setModalFieldsDirty(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    // Flush pending auto-save immediately
    if (modalFieldsDirty && selectedItem) {
      if (modalSaveTimerRef.current) clearTimeout(modalSaveTimerRef.current);
      saveModalFields(selectedItem.id, modalQty, modalUnit, modalCategory);
    }
    setIsModalOpen(false);
    setSelectedItem(null);
    setIsEditingItemName(false);
    setModalFieldsDirty(false);
  };

  const saveItemName = async () => {
    if (!selectedItem || !itemNameDraft.trim() || itemNameDraft.trim() === selectedItem.name) {
      setIsEditingItemName(false);
      return;
    }
    setItemEditLoading(true);
    try {
      await updateDoc(doc(db, "lists", listId, "items", selectedItem.id), { name: itemNameDraft.trim() });
      setSelectedItem({ ...selectedItem, name: itemNameDraft.trim() });
      setIsEditingItemName(false);
    } catch (err) {
      console.error("Error updating item name:", err);
    } finally {
      setItemEditLoading(false);
    }
  };

  const saveModalFields = useCallback(async (itemId: string, qty: string, unit: string, category: string) => {
    try {
      await updateDoc(doc(db, "lists", listId, "items", itemId), {
        quantity: qty && !isNaN(Number(qty)) ? Number(qty) : null,
        unit: unit || null,
        category: category || null,
      });
    } catch (err) {
      console.error("Error saving modal fields:", err);
    }
  }, [listId]);

  // Auto-save modal fields with debounce
  const modalSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!modalFieldsDirty || !selectedItem) return;
    if (modalSaveTimerRef.current) clearTimeout(modalSaveTimerRef.current);
    const itemId = selectedItem.id;
    modalSaveTimerRef.current = setTimeout(() => {
      setModalSaving(true);
      saveModalFields(itemId, modalQty, modalUnit, modalCategory).finally(() => {
        setModalSaving(false);
        setModalFieldsDirty(false);
      });
    }, 600);
    return () => { if (modalSaveTimerRef.current) clearTimeout(modalSaveTimerRef.current); };
  }, [modalQty, modalUnit, modalCategory, modalFieldsDirty, selectedItem, saveModalFields]);

  // ── Copy share code ─────────────────────────────────────────────────────────
  const copyCode = async () => {
    if (!list?.share_code) return;
    try {
      await navigator.clipboard.writeText(list.share_code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  // ── Export ──────────────────────────────────────────────────────────────────
  const exportList = async () => {
    if (!list) return;
    const pending = items.filter((i) => i.status === "pending");
    const bought = items.filter((i) => i.status === "bought");

    const formatItem = (item: Item) => {
      let line = `• ${item.name}`;
      if (item.quantity != null) line += ` (${item.quantity}${item.unit ? " " + item.unit : ""})`;
      if (item.averagePrice != null) line += ` — Média: R$ ${item.averagePrice.toFixed(2)}`;
      return line;
    };

    let text = `📋 ${list.name}\n`;
    text += `Código: ${list.share_code}\n`;
    text += `─────────────────\n`;
    if (pending.length) {
      text += `\n🛒 A comprar (${pending.length}):\n`;
      text += pending.map(formatItem).join("\n");
    }
    if (bought.length) {
      text += `\n\n✅ Comprados (${bought.length}):\n`;
      text += bought.map(formatItem).join("\n");
    }
    text += `\n\n─────────────────\nExportado pelo Listinha`;

    try {
      if (navigator.share) {
        await navigator.share({ title: list.name, text });
      } else {
        await navigator.clipboard.writeText(text);
        alert("Lista copiada para a área de transferência!");
      }
    } catch {
      // user dismissed share sheet — ignore
    }
  };

  // ── Duplicate list ──────────────────────────────────────────────────────────
  const handleDuplicate = async () => {
    if (!user) return;
    setDuplicating(true);
    const result = await listService.duplicateList(listId, user.uid, user.email ?? "");
    setDuplicating(false);
    if (result.success && result.listId) {
      router.push(`/list/${result.listId}`);
    }
  };

  // ── Members dialog ──────────────────────────────────────────────────────────
  const openMembersDialog = async () => {
    setShowMembersDialog(true);
    setMembersLoading(true);
    const m = await listService.getMembers(listId);
    setMembers(m);
    setMembersLoading(false);
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!user) return;
    setRemovingMember(memberId);
    const result = await listService.removeMember(listId, memberId, user.uid);
    if (result.success) {
      setMembers((prev) => prev.filter((m) => m.uid !== memberId));
    }
    setRemovingMember(null);
  };

  // ── Delete / leave list ─────────────────────────────────────────────────────
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

  // ── Render guards ───────────────────────────────────────────────────────────
  if (loading || pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // ── JSX ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Header ── */}
      <header className="glass border-b sticky top-0 z-20 w-full">
        <div className="w-full max-w-2xl mx-auto px-4 h-16 flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")} className="shrink-0 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>

          {/* Editable list name */}
          {isEditingListName ? (
            <div className="flex items-center gap-1 flex-1 overflow-hidden">
              <Input
                value={listNameDraft}
                onChange={(e) => setListNameDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveListName(); if (e.key === "Escape") setIsEditingListName(false); }}
                className="h-9 text-lg font-bold border-primary/40 flex-1"
                autoFocus
                disabled={listNameSaving}
              />
              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={saveListName} disabled={listNameSaving}>
                <Check className="w-4 h-4 text-primary" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setIsEditingListName(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <button
              className="flex items-center gap-1.5 flex-1 overflow-hidden text-left group"
              onClick={startEditingListName}
              title="Clique para renomear"
            >
              <span className="font-bold text-xl tracking-tight text-foreground truncate">{list?.name}</span>
              <Pencil className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 group-hover:text-muted-foreground transition-colors" />
            </button>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="outline" size="sm" onClick={() => router.push(`/list/${listId}/scan`)} className="rounded-full font-bold border-2 hidden sm:flex">
              <Camera className="w-4 h-4 mr-1.5" />
              Escanear
            </Button>
            <Button variant="outline" size="icon" onClick={() => router.push(`/list/${listId}/scan`)} className="rounded-full sm:hidden h-8 w-8">
              <Camera className="w-4 h-4" />
            </Button>

            {/* Menu */}
            <div className="relative">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground" onClick={() => setShowMenu(!showMenu)}>
                <MoreVertical className="w-4 h-4" />
              </Button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-40 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[200px]">
                    <MenuButton icon={<Users className="w-4 h-4" />} label="Gerenciar membros" onClick={() => { setShowMenu(false); openMembersDialog(); }} />
                    <MenuButton icon={<Files className="w-4 h-4" />} label={duplicating ? "Duplicando..." : "Duplicar lista"} onClick={() => { setShowMenu(false); handleDuplicate(); }} disabled={duplicating} />
                    <MenuButton icon={<Download className="w-4 h-4" />} label="Exportar lista" onClick={() => { setShowMenu(false); exportList(); }} />
                    <div className="h-px bg-border my-1" />
                    <MenuButton
                      icon={isOwner ? <Trash2 className="w-4 h-4" /> : <LogOutIcon className="w-4 h-4" />}
                      label={isOwner ? "Excluir lista" : "Sair da lista"}
                      onClick={() => { setShowMenu(false); setShowDeleteConfirm(true); }}
                      danger
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-4 flex flex-col gap-3">

        {/* ── Share code ── */}
        <div className="bg-primary/10 text-primary px-4 py-3 rounded-2xl text-sm flex items-center justify-between border border-primary/20">
          <span className="font-medium">
            Código: <strong className="font-mono bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded-lg ml-1">{list?.share_code}</strong>
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-primary/20" onClick={copyCode}>
            {codeCopied ? <CopyCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>

        {/* ── Search & sort bar ── */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar itens..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
            {search && (
              <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearch("")}>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Button
            variant={showFilters ? "secondary" : "outline"}
            size="sm"
            className="h-9 px-3 shrink-0 gap-1.5"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold hidden xs:inline">Filtros</span>
          </Button>
        </div>

        {/* ── Filters panel ── */}
        {showFilters && (
          <div className="bg-card border border-border rounded-2xl p-3 space-y-3">
            {/* Sort */}
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Ordenar por</p>
              <div className="flex flex-wrap gap-1.5">
                {(["default", "az", "category", "price"] as SortKey[]).map((key) => {
                  const labels: Record<SortKey, string> = { default: "Padrão", az: "A–Z", category: "Categoria", price: "Preço médio" };
                  return (
                    <button
                      key={key}
                      onClick={() => setSortBy(key)}
                      className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                        sortBy === key ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/40"
                      }`}
                    >
                      {labels[key]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Category filter */}
            {usedCategories.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Filtrar por categoria</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setCategoryFilter(null)}
                    className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                      !categoryFilter ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/40"
                    }`}
                  >
                    Todas
                  </button>
                  {usedCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat === categoryFilter ? null : cat)}
                      className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                        categoryFilter === cat ? "bg-primary text-primary-foreground border-primary" : `${CATEGORY_COLORS[cat] || "bg-muted text-muted-foreground"} border-transparent`
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Item count summary ── */}
        {items.length > 0 && (
          <div className="flex items-center gap-3 px-1">
            <span className="text-xs text-muted-foreground font-medium">{pendingCount} pendente{pendingCount !== 1 ? "s" : ""}</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-xs text-primary font-bold">{boughtCount} comprado{boughtCount !== 1 ? "s" : ""}</span>
            {(search || categoryFilter) && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-xs text-muted-foreground">{visibleItems.length} exibido{visibleItems.length !== 1 ? "s" : ""}</span>
              </>
            )}
          </div>
        )}

        {/* ── Items list ── */}
        <div className="flex-1 space-y-2 mb-44">
          {visibleItems.length === 0 && items.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-muted-foreground/30" />
              </div>
              <p className="text-base font-medium">Nenhum item ainda.<br />Adicione seu primeiro item abaixo!</p>
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-sm font-medium">Nenhum item encontrado para "<strong>{search || categoryFilter}</strong>".</p>
            </div>
          ) : (
            visibleItems.map((item) => (
              <div
                key={item.id}
                className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200 ${
                  item.status === "bought"
                    ? "bg-muted/20 border-transparent text-muted-foreground opacity-60 scale-[0.99]"
                    : "bg-card border-border/50 hover:border-primary/30 shadow-sm active:scale-[0.99]"
                }`}
              >
                <div className="flex items-center gap-3 cursor-pointer flex-1 overflow-hidden" onClick={() => toggleItemStatus(item)}>
                  {/* Checkbox */}
                  <div className="shrink-0">
                    {item.status === "bought" ? (
                      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/20 hover:border-primary/40" />
                    )}
                  </div>

                  {/* Name + meta */}
                  <div className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-base font-semibold truncate ${item.status === "bought" ? "line-through opacity-50" : ""}`}>
                        {item.name}
                      </span>
                      {item.quantity != null && (
                        <span className="text-xs text-muted-foreground font-medium shrink-0">
                          {item.quantity}{item.unit ? " " + item.unit : "×"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {item.category && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[item.category] || "bg-muted text-muted-foreground"}`}>
                          {item.category}
                        </span>
                      )}
                      {item.averagePrice != null && (
                        <span className="text-[10px] font-bold text-primary/70 uppercase tracking-tight">
                          Média: R$ {item.averagePrice.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground/40 hover:text-primary hover:bg-primary/10 shrink-0 rounded-full"
                  onClick={(e) => { e.stopPropagation(); openModal(item); }}
                >
                  <Info className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </main>

      {/* ── Undo toast ── */}
      {undoState && (
        <div className="fixed bottom-[7.5rem] left-0 right-0 flex justify-center z-30 pointer-events-none px-4">
          <div className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl pointer-events-auto max-w-sm w-full">
            <Trash2 className="w-4 h-4 shrink-0 opacity-60" />
            <span className="text-sm font-medium flex-1 truncate">"{undoState.item.name}" excluído</span>
            <button className="text-sm font-bold text-primary dark:text-primary shrink-0 flex items-center gap-1" onClick={handleUndo}>
              <Undo2 className="w-3.5 h-3.5" /> Desfazer
            </button>
          </div>
        </div>
      )}

      {/* ── Add item form (fixed at bottom) ── */}
      <div className="fixed bottom-0 left-0 right-0 z-10 pointer-events-none px-4 pb-[max(1rem,env(safe-area-inset-bottom,1rem))] pt-4 bg-gradient-to-t from-background via-background/95 to-transparent">
        <form onSubmit={handleAddItem} className="w-full max-w-2xl mx-auto pointer-events-auto space-y-2">
          {/* Optional extras */}
          {showAddExtras && (
            <div className="glass border rounded-2xl px-3 py-2.5 flex flex-wrap gap-2 items-center shadow-md">
              {/* Quantity */}
              <input
                type="number"
                min="0"
                step="any"
                value={addQty}
                onChange={(e) => setAddQty(e.target.value)}
                placeholder="Qtd"
                className="h-8 w-16 px-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary/60"
              />
              {/* Unit */}
              <div className="flex flex-wrap gap-1">
                {UNITS.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setAddUnit(addUnit === u ? "" : u)}
                    className={`h-8 px-2.5 text-xs font-bold rounded-lg border transition-colors ${
                      addUnit === u ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
              {/* Category */}
              <div className="flex flex-wrap gap-1 border-t border-border/50 w-full pt-2 mt-1">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setAddCategory(addCategory === cat ? "" : cat)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-full border transition-colors ${
                      addCategory === cat ? "bg-primary text-primary-foreground border-primary" : `${CATEGORY_COLORS[cat] || "bg-muted text-muted-foreground"} border-transparent`
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* AI category suggestion */}
          {(isCategorizing || aiSuggestedCategory) && !addCategory && (
            <div className="flex items-center gap-1.5 px-3 py-1">
              <Sparkles className="w-3.5 h-3.5 text-primary/60 shrink-0" />
              {isCategorizing ? (
                <span className="text-xs text-muted-foreground">Categorizando...</span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setAddCategory(aiSuggestedCategory)}
                    className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border border-transparent transition-all hover:opacity-80 ${CATEGORY_COLORS[aiSuggestedCategory] || "bg-muted text-muted-foreground"}`}
                  >
                    {aiSuggestedCategory}
                  </button>
                  <span className="text-[10px] text-muted-foreground">sugestão IA</span>
                </>
              )}
            </div>
          )}

          {/* Main input row */}
          <div className="glass p-2 rounded-3xl premium-shadow flex gap-2 border shadow-2xl">
            <button
              type="button"
              onClick={() => setShowAddExtras(!showAddExtras)}
              className="h-14 w-10 shrink-0 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors rounded-xl"
              title="Mais opções"
            >
              {showAddExtras ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
            </button>
            <Input
              placeholder="Adicionar item..."
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="flex-1 h-14 text-lg border-none bg-transparent focus-visible:ring-0 px-1"
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

      {/* ── Item Detail Modal ── */}
      <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogContent className="sm:max-w-[420px] rounded-[2rem] p-0 overflow-hidden border-none premium-shadow">
          {/* Header */}
          <DialogHeader className="p-6 pb-4 bg-primary text-primary-foreground">
            {isEditingItemName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={itemNameDraft}
                  onChange={(e) => setItemNameDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveItemName(); if (e.key === "Escape") setIsEditingItemName(false); }}
                  className="text-xl font-bold bg-white/20 border-white/30 text-primary-foreground placeholder:text-primary-foreground/50 focus-visible:ring-white/50 h-10"
                  autoFocus
                  disabled={itemEditLoading}
                />
                <Button size="icon" variant="ghost" className="shrink-0 text-primary-foreground hover:bg-white/20 h-9 w-9" onClick={saveItemName} disabled={itemEditLoading}>
                  <Check className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="shrink-0 text-primary-foreground hover:bg-white/20 h-9 w-9" onClick={() => setIsEditingItemName(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <DialogTitle className="text-2xl font-bold truncate">{selectedItem?.name}</DialogTitle>
                <Button size="icon" variant="ghost" className="shrink-0 text-primary-foreground hover:bg-white/20 h-8 w-8 mt-0.5" onClick={() => { setItemNameDraft(selectedItem?.name ?? ""); setIsEditingItemName(true); }}>
                  <Pencil className="w-4 h-4" />
                </Button>
              </div>
            )}
            <DialogDescription className="text-primary-foreground/80 font-medium">
              {selectedItem?.category && <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mr-2 ${CATEGORY_COLORS[selectedItem.category] || ""}`}>{selectedItem.category}</span>}
              Detalhes e histórico de preços
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 space-y-5 overflow-y-auto max-h-[70vh]">
            {/* Qty / Unit / Category editors */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Quantidade e categoria</p>
              <div className="flex gap-2 flex-wrap">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={modalQty}
                  onChange={(e) => { setModalQty(e.target.value); setModalFieldsDirty(true); }}
                  placeholder="Qtd"
                  className="h-8 w-16 px-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary/60"
                />
                {UNITS.map((u) => (
                  <button
                    key={u}
                    onClick={() => { setModalUnit(modalUnit === u ? "" : u); setModalFieldsDirty(true); }}
                    className={`h-8 px-2.5 text-xs font-bold rounded-lg border transition-colors ${
                      modalUnit === u ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => { setModalCategory(""); setModalFieldsDirty(true); }}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-full border transition-colors ${!modalCategory ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background text-muted-foreground hover:border-primary/40"}`}
                >
                  Sem categoria
                </button>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => { setModalCategory(cat === modalCategory ? "" : cat); setModalFieldsDirty(true); }}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-full border transition-colors ${
                      modalCategory === cat ? "bg-primary text-primary-foreground border-primary" : `${CATEGORY_COLORS[cat] || "bg-muted text-muted-foreground"} border-transparent`
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              {(modalFieldsDirty || modalSaving) && (
                <span className="text-[11px] text-muted-foreground italic">
                  {modalSaving ? "Salvando..." : "Salvo automaticamente"}
                </span>
              )}
            </div>

            {/* Price data */}
            {selectedItem?.averagePrice != null ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-primary/5 p-3 rounded-2xl border border-primary/10">
                  <div className="text-[10px] font-bold text-primary/60 uppercase mb-1">Preço Médio</div>
                  <div className="text-xl font-black text-primary">R$ {selectedItem.averagePrice.toFixed(2)}</div>
                </div>
                {selectedItem.priceHistory && selectedItem.priceHistory.length > 0 && (
                  <div className="bg-green-500/5 p-3 rounded-2xl border border-green-500/10">
                    <div className="text-[10px] font-bold text-green-600/60 uppercase mb-1">Última Compra</div>
                    <div className="text-xl font-black text-green-600">
                      R$ {selectedItem.priceHistory[selectedItem.priceHistory.length - 1].price.toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-muted/30 p-3 rounded-2xl text-sm text-muted-foreground text-center">
                Nenhum dado de preço ainda.
              </div>
            )}

            {/* Price history */}
            {selectedItem?.priceHistory && selectedItem.priceHistory.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <TrendingUp className="w-3 h-3" /> Histórico Recente
                </h4>
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                  {selectedItem.priceHistory.map((entry, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1.5 border-b border-muted/50 last:border-0">
                      <span className="text-sm text-muted-foreground">{entry.date}</span>
                      <span className="text-sm font-bold">R$ {entry.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <Button className="flex-1 h-11 rounded-xl font-bold" onClick={closeModal}>Fechar</Button>
              <Button
                variant="ghost"
                className="h-11 w-11 rounded-xl text-destructive hover:bg-destructive/10"
                onClick={() => {
                  if (selectedItem) {
                    deleteItemWithUndo(selectedItem);
                    closeModal();
                  }
                }}
              >
                <Trash2 className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete/Leave confirmation ── */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>{isOwner ? "Excluir lista" : "Sair da lista"}</DialogTitle>
            <DialogDescription>
              {isOwner
                ? `Tem certeza que deseja excluir "${list?.name}"? Todos os itens serão removidos permanentemente.`
                : `Tem certeza que deseja sair de "${list?.name}"? Você precisará do código para entrar novamente.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleteLoading}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteOrLeaveList} disabled={deleteLoading}>
              {deleteLoading ? "Aguarde..." : isOwner ? "Excluir" : "Sair"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Members dialog ── */}
      <Dialog open={showMembersDialog} onOpenChange={setShowMembersDialog}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" /> Membros da lista
            </DialogTitle>
            <DialogDescription>
              {isOwner ? "Como dono, você pode remover membros." : "Pessoas com acesso a esta lista."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-[50vh] overflow-y-auto">
            {membersLoading ? (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : members.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum membro encontrado.</p>
            ) : (
              members.map((member) => (
                <div key={member.uid} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-border bg-card">
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-sm font-semibold truncate">
                      {member.email || `Usuário (${member.uid.slice(0, 8)}…)`}
                    </span>
                    {member.uid === list?.owner_id && (
                      <span className="text-[10px] font-bold text-primary/70 uppercase">Dono</span>
                    )}
                  </div>
                  {isOwner && member.uid !== list?.owner_id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => handleRemoveMember(member.uid)}
                      disabled={removingMember === member.uid}
                    >
                      {removingMember === member.uid
                        ? <div className="w-3.5 h-3.5 rounded-full border-2 border-destructive border-t-transparent animate-spin" />
                        : <UserMinus className="w-3.5 h-3.5" />}
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground">Código: <strong className="font-mono">{list?.share_code}</strong></span>
            <Button size="sm" variant="outline" onClick={copyCode} className="h-8 text-xs gap-1.5">
              {codeCopied ? <CopyCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              Copiar código
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

// ─── Helper ────────────────────────────────────────────────────────────────────
function MenuButton({
  icon,
  label,
  onClick,
  danger,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      className={`w-full px-4 py-2.5 text-sm text-left flex items-center gap-2.5 transition-colors disabled:opacity-50 ${
        danger ? "text-destructive hover:bg-destructive/10" : "text-foreground hover:bg-muted"
      }`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
      {label}
    </button>
  );
}
