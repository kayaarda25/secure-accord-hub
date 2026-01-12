import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FileText, Check } from "lucide-react";

export type SignaturePosition = 
  | "bottom-left" 
  | "bottom-center" 
  | "bottom-right"
  | "top-left"
  | "top-center"
  | "top-right";

interface SignaturePositionSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (position: SignaturePosition) => void;
  documentName?: string;
  signaturePreview?: string | null;
  signatureInitials?: string | null;
}

export function SignaturePositionSelector({
  open,
  onOpenChange,
  onConfirm,
  documentName,
  signaturePreview,
  signatureInitials,
}: SignaturePositionSelectorProps) {
  const [selectedPosition, setSelectedPosition] = useState<SignaturePosition>("bottom-right");

  const positions: { value: SignaturePosition; label: string }[] = [
    { value: "top-left", label: "Oben Links" },
    { value: "top-center", label: "Oben Mitte" },
    { value: "top-right", label: "Oben Rechts" },
    { value: "bottom-left", label: "Unten Links" },
    { value: "bottom-center", label: "Unten Mitte" },
    { value: "bottom-right", label: "Unten Rechts" },
  ];

  const getPositionClasses = (position: SignaturePosition) => {
    switch (position) {
      case "top-left": return "top-2 left-2";
      case "top-center": return "top-2 left-1/2 -translate-x-1/2";
      case "top-right": return "top-2 right-2";
      case "bottom-left": return "bottom-2 left-2";
      case "bottom-center": return "bottom-2 left-1/2 -translate-x-1/2";
      case "bottom-right": return "bottom-2 right-2";
    }
  };

  const handleConfirm = () => {
    onConfirm(selectedPosition);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-accent" />
            Signatur-Position wählen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {documentName && (
            <p className="text-sm text-muted-foreground">
              Dokument: <span className="font-medium text-foreground">{documentName}</span>
            </p>
          )}

          {/* Document Preview with Signature Position */}
          <div className="relative bg-muted rounded-lg border border-border aspect-[3/4] max-h-[300px]">
            {/* Fake document lines */}
            <div className="absolute inset-4 space-y-2">
              <div className="h-3 bg-muted-foreground/20 rounded w-3/4" />
              <div className="h-3 bg-muted-foreground/20 rounded w-full" />
              <div className="h-3 bg-muted-foreground/20 rounded w-5/6" />
              <div className="h-3 bg-muted-foreground/20 rounded w-2/3" />
              <div className="h-3 bg-muted-foreground/20 rounded w-4/5 mt-4" />
              <div className="h-3 bg-muted-foreground/20 rounded w-full" />
              <div className="h-3 bg-muted-foreground/20 rounded w-3/4" />
            </div>

            {/* Signature Preview */}
            <div 
              className={`absolute p-2 bg-background/90 rounded border-2 border-accent shadow-lg transition-all duration-200 ${getPositionClasses(selectedPosition)}`}
            >
              {signaturePreview ? (
                <img 
                  src={signaturePreview} 
                  alt="Signatur Vorschau" 
                  className="h-8 object-contain"
                />
              ) : signatureInitials ? (
                <span className="font-signature text-lg italic text-foreground">
                  {signatureInitials}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Signatur</span>
              )}
            </div>
          </div>

          {/* Position Selection */}
          <div className="space-y-3">
            <Label>Position auswählen:</Label>
            <RadioGroup
              value={selectedPosition}
              onValueChange={(value) => setSelectedPosition(value as SignaturePosition)}
              className="grid grid-cols-3 gap-2"
            >
              {positions.map((pos) => (
                <div key={pos.value}>
                  <RadioGroupItem
                    value={pos.value}
                    id={pos.value}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={pos.value}
                    className="flex items-center justify-center rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-accent peer-data-[state=checked]:bg-accent/10 cursor-pointer text-xs text-center transition-colors"
                  >
                    {pos.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleConfirm}>
            <Check className="h-4 w-4 mr-2" />
            Signieren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
