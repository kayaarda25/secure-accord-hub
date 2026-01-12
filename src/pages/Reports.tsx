import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  BarChart,
  FileText,
  Download,
  Plus,
  Clock,
  Calendar,
  Mail,
  Trash2,
  Play,
  Building2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface ScheduledReport {
  id: string;
  name: string;
  report_type: string;
  frequency: string;
  recipients: string[];
  format: string;
  last_run_at: string | null;
  next_run_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface OpexSummary {
  organization_id: string;
  organization_name: string;
  org_type: string;
  total_amount: number;
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  budget_used: number;
  budget_total: number;
  categories: { [key: string]: number };
}

interface OpexMonthlyEntry {
  id: string;
  organization_name: string;
  org_type: string;
  period: string; // e.g., "Januar 2025"
  period_key: string; // e.g., "2025-01"
  total_amount: number;
  currency: string;
  expense_count: number;
  categories: { category: string; amount: number }[];
  expenses: OpexExpenseDetail[];
}

interface OpexExpenseDetail {
  id: string;
  expense_number: string;
  title: string;
  amount: number;
  currency: string;
  category: string | null;
  status: string;
  expense_date: string;
  submitted_by_name: string;
  cost_center_name: string;
  organization_name: string;
}

const reportTypes = [
  { value: "opex", label: "OPEX-Übersicht", icon: FileText },
  { value: "declarations", label: "Deklarationen", icon: FileText },
  { value: "budget", label: "Budget-Analyse", icon: BarChart },
  { value: "compliance", label: "Compliance-Status", icon: FileText },
  { value: "financial_summary", label: "Finanzzusammenfassung", icon: BarChart },
];

const frequencies = [
  { value: "daily", label: "Täglich" },
  { value: "weekly", label: "Wöchentlich" },
  { value: "monthly", label: "Monatlich" },
  { value: "quarterly", label: "Quartalsweise" },
];

const formats = [
  { value: "pdf", label: "PDF" },
  { value: "excel", label: "Excel" },
  { value: "csv", label: "CSV" },
];

export default function Reports() {
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);
  const [isAddReportOpen, setIsAddReportOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [opexSummaries, setOpexSummaries] = useState<OpexSummary[]>([]);
  const [opexMonthlyEntries, setOpexMonthlyEntries] = useState<OpexMonthlyEntry[]>([]);
  const [isLoadingOpex, setIsLoadingOpex] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<OpexMonthlyEntry | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const monthNames = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember"
  ];

  useEffect(() => {
    fetchScheduledReports();
    fetchOpexData();
  }, []);

  const fetchOpexData = async () => {
    setIsLoadingOpex(true);
    try {
      // Fetch organizations
      const { data: orgs } = await supabase
        .from("organizations")
        .select("id, name, org_type")
        .in("org_type", ["mgi_media", "mgi_communications", "gateway"]);

      // Fetch all OPEX expenses with cost center info
      const { data: expenses } = await supabase
        .from("opex_expenses")
        .select(`
          id,
          expense_number,
          title,
          amount,
          currency,
          category,
          status,
          expense_date,
          submitted_by,
          cost_center_id
        `)
        .order("expense_date", { ascending: false });

      // Fetch cost centers with organization info
      const { data: costCenters } = await supabase
        .from("cost_centers")
        .select("id, name, organization_id, budget_annual, budget_used");

      // Fetch profiles for submitter names
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name");

      if (orgs && expenses && costCenters && profiles) {
        // Create lookup maps
        const costCenterMap = new Map(costCenters.map(cc => [cc.id, cc]));
        const profileMap = new Map(profiles.map(p => [p.user_id, p]));
        const orgMap = new Map(orgs.map(o => [o.id, o]));

        // Build detailed expense list with org info
        const detailedExpenses: OpexExpenseDetail[] = expenses.map(exp => {
          const costCenter = costCenterMap.get(exp.cost_center_id);
          const org = costCenter ? orgMap.get(costCenter.organization_id) : null;
          const profile = profileMap.get(exp.submitted_by);
          
          return {
            id: exp.id,
            expense_number: exp.expense_number,
            title: exp.title,
            amount: exp.amount,
            currency: exp.currency,
            category: exp.category,
            status: exp.status,
            expense_date: exp.expense_date,
            submitted_by_name: profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Unbekannt" : "Unbekannt",
            cost_center_name: costCenter?.name || "–",
            organization_name: org ? getOrgDisplayName(org.org_type) : "–",
          };
        });

        // Group expenses by organization and month
        const monthlyMap = new Map<string, OpexMonthlyEntry>();

        detailedExpenses.forEach(exp => {
          const date = new Date(exp.expense_date);
          const periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          const period = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
          const key = `${exp.organization_name}-${periodKey}`;

          if (!monthlyMap.has(key)) {
            const org = orgs.find(o => getOrgDisplayName(o.org_type) === exp.organization_name);
            monthlyMap.set(key, {
              id: key,
              organization_name: exp.organization_name,
              org_type: org?.org_type || "",
              period,
              period_key: periodKey,
              total_amount: 0,
              currency: exp.currency,
              expense_count: 0,
              categories: [],
              expenses: [],
            });
          }

          const entry = monthlyMap.get(key)!;
          entry.total_amount += Number(exp.amount);
          entry.expense_count += 1;
          entry.expenses.push(exp);
        });

        // Calculate categories for each monthly entry
        monthlyMap.forEach(entry => {
          const categoryMap = new Map<string, number>();
          entry.expenses.forEach(exp => {
            const cat = exp.category || "Sonstige";
            categoryMap.set(cat, (categoryMap.get(cat) || 0) + Number(exp.amount));
          });
          entry.categories = Array.from(categoryMap.entries())
            .map(([category, amount]) => ({ category, amount }))
            .sort((a, b) => b.amount - a.amount);
        });

        // Sort by period (newest first) and then by organization
        const sortedEntries = Array.from(monthlyMap.values()).sort((a, b) => {
          if (a.period_key !== b.period_key) {
            return b.period_key.localeCompare(a.period_key);
          }
          return a.organization_name.localeCompare(b.organization_name);
        });

        setOpexMonthlyEntries(sortedEntries);

        // Build summaries per organization
        const summaries: OpexSummary[] = orgs.map(org => {
          const orgCostCenters = costCenters.filter(cc => cc.organization_id === org.id);
          const orgCostCenterIds = orgCostCenters.map(cc => cc.id);
          const orgExpenses = expenses.filter(e => orgCostCenterIds.includes(e.cost_center_id));

          const categories: { [key: string]: number } = {};
          orgExpenses.forEach(e => {
            const cat = e.category || "Sonstige";
            categories[cat] = (categories[cat] || 0) + Number(e.amount);
          });

          return {
            organization_id: org.id,
            organization_name: getOrgDisplayName(org.org_type),
            org_type: org.org_type || "",
            total_amount: orgExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
            pending_count: orgExpenses.filter(e => e.status === "pending" || e.status === "approved_supervisor").length,
            approved_count: orgExpenses.filter(e => e.status === "approved_finance").length,
            rejected_count: orgExpenses.filter(e => e.status === "rejected").length,
            budget_used: orgCostCenters.reduce((sum, cc) => sum + Number(cc.budget_used || 0), 0),
            budget_total: orgCostCenters.reduce((sum, cc) => sum + Number(cc.budget_annual || 0), 0),
            categories,
          };
        });

        setOpexSummaries(summaries);
      }
    } catch (error) {
      console.error("Error fetching OPEX data:", error);
    } finally {
      setIsLoadingOpex(false);
    }
  };

  const generateOpexPdf = (entry: OpexMonthlyEntry) => {
    // Create print-friendly HTML
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>OPEX Report - ${entry.organization_name} - ${entry.period}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
          h2 { color: #666; margin-top: 30px; }
          .summary { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
          .summary-item { text-align: center; }
          .summary-label { font-size: 12px; color: #666; }
          .summary-value { font-size: 24px; font-weight: bold; color: #333; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background: #f0f0f0; font-weight: bold; }
          .amount { text-align: right; font-weight: bold; }
          .category-section { margin-top: 30px; }
          .category-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
          .footer { margin-top: 40px; font-size: 12px; color: #666; text-align: center; }
        </style>
      </head>
      <body>
        <h1>OPEX Report</h1>
        <h2>${entry.organization_name} - ${entry.period}</h2>
        
        <div class="summary">
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-label">Gesamtbetrag</div>
              <div class="summary-value">${formatCurrency(entry.total_amount, entry.currency)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Anzahl Positionen</div>
              <div class="summary-value">${entry.expense_count}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Kategorien</div>
              <div class="summary-value">${entry.categories.length}</div>
            </div>
          </div>
        </div>
        
        <h2>Aufschlüsselung nach Kategorie</h2>
        <div class="category-section">
          ${entry.categories.map(cat => `
            <div class="category-item">
              <span>${cat.category}</span>
              <span class="amount">${formatCurrency(cat.amount, entry.currency)}</span>
            </div>
          `).join('')}
        </div>
        
        <h2>Einzelpositionen</h2>
        <table>
          <thead>
            <tr>
              <th>Nr.</th>
              <th>Titel</th>
              <th>Kategorie</th>
              <th>Datum</th>
              <th style="text-align: right;">Betrag</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${entry.expenses.map(exp => `
              <tr>
                <td>${exp.expense_number}</td>
                <td>${exp.title}</td>
                <td>${exp.category || '–'}</td>
                <td>${format(new Date(exp.expense_date), "dd.MM.yyyy", { locale: de })}</td>
                <td class="amount">${formatCurrency(exp.amount, exp.currency)}</td>
                <td>${exp.status === 'approved_finance' ? 'Genehmigt' : exp.status === 'rejected' ? 'Abgelehnt' : exp.status === 'approved_supervisor' ? 'Vorgesetzter OK' : 'Ausstehend'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="footer">
          Generiert am ${format(new Date(), "dd.MM.yyyy 'um' HH:mm", { locale: de })} Uhr
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }

    toast({
      title: "PDF generiert",
      description: `OPEX-Report für ${entry.organization_name} - ${entry.period} wurde erstellt.`,
    });
  };

  const getOrgDisplayName = (orgType: string | null): string => {
    if (orgType === "mgi_media") return "MGI Media";
    if (orgType === "mgi_communications") return "MGI Communications";
    if (orgType === "gateway") return "Gateway";
    return "Unbekannt";
  };

  const formatCurrency = (amount: number, currency: string = "CHF"): string => {
    return new Intl.NumberFormat("de-CH", {
      style: "currency",
      currency,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved_finance":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Genehmigt</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Abgelehnt</Badge>;
      case "approved_supervisor":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Vorgesetzter OK</Badge>;
      case "pending":
      default:
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Ausstehend</Badge>;
    }
  };

  const fetchScheduledReports = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("scheduled_reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching reports:", error);
    } else {
      setScheduledReports(data || []);
    }
    setIsLoading(false);
  };

  const handleAddReport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    const formData = new FormData(e.currentTarget);
    const recipients = (formData.get("recipients") as string)
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);

    const { error } = await supabase.from("scheduled_reports").insert({
      name: formData.get("name") as string,
      report_type: formData.get("report_type") as string,
      frequency: formData.get("frequency") as string,
      format: formData.get("format") as string,
      recipients,
      is_active: true,
      created_by: user.id,
    });

    if (error) {
      toast({ title: "Fehler", description: "Report konnte nicht erstellt werden", variant: "destructive" });
    } else {
      toast({ title: "Erfolg", description: "Geplanter Report wurde erstellt" });
      setIsAddReportOpen(false);
      fetchScheduledReports();
    }
  };

  const handleGenerateReport = async (type: string, format: string) => {
    setIsGenerating(type);
    
    // Simulate report generation
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    toast({
      title: "Report generiert",
      description: `Der ${reportTypes.find((r) => r.value === type)?.label}-Report wurde erstellt.`,
    });
    
    setIsGenerating(null);
  };

  const handleDeleteReport = async (id: string) => {
    const { error } = await supabase
      .from("scheduled_reports")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Fehler", description: "Report konnte nicht gelöscht werden", variant: "destructive" });
    } else {
      toast({ title: "Gelöscht", description: "Geplanter Report wurde gelöscht" });
      fetchScheduledReports();
    }
  };

  const getReportTypeLabel = (type: string) => {
    return reportTypes.find((r) => r.value === type)?.label || type;
  };

  const getFrequencyLabel = (freq: string) => {
    return frequencies.find((f) => f.value === freq)?.label || freq;
  };

  return (
    <Layout title="Reports" subtitle="Berichte generieren und automatisieren">
      <Tabs defaultValue="opex-overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="opex-overview">OPEX-Übersicht</TabsTrigger>
          <TabsTrigger value="generate">Report erstellen</TabsTrigger>
          <TabsTrigger value="scheduled">Geplante Reports</TabsTrigger>
        </TabsList>

        {/* OPEX Overview Tab */}
        <TabsContent value="opex-overview" className="space-y-6">
          {isLoadingOpex ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p>Lade OPEX-Daten...</p>
            </div>
          ) : (
            <>
              {/* Organization Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {opexSummaries.map((summary) => (
                  <Card key={summary.organization_id} className="overflow-hidden">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-3">
                        <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
                          summary.org_type === "mgi_media" 
                            ? "bg-blue-500/10" 
                            : summary.org_type === "mgi_communications"
                            ? "bg-purple-500/10"
                            : "bg-green-500/10"
                        }`}>
                          <Building2 className={`h-6 w-6 ${
                            summary.org_type === "mgi_media" 
                              ? "text-blue-500" 
                              : summary.org_type === "mgi_communications"
                              ? "text-purple-500"
                              : "text-green-500"
                          }`} />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{summary.organization_name}</CardTitle>
                          <CardDescription>OPEX-Zusammenfassung</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Total Amount */}
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Gesamtausgaben</span>
                        </div>
                        <span className="font-bold text-lg">{formatCurrency(summary.total_amount)}</span>
                      </div>

                      {/* Status Counts */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center p-2 bg-yellow-500/10 rounded-lg">
                          <AlertCircle className="h-4 w-4 text-yellow-600 mx-auto mb-1" />
                          <div className="text-lg font-bold text-yellow-600">{summary.pending_count}</div>
                          <div className="text-xs text-muted-foreground">Ausstehend</div>
                        </div>
                        <div className="text-center p-2 bg-green-500/10 rounded-lg">
                          <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto mb-1" />
                          <div className="text-lg font-bold text-green-600">{summary.approved_count}</div>
                          <div className="text-xs text-muted-foreground">Genehmigt</div>
                        </div>
                        <div className="text-center p-2 bg-red-500/10 rounded-lg">
                          <XCircle className="h-4 w-4 text-red-600 mx-auto mb-1" />
                          <div className="text-lg font-bold text-red-600">{summary.rejected_count}</div>
                          <div className="text-xs text-muted-foreground">Abgelehnt</div>
                        </div>
                      </div>

                      {/* Budget Progress */}
                      {summary.budget_total > 0 && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Budget-Nutzung</span>
                            <span className="font-medium">
                              {Math.round((summary.budget_used / summary.budget_total) * 100)}%
                            </span>
                          </div>
                          <Progress 
                            value={(summary.budget_used / summary.budget_total) * 100} 
                            className="h-2"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{formatCurrency(summary.budget_used)}</span>
                            <span>{formatCurrency(summary.budget_total)}</span>
                          </div>
                        </div>
                      )}

                      {/* Top Categories */}
                      {Object.keys(summary.categories).length > 0 && (
                        <div className="space-y-2">
                          <div className="text-sm font-medium">Top Kategorien</div>
                          <div className="space-y-1">
                            {Object.entries(summary.categories)
                              .sort(([, a], [, b]) => b - a)
                              .slice(0, 3)
                              .map(([cat, amount]) => (
                                <div key={cat} className="flex justify-between text-sm">
                                  <span className="text-muted-foreground truncate">{cat}</span>
                                  <span className="font-medium">{formatCurrency(amount)}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Combined Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Gesamtübersicht aller Organisationen
                  </CardTitle>
                  <CardDescription>
                    Aggregierte OPEX-Daten von MGI Media, MGI Communications und Gateway
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-muted/50 rounded-lg text-center">
                      <div className="text-2xl font-bold text-primary">
                        {formatCurrency(opexSummaries.reduce((sum, s) => sum + s.total_amount, 0))}
                      </div>
                      <div className="text-sm text-muted-foreground">Gesamtausgaben</div>
                    </div>
                    <div className="p-4 bg-yellow-500/10 rounded-lg text-center">
                      <div className="text-2xl font-bold text-yellow-600">
                        {opexSummaries.reduce((sum, s) => sum + s.pending_count, 0)}
                      </div>
                      <div className="text-sm text-muted-foreground">Ausstehend gesamt</div>
                    </div>
                    <div className="p-4 bg-green-500/10 rounded-lg text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {opexSummaries.reduce((sum, s) => sum + s.approved_count, 0)}
                      </div>
                      <div className="text-sm text-muted-foreground">Genehmigt gesamt</div>
                    </div>
                    <div className="p-4 bg-red-500/10 rounded-lg text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {opexSummaries.reduce((sum, s) => sum + s.rejected_count, 0)}
                      </div>
                      <div className="text-sm text-muted-foreground">Abgelehnt gesamt</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Monthly OPEX Overview by Organization */}
              <Card>
                <CardHeader>
                  <CardTitle>OPEX nach Organisation und Monat</CardTitle>
                  <CardDescription>
                    Monatliche OPEX-Zusammenfassung von MGI Media, MGI Communications und Gateway
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {opexMonthlyEntries.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Keine OPEX-Einträge vorhanden</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="font-semibold">Organisation</TableHead>
                            <TableHead className="font-semibold">Periode</TableHead>
                            <TableHead className="font-semibold">Anzahl</TableHead>
                            <TableHead className="font-semibold">Top Kategorien</TableHead>
                            <TableHead className="font-semibold text-right">Gesamtbetrag</TableHead>
                            <TableHead className="font-semibold text-center">Aktionen</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {opexMonthlyEntries.map((entry) => (
                            <TableRow key={entry.id} className="hover:bg-muted/20">
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                                    entry.org_type === "mgi_media" 
                                      ? "bg-blue-500/10" 
                                      : entry.org_type === "mgi_communications"
                                      ? "bg-purple-500/10"
                                      : "bg-green-500/10"
                                  }`}>
                                    <Building2 className={`h-4 w-4 ${
                                      entry.org_type === "mgi_media" 
                                        ? "text-blue-500" 
                                        : entry.org_type === "mgi_communications"
                                        ? "text-purple-500"
                                        : "text-green-500"
                                    }`} />
                                  </div>
                                  <span className={`font-medium ${
                                    entry.org_type === "mgi_media"
                                      ? "text-blue-600"
                                      : entry.org_type === "mgi_communications"
                                      ? "text-purple-600"
                                      : "text-green-600"
                                  }`}>
                                    {entry.organization_name}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  {entry.period}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{entry.expense_count} Positionen</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1 max-w-[300px]">
                                  {entry.categories.slice(0, 3).map((cat, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {cat.category}: {formatCurrency(cat.amount, entry.currency)}
                                    </Badge>
                                  ))}
                                  {entry.categories.length > 3 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{entry.categories.length - 3} mehr
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="text-lg font-bold">
                                  {formatCurrency(entry.total_amount, entry.currency)}
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex justify-center gap-2">
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => setSelectedEntry(entry)}
                                      >
                                        <FileText className="h-4 w-4 mr-1" />
                                        Details
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                                      <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2">
                                          <Building2 className={`h-5 w-5 ${
                                            entry.org_type === "mgi_media"
                                              ? "text-blue-500"
                                              : entry.org_type === "mgi_communications"
                                              ? "text-purple-500"
                                              : "text-green-500"
                                          }`} />
                                          {entry.organization_name} - {entry.period}
                                        </DialogTitle>
                                      </DialogHeader>
                                      <div className="space-y-4">
                                        {/* Summary */}
                                        <div className="grid grid-cols-3 gap-4">
                                          <div className="p-4 bg-muted/50 rounded-lg text-center">
                                            <div className="text-2xl font-bold">{formatCurrency(entry.total_amount, entry.currency)}</div>
                                            <div className="text-sm text-muted-foreground">Gesamtbetrag</div>
                                          </div>
                                          <div className="p-4 bg-muted/50 rounded-lg text-center">
                                            <div className="text-2xl font-bold">{entry.expense_count}</div>
                                            <div className="text-sm text-muted-foreground">Positionen</div>
                                          </div>
                                          <div className="p-4 bg-muted/50 rounded-lg text-center">
                                            <div className="text-2xl font-bold">{entry.categories.length}</div>
                                            <div className="text-sm text-muted-foreground">Kategorien</div>
                                          </div>
                                        </div>

                                        {/* Categories */}
                                        <div>
                                          <h4 className="font-medium mb-2">Aufschlüsselung nach Kategorie</h4>
                                          <div className="space-y-2">
                                            {entry.categories.map((cat, idx) => (
                                              <div key={idx} className="flex justify-between items-center p-2 bg-muted/30 rounded">
                                                <span>{cat.category}</span>
                                                <span className="font-bold">{formatCurrency(cat.amount, entry.currency)}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>

                                        {/* Expense List */}
                                        <div>
                                          <h4 className="font-medium mb-2">Einzelpositionen</h4>
                                          <Table>
                                            <TableHeader>
                                              <TableRow>
                                                <TableHead>Nr.</TableHead>
                                                <TableHead>Titel</TableHead>
                                                <TableHead>Kategorie</TableHead>
                                                <TableHead>Datum</TableHead>
                                                <TableHead className="text-right">Betrag</TableHead>
                                                <TableHead>Status</TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {entry.expenses.map((exp) => (
                                                <TableRow key={exp.id}>
                                                  <TableCell className="font-mono text-xs">{exp.expense_number}</TableCell>
                                                  <TableCell>{exp.title}</TableCell>
                                                  <TableCell className="text-muted-foreground">{exp.category || "–"}</TableCell>
                                                  <TableCell>{format(new Date(exp.expense_date), "dd.MM.yyyy", { locale: de })}</TableCell>
                                                  <TableCell className="text-right font-medium">{formatCurrency(exp.amount, exp.currency)}</TableCell>
                                                  <TableCell>
                                                    <span className={`text-sm ${
                                                      exp.status === "approved_finance"
                                                        ? "text-green-600"
                                                        : exp.status === "rejected"
                                                        ? "text-red-600"
                                                        : exp.status === "approved_supervisor"
                                                        ? "text-blue-600"
                                                        : "text-yellow-600"
                                                    }`}>
                                                      {exp.status === "approved_finance"
                                                        ? "Genehmigt"
                                                        : exp.status === "rejected"
                                                        ? "Abgelehnt"
                                                        : exp.status === "approved_supervisor"
                                                        ? "Vorgesetzter OK"
                                                        : "Ausstehend"}
                                                    </span>
                                                  </TableCell>
                                                </TableRow>
                                              ))}
                                            </TableBody>
                                          </Table>
                                        </div>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                  <Button 
                                    variant="default" 
                                    size="sm"
                                    onClick={() => generateOpexPdf(entry)}
                                  >
                                    <Download className="h-4 w-4 mr-1" />
                                    PDF
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Generate Reports Tab */}
        <TabsContent value="generate" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reportTypes.map((report) => (
              <Card key={report.value} className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <report.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{report.label}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleGenerateReport(report.value, "pdf")}
                      disabled={isGenerating === report.value}
                    >
                      {isGenerating === report.value ? (
                        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full mr-2" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleGenerateReport(report.value, "excel")}
                      disabled={isGenerating === report.value}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Excel
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleGenerateReport(report.value, "csv")}
                      disabled={isGenerating === report.value}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      CSV
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Quick Date Range Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Zeitraum für Reports</CardTitle>
              <CardDescription>
                Wählen Sie den Zeitraum für die Reportgenerierung
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">Heute</Button>
                  <Button variant="outline" size="sm">Diese Woche</Button>
                  <Button variant="outline" size="sm">Dieser Monat</Button>
                  <Button variant="outline" size="sm">Dieses Quartal</Button>
                  <Button variant="outline" size="sm">Dieses Jahr</Button>
                </div>
                <div className="flex gap-2 items-center ml-auto">
                  <Label>Von:</Label>
                  <Input type="date" className="w-40" />
                  <Label>Bis:</Label>
                  <Input type="date" className="w-40" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scheduled Reports Tab */}
        <TabsContent value="scheduled" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Geplante Reports</CardTitle>
                  <CardDescription>
                    Automatische Reports die regelmäßig generiert und versendet werden
                  </CardDescription>
                </div>
                <Dialog open={isAddReportOpen} onOpenChange={setIsAddReportOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Neuer Report
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Geplanten Report erstellen</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddReport} className="space-y-4">
                      <div>
                        <Label htmlFor="name">Name *</Label>
                        <Input id="name" name="name" required placeholder="z.B. Monatlicher OPEX-Report" />
                      </div>
                      <div>
                        <Label>Report-Typ *</Label>
                        <Select name="report_type" required>
                          <SelectTrigger>
                            <SelectValue placeholder="Auswählen..." />
                          </SelectTrigger>
                          <SelectContent>
                            {reportTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Häufigkeit *</Label>
                        <Select name="frequency" required>
                          <SelectTrigger>
                            <SelectValue placeholder="Auswählen..." />
                          </SelectTrigger>
                          <SelectContent>
                            {frequencies.map((freq) => (
                              <SelectItem key={freq.value} value={freq.value}>
                                {freq.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Format *</Label>
                        <Select name="format" required>
                          <SelectTrigger>
                            <SelectValue placeholder="Auswählen..." />
                          </SelectTrigger>
                          <SelectContent>
                            {formats.map((fmt) => (
                              <SelectItem key={fmt.value} value={fmt.value}>
                                {fmt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="recipients">Empfänger (E-Mails, kommagetrennt) *</Label>
                        <Input
                          id="recipients"
                          name="recipients"
                          required
                          placeholder="email1@example.com, email2@example.com"
                        />
                      </div>
                      <Button type="submit" className="w-full">
                        Report planen
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Laden...</div>
              ) : scheduledReports.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Keine geplanten Reports vorhanden</p>
                  <p className="text-sm">Erstellen Sie Ihren ersten automatisierten Report</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead>Häufigkeit</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>Empfänger</TableHead>
                      <TableHead>Nächste Ausführung</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scheduledReports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium">{report.name}</TableCell>
                        <TableCell>{getReportTypeLabel(report.report_type)}</TableCell>
                        <TableCell>{getFrequencyLabel(report.frequency)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{report.format.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{report.recipients?.length || 0}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {report.next_run_at ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {format(new Date(report.next_run_at), "dd.MM.yyyy HH:mm", { locale: de })}
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={report.is_active ? "default" : "secondary"}>
                            {report.is_active ? "Aktiv" : "Pausiert"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleGenerateReport(report.report_type, report.format)}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDeleteReport(report.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
