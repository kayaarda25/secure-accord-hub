import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { useAuth } from "@/contexts/AuthContext";
import { useAuditLog } from "@/hooks/useAuditLog";
import { supabase } from "@/integrations/supabase/client";
import {
  Receipt,
  Plus,
  Filter,
  Download,
  Upload,
  CheckCircle,
  Clock,
  XCircle,
  MoreHorizontal,
  FileText,
  Eye,
  ChevronRight,
  Loader2,
} from "lucide-react";

interface CostCenter {
  id: string;
  code: string;
  name: string;
  country: string | null;
  budget_annual: number;
  budget_used: number;
}

interface OpexExpense {
  id: string;
  expense_number: string;
  title: string;
  description: string | null;
  cost_center_id: string;
  amount: number;
  currency: string;
  expense_date: string;
  status: string;
  submitted_at: string;
  cost_center?: CostCenter;
}

export default function Opex() {
  const { user, hasAnyRole } = useAuth();
  const { logAction } = useAuditLog();
  const [expenses, setExpenses] = useState<OpexExpense[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewExpense, setShowNewExpense] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    cost_center_id: "",
    amount: "",
    currency: "CHF",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canApprove = hasAnyRole(["finance", "management"]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch expenses
      const { data: expensesData } = await supabase
        .from("opex_expenses")
        .select("*, cost_center:cost_centers(*)")
        .order("submitted_at", { ascending: false });

      if (expensesData) {
        setExpenses(expensesData as unknown as OpexExpense[]);
      }

      // Fetch cost centers
      const { data: costCentersData } = await supabase
        .from("cost_centers")
        .select("*")
        .eq("is_active", true);

      if (costCentersData) {
        setCostCenters(costCentersData as CostCenter[]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("opex_expenses")
        .insert({
          title: formData.title,
          description: formData.description || null,
          cost_center_id: formData.cost_center_id,
          amount: parseFloat(formData.amount),
          currency: formData.currency,
          submitted_by: user.id,
          expense_number: "", // Will be auto-generated
        })
        .select()
        .single();

      if (error) throw error;

      // Upload receipt if selected
      if (selectedFile && data) {
        const filePath = `${user.id}/${data.id}/${selectedFile.name}`;
        await supabase.storage.from("receipts").upload(filePath, selectedFile);

        await supabase.from("opex_receipts").insert({
          expense_id: data.id,
          file_name: selectedFile.name,
          file_path: filePath,
          file_size: selectedFile.size,
          mime_type: selectedFile.type,
          uploaded_by: user.id,
        });
      }

      await logAction("CREATE", "opex_expenses", data?.id);

      // Reset form
      setFormData({
        title: "",
        description: "",
        cost_center_id: "",
        amount: "",
        currency: "CHF",
      });
      setSelectedFile(null);
      setShowNewExpense(false);
      fetchData();
    } catch (error) {
      console.error("Error submitting expense:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (expenseId: string, stage: "supervisor" | "finance") => {
    if (!user) return;

    try {
      const updateData = stage === "supervisor" 
        ? {
            status: "approved_supervisor" as const,
            supervisor_id: user.id,
            supervisor_approved_at: new Date().toISOString(),
          }
        : {
            status: "approved_finance" as const,
            finance_approver_id: user.id,
            finance_approved_at: new Date().toISOString(),
          };

      await supabase
        .from("opex_expenses")
        .update(updateData)
        .eq("id", expenseId);

      await logAction("APPROVE", "opex_expenses", expenseId, null, updateData);
      fetchData();
    } catch (error) {
      console.error("Error approving expense:", error);
    }
  };

  const handleReject = async (expenseId: string, reason: string) => {
    if (!user) return;

    try {
      await supabase
        .from("opex_expenses")
        .update({
          status: "rejected",
          rejected_by: user.id,
          rejected_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq("id", expenseId);

      await logAction("REJECT", "opex_expenses", expenseId);
      fetchData();
    } catch (error) {
      console.error("Error rejecting expense:", error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded status-warning">
            <Clock size={12} />
            Ausstehend
          </span>
        );
      case "approved_supervisor":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded status-info">
            <CheckCircle size={12} />
            Vorgesetzter OK
          </span>
        );
      case "approved_finance":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded status-success">
            <CheckCircle size={12} />
            Genehmigt
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded status-critical">
            <XCircle size={12} />
            Abgelehnt
          </span>
        );
      default:
        return null;
    }
  };

  const formatCurrency = (amount: number, currency: string = "CHF") => {
    return new Intl.NumberFormat("de-CH", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Calculate totals
  const totalPending = expenses
    .filter((e) => e.status === "pending" || e.status === "approved_supervisor")
    .reduce((sum, e) => sum + e.amount, 0);
  const totalApproved = expenses
    .filter((e) => e.status === "approved_finance")
    .reduce((sum, e) => sum + e.amount, 0);

  if (isLoading) {
    return (
      <Layout title="OPEX" subtitle="Betriebskosten-Verwaltung">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="OPEX" subtitle="Betriebskosten-Verwaltung">
      {/* Action Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-muted rounded-lg text-sm font-medium text-foreground hover:bg-muted/80 transition-colors flex items-center gap-2">
            <Filter size={16} />
            Filter
          </button>
          <select className="px-4 py-2 bg-muted rounded-lg text-sm font-medium text-foreground border-0 focus:ring-2 focus:ring-accent">
            <option>Alle Status</option>
            <option>Ausstehend</option>
            <option>Genehmigt</option>
            <option>Abgelehnt</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-muted rounded-lg text-sm font-medium text-foreground hover:bg-muted/80 transition-colors flex items-center gap-2">
            <Download size={16} />
            Export
          </button>
          <button
            onClick={() => setShowNewExpense(true)}
            className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-2 glow-gold"
          >
            <Plus size={16} />
            Neue Ausgabe
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Ausstehend"
          value={formatCurrency(totalPending)}
          changeLabel={`${expenses.filter((e) => e.status === "pending").length} Anfragen`}
          icon={<Clock size={20} className="text-warning" />}
          variant="warning"
        />
        <MetricCard
          title="Genehmigt (Monat)"
          value={formatCurrency(totalApproved)}
          changeLabel={`${expenses.filter((e) => e.status === "approved_finance").length} Ausgaben`}
          icon={<CheckCircle size={20} className="text-success" />}
          variant="success"
        />
        <MetricCard
          title="Kostenstellen"
          value={costCenters.length.toString()}
          changeLabel="Aktive Stellen"
          icon={<Receipt size={20} className="text-muted-foreground" />}
        />
        <MetricCard
          title="Budget verbraucht"
          value="68%"
          changeLabel="YTD"
          icon={<Receipt size={20} className="text-accent" />}
          variant="accent"
        />
      </div>

      {/* Cost Centers Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {costCenters.slice(0, 4).map((cc, index) => {
          const usagePercent = cc.budget_annual > 0 
            ? Math.round((cc.budget_used / cc.budget_annual) * 100) 
            : 0;
          return (
            <div
              key={cc.id}
              className="card-state p-4 animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="badge-gold">{cc.code}</span>
                <span className="text-xs text-muted-foreground">{cc.country}</span>
              </div>
              <p className="text-sm font-medium text-foreground mb-2">{cc.name}</p>
              <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all ${
                    usagePercent > 90
                      ? "bg-destructive"
                      : usagePercent > 70
                      ? "bg-warning"
                      : "bg-success"
                  }`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  {formatCurrency(cc.budget_used)}
                </span>
                <span className="text-foreground font-medium">{usagePercent}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Expenses Table */}
      <div className="card-state">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">OPEX-Anfragen</h3>
          <span className="text-sm text-muted-foreground">
            {expenses.length} Ausgaben
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Ausgabe
                </th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                  Kostenstelle
                </th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="text-right p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Betrag
                </th>
                <th className="w-32"></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense, index) => (
                <tr
                  key={expense.id}
                  className="table-row-state animate-fade-in"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <td className="p-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {expense.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {expense.expense_number} • {formatDate(expense.submitted_at)}
                      </p>
                    </div>
                  </td>
                  <td className="p-4 hidden md:table-cell">
                    <span className="badge-gold">
                      {expense.cost_center?.code || "N/A"}
                    </span>
                  </td>
                  <td className="p-4">{getStatusBadge(expense.status)}</td>
                  <td className="p-4 text-right">
                    <span className="text-sm font-semibold text-foreground">
                      {formatCurrency(expense.amount, expense.currency)}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1 justify-end">
                      {canApprove && expense.status === "pending" && (
                        <button
                          onClick={() => handleApprove(expense.id, "supervisor")}
                          className="p-2 rounded hover:bg-success/10 text-success transition-colors"
                          title="Genehmigen (Vorgesetzter)"
                        >
                          <CheckCircle size={16} />
                        </button>
                      )}
                      {canApprove && expense.status === "approved_supervisor" && (
                        <button
                          onClick={() => handleApprove(expense.id, "finance")}
                          className="p-2 rounded hover:bg-success/10 text-success transition-colors"
                          title="Genehmigen (Finance)"
                        >
                          <CheckCircle size={16} />
                        </button>
                      )}
                      {canApprove && (expense.status === "pending" || expense.status === "approved_supervisor") && (
                        <button
                          onClick={() => handleReject(expense.id, "Abgelehnt")}
                          className="p-2 rounded hover:bg-destructive/10 text-destructive transition-colors"
                          title="Ablehnen"
                        >
                          <XCircle size={16} />
                        </button>
                      )}
                      <button className="p-2 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                        <Eye size={16} />
                      </button>
                      <button className="p-2 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                        <MoreHorizontal size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    Keine OPEX-Ausgaben vorhanden
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Expense Modal */}
      {showNewExpense && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card-state w-full max-w-lg p-6 animate-fade-in">
            <h2 className="text-xl font-semibold text-foreground mb-6">
              Neue OPEX-Ausgabe
            </h2>
            <form onSubmit={handleSubmitExpense} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  Titel
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="Beschreibung der Ausgabe"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  Kostenstelle
                </label>
                <select
                  value={formData.cost_center_id}
                  onChange={(e) =>
                    setFormData({ ...formData, cost_center_id: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                  required
                >
                  <option value="">Kostenstelle wählen</option>
                  {costCenters.map((cc) => (
                    <option key={cc.id} value={cc.id}>
                      {cc.code} - {cc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    Betrag
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    Währung
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) =>
                      setFormData({ ...formData, currency: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="CHF">CHF</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="UGX">UGX</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  Beschreibung
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                  rows={3}
                  placeholder="Zusätzliche Details..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  Beleg hochladen
                </label>
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-accent/50 transition-colors cursor-pointer">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) =>
                      setSelectedFile(e.target.files?.[0] || null)
                    }
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    {selectedFile ? (
                      <div className="flex items-center justify-center gap-2 text-accent">
                        <FileText size={20} />
                        <span className="text-sm">{selectedFile.name}</span>
                      </div>
                    ) : (
                      <>
                        <Upload size={24} className="mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                          PDF, JPG oder PNG (max. 10MB)
                        </p>
                      </>
                    )}
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewExpense(false)}
                  className="flex-1 py-2.5 bg-muted text-foreground rounded-lg font-medium hover:bg-muted/80 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  Einreichen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
