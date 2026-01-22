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
  DialogFooter,
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
  User,
  Calendar,
  FileText,
  Clock,
  Send,
  AlertTriangle,
  CheckCheck,
} from "lucide-react";

interface Invoice {
  id: string;
  vendor_name: string;
  invoice_number: string | null;
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
    onError: (error: any) => {
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
          // First search/create contact
          const contactResult = await callBexioApi("search_contact", { 
            name: invoice.vendor_name 
          });
          
          let contactId: number;
          if (contactResult && contactResult.length > 0) {
            contactId = contactResult[0].id;
          } else {
            const newContact = await callBexioApi("create_contact", {
              name: invoice.vendor_name,
            });
            contactId = newContact.id;
          }

          // Create invoice in Bexio
          const bexioInvoice = await callBexioApi("create_invoice", {
            contact_id: contactId,
            title: `${invoice.invoice_number || "Rechnung"} - ${invoice.vendor_name}`,
            is_valid_from: invoice.invoice_date || new Date().toISOString().split("T")[0],
            is_valid_to: invoice.due_date || new Date().toISOString().split("T")[0],
            positions: [{
              type: "KbPositionCustom",
              text: invoice.notes || invoice.vendor_name,
              amount: "1",
              unit_price: String(invoice.amount),
              account_id: 1, // Default account
            }],
            mwst_type: 0,
            mwst_is_net: true,
          });

          // Update with Bexio reference
          await supabase
            .from("creditor_invoices")
            .update({
              bexio_invoice_id: String(bexioInvoice.id),
              bexio_synced_at: new Date().toISOString(),
            })
            .eq("id", invoice.id);

        } catch (bexioError) {
          console.error("Bexio sync error:", bexioError);
          // Don't fail the approval, just note it wasn't synced
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
    onError: (error: any) => {
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
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!invoice) return null;

  const canFirstApprove = invoice.status === "pending_review" && !invoice.first_approver_id;
  const canSecondApprove = invoice.status === "first_approval" && 
    invoice.first_approver_id && 
    invoice.first_approver_id !== user?.id;
  const canReject = invoice.status !== "approved" && invoice.status !== "rejected" && invoice.status !== "paid";
  const isApproved = invoice.status === "approved" || invoice.status === "paid";
  const isRejected = invoice.status === "rejected";

  const isPending = firstApproval.isPending || secondApproval.isPending || rejectInvoice.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
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

        <DialogFooter className="flex-col sm:flex-row gap-2">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
