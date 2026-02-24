import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Upload, Check, Loader2, X, Image } from "lucide-react";

export default function MobileUpload() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error" | "expired">("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!code) {
      setStatus("error");
      setErrorMsg("Kein Upload-Code gefunden.");
      return;
    }
    // Verify session exists and is not expired
    const verify = async () => {
      try {
        const { data, error } = await supabase
          .from("receipt_upload_sessions")
          .select("id, status, expires_at")
          .eq("session_code", code)
          .maybeSingle();

        if (error) {
          console.error("Session verify error:", error);
          setStatus("error");
          setErrorMsg(`Fehler: ${error.message}`);
          return;
        }
        if (!data) {
          setStatus("error");
          setErrorMsg("Session nicht gefunden. Bitte QR-Code erneut scannen.");
          return;
        }
        if (new Date(data.expires_at) < new Date()) {
          setStatus("expired");
          return;
        }
        if (data.status === "uploaded") {
          setStatus("done");
        }
      } catch (err: any) {
        console.error("Verify error:", err);
        setStatus("error");
        setErrorMsg(err.message || "Unbekannter Fehler");
      }
    };
    verify();
  }, [code]);

  const handleFile = async (file: File) => {
    if (!file || !code) return;

    if (!file.type.startsWith("image/")) {
      setErrorMsg("Bitte wähle ein Bild aus.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("Bild muss kleiner als 10MB sein.");
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setStatus("uploading");
    setErrorMsg("");

    try {
      const filePath = `mobile/${code}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("receipt-uploads")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Update session with image path
      const { error: updateError } = await supabase
        .from("receipt_upload_sessions")
        .update({ image_path: filePath, status: "uploaded" })
        .eq("session_code", code);

      if (updateError) throw updateError;

      setStatus("done");
    } catch (err: any) {
      console.error("Upload error:", err);
      setStatus("error");
      setErrorMsg(err.message || "Upload fehlgeschlagen.");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  if (!code) {
    return (
      <MobileShell>
        <ErrorState message="Kein Upload-Code vorhanden. Bitte scanne den QR-Code erneut." />
      </MobileShell>
    );
  }

  if (status === "expired") {
    return (
      <MobileShell>
        <ErrorState message="Dieser QR-Code ist abgelaufen. Bitte generiere einen neuen auf dem Desktop." />
      </MobileShell>
    );
  }

  if (status === "done") {
    return (
      <MobileShell>
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Bild hochgeladen!</h2>
          <p className="text-gray-500 text-sm">
            Das Bild wird jetzt auf dem Desktop angezeigt. Du kannst diese Seite schliessen.
          </p>
          {preview && (
            <img src={preview} alt="Hochgeladen" className="w-full max-w-xs rounded-lg border mt-2" />
          )}
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
          <Image className="h-7 w-7 text-blue-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 text-center">Beleg hochladen</h2>
        <p className="text-gray-500 text-sm text-center">
          Mache ein Foto oder wähle ein Bild von deinem Handy aus.
        </p>

        {errorMsg && (
          <div className="w-full p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-center">
            {errorMsg}
          </div>
        )}

        {status === "uploading" ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            <p className="text-gray-500 text-sm">Wird hochgeladen...</p>
            {preview && (
              <img src={preview} alt="Preview" className="w-full max-w-xs rounded-lg border mt-2" />
            )}
          </div>
        ) : (
          <div className="w-full space-y-3 mt-2">
            {/* Camera button */}
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-blue-600 text-white rounded-xl font-medium text-base hover:bg-blue-700 active:bg-blue-800 transition-colors"
            >
              <Camera className="h-5 w-5" />
              Foto aufnehmen
            </button>

            {/* Gallery button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-white text-gray-700 rounded-xl font-medium text-base border border-gray-200 hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <Upload className="h-5 w-5" />
              Bild aus Galerie
            </button>
          </div>
        )}

        {/* Hidden inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleInputChange}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleInputChange}
        />
      </div>
    </MobileShell>
  );
}

function MobileShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6">
        {children}
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
        <X className="h-8 w-8 text-red-600" />
      </div>
      <h2 className="text-xl font-semibold text-gray-900">Fehler</h2>
      <p className="text-gray-500 text-sm">{message}</p>
    </div>
  );
}
