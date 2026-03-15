"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, ArrowRight } from "lucide-react";
import { CreateListDialog } from "@/app/components/dashboard/CreateListDialog";
import { listService, List } from "@/lib/services/listService";

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [lists, setLists] = useState<List[]>([]);
  const [listsLoading, setListsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    // Subscribe to lists where the user is the owner
    const unsubscribe = listService.subscribeToOwnedLists(user.uid, (fetchedLists) => {
      // Sort by creation date (newest first)
      const sortedLists = fetchedLists.sort((a, b) => {
        const timeA = a.created_at ? ("seconds" in a.created_at ? a.created_at.seconds : a.created_at.getTime()) : 0;
        const timeB = b.created_at ? ("seconds" in b.created_at ? b.created_at.seconds : b.created_at.getTime()) : 0;
        return timeB - timeA;
      });
      setLists(sortedLists);
      setListsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xl tracking-tight text-zinc-900 dark:text-zinc-100">
              Listinha
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-sm text-zinc-500 dark:text-zinc-400">
              {user.email}
            </div>
            <Button variant="ghost" size="icon" onClick={logout} title="Sair">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 space-y-8">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Suas Listas
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
              Gerencie suas compras e acompanhe os preços.
            </p>
          </div>
          <CreateListDialog />
        </div>

        {listsLoading ? (
          <div className="flex justify-center p-12">
            <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {lists.length === 0 ? (
              <div className="col-span-full py-12 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/50">
                <p className="text-zinc-500 dark:text-zinc-400">Você ainda não possui nenhuma lista.</p>
              </div>
            ) : (
              lists.map((list) => (
                <div 
                  key={list.id} 
                  onClick={() => router.push(`/list/${list.id}`)}
                  className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer flex flex-col h-full"
                >
                  <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100 mb-1 truncate">
                    {list.name}
                  </h3>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                    Código: <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-xs">{list.share_code}</span>
                  </div>
                  <div className="mt-auto flex items-center text-primary text-sm font-medium group-hover:translate-x-1 transition-transform w-fit">
                    Abrir Lista <ArrowRight className="w-4 h-4 ml-1" />
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
