"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, use } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { ArrowLeft, Loader2, QrCode, ImageIcon, Link2, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ValidationModal, AIValidationData } from "@/app/components/dashboard/ValidationModal";

type ScanMode = "qr" | "photo" | "url";

export default function ScannerPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const listId = resolvedParams.id;

  const { user, loading } = useAuth();
  const router = useRouter();

  const qrCodeRef = useRef<Html5Qrcode | null>(null);
  const [scanMode, setScanMode] = useState<ScanMode>("qr");
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationData, setValidationData] = useState<AIValidationData | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [emissionDate, setEmissionDate] = useState<string | null>(null);

  // URL mode
  const [urlInput, setUrlInput] = useState("");

  // Photo mode
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Stop QR scanner when switching modes
  useEffect(() => {
    if (scanMode !== "qr" && qrCodeRef.current?.isScanning) {
      qrCodeRef.current.stop().catch(console.error);
    }
  }, [scanMode]);

  const getUserList = useCallback(async () => {
    const { collection, getDocs } = await import("firebase/firestore");
    const { db } = await import("@/lib/firebase");

    const querySnapshot = await getDocs(collection(db, "lists", listId, "items"));
    const userList = querySnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name
    }));

    if (userList.length === 0) {
      throw new Error("Sua lista não tem itens para cruzar com a nota.");
    }

    return userList;
  }, [listId]);

  const runAIMatch = useCallback(async (sefazItems: Array<{ name: string; price: number }>, userList: Array<{ id: string; name: string }>) => {
    const matchRes = await fetch("/api/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userList, sefazList: sefazItems })
    });

    if (!matchRes.ok) throw new Error("Falha ao processar com a IA.");
    return await matchRes.json();
  }, []);

  const processReceiptUrl = useCallback(async (url: string) => {
    setProcessing(true);
    setError(null);

    try {
      const userList = await getUserList();

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

      if (sefazData.emission_date) {
        setEmissionDate(sefazData.emission_date);
      }

      const matchData = await runAIMatch(sefazData.items, userList);

      setValidationData(matchData);
      setProcessing(false);
      setShowModal(true);

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Erro ao processar a nota fiscal.");
      setProcessing(false);
      setScanResult(null);
    }
  }, [getUserList, runAIMatch]);

  const processReceiptPhoto = useCallback(async (file: File) => {
    setProcessing(true);
    setError(null);

    try {
      const userList = await getUserList();

      const formData = new FormData();
      formData.append("image", file);

      const ocrRes = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
      });

      if (!ocrRes.ok) throw new Error("Falha ao ler a imagem da nota fiscal.");
      const ocrData = await ocrRes.json();

      if (ocrData.error) throw new Error(ocrData.error);
      if (!ocrData.items || ocrData.items.length === 0) {
        throw new Error("Nenhum item encontrado na imagem.");
      }

      if (ocrData.emission_date) {
        setEmissionDate(ocrData.emission_date);
      }

      const matchData = await runAIMatch(ocrData.items, userList);

      setValidationData(matchData);
      setProcessing(false);
      setShowModal(true);

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Erro ao processar a imagem.");
      setProcessing(false);
    }
  }, [getUserList, runAIMatch]);

  // QR code scanner
  useEffect(() => {
    if (!user || scanMode !== "qr" || scanResult || processing || showModal) return;

    const qrCode = new Html5Qrcode("reader");
    qrCodeRef.current = qrCode;

    qrCode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        qrCode.stop().catch(console.error);
        setScanResult(decodedText);
        processReceiptUrl(decodedText);
      },
      () => { /* ignore frequent no-QR-found errors */ }
    ).catch((err) => {
      console.error("Camera error:", err);
      setError("Não foi possível acessar a câmera traseira.");
    });

    return () => {
      if (qrCodeRef.current?.isScanning) {
        qrCodeRef.current.stop().catch(console.error);
      }
    };
  }, [user, scanMode, scanResult, processing, showModal, processReceiptUrl]);

  const handleValidationOpenChange = (open: boolean) => {
    setShowModal(open);
    if (!open) {
      setScanResult(null);
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = urlInput.trim();
    if (!url) return;
    setScanResult(url);
    processReceiptUrl(url);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processReceiptPhoto(file);
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleSaveMatches = async (finalMatches: Array<{ user_item_id: string; sefaz_name: string; price: number }>) => {
    try {
      setProcessing(true);
      setShowModal(false);

      const { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp, Timestamp } = await import("firebase/firestore");
      const { db } = await import("@/lib/firebase");

      // Use emission date from the receipt instead of current date
      let dateForLabel: Date;
      if (emissionDate) {
        // emissionDate is "DD/MM/YYYY"
        const [day, month, year] = emissionDate.split("/").map(Number);
        dateForLabel = new Date(year, month - 1, day);
      } else {
        dateForLabel = new Date();
      }
      const dateLabel = dateForLabel.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
        .replace(".", "")
        .replace(/^\d+ de /, (m) => m.replace(" de ", " "))
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

        await addDoc(collection(db, "price_history"), {
          item_id: match.user_item_id,
          sefaz_description: match.sefaz_name,
          price: match.price,
          date: emissionDate ? Timestamp.fromDate(dateForLabel) : serverTimestamp(),
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

  const modeLabels: Record<ScanMode, { icon: React.ReactNode; label: string }> = {
    qr: { icon: <QrCode className="w-4 h-4" />, label: "QR Code" },
    photo: { icon: <ImageIcon className="w-4 h-4" />, label: "Foto" },
    url: { icon: <Link2 className="w-4 h-4" />, label: "Link" },
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10 w-full">
        <div className="w-full max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <Button variant="ghost" size="icon" onClick={() => router.push(`/list/${listId}`)} className="mr-1 shrink-0" disabled={processing}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <span className="font-bold text-xl tracking-tight text-zinc-900 dark:text-zinc-100 truncate w-full">
              Registrar Nota Fiscal
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-md mx-auto px-4 py-6 flex flex-col items-center gap-4">
        {/* Mode selector tabs */}
        {!processing && (
          <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl w-full">
            {(["qr", "photo", "url"] as ScanMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => { setScanMode(mode); setError(null); setScanResult(null); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  scanMode === mode
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                {modeLabels[mode].icon}
                {modeLabels[mode].label}
              </button>
            ))}
          </div>
        )}

        {processing ? (
          <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm w-full">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Processando Nota...</h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-center text-sm">
              {scanMode === "photo"
                ? "Lendo a imagem com IA e identificando os produtos..."
                : "Conectando à SEFAZ e utilizando IA para identificar os produtos..."}
            </p>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center">
            {/* QR Code Mode */}
            {scanMode === "qr" && (
              <>
                <p className="text-zinc-600 dark:text-zinc-300 text-center mb-4 text-sm">
                  Aponte a câmera para o QR Code da nota fiscal eletrônica (NFC-e)
                </p>
                <div
                  id="reader"
                  className="w-full rounded-xl overflow-hidden shadow-sm border border-zinc-200 dark:border-zinc-800"
                />
              </>
            )}

            {/* Photo Mode */}
            {scanMode === "photo" && (
              <div className="w-full space-y-4">
                <p className="text-zinc-600 dark:text-zinc-300 text-center text-sm">
                  Tire uma foto ou escolha da galeria uma imagem da nota fiscal
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoSelect}
                  className="hidden"
                  id="photo-capture"
                />

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.setAttribute("capture", "environment");
                        fileInputRef.current.click();
                      }
                    }}
                    className="flex flex-col items-center gap-3 p-6 bg-white dark:bg-zinc-900 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  >
                    <Camera className="w-8 h-8 text-primary" />
                    <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Tirar Foto</span>
                  </button>

                  <button
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.removeAttribute("capture");
                        fileInputRef.current.click();
                      }
                    }}
                    className="flex flex-col items-center gap-3 p-6 bg-white dark:bg-zinc-900 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  >
                    <ImageIcon className="w-8 h-8 text-primary" />
                    <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Da Galeria</span>
                  </button>
                </div>
              </div>
            )}

            {/* URL Mode */}
            {scanMode === "url" && (
              <div className="w-full space-y-4">
                <p className="text-zinc-600 dark:text-zinc-300 text-center text-sm">
                  Cole o link da nota fiscal eletrônica (NFC-e) abaixo
                </p>

                <form onSubmit={handleUrlSubmit} className="space-y-3">
                  <Input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://www.nfce.fazenda..."
                    className="h-12 text-sm"
                    autoFocus
                  />
                  <Button
                    type="submit"
                    className="w-full h-12 font-bold text-base"
                    disabled={!urlInput.trim()}
                  >
                    <Link2 className="w-4 h-4 mr-2" />
                    Processar Nota Fiscal
                  </Button>
                </form>

                <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center">
                  Dica: copie o link do site da SEFAZ do seu estado ou o link que vem no QR Code da nota
                </p>
              </div>
            )}

            {error && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800 text-sm text-center w-full">
                {error}
                <Button variant="link" className="text-red-700 dark:text-red-400 p-0 h-auto ml-2" onClick={() => { setError(null); setScanResult(null); }}>
                  Tentar Novamente
                </Button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Hidden div for QR reader - needs to exist in DOM */}
      {scanMode !== "qr" && <div id="reader" className="hidden" />}

      <ValidationModal
        open={showModal}
        onOpenChange={handleValidationOpenChange}
        data={validationData}
        onConfirm={handleSaveMatches}
      />
    </div>
  );
}
