import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Bold, Italic, AlignLeft, AlignCenter, AlignRight,
  Type, Eye, EyeOff, Move, Minus
} from "lucide-react";

export interface LayoutElement {
  id: string;
  type: "text" | "image" | "line";
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  textAlign?: string;
  visible: boolean;
}

export interface LayoutData {
  elements: LayoutElement[];
}

interface LetterheadCanvasProps {
  layoutData: LayoutData;
  onLayoutChange: (data: LayoutData) => void;
  companyName: string;
  subtitle: string;
  address: string;
  footerText: string;
  primaryColor: string;
  logoUrl: string;
  showLogo: boolean;
}

// A4 at 72 DPI = 595 x 842
const A4_WIDTH = 595;
const A4_HEIGHT = 842;

const FONT_FAMILIES = [
  { value: "sans-serif", label: "Sans Serif" },
  { value: "serif", label: "Serif" },
  { value: "monospace", label: "Monospace" },
  { value: "'Georgia', serif", label: "Georgia" },
  { value: "'Times New Roman', serif", label: "Times New Roman" },
  { value: "'Arial', sans-serif", label: "Arial" },
  { value: "'Helvetica Neue', sans-serif", label: "Helvetica" },
];

const ELEMENT_LABELS: Record<string, string> = {
  logo: "Logo",
  company_name: "Firmenname",
  subtitle: "Untertitel",
  address: "Adresse",
  divider: "Trennlinie",
  footer: "Fusszeile",
};

function getElementContent(
  el: LayoutElement,
  props: Pick<LetterheadCanvasProps, "companyName" | "subtitle" | "address" | "footerText" | "logoUrl" | "showLogo" | "primaryColor">
): string {
  switch (el.id) {
    case "company_name": return props.companyName;
    case "subtitle": return props.subtitle;
    case "address": return props.address;
    case "footer": return props.footerText;
    default: return "";
  }
}

