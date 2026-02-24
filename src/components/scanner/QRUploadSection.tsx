import { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { QrCode, RefreshCw, Loader2, Smartphone, Check } from "lucide-react";

interface QRUploadSectionProps {
  onImageReceived: (imageUrl: string, file: File) => void;
}

export function QRUploadSection({ onImageReceived }: QRUploadSectionProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [received, setReceived] = useState(false);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  const createSession = useCallback(async () => {
    if (!user) return;
    setIsCreating(true);
    setReceived(false);

    try {
      const code = crypto.randomUUID().replace(/-/g, "").slice(0, 12);

      const { error } = await supabase.from("receipt_upload_sessions").insert({
        session_code: code,
        user_id: user.id,
        status: "pending",
      });

      if (error) throw error;

      setSessionCode(code);
      const expires = new Date(Date.now() + 15 * 60 * 1000);
      setExpiresAt(expires);

      // Build the QR URL using the published URL
      const baseUrl = window.location.origin;
      setQrUrl(`${baseUrl}/mobile-upload?code=${code}`);
    } catch (err) {
      console.error("Error creating session:", err);
    } finally {
      setIsCreating(false);
    }
  }, [user]);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setTimeLeft(diff);
      if (diff <= 0) {
        setSessionCode(null);
        setQrUrl(null);
        setExpiresAt(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  // Listen for realtime updates
  useEffect(() => {
    if (!sessionCode) return;

    const channel = supabase
      .channel(`receipt-upload-${sessionCode}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "receipt_upload_sessions",
          filter: `session_code=eq.${sessionCode}`,
        },
        async (payload) => {
          const updated = payload.new as any;
          if (updated.status === "uploaded" && updated.image_path) {
            setReceived(true);

            // Download the image and pass it to parent
            const { data } = supabase.storage
              .from("receipt-uploads")
              .getPublicUrl(updated.image_path);

            if (data?.publicUrl) {
              try {
                const response = await fetch(data.publicUrl);
                const blob = await response.blob();
                const file = new File([blob], "mobile-receipt.jpg", { type: blob.type });
                onImageReceived(data.publicUrl, file);
              } catch (err) {
                console.error("Error fetching uploaded image:", err);
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionCode, onImageReceived]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (received) {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
        </div>
        <p className="text-sm font-medium text-green-700 dark:text-green-400">
          Bild empfangen!
        </p>
        <Button variant="outline" size="sm" onClick={createSession}>
          <RefreshCw className="h-3 w-3 mr-1" />
          Neuer QR-Code
        </Button>
      </div>
    );
  }

  if (!qrUrl) {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <Smartphone className="h-8 w-8 text-muted-foreground" />
        <p className="text-xs text-muted-foreground text-center">
          Oder scanne einen QR-Code mit dem Handy, um ein Foto direkt hierher zu senden.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={createSession}
          disabled={isCreating}
        >
          {isCreating ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <QrCode className="h-3 w-3 mr-1" />
          )}
          QR-Code generieren
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="bg-white p-3 rounded-lg">
        <QRCodeSVG value={qrUrl} size={160} level="M" />
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Scanne mit dem Handy & lade ein Foto hoch
      </p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Warte auf Upload... ({formatTime(timeLeft)})
      </div>
      <Button variant="ghost" size="sm" onClick={createSession} className="text-xs">
        <RefreshCw className="h-3 w-3 mr-1" />
        Neuer Code
      </Button>
    </div>
  );
}
