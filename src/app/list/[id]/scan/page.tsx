"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, use } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ValidationModal } from "@/app/components/dashboard/ValidationModal";

export default function ScannerPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const listId = resolvedParams.id;

  const { user, loading } = useAuth();
  const router = useRouter();

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationData, setValidationData] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user || scanResult || processing || showModal) return;

    function onScanSuccess(decodedText: string) {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
      setScanResult(decodedText);
      processReceiptUrl(decodedText);
    }

    function onScanFailure(_error: any) {
      // Html5QrcodeScanner fires frequent errors when no QR is visible — ignore them
    }

    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    scannerRef.current = scanner;
    scanner.render(onScanSuccess, onScanFailure);

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, [user, scanResult, processing, showModal]);

  const processReceiptUrl = async (url: string) => {
    setProcessing(true);
    setError(null);

    try {
      const { collection, getDocs, query, where } = await import("firebase/firestore");
      const { db } = await import("@/lib/firebase");

      const q = query(
        collection(db, "lists", listId, "items"),
        where("status", "==", "pending")
      );
      const querySnapshot = await getDocs(q);
      const userList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      }));

      if (userList.length === 0) {
        throw new Error("Sua lista não tem itens pendentes para cruzar com a nota.");
      }

      const sefazRes = await fetch("/api/sefaz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });

      if (!sefazRes.ok) throw new Error("Falha ao extrair dados da nota fiscal.");
      const sefazData = await sefazRes.json();

      if (sefazData.error) throw new Error(sefazData.error);
      if (!sefazData.items || sefazData.items.length === 0) {
        throw new Error("Nenhum item encontrado na nota fiscal.");
      }

      const matchRes = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userList, sefazList: sefazData.items })
      });

      if (!matchRes.ok) throw new Error("Falha ao processar com a IA.");
      const matchData = await matchRes.json();

      setValidationData(matchData);
      setProcessing(false);
      setShowModal(true);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro ao processar a nota fiscal.");
      setProcessing(false);
      setScanResult(null);
    }
  };

  const handleValidationOpenChange = (open: boolean) => {
    setShowModal(open);
    // If the user dismissed the modal without confirming, allow scanning again
    if (!open) {
      setScanResult(null);
    }
  };

  const handleSaveMatches = async (finalMatches: Array<{ user_item_id: string; sefaz_name: string; price: number }>) => {
    try {
      setProcessing(true);
      setShowModal(false);

      const { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } = await import("firebase/firestore");
      const { db } = await import("@/lib/firebase");

      const now = new Date();
      const dateLabel = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
        .replace(".", "")
        .replace(/^\d+ de /, (m) => m.replace(" de ", " "))
        // Format: "15 mar" → "15 Mar"
        .replace(/\b\w/g, c => c.toUpperCase());

      for (const match of finalMatches) {
        const itemRef = doc(db, "lists", listId, "items", match.user_item_id);
        const itemSnap = await getDoc(itemRef);
        const existingData = itemSnap.exists() ? itemSnap.data() : {};

        const existingHistory: { date: string; price: number }[] = existingData.priceHistory ?? [];
        const updatedHistory = [...existingHistory, { date: dateLabel, price: match.price }];
        const averagePrice = updatedHistory.reduce((sum, e) => sum + e.price, 0) / updatedHistory.length;

        await updateDoc(itemRef, {
          status: "bought",
          averagePrice: Math.round(averagePrice * 100) / 100,
          priceHistory: updatedHistory,
        });

        // Keep audit record in root collection
        await addDoc(collection(db, "price_history"), {
          item_id: match.user_item_id,
          sefaz_description: match.sefaz_name,
          price: match.price,
          date: serverTimestamp(),
          list_id: listId
        });
      }

      router.push(`/list/${listId}`);

    } catch (err) {
      console.error("Error saving matches:", err);
      setError("Erro ao salvar os itens.");
      setProcessing(false);
      setScanResult(null);
    }
  };

  if (loading || !user) {
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
          <div className="flex items-center gap-2 flex-1">
            <Button variant="ghost" size="icon" onClick={() => router.push(`/list/${listId}`)} className="mr-1 shrink-0" disabled={processing}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <span className="font-bold text-xl tracking-tight text-zinc-900 dark:text-zinc-100 truncate w-full">
              Ler QR Code
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-md mx-auto px-4 py-8 flex flex-col items-center justify-center">
        {processing ? (
          <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm w-full">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Processando Nota...</h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-center text-sm">
              Conectando à SEFAZ e utilizando IA para identificar os produtos...
            </p>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center">
            <div className="mb-6 text-center">
              <p className="text-zinc-600 dark:text-zinc-300">
                Aponte a câmera para o QR Code da nota fiscal eletrônica (NFC-e)
              </p>
            </div>

            <div
              id="reader"
              className="w-full bg-white dark:bg-zinc-900 rounded-xl overflow-hidden shadow-sm border border-zinc-200 dark:border-zinc-800"
            />

            {error && (
              <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-lg border border-red-200 text-sm text-center w-full">
                {error}
                <Button variant="link" className="text-red-700 p-0 h-auto ml-2" onClick={() => setError(null)}>
                  Tentar Novamente
                </Button>
              </div>
            )}
          </div>
        )}
      </main>

      <ValidationModal
        open={showModal}
        onOpenChange={handleValidationOpenChange}
        data={validationData}
        onConfirm={handleSaveMatches}
      />
    </div>
  );
}
