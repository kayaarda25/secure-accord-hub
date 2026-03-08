import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface AvatarCropperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageFile: File | null;
  onCropComplete: (croppedBlob: Blob) => void;
}

export function AvatarCropper({ open, onOpenChange, imageFile, onCropComplete }: AvatarCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isSaving, setIsSaving] = useState(false);

  const CANVAS_SIZE = 280;

  // Load image when file changes
  useEffect(() => {
    if (!imageFile) return;
    const url = URL.createObjectURL(imageFile);
    setImageSrc(url);

    const img = new Image();
    img.onload = () => {
      setImageEl(img);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    img.src = url;

    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  // Draw canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !imageEl) return;

    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Calculate scaled dimensions to fit image in canvas
    const imgAspect = imageEl.width / imageEl.height;
    let drawW: number, drawH: number;

    if (imgAspect > 1) {
      drawH = CANVAS_SIZE * zoom;
      drawW = drawH * imgAspect;
    } else {
      drawW = CANVAS_SIZE * zoom;
      drawH = drawW / imgAspect;
    }

    const drawX = (CANVAS_SIZE - drawW) / 2 + offset.x;
    const drawY = (CANVAS_SIZE - drawH) / 2 + offset.y;

    // Clip to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();

    ctx.drawImage(imageEl, drawX, drawY, drawW, drawH);
    ctx.restore();
  }, [imageEl, zoom, offset]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Mouse/touch handlers for panning
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const maxOffset = CANVAS_SIZE * (zoom - 1) / 2 + 20;
    const newX = Math.max(-maxOffset, Math.min(maxOffset, e.clientX - dragStart.x));
    const newY = Math.max(-maxOffset, Math.min(maxOffset, e.clientY - dragStart.y));
    setOffset({ x: newX, y: newY });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setZoom(prev => Math.max(1, Math.min(3, prev + delta)));
  };

  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsSaving(true);

    // Create a high-res output canvas (512x512)
    const outputCanvas = document.createElement("canvas");
    const outputCtx = outputCanvas.getContext("2d");
    const OUTPUT_SIZE = 512;
    outputCanvas.width = OUTPUT_SIZE;
    outputCanvas.height = OUTPUT_SIZE;

    if (outputCtx && imageEl) {
      const imgAspect = imageEl.width / imageEl.height;
      let drawW: number, drawH: number;

      if (imgAspect > 1) {
        drawH = OUTPUT_SIZE * zoom;
        drawW = drawH * imgAspect;
      } else {
        drawW = OUTPUT_SIZE * zoom;
        drawH = drawW / imgAspect;
      }

      const scale = OUTPUT_SIZE / CANVAS_SIZE;
      const drawX = (OUTPUT_SIZE - drawW) / 2 + offset.x * scale;
      const drawY = (OUTPUT_SIZE - drawH) / 2 + offset.y * scale;

      outputCtx.beginPath();
      outputCtx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
      outputCtx.clip();

      outputCtx.drawImage(imageEl, drawX, drawY, drawW, drawH);
    }

    outputCanvas.toBlob(
      (blob) => {
        if (blob) {
          onCropComplete(blob);
        }
        setIsSaving(false);
      },
      "image/png",
      0.95
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Profilbild anpassen</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {/* Preview area */}
          <div
            ref={containerRef}
            className="relative rounded-full overflow-hidden border-2 border-border bg-muted cursor-grab active:cursor-grabbing"
            style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
            onWheel={handleWheel}
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              className="touch-none"
            />
            {/* Circle overlay guide */}
            <div
              className="absolute inset-0 pointer-events-none rounded-full"
              style={{
                boxShadow: "0 0 0 2px hsl(var(--primary) / 0.3)",
              }}
            />
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-3 w-full max-w-xs">
            <ZoomOut className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Slider
              value={[zoom]}
              onValueChange={([v]) => setZoom(v)}
              min={1}
              max={3}
              step={0.01}
              className="flex-1"
            />
            <ZoomIn className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Ziehen Sie das Bild um es zu verschieben. Nutzen Sie den Regler oder das Scrollrad zum Zoomen.
          </p>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Zurücksetzen
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Speichern..." : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
