import { CheckCircle } from "lucide-react";
import { SignaturePosition } from "./SignaturePositionSelector";

interface SignatureDisplayProps {
  signerName: string;
  signatureImage?: string | null;
  signatureInitials?: string | null;
  signedAt: string;
  position?: SignaturePosition | string | null;
  compact?: boolean;
}

const getPositionLabel = (position?: SignaturePosition | string | null) => {
  switch (position) {
    case "top-left": return "Oben Links";
    case "top-center": return "Oben Mitte";
    case "top-right": return "Oben Rechts";
    case "bottom-left": return "Unten Links";
    case "bottom-center": return "Unten Mitte";
    case "bottom-right": return "Unten Rechts";
    default: return null;
  }
};

export function SignatureDisplay({
  signerName,
  signatureImage,
  signatureInitials,
  signedAt,
  position,
  compact = false,
}: SignatureDisplayProps) {
  const formattedDate = new Date(signedAt).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const positionLabel = getPositionLabel(position);

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-success/10 rounded-lg border border-success/20">
        <CheckCircle className="h-4 w-4 text-success" />
        <div className="flex items-center gap-2">
          {signatureImage ? (
            <img
              src={signatureImage}
              alt={`${signerName}'s signature`}
              className="h-6 object-contain"
            />
          ) : signatureInitials ? (
            <span className="font-signature text-lg italic text-foreground">
              {signatureInitials}
            </span>
          ) : (
            <span className="text-sm font-medium text-success">
              {signerName}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-muted/50 rounded-lg border border-border">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-5 w-5 text-success" />
            <span className="text-sm font-medium text-foreground">
              Signiert von {signerName}
            </span>
            {positionLabel && (
              <span className="text-xs px-2 py-0.5 bg-accent/10 text-accent rounded">
                {positionLabel}
              </span>
            )}
          </div>
          
          {/* Signature */}
          <div className="bg-background p-4 rounded border border-border inline-block min-w-[150px]">
            {signatureImage ? (
              <img
                src={signatureImage}
                alt={`${signerName}'s signature`}
                className="h-12 object-contain"
              />
            ) : signatureInitials ? (
              <span className="font-signature text-2xl italic text-foreground">
                {signatureInitials}
              </span>
            ) : (
              <span className="font-signature text-2xl italic text-foreground">
                {signerName.split(" ").map(n => n[0]).join(".")}
              </span>
            )}
          </div>
        </div>
        
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Datum & Uhrzeit</p>
          <p className="text-sm text-foreground">{formattedDate}</p>
        </div>
      </div>
    </div>
  );
}
