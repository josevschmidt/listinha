"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogOut, ArrowLeft, Camera, Send, CheckCircle2, Circle } from "lucide-react";
import { listService, List } from "@/lib/services/listService";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, orderBy } from "firebase/firestore";
import { use } from "react";

interface Item {
  id: string;
  name: string;
  status: "pending" | "bought";
}

export default function ListPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const listId = resolvedParams.id;
  
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  
  const [list, setList] = useState<List | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [pageLoading, setPageLoading] = useState(true);

  // Auth Guard
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Fetch List Details & Items
  useEffect(() => {
    if (!user || !listId) return;

    // Listen to the List Document
    const unsubscribeList = onSnapshot(doc(db, "lists", listId), (docSnapshot) => {
      if (docSnapshot.exists()) {
        setList({ id: docSnapshot.id, ...docSnapshot.data() } as List);
      } else {
        router.push("/dashboard");
      }
    });

    // Listen to the Items Collection
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
    setNewItemName(""); // Optimistic clear
    
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

  if (loading || pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10 w-full">
        <div className="w-full max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden flex-1">
            <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")} className="mr-1 shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <span className="font-bold text-xl tracking-tight text-zinc-900 dark:text-zinc-100 truncate w-full">
              {list?.name}
            </span>
          </div>
          <div className="flex items-center gap-2 pl-4 shrink-0">
            <Button variant="outline" size="sm" onClick={() => router.push(`/list/${listId}/scan`)}>
              <Camera className="w-4 h-4 mr-2" />
              Escanear
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-6 flex flex-col items-stretch">
        {/* Share Code Section */}
        <div className="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 p-3 rounded-lg text-sm flex items-center justify-between mb-6">
          <span>
            Convide pessoas usando o código: <strong className="font-mono bg-white dark:bg-blue-900/50 px-1.5 py-0.5 rounded">{list?.share_code}</strong>
          </span>
        </div>

        {/* Items List */}
        <div className="flex-1 space-y-2 mb-20 overflow-y-auto">
          {items.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 dark:text-zinc-400">
              Nenhum item na lista. Adicione abaixo!
            </div>
          ) : (
            items.map((item) => (
              <div 
                key={item.id} 
                className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                  item.status === "bought" 
                    ? "bg-zinc-100 border-zinc-200 text-zinc-500 dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-zinc-500" 
                    : "bg-white border-zinc-200 text-zinc-900 shadow-sm dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100"
                }`}
              >
                <div 
                  className="flex items-center gap-3 cursor-pointer flex-1 overflow-hidden"
                  onClick={() => toggleItemStatus(item)}
                >
                  {item.status === "bought" ? (
                    <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />
                  ) : (
                    <Circle className="w-6 h-6 text-zinc-300 dark:text-zinc-600 shrink-0" />
                  )}
                  <span className={`truncate text-lg ${item.status === "bought" ? "line-through" : ""}`}>
                    {item.name}
                  </span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0 ml-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteItem(item.id);
                  }}
                >
                  Excluir
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Add Item Form - Fixed at bottom */}
        <form 
          onSubmit={handleAddItem}
          className="bg-zinc-50 dark:bg-zinc-950 p-4 border-t border-zinc-200 dark:border-zinc-800 fixed bottom-0 left-0 right-0 sm:static sm:border sm:rounded-xl sm:shadow-lg sm:mb-4 sm:bg-white dark:sm:bg-zinc-900"
        >
          <div className="w-full max-w-2xl mx-auto flex gap-2">
            <Input 
              placeholder="Adicionar item..." 
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="flex-1 h-12 text-lg"
            />
            <Button type="submit" size="icon" className="h-12 w-12 shrink-0" disabled={!newItemName.trim()}>
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
