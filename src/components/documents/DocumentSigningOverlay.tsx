import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Check, Loader2, Move, ZoomIn, ZoomOut, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as pdfjsLib from "pdfjs-dist";

// Configure PDF.js worker via jsDelivr (mirrors npm exactly, avoids version mismatch)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface DocumentSigningOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentFilePath: string;
  documentName: string;
  signatureImage?: string | null;
  signatureInitials?: string | null;
  onConfirmSign: (position: { xPercent: number; yPercent: number; page: number }, comment?: string) => void;
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
  const [isLoadingDoc, setIsLoadingDoc] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pageSize, setPageSize] = useState({ width: 800, height: 1100 });

  // Draggable signature state
  const [sigPos, setSigPos] = useState({ x: 50, y: 80 });
  const [sigSize, setSigSize] = useState({ w: 180, h: 70 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ mouseX: 0, mouseY: 0, w: 0, h: 0 });
  const [signatureComment, setSignatureComment] = useState("");

  // Render PDF to canvas using PDF.js
  useEffect(() => {
    if (!open) return;
    setIsLoadingDoc(true);
    setLoadError(false);
    setPdfReady(false);
    setSigPos({ x: 50, y: 80 });
    setSigSize({ w: 180, h: 70 });
    setZoom(1);

    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase.storage
          .from("documents")
          .download(documentFilePath);
        if (error) throw error;
        if (cancelled) return;

        const arrayBuffer = await data.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });
        setPageSize({ width: viewport.width, height: viewport.height });
        setIsLoadingDoc(false);

        // Wait for canvas to mount after isLoadingDoc=false re-render
        const waitForCanvas = () => new Promise<HTMLCanvasElement>((resolve, reject) => {
          let attempts = 0;
          const check = () => {
            if (cancelled) { reject(new Error("Cancelled")); return; }
            if (canvasRef.current) { resolve(canvasRef.current); return; }
            attempts++;
            if (attempts > 50) { reject(new Error("Canvas not found")); return; }
            requestAnimationFrame(check);
          };
          check();
        });

        const canvas = await waitForCanvas();
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not get canvas context");

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, viewport.width, viewport.height);

        await page.render({ canvasContext: context, viewport }).promise;
        setPdfReady(true);
      } catch (err) {
        if (cancelled) return;
        console.error("[SigningOverlay] Error:", err);
        setLoadError(true);
        setIsLoadingDoc(false);
        toast.error("Dokument konnte nicht geladen werden");
      }
    })();

    return () => { cancelled = true; };
  }, [open, documentFilePath]);

  // Drag handlers
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
        x: Math.max(0, Math.min(90, newX)),
        y: Math.max(0, Math.min(95, newY)),
      });
    };
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => { e.preventDefault(); handleMove(e.touches[0].clientX, e.touches[0].clientY); };
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

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeStart.current = { mouseX: e.clientX, mouseY: e.clientY, w: sigSize.w, h: sigSize.h };
    setIsResizing(true);
  }, [sigSize]);

  useEffect(() => {
    if (!isResizing) return;
    const onMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - resizeStart.current.mouseX;
      const dy = e.clientY - resizeStart.current.mouseY;
      setSigSize({
        w: Math.max(120, Math.min(400, resizeStart.current.w + dx)),
        h: Math.max(50, Math.min(200, resizeStart.current.h + dy)),
      });
    };
    const onEnd = () => setIsResizing(false);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onEnd);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onEnd);
    };
  }, [isResizing]);

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

  const scaledWidth = pageSize.width * zoom;
  const scaledHeight = pageSize.height * zoom;

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
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.min(2, z + 0.25))}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
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
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <p className="text-sm text-destructive">Dokument konnte nicht geladen werden.</p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Schließen</Button>
          </div>
        ) : (
          <div
            ref={containerRef}
            className="relative bg-white shadow-xl rounded-lg overflow-hidden select-none"
            style={{ width: `${scaledWidth}px`, height: `${scaledHeight}px` }}
          >
            {/* PDF rendered as canvas */}
            <canvas
              ref={canvasRef}
              style={{
                width: `${scaledWidth}px`,
                height: `${scaledHeight}px`,
              }}
            />
            {!pdfReady && !loadError && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-accent" />
              </div>
            )}

            {/* Draggable + Resizable Signature */}
            <div
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
              className={`absolute cursor-grab active:cursor-grabbing transition-shadow ${
                isDragging ? "shadow-2xl scale-[1.02] z-20" : "shadow-lg z-10"
              }`}
              style={{
                left: `${sigPos.x}%`,
                top: `${sigPos.y}%`,
                transform: "translate(-50%, -50%)",
                width: `${sigSize.w}px`,
                height: `${sigSize.h}px`,
              }}
            >
              <div className="relative bg-white/90 backdrop-blur-sm border-2 border-accent rounded-lg h-full flex flex-col items-center justify-center p-2 overflow-hidden">
                {/* Drag handle indicator */}
                <div className="absolute -top-2 -right-2 bg-accent text-accent-foreground rounded-full p-1">
                  <Move className="h-3 w-3" />
                </div>

                {signatureImage ? (
                  <img
                    src={signatureImage}
                    alt="Ihre Signatur"
                    className="max-h-full max-w-full object-contain pointer-events-none"
                    draggable={false}
                  />
                ) : signatureInitials ? (
                  <span className="font-signature text-2xl italic text-foreground pointer-events-none select-none">
                    {signatureInitials}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground pointer-events-none">Signatur</span>
                )}

                <div className="w-full border-t border-border mt-auto pt-1">
                  <p className="text-[9px] text-muted-foreground text-center">Digital signiert</p>
                </div>

                {/* Resize handle (bottom-right corner) */}
                <div
                  onMouseDown={handleResizeStart}
                  className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize flex items-center justify-center hover:bg-accent/20 rounded-tl"
                >
                  <GripVertical className="h-3 w-3 text-muted-foreground rotate-[-45deg]" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar with comment */}
      <div className="px-4 py-3 border-t border-border bg-card flex items-center gap-4">
        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <Move className="h-3 w-3" />
          Drag & Drop / Ecke ziehen zum Skalieren
        </div>
        <Input
          placeholder="Kommentar hinzufügen (z.B. Ort, Datum…) — optional"
          value={signatureComment}
          onChange={(e) => setSignatureComment(e.target.value)}
          className="max-w-md text-sm"
        />
      </div>
    </div>
  );
}
