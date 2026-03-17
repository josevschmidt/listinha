"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, ArrowRight } from "lucide-react";
import { CreateListDialog } from "@/app/components/dashboard/CreateListDialog";
import { JoinListDialog } from "@/app/components/dashboard/JoinListDialog";
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

    // Subscribe to all lists where the user is a member (owned + shared)
    const unsubscribe = listService.subscribeToMemberLists(user.uid, (fetchedLists) => {
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

  const ownedLists = lists.filter(l => l.owner_id === user.uid);
  const sharedLists = lists.filter(l => l.owner_id !== user.uid);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="glass border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl">
              L
            </div>
            <span className="font-bold text-xl tracking-tight text-foreground">
              Listinha
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-sm text-muted-foreground font-medium">
              {user.email}
            </div>
            <Button variant="ghost" size="icon" onClick={logout} title="Sair" className="rounded-full hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-5 py-8 space-y-8">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Suas Listas
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm sm:text-lg">
              Gerencie suas compras e acompanhe os preços com inteligência.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <JoinListDialog />
            <CreateListDialog />
          </div>
        </div>

        {listsLoading ? (
          <div className="flex justify-center p-12">
            <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
          </div>
        ) : (
          <>
            <ListGrid lists={ownedLists} onNavigate={(id) => router.push(`/list/${id}`)} emptyMessage="Você ainda não possui nenhuma lista." />

            {sharedLists.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-foreground">Listas Compartilhadas</h2>
                <ListGrid lists={sharedLists} onNavigate={(id) => router.push(`/list/${id}`)} emptyMessage="" />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function ListGrid({ lists, onNavigate, emptyMessage }: { lists: List[]; onNavigate: (id: string) => void; emptyMessage: string }) {
  if (lists.length === 0 && emptyMessage) {
    return (
      <div className="col-span-full py-16 text-center border-2 border-dashed border-muted rounded-3xl bg-muted/20">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {lists.map((list) => (
        <div
          key={list.id}
          onClick={() => onNavigate(list.id)}
          className="group relative bg-card card-gradient border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col h-full overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <ArrowRight className="w-12 h-12" />
          </div>
          <h3 className="font-bold text-lg text-foreground mb-2 truncate pr-8">
            {list.name}
          </h3>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Código</span>
            <span className="font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-lg text-xs font-semibold">{list.share_code}</span>
          </div>
          <div className="mt-auto flex items-center gap-1 text-primary text-sm font-bold group-hover:gap-2 transition-all">
            Visualizar itens <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      ))}
    </div>
  );
}
