import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  Download,
  ExternalLink,
  CheckCircle,
  Clock,
  XCircle,
  Calendar,
  User,
  Building2,
  Loader2,
} from "lucide-react";
import { SignatureDisplay } from "./SignatureDisplay";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateSignedPdf } from "@/lib/signedPdfGenerator";

interface Profile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

interface DocumentSignature {
  id: string;
  document_id: string;
  signer_id: string;
  requested_by: string;
  status: string;
  signed_at: string | null;
  signature_image: string | null;
  signature_position?: string | null;
  signer?: Profile;
}

interface Document {
  id: string;
  name: string;
  type: string;
  file_path: string;
  file_size: number | null;
  description: string | null;
  expires_at: string | null;
  uploaded_by: string;
  created_at: string;
  signatures?: DocumentSignature[];
  uploader?: Profile;
}

interface DocumentDetailDialogProps {
  document: Document | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocumentDetailDialog({
  document,
  open,
  onOpenChange,
}: DocumentDetailDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  if (!document) return null;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "–";
    return new Date(dateStr).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "–";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "contract": return "Vertrag";
      case "license": return "Lizenz";
      case "report": return "Bericht";
      default: return "Sonstiges";
    }
  };

  const openDocument = async (download = false) => {
    setIsLoading(true);
    try {
      if (download) {
        // Download: use blob + a.download (works in sandboxed iframes)
        const { data: blobData, error } = await supabase.storage
          .from("documents")
          .download(document.file_path);
        if (error) throw error;
        if (!blobData) throw new Error("Could not download document");

        const url = URL.createObjectURL(blobData);
        const a = window.document.createElement("a");
        a.href = url;
        a.download = document.name;
        window.document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } else {
        // Open: use signed URL in new tab (avoids sandbox issues with blob URLs)
        const { data, error } = await supabase.storage
          .from("documents")
          .createSignedUrl(document.file_path, 600);
        if (error) throw error;
        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      console.error("Error opening document:", error);
      toast.error("Dokument konnte nicht geöffnet werden");
    } finally {
      setIsLoading(false);
    }
  };

  const signedSignatures = (document.signatures || []).filter(
    (s) => s.status === "signed"
  );
  const pendingSignatures = (document.signatures || []).filter(
    (s) => s.status === "pending"
  );
  const rejectedSignatures = (document.signatures || []).filter(
    (s) => s.status === "rejected"
  );

  const getSignerName = (sig: DocumentSignature) => {
    if (sig.signer) {
      return `${sig.signer.first_name || ""} ${sig.signer.last_name || ""}`.trim() || sig.signer.email;
    }
    return "Unknown";
  };

  const getSignatureInitials = (sig: DocumentSignature) => {
    if (sig.signature_image?.startsWith("text:")) {
      return sig.signature_image.replace("text:", "");
    }
    return null;
  };

  const getSignatureImage = (sig: DocumentSignature) => {
    if (sig.signature_image && !sig.signature_image.startsWith("text:")) {
      return sig.signature_image;
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <FileText className="h-5 w-5 text-accent" />
            </div>
            <span className="truncate">{document.name}</span>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="space-y-6 pr-4">
            {/* Document Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Typ</p>
                <p className="text-sm font-medium">{getTypeLabel(document.type)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Größe</p>
                <p className="text-sm font-medium">{formatFileSize(document.file_size)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Erstellt am
                </p>
                <p className="text-sm font-medium">{formatDate(document.created_at)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Gültig bis
                </p>
                <p className="text-sm font-medium">{formatDate(document.expires_at)}</p>
              </div>
              <div className="space-y-1 col-span-2">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Hochgeladen von
                </p>
                <p className="text-sm font-medium">
                  {document.uploader
                    ? `${document.uploader.first_name || ""} ${document.uploader.last_name || ""}`.trim() || document.uploader.email
                    : "–"}
                </p>
              </div>
            </div>

            {document.description && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Beschreibung</p>
                <p className="text-sm">{document.description}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => openDocument()} disabled={isLoading} variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-2" />
                Öffnen
              </Button>
              <Button onClick={() => openDocument(true)} disabled={isLoading} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Herunterladen
              </Button>
            </div>

            <Separator />

            {/* Signatures Section */}
            <div>
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                Signaturen
                <span className="text-xs font-normal text-muted-foreground">
                  ({signedSignatures.length} signiert, {pendingSignatures.length} ausstehend)
                </span>
              </h3>

              {/* No signatures */}
              {(document.signatures || []).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Keine Signaturen für dieses Dokument.
                </p>
              )}

              {/* Signed Signatures */}
              {signedSignatures.length > 0 && (
                <div className="space-y-4 mb-6">
                  <p className="text-xs font-medium text-success flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Signiert ({signedSignatures.length})
                  </p>
                  <div className="space-y-3">
                    {signedSignatures.map((sig) => (
                      <SignatureDisplay
                        key={sig.id}
                        signerName={getSignerName(sig)}
                        signatureImage={getSignatureImage(sig)}
                        signatureInitials={getSignatureInitials(sig)}
                        signedAt={sig.signed_at || ""}
                        position={sig.signature_position}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Pending Signatures */}
              {pendingSignatures.length > 0 && (
                <div className="space-y-3 mb-6">
                  <p className="text-xs font-medium text-warning flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Ausstehend ({pendingSignatures.length})
                  </p>
                  <div className="space-y-2">
                    {pendingSignatures.map((sig) => (
                      <div
                        key={sig.id}
                        className="flex items-center gap-3 p-3 bg-warning/5 rounded-lg border border-warning/20"
                      >
                        <Clock className="h-4 w-4 text-warning" />
                        <div>
                          <p className="text-sm font-medium">{getSignerName(sig)}</p>
                          <p className="text-xs text-muted-foreground">Warten auf Signatur</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rejected Signatures */}
              {rejectedSignatures.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-destructive flex items-center gap-1">
                    <XCircle className="h-3 w-3" />
                    Abgelehnt ({rejectedSignatures.length})
                  </p>
                  <div className="space-y-2">
                    {rejectedSignatures.map((sig) => (
                      <div
                        key={sig.id}
                        className="flex items-center gap-3 p-3 bg-destructive/5 rounded-lg border border-destructive/20"
                      >
                        <XCircle className="h-4 w-4 text-destructive" />
                        <div>
                          <p className="text-sm font-medium">{getSignerName(sig)}</p>
                          <p className="text-xs text-muted-foreground">Signatur abgelehnt</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
