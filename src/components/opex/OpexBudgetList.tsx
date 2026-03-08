import { useState, useEffect } from "react";
import { useOpexBudgets, OpexBudget, OpexLineItem } from "@/hooks/useOpexBudgets";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Send,
  Clock,
  FileText,
  Loader2,
} from "lucide-react";
import { CreateOpexBudgetDialog } from "./CreateOpexBudgetDialog";

interface CostCenter {
  id: string;
  code: string;
  name: string;
}

interface OpexBudgetListProps {
  costCenters: CostCenter[];
}

export function OpexBudgetList({ costCenters }: OpexBudgetListProps) {
  const { hasAnyRole } = useAuth();
  const {
    budgets,
    isLoading,
    fetchLineItems,
    createBudget,
    approveBudget,
    rejectBudget,
    submitBudget,
  } = useOpexBudgets();

  const canApprove = hasAnyRole(["finance", "management"]);
  const [expandedBudget, setExpandedBudget] = useState<string | null>(null);
  const [lineItemsMap, setLineItemsMap] = useState<Record<string, OpexLineItem[]>>({});
  const [loadingItems, setLoadingItems] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [rejectDialog, setRejectDialog] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const toggleExpand = async (budgetId: string) => {
    if (expandedBudget === budgetId) {
      setExpandedBudget(null);
      return;
    }
    setExpandedBudget(budgetId);
    if (!lineItemsMap[budgetId]) {
      setLoadingItems(budgetId);
      const items = await fetchLineItems(budgetId);
      setLineItemsMap((prev) => ({ ...prev, [budgetId]: items }));
      setLoadingItems(null);
    }
  };

  const handleReject = async () => {
    if (!rejectDialog || !rejectReason.trim()) return;
    await rejectBudget(rejectDialog, rejectReason);
    setRejectDialog(null);
    setRejectReason("");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary"><FileText className="h-3 w-3 mr-1" />Entwurf</Badge>;
      case "pending":
        return <Badge variant="outline" className="border-warning text-warning"><Clock className="h-3 w-3 mr-1" />Eingereicht</Badge>;
      case "approved":
        return <Badge className="bg-success text-success-foreground"><CheckCircle className="h-3 w-3 mr-1" />Genehmigt</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Abgelehnt</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number, currency: string = "CHF") =>
    new Intl.NumberFormat("de-CH", { style: "currency", currency }).format(amount);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">OPEX-Budgets</h3>
        <Button onClick={() => setShowCreate(true)}>
          <FileText className="h-4 w-4 mr-2" />
          Neues Budget
        </Button>
      </div>

      {/* Budget List */}
      {budgets.length === 0 ? (
        <div className="card-state p-8 text-center text-muted-foreground">
          Noch keine OPEX-Budgets vorhanden.
        </div>
      ) : (
        <div className="space-y-3">
          {budgets.map((budget) => (
            <div key={budget.id} className="card-state overflow-hidden">
              <Collapsible open={expandedBudget === budget.id} onOpenChange={() => toggleExpand(budget.id)}>
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      {expandedBudget === budget.id ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div className="text-left">
                        <p className="font-medium text-foreground">
                          Budget {budget.period}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Erstellt: {formatDate(budget.submitted_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {getStatusBadge(budget.status)}
                      <span className="text-sm font-semibold text-foreground">
                        {formatCurrency(budget.total_amount, budget.currency)}
                      </span>
                    </div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="border-t border-border px-4 pb-4">
                    {/* Line Items */}
                    {loadingItems === budget.id ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="mt-3">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-2 text-xs text-muted-foreground font-medium">Kategorie</th>
                              <th className="text-left py-2 text-xs text-muted-foreground font-medium">Bezeichnung</th>
                              <th className="text-right py-2 text-xs text-muted-foreground font-medium">Betrag</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(lineItemsMap[budget.id] || []).map((item) => (
                              <tr key={item.id} className="border-b border-border/50">
                                <td className="py-2">
                                  <Badge variant="outline" className="text-xs">{item.category}</Badge>
                                </td>
                                <td className="py-2 text-foreground">{item.label}</td>
                                <td className="py-2 text-right font-medium text-foreground">
                                  {formatCurrency(item.amount, budget.currency)}
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-accent/5">
                              <td colSpan={2} className="py-2 font-semibold text-foreground">Gesamt</td>
                              <td className="py-2 text-right font-bold text-accent">
                                {formatCurrency(budget.total_amount, budget.currency)}
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        {budget.notes && (
                          <p className="mt-3 text-sm text-muted-foreground">
                            <span className="font-medium">Notizen:</span> {budget.notes}
                          </p>
                        )}

                        {budget.rejection_reason && (
                          <p className="mt-3 text-sm text-destructive">
                            <span className="font-medium">Ablehnungsgrund:</span> {budget.rejection_reason}
                          </p>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2 mt-4">
                          {budget.status === "draft" && (
                            <Button size="sm" onClick={() => submitBudget(budget.id)}>
                              <Send className="h-4 w-4 mr-1" /> Einreichen
                            </Button>
                          )}
                          {canApprove && budget.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-success border-success hover:bg-success/10"
                                onClick={() => approveBudget(budget.id)}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" /> Genehmigen
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive border-destructive hover:bg-destructive/10"
                                onClick={() => setRejectDialog(budget.id)}
                              >
                                <XCircle className="h-4 w-4 mr-1" /> Ablehnen
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <CreateOpexBudgetDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        costCenters={costCenters}
        onSubmit={createBudget}
      />

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={() => { setRejectDialog(null); setRejectReason(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Budget ablehnen</DialogTitle>
            <DialogDescription>Bitte geben Sie einen Grund für die Ablehnung an.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Ablehnungsgrund..."
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialog(null); setRejectReason(""); }}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim()}>
              Ablehnen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
