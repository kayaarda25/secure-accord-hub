import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBexio } from "@/hooks/useBexio";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Calendar,
  FileText,
  Send,
  AlertTriangle,
  CheckCheck,
  ChevronUp,
  ChevronDown,
  Download,
} from "lucide-react";

interface Invoice {
  id: string;
  vendor_name: string;
  vendor_address: string | null;
  vendor_iban: string | null;
  invoice_number: string | null;
  payment_reference: string | null;
  notes: string | null;
  amount: number;
  currency: string;
  invoice_date: string | null;
  due_date: string | null;
  status: string;
  first_approver_id: string | null;
  first_approved_at: string | null;
  first_approver_comment: string | null;
  second_approver_id: string | null;
  second_approved_at: string | null;
  second_approver_comment: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  bexio_synced_at: string | null;
  document_path: string | null;
  document_name: string | null;
  vat_rate: number | null;
  vat_amount: number | null;
}

interface InvoiceApprovalDialogProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvoiceApprovalDialog({
  invoice,
  open,
  onOpenChange,
}: InvoiceApprovalDialogProps) {
  const { user } = useAuth();
  const { isConnected: bexioConnected, callApi: callBexioApi } = useBexio();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showDocument, setShowDocument] = useState(false);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [loadingDocument, setLoadingDocument] = useState(false);

  const formatCurrency = (amount: number, currency: string = "CHF") => {
    return new Intl.NumberFormat("de-CH", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // First approval mutation
  const firstApproval = useMutation({
    mutationFn: async () => {
      if (!invoice || !user) throw new Error("Missing data");
      
      const { error } = await supabase
        .from("creditor_invoices")
        .update({
          status: "first_approval",
          first_approver_id: user.id,
          first_approved_at: new Date().toISOString(),
          first_approver_comment: comment || null,
        })
        .eq("id", invoice.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creditor-invoices"] });
      toast({
        title: "Erste Freigabe erteilt",
        description: "Die Rechnung wartet nun auf die zweite Freigabe.",
      });
      setComment("");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Second approval mutation with Bexio sync
  const secondApproval = useMutation({
    mutationFn: async () => {
      if (!invoice || !user) throw new Error("Missing data");
      
      // Update status to approved
      const { error } = await supabase
        .from("creditor_invoices")
        .update({
          status: "approved",
          second_approver_id: user.id,
          second_approved_at: new Date().toISOString(),
          second_approver_comment: comment || null,
        })
        .eq("id", invoice.id);
      
      if (error) throw error;

      // Sync to Bexio if connected
      if (bexioConnected) {
        try {
          // Step 1: Search for existing supplier contact
          const contactResult = await callBexioApi("search_contact", { 
            name: invoice.vendor_name 
          });
          
          let vendorId: number;
          if (contactResult && contactResult.length > 0) {
            vendorId = contactResult[0].id;
            console.log("Found existing Bexio contact:", vendorId);
          } else {
            // Create new creditor/supplier contact if not found
            console.log("Creating new Bexio creditor for:", invoice.vendor_name);
            const newContact = await callBexioApi("create_creditor", {
              name: invoice.vendor_name,
              address: invoice.vendor_address,
            });
            vendorId = newContact.id;
            console.log("Created new Bexio creditor:", vendorId);
          }

          // Step 2: Upload document to Bexio (if available)
          let bexioFileId: string | null = null;
          if (invoice.document_path) {
            try {
              // Download document from Supabase storage
              const { data: fileData, error: downloadError } = await supabase.storage
                .from("creditor-invoices")
                .download(invoice.document_path);

              if (downloadError) {
                console.error("Failed to download document:", downloadError);
              } else if (fileData) {
                // Convert to base64
                const arrayBuffer = await fileData.arrayBuffer();
                const base64 = btoa(
                  new Uint8Array(arrayBuffer).reduce(
                    (data, byte) => data + String.fromCharCode(byte),
                    ""
                  )
                );

                const filename = invoice.document_name || `invoice-${invoice.id}.pdf`;
                console.log("Uploading document to Bexio:", filename);

                const uploadResult = await callBexioApi("upload_file", {
                  file_base64: base64,
                  filename: filename,
                  mime_type: "application/pdf",
                });

                 // Bexio returns an array: [{ id: number, uuid: string, ... }]
                 const uploadedUuid = Array.isArray(uploadResult)
                   ? uploadResult?.[0]?.uuid
                   : uploadResult?.uuid;

                 if (uploadedUuid) {
                   bexioFileId = String(uploadedUuid);
                   console.log("Uploaded file to Bexio with UUID:", bexioFileId);
                 } else {
                   console.warn("Bexio upload_file returned no uuid:", uploadResult);
                 }
              }
            } catch (uploadError) {
              console.error("Document upload to Bexio failed:", uploadError);
              // Continue with bill creation even if upload fails
            }
          }

          // Step 3: Search for internal contact "Hasan Arda Kaya" for contact_partner_id
          let internalContactId: number | null = null;
          try {
            const internalContactResult = await callBexioApi("search_contact", {
              name: "Hasan Arda Kaya"
            });
            if (internalContactResult && internalContactResult.length > 0) {
              internalContactId = internalContactResult[0].id;
              console.log("Found internal contact Hasan Arda Kaya:", internalContactId);
            } else {
              console.log("Internal contact 'Hasan Arda Kaya' not found in Bexio");
            }
          } catch (contactErr) {
            console.warn("Failed to search for internal contact:", contactErr);
          }

          // Step 4: Create creditor invoice (Lieferantenrechnung) in Bexio
          // Include attachment_ids directly if file was uploaded.
          // Note: v4 purchase bills support "name" field in line_items for description.
          const normalizedNotes = (invoice.notes || "")
            .replace(/\s+/g, " ")
            .trim();

          const bexioTitleBase = `${invoice.invoice_number || "Rechnung"} - ${invoice.vendor_name}`;
          const bexioTitle = normalizedNotes
            ? `${bexioTitleBase} | ${normalizedNotes}`.slice(0, 180)
            : bexioTitleBase;

          // Line item description: use notes or generate from invoice data
          const lineDescription = normalizedNotes || bexioTitle;

          const bexioInvoice = await callBexioApi("create_invoice", {
            vendor_id: vendorId,
            vendor_name: invoice.vendor_name,
            vendor_address: invoice.vendor_address || "",
            invoice_number: invoice.invoice_number,
            payment_reference: invoice.payment_reference,
            bill_date: invoice.invoice_date || new Date().toISOString().split("T")[0],
            due_date: invoice.due_date || new Date().toISOString().split("T")[0],
            amount: invoice.amount,
            vat_rate: invoice.vat_rate || 0,
            vat_amount: invoice.vat_amount || 0,
            currency: invoice.currency || "CHF",
            title: bexioTitle,
            notes: normalizedNotes,
            contact_partner_id: internalContactId,
            attachment_ids: bexioFileId ? [bexioFileId] : [],
          });

          // Fallback: ensure attachment is linked even if create endpoint ignored it
          if (bexioFileId && bexioInvoice?.id) {
            try {
              await callBexioApi("attach_file_to_bill", {
                bill_id: bexioInvoice.id,
                attachment_ids: [bexioFileId],
              });
            } catch (e) {
              console.warn("Bexio attach_file_to_bill failed (non-blocking):", e);
            }
          }

          console.log("Created Bexio purchase bill:", bexioInvoice.id, "with attachment uuid:", bexioFileId);

          // Step 4: Create payment order if vendor IBAN is available
          let paymentCreated = false;
          if (invoice.vendor_iban) {
            try {
              // Get bank accounts to find "Valiant" CHF account
              const bankAccounts = await callBexioApi("get_bank_accounts", {});
              console.log("Available bank accounts:", bankAccounts?.length);

              // Find Valiant CHF account (case-insensitive match on name containing "valiant" and currency CHF)
              const valiantAccount = (bankAccounts || []).find((acc: any) => {
                const name = (acc.name || "").toLowerCase();
                const currency = (acc.currency_code || acc.currency || "").toUpperCase();
                return name.includes("valiant") && currency === "CHF";
              });

              if (valiantAccount) {
                console.log("Found Valiant CHF account:", valiantAccount.id, valiantAccount.name);

                // Parse vendor address for recipient info
                const addrParts = (invoice.vendor_address || "").split(/[,\n]/).map((s: string) => s.trim()).filter(Boolean);
                let street = addrParts[0] || "-";
                let zip = "";
                let city = "";
                if (addrParts.length > 1) {
                  const lastPart = addrParts[addrParts.length - 1];
                  const zipCityMatch = lastPart.match(/^(\d{4,5})\s+(.+)$/);
                  if (zipCityMatch) {
                    zip = zipCityMatch[1];
                    city = zipCityMatch[2];
                  } else {
                    city = lastPart;
                  }
                }

                await callBexioApi("create_iban_payment", {
                  bank_account_id: valiantAccount.id,
                  iban: invoice.vendor_iban,
                  amount: invoice.amount,
                  currency: invoice.currency || "CHF",
                  recipient_name: invoice.vendor_name,
                  recipient_street: street,
                  recipient_zip: zip,
                  recipient_city: city,
                  recipient_country: "CH",
                  execution_date: invoice.due_date || new Date().toISOString().split("T")[0],
                  message: invoice.payment_reference || invoice.invoice_number || "",
                });

                paymentCreated = true;
                console.log("Created IBAN payment order for", invoice.vendor_name);
              } else {
                console.warn("No Valiant CHF bank account found in Bexio - skipping payment creation");
              }
            } catch (paymentError) {
              console.error("Payment order creation failed (non-blocking):", paymentError);
              // Continue - payment creation is optional
            }
          } else {
            console.log("No vendor IBAN available - skipping payment order");
          }

          // Update local record with Bexio reference
          await supabase
            .from("creditor_invoices")
            .update({
              bexio_invoice_id: String(bexioInvoice.id),
              bexio_creditor_id: String(vendorId),
              bexio_synced_at: new Date().toISOString(),
              payment_status: paymentCreated ? "payment_created" : invoice.vendor_iban ? "pending" : null,
            })
            .eq("id", invoice.id);

        } catch (bexioError) {
          console.error("Bexio sync error:", bexioError);
          throw new Error(`Bexio-Sync fehlgeschlagen: ${bexioError instanceof Error ? bexioError.message : "Unbekannter Fehler"}`);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creditor-invoices"] });
      toast({
        title: "Zweite Freigabe erteilt",
        description: bexioConnected 
          ? "Die Rechnung wurde freigegeben und an Bexio übertragen."
          : "Die Rechnung wurde freigegeben.",
      });
      setComment("");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Rejection mutation
  const rejectInvoice = useMutation({
    mutationFn: async () => {
      if (!invoice || !user) throw new Error("Missing data");
      
      const { error } = await supabase
        .from("creditor_invoices")
        .update({
          status: "rejected",
          rejected_by: user.id,
          rejected_at: new Date().toISOString(),
          rejection_reason: rejectionReason,
        })
        .eq("id", invoice.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creditor-invoices"] });
      toast({
        title: "Rechnung abgelehnt",
        description: "Die Rechnung wurde abgelehnt.",
        variant: "destructive",
      });
      setRejectionReason("");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!invoice) return null;

  // Toggle embedded document preview
  const toggleDocument = async () => {
    // Hide + cleanup
    if (showDocument) {
      if (documentUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(documentUrl);
      }
      setDocumentUrl(null);
      setShowDocument(false);
      return;
    }

    if (!invoice.document_path) return;

    setLoadingDocument(true);
    try {
      // Prefer direct download -> blob URL to avoid Chrome iframe blocking on signed URLs
      const { data: fileBlob, error: downloadError } = await supabase.storage
        .from("creditor-invoices")
        .download(invoice.document_path);

      if (downloadError || !fileBlob) {
        throw downloadError ?? new Error("Download fehlgeschlagen");
      }

      const blobUrl = URL.createObjectURL(fileBlob);
      setDocumentUrl(blobUrl);
      setShowDocument(true);
    } catch (e) {
      toast({
        title: "Fehler",
        description: "Dokument konnte nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoadingDocument(false);
    }
  };

  // Handle dialog close - reset document state
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      if (documentUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(documentUrl);
      }
      setShowDocument(false);
      setDocumentUrl(null);
    }
    onOpenChange(isOpen);
  };

  const canFirstApprove = invoice.status === "pending_review" && !invoice.first_approver_id;
  const canSecondApprove = invoice.status === "first_approval" && 
    invoice.first_approver_id && 
    invoice.first_approver_id !== user?.id;
  const canReject = invoice.status !== "approved" && invoice.status !== "rejected" && invoice.status !== "paid";
  const isApproved = invoice.status === "approved" || invoice.status === "paid";
  const isRejected = invoice.status === "rejected";

  const isPending = firstApproval.isPending || secondApproval.isPending || rejectInvoice.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Rechnungsfreigabe
          </DialogTitle>
          <DialogDescription>
            4-Augen-Prinzip: Zwei unabhängige Freigaben erforderlich
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Invoice Details */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Lieferant</p>
              <p className="font-medium">{invoice.vendor_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Rechnungsnummer</p>
              <p className="font-medium font-mono">{invoice.invoice_number || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Betrag</p>
              <p className="font-bold text-lg">
                {formatCurrency(Number(invoice.amount), invoice.currency)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fälligkeit</p>
              <p className="font-medium flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString("de-CH") : "-"}
              </p>
            </div>
            {invoice.notes && (
              <div className="col-span-2">
                <p className="text-sm text-muted-foreground">Beschreibung</p>
                <p className="text-sm">{invoice.notes}</p>
              </div>
            )}
            
            {/* Embedded Document Preview */}
            {invoice.document_path && (
              <div className="col-span-2 space-y-2">
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={toggleDocument}
                    className="flex-1"
                    disabled={loadingDocument}
                  >
                    {loadingDocument ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : showDocument ? (
                      <ChevronUp className="h-4 w-4 mr-2" />
                    ) : (
                      <ChevronDown className="h-4 w-4 mr-2" />
                    )}
                    {loadingDocument 
                      ? "Dokument wird geladen..." 
                      : showDocument 
                        ? "Dokument ausblenden" 
                        : `Dokument anzeigen (${invoice.document_name || "PDF"})`
                    }
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      if (!invoice.document_path) return;
                      const { data, error } = await supabase.storage
                        .from("creditor-invoices")
                        .download(invoice.document_path);
                      if (error || !data) {
                        toast({
                          title: "Fehler",
                          description: "Download fehlgeschlagen.",
                          variant: "destructive",
                        });
                        return;
                      }
                      const url = URL.createObjectURL(data);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = invoice.document_name || "rechnung.pdf";
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
                
                {showDocument && documentUrl && (
                  <div className="border rounded-lg overflow-hidden bg-muted/30">
                    <iframe
                      src={documentUrl}
                      className="w-full h-[500px]"
                      title="Rechnungs-Vorschau"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Approval Status */}
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <CheckCheck className="h-4 w-4" />
              Freigabe-Status
            </h4>

            {/* First Approval */}
            <div className={`flex items-center gap-3 p-3 rounded-lg border ${
              invoice.first_approver_id ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800" : "bg-muted/30"
            }`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                invoice.first_approver_id ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
              }`}>
                {invoice.first_approver_id ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <span className="font-bold">1</span>
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium">Erste Freigabe</p>
                {invoice.first_approver_id ? (
                  <p className="text-sm text-muted-foreground">
                    Freigegeben am {formatDate(invoice.first_approved_at)}
                    {invoice.first_approver_comment && (
                      <span className="block italic">"{invoice.first_approver_comment}"</span>
                    )}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Ausstehend</p>
                )}
              </div>
              {invoice.first_approver_id && (
                <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                  Erteilt
                </Badge>
              )}
            </div>

            {/* Second Approval */}
            <div className={`flex items-center gap-3 p-3 rounded-lg border ${
              invoice.second_approver_id ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800" : "bg-muted/30"
            }`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                invoice.second_approver_id ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
              }`}>
                {invoice.second_approver_id ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <span className="font-bold">2</span>
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium">Zweite Freigabe</p>
                {invoice.second_approver_id ? (
                  <p className="text-sm text-muted-foreground">
                    Freigegeben am {formatDate(invoice.second_approved_at)}
                    {invoice.second_approver_comment && (
                      <span className="block italic">"{invoice.second_approver_comment}"</span>
                    )}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {invoice.first_approver_id ? "Wartet auf zweite Freigabe" : "Nach erster Freigabe"}
                  </p>
                )}
              </div>
              {invoice.second_approver_id && (
                <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                  Erteilt
                </Badge>
              )}
            </div>

            {/* Bexio Sync */}
            <div className={`flex items-center gap-3 p-3 rounded-lg border ${
              invoice.bexio_synced_at ? "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800" : "bg-muted/30"
            }`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                invoice.bexio_synced_at ? "bg-blue-500 text-white" : "bg-muted text-muted-foreground"
              }`}>
                <Send className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Bexio-Buchung</p>
                {invoice.bexio_synced_at ? (
                  <p className="text-sm text-muted-foreground">
                    Übertragen am {formatDate(invoice.bexio_synced_at)}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {bexioConnected 
                      ? "Wird nach zweiter Freigabe übertragen" 
                      : "Bexio nicht verbunden"}
                  </p>
                )}
              </div>
              {invoice.bexio_synced_at && (
                <Badge variant="outline" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                  Gebucht
                </Badge>
              )}
            </div>

            {/* Rejection Status */}
            {isRejected && (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800">
                <div className="h-8 w-8 rounded-full flex items-center justify-center bg-red-500 text-white">
                  <XCircle className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-red-700 dark:text-red-300">Abgelehnt</p>
                  <p className="text-sm text-red-600 dark:text-red-400">
                    Am {formatDate(invoice.rejected_at)}
                    {invoice.rejection_reason && (
                      <span className="block">Grund: {invoice.rejection_reason}</span>
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Action Section */}
          {!isApproved && !isRejected && (
            <>
              <Separator />
              
              {canFirstApprove && (
                <div className="space-y-3">
                  <Label>Kommentar (optional)</Label>
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Anmerkung zur Freigabe..."
                    rows={2}
                  />
                </div>
              )}

              {canSecondApprove && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Sie erteilen die finale Freigabe (4-Augen-Prinzip)
                    </span>
                  </div>
                  <Label>Kommentar (optional)</Label>
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Anmerkung zur Freigabe..."
                    rows={2}
                  />
                </div>
              )}

              {invoice.status === "first_approval" && invoice.first_approver_id === user?.id && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-950 dark:border-amber-800">
                  <p className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Sie haben die erste Freigabe erteilt. Die zweite Freigabe muss von einer anderen Person erfolgen.
                  </p>
                </div>
              )}

              {canReject && (
                <div className="space-y-3 pt-2 border-t">
                  <Label className="text-destructive">Ablehnung</Label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Grund für Ablehnung..."
                    rows={2}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
          {canReject && rejectionReason && (
            <Button
              variant="destructive"
              onClick={() => rejectInvoice.mutate()}
              disabled={isPending}
            >
              {rejectInvoice.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <XCircle className="mr-2 h-4 w-4" />
              Ablehnen
            </Button>
          )}
          
          <div className="flex-1" />
          
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Schliessen
          </Button>

          {canFirstApprove && (
            <Button onClick={() => firstApproval.mutate()} disabled={isPending}>
              {firstApproval.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CheckCircle className="mr-2 h-4 w-4" />
              Erste Freigabe
            </Button>
          )}

          {canSecondApprove && (
            <Button onClick={() => secondApproval.mutate()} disabled={isPending}>
              {secondApproval.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CheckCheck className="mr-2 h-4 w-4" />
              Finale Freigabe
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
