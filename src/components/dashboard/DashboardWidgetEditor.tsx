import { useState } from "react";
import { Settings2, ChevronUp, ChevronDown, RotateCcw, Eye, EyeOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DashboardWidget } from "@/hooks/useDashboardLayout";

interface DashboardWidgetEditorProps {
  widgets: DashboardWidget[];
  saving: boolean;
  onToggle: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  onReset: () => void;
}

export function DashboardWidgetEditor({
  widgets,
  saving,
  onToggle,
  onMove,
  onReset,
}: DashboardWidgetEditorProps) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <Settings2 className="h-4 w-4" />
        Widgets anpassen
      </Button>
    );
  }

  return (
    <div className="card-state p-4 mb-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-accent" />
          Dashboard anpassen
        </h3>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onReset} className="gap-1 text-xs">
            <RotateCcw className="h-3 w-3" />
            Zurücksetzen
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {widgets.map((widget, index) => (
          <div
            key={widget.id}
            className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
              widget.visible
                ? "border-border bg-background"
                : "border-border/50 bg-muted/30 opacity-60"
            }`}
          >
            <div className="flex items-center gap-3">
              {widget.visible ? (
                <Eye className="h-4 w-4 text-accent" />
              ) : (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm font-medium text-foreground">{widget.label}</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={index === 0}
                  onClick={() => onMove(widget.id, "up")}
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={index === widgets.length - 1}
                  onClick={() => onMove(widget.id, "down")}
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>
              <Switch
                checked={widget.visible}
                onCheckedChange={() => onToggle(widget.id)}
              />
            </div>
          </div>
        ))}
      </div>

      {saving && (
        <p className="text-xs text-muted-foreground mt-3 text-center">Speichern...</p>
      )}
    </div>
  );
}
