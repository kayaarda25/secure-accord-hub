import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, Check, Loader2, Move, ZoomIn, ZoomOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DocumentSigningOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentFilePath: string;
  documentName: string;
  signatureImage?: string | null;
  signatureInitials?: string | null;
  onConfirmSign: (position: { xPercent: number; yPercent: number; page: number }, comment?: string) => void;
}

/**
 * Determines if a file is a Word document based on extension or mime-type-like path.
 */
function isWordDocument(filePathOrName: string): boolean {
  const lower = filePathOrName.toLowerCase();
  return lower.endsWith(".doc") || lower.endsWith(".docx");
}

export function DocumentSigningOverlay({
  open,
  onOpenChange,
  documentFilePath,
  documentName,
  signatureImage,
  signatureInitials,
  onConfirmSign,
}: DocumentSigningOverlayProps) {
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [isLoadingDoc, setIsLoadingDoc] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  // Draggable signature state
  const [sigPos, setSigPos] = useState({ x: 50, y: 80 }); // percentage
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [signatureComment, setSignatureComment] = useState("");

  // Load document URL
  useEffect(() => {
    if (!open) return;
    setIsLoadingDoc(true);
    setLoadError(false);
    setDocumentUrl(null);
    setSigPos({ x: 50, y: 80 });
    setZoom(1);

    (async () => {
      try {
        // Use a longer expiry for the signed URL (10 min)
        const { data, error } = await supabase.storage
          .from("documents")
          .createSignedUrl(documentFilePath, 600);
        if (error) throw error;

        const signedUrl = data.signedUrl;

        // For Word documents, use Microsoft Office Online Viewer
        if (isWordDocument(documentFilePath) || isWordDocument(documentName)) {
          const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(signedUrl)}`;
          setDocumentUrl(viewerUrl);
        } else {
          // For PDFs and images, use the signed URL directly
          setDocumentUrl(signedUrl);
        }
      } catch (err) {
        console.error("Error loading document:", err);
        setLoadError(true);
        toast.error("Dokument konnte nicht geladen werden");
      } finally {
        setIsLoadingDoc(false);
      }
    })();
  }, [open, documentFilePath, documentName]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - (sigPos.x / 100) * rect.width,
      y: e.clientY - (sigPos.y / 100) * rect.height,
    };
    setIsDragging(true);
  }, [sigPos]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    dragOffset.current = {
      x: touch.clientX - (sigPos.x / 100) * rect.width,
      y: touch.clientY - (sigPos.y / 100) * rect.height,
    };
    setIsDragging(true);
  }, [sigPos]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (clientX: number, clientY: number) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const newX = ((clientX - dragOffset.current.x) / rect.width) * 100;
      const newY = ((clientY - dragOffset.current.y) / rect.height) * 100;
      setSigPos({
        x: Math.max(0, Math.min(85, newX)),
        y: Math.max(0, Math.min(92, newY)),
      });
    };

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onEnd = () => setIsDragging(false);

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [isDragging]);

  const handleConfirm = () => {
    onConfirmSign({
      xPercent: sigPos.x,
      yPercent: sigPos.y,
      page: 1,
    }, signatureComment.trim() || undefined);
    setSignatureComment("");
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-sm font-semibold text-foreground truncate max-w-[300px]">
              {documentName}
            </h2>
            <p className="text-xs text-muted-foreground">
              Signatur an gewünschter Position platzieren
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 mr-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleConfirm} className="bg-success text-success-foreground hover:bg-success/90">
            <Check className="h-4 w-4 mr-2" />
            Hier signieren
          </Button>
        </div>
      </div>

      {/* Document Viewer */}
      <div className="flex-1 overflow-auto bg-muted/50 flex items-start justify-center p-4">
        {isLoadingDoc ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
            <p className="text-sm text-muted-foreground">Dokument wird geladen…</p>
          </div>
        ) : loadError || !documentUrl ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <p className="text-sm text-destructive">Dokument konnte nicht geladen werden.</p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Schließen
            </Button>
          </div>
        ) : (
          <div
            ref={containerRef}
            className="relative bg-white shadow-xl rounded-lg overflow-hidden select-none"
            style={{
              width: `${zoom * 800}px`,
              minHeight: `${zoom * 1100}px`,
            }}
          >
            {/* Embedded Document */}
            <iframe
              src={documentUrl}
              className="w-full border-0"
              style={{ height: `${zoom * 1100}px`, pointerEvents: isDragging ? 'none' : 'auto' }}
              title="Dokument-Vorschau"
              allow="fullscreen"
            />

            {/* Draggable Signature */}
            <div
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
              className={`absolute cursor-grab active:cursor-grabbing transition-shadow ${
                isDragging ? "shadow-2xl scale-105 z-20" : "shadow-lg z-10"
              }`}
              style={{
                left: `${sigPos.x}%`,
                top: `${sigPos.y}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <div className="relative bg-white/90 backdrop-blur-sm border-2 border-accent rounded-lg p-3 min-w-[140px]">
                {/* Drag handle indicator */}
                <div className="absolute -top-2 -right-2 bg-accent text-accent-foreground rounded-full p-1">
                  <Move className="h-3 w-3" />
                </div>

                {signatureImage ? (
                  <img
                    src={signatureImage}
                    alt="Ihre Signatur"
                    className="h-12 object-contain pointer-events-none"
                    draggable={false}
                  />
                ) : signatureInitials ? (
                  <span className="font-signature text-2xl italic text-foreground pointer-events-none select-none">
                    {signatureInitials}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground pointer-events-none">
                    Signatur
                  </span>
                )}

                <div className="mt-1 border-t border-border pt-1">
                  <p className="text-[9px] text-muted-foreground">
                    Digital signiert
                  </p>
                </div>

                {/* Comment text field */}
                <div className="mt-2 border-t border-border pt-2">
                  <Textarea
                    placeholder="Kommentar hinzufügen (z.B. Ort, Datum…)"
                    value={signatureComment}
                    onChange={(e) => setSignatureComment(e.target.value)}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    className="text-xs min-h-[50px] resize-none bg-white/80 border-muted"
                    rows={2}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom hint */}
      <div className="px-4 py-2 border-t border-border bg-card text-center">
        <p className="text-xs text-muted-foreground">
          <Move className="inline h-3 w-3 mr-1" />
          Signatur per Drag & Drop an die gewünschte Stelle verschieben, dann "Hier signieren" klicken
        </p>
      </div>
    </div>
  );
}