export function LetterheadCanvas({
  layoutData,
  onLayoutChange,
  companyName,
  subtitle,
  address,
  footerText,
  primaryColor,
  logoUrl,
  showLogo,
}: LetterheadCanvasProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // Calculate scale to fit container
  useEffect(() => {
    const updateScale = () => {
      if (canvasRef.current?.parentElement) {
        const containerWidth = canvasRef.current.parentElement.clientWidth;
        const maxScale = (containerWidth - 32) / A4_WIDTH;
        setScale(Math.min(maxScale, 1));
      }
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  const selectedElement = layoutData.elements.find((el) => el.id === selectedId) || null;

  const updateElement = useCallback(
    (id: string, updates: Partial<LayoutElement>) => {
      const newElements = layoutData.elements.map((el) =>
        el.id === id ? { ...el, ...updates } : el
      );
      onLayoutChange({ elements: newElements });
    },
    [layoutData, onLayoutChange]
  );

  const handleMouseDown = (e: React.MouseEvent, elId: string) => {
    e.stopPropagation();
    setSelectedId(elId);
    const el = layoutData.elements.find((e) => e.id === elId);
    if (!el || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / scale;
    const mouseY = (e.clientY - rect.top) / scale;

    setDragging({
      id: elId,
      offsetX: mouseX - el.x,
      offsetY: mouseY - el.y,
    });
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) / scale;
      const mouseY = (e.clientY - rect.top) / scale;

      const newX = Math.max(0, Math.min(A4_WIDTH - 20, mouseX - dragging.offsetX));
      const newY = Math.max(0, Math.min(A4_HEIGHT - 20, mouseY - dragging.offsetY));

      updateElement(dragging.id, { x: Math.round(newX), y: Math.round(newY) });
    },
    [dragging, scale, updateElement]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  const renderElement = (el: LayoutElement) => {
    if (!el.visible) return null;

    const isSelected = selectedId === el.id;
    const borderStyle = isSelected
      ? "2px solid hsl(var(--accent))"
      : "1px dashed transparent";
    const hoverBorder = "1px dashed hsl(var(--border))";

    const commonStyle: React.CSSProperties = {
      position: "absolute",
      left: el.x,
      top: el.y,
      width: el.width,
      height: el.height,
      cursor: dragging?.id === el.id ? "grabbing" : "grab",
      border: borderStyle,
      borderRadius: 2,
      transition: dragging ? "none" : "border 0.15s",
      userSelect: "none",
      zIndex: isSelected ? 10 : 1,
    };

    if (el.type === "image" && el.id === "logo") {
      return (
        <div
          key={el.id}
          style={commonStyle}
          onMouseDown={(e) => handleMouseDown(e, el.id)}
          onMouseEnter={(e) => {
            if (!isSelected) (e.currentTarget.style.border = hoverBorder);
          }}
          onMouseLeave={(e) => {
            if (!isSelected) (e.currentTarget.style.border = "1px dashed transparent");
          }}
          className="flex items-center justify-center"
        >
          {showLogo && logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              className="max-w-full max-h-full object-contain pointer-events-none"
              draggable={false}
            />
          ) : (
            <div className="w-full h-full border border-dashed border-muted-foreground/30 rounded flex items-center justify-center text-xs text-muted-foreground">
              Logo
            </div>
          )}
        </div>
      );
    }

    if (el.type === "line") {
      return (
        <div
          key={el.id}
          style={{
            ...commonStyle,
            display: "flex",
            alignItems: "center",
          }}
          onMouseDown={(e) => handleMouseDown(e, el.id)}
          onMouseEnter={(e) => {
            if (!isSelected) (e.currentTarget.style.border = hoverBorder);
          }}
          onMouseLeave={(e) => {
            if (!isSelected) (e.currentTarget.style.border = "1px dashed transparent");
          }}
        >
          <div
            style={{
              width: "100%",
              height: Math.max(1, el.height - 4),
              backgroundColor: primaryColor,
              borderRadius: 1,
            }}
          />
        </div>
      );
    }

    // Text element
    const content = getElementContent(el, {
      companyName,
      subtitle,
      address,
      footerText,
      logoUrl,
      showLogo,
      primaryColor,
    });

    const textColor = el.id === "company_name" ? primaryColor : undefined;

    return (
      <div
        key={el.id}
        style={{
          ...commonStyle,
          fontSize: el.fontSize || 12,
          fontFamily: el.fontFamily || "sans-serif",
          fontWeight: el.fontWeight || "normal",
          fontStyle: el.fontStyle || "normal",
          textAlign: (el.textAlign as React.CSSProperties["textAlign"]) || "left",
          color: textColor,
          lineHeight: 1.3,
          overflow: "hidden",
          display: "flex",
          alignItems: "flex-start",
          justifyContent:
            el.textAlign === "center"
              ? "center"
              : el.textAlign === "right"
              ? "flex-end"
              : "flex-start",
          padding: "2px 4px",
        }}
        onMouseDown={(e) => handleMouseDown(e, el.id)}
        onMouseEnter={(e) => {
          if (!isSelected) (e.currentTarget.style.border = hoverBorder);
        }}
        onMouseLeave={(e) => {
          if (!isSelected) (e.currentTarget.style.border = "1px dashed transparent");
        }}
      >
        <span className="pointer-events-none whitespace-pre-wrap">{content || `[${ELEMENT_LABELS[el.id] || el.id}]`}</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* A4 Canvas */}
      <div className="flex-1 flex justify-center">
        <div
          className="relative bg-white shadow-lg border border-border"
          ref={canvasRef}
          style={{
            width: A4_WIDTH * scale,
            height: A4_HEIGHT * scale,
            overflow: "hidden",
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedId(null);
          }}
        >
          {/* Scaled content layer */}
          <div
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              width: A4_WIDTH,
              height: A4_HEIGHT,
              position: "absolute",
              top: 0,
              left: 0,
            }}
          >
            {layoutData.elements.map(renderElement)}
          </div>
        </div>
      </div>

      {/* Properties Panel */}
      <div className="w-full lg:w-72 space-y-4">
        <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Elemente
        </div>

        {/* Element list */}
        <div className="space-y-1">
          {layoutData.elements.map((el) => (
            <button
              key={el.id}
              onClick={() => setSelectedId(el.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedId === el.id
                  ? "bg-accent/10 text-accent font-medium"
                  : "hover:bg-muted text-foreground"
              }`}
            >
              <span className="flex items-center gap-2">
                {el.type === "line" ? (
                  <Minus className="h-3.5 w-3.5" />
                ) : el.type === "image" ? (
                  <Move className="h-3.5 w-3.5" />
                ) : (
                  <Type className="h-3.5 w-3.5" />
                )}
                {ELEMENT_LABELS[el.id] || el.id}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateElement(el.id, { visible: !el.visible });
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                {el.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </button>
            </button>
          ))}
        </div>

        <Separator />

        {/* Selected element properties */}
        {selectedElement ? (
          <div className="space-y-4">
            <div className="text-sm font-medium">
              {ELEMENT_LABELS[selectedElement.id] || selectedElement.id}
            </div>

            {/* Position */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">X</Label>
                <Input
                  type="number"
                  value={selectedElement.x}
                  onChange={(e) => updateElement(selectedElement.id, { x: Number(e.target.value) })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Y</Label>
                <Input
                  type="number"
                  value={selectedElement.y}
                  onChange={(e) => updateElement(selectedElement.id, { y: Number(e.target.value) })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Breite</Label>
                <Input
                  type="number"
                  value={selectedElement.width}
                  onChange={(e) => updateElement(selectedElement.id, { width: Number(e.target.value) })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Höhe</Label>
                <Input
                  type="number"
                  value={selectedElement.height}
                  onChange={(e) => updateElement(selectedElement.id, { height: Number(e.target.value) })}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Text-specific properties */}
            {selectedElement.type === "text" && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Schriftart</Label>
                  <Select
                    value={selectedElement.fontFamily || "sans-serif"}
                    onValueChange={(v) => updateElement(selectedElement.id, { fontFamily: v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_FAMILIES.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          <span style={{ fontFamily: f.value }}>{f.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Schriftgrösse</Label>
                  <Input
                    type="number"
                    min={6}
                    max={72}
                    value={selectedElement.fontSize || 12}
                    onChange={(e) => updateElement(selectedElement.id, { fontSize: Number(e.target.value) })}
                    className="h-8 text-xs"
                  />
                </div>

                {/* Style buttons */}
                <div className="flex gap-1">
                  <Button
                    variant={selectedElement.fontWeight === "bold" ? "default" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      updateElement(selectedElement.id, {
                        fontWeight: selectedElement.fontWeight === "bold" ? "normal" : "bold",
                      })
                    }
                  >
                    <Bold className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={selectedElement.fontStyle === "italic" ? "default" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      updateElement(selectedElement.id, {
                        fontStyle: selectedElement.fontStyle === "italic" ? "normal" : "italic",
                      })
                    }
                  >
                    <Italic className="h-3.5 w-3.5" />
                  </Button>
                  <Separator orientation="vertical" className="h-8 mx-1" />
                  <Button
                    variant={selectedElement.textAlign === "left" ? "default" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => updateElement(selectedElement.id, { textAlign: "left" })}
                  >
                    <AlignLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={selectedElement.textAlign === "center" ? "default" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => updateElement(selectedElement.id, { textAlign: "center" })}
                  >
                    <AlignCenter className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={selectedElement.textAlign === "right" ? "default" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => updateElement(selectedElement.id, { textAlign: "right" })}
                  >
                    <AlignRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </>
            )}

            {/* Visibility */}
            <div className="flex items-center justify-between">
              <Label className="text-xs">Sichtbar</Label>
              <Switch
                checked={selectedElement.visible}
                onCheckedChange={(v) => updateElement(selectedElement.id, { visible: v })}
              />
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Klicken Sie auf ein Element in der Vorschau oder der Liste, um es zu bearbeiten.
          </p>
        )}
      </div>
    </div>
  );
}
