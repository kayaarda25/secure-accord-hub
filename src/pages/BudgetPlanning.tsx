import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  Plus,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Target,
  Calendar,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganizationPermissions } from "@/hooks/useOrganizationPermissions";
import { useToast } from "@/hooks/use-toast";

interface CostCenter {
  id: string;
  name: string;
  code: string;
  budget_annual: number;
  budget_used: number;
}

interface BudgetPlan {
  id: string;
  fiscal_year: number;
  cost_center_id: string;
  planned_amount: number;
  q1_amount: number;
  q2_amount: number;
  q3_amount: number;
  q4_amount: number;
  status: string;
  notes: string | null;
  cost_center?: CostCenter;
}

interface BudgetAlert {
  id: string;
  cost_center_id: string;
  threshold_percent: number;
  is_active: boolean;
  cost_center?: CostCenter;
}

export default function BudgetPlanning() {
  const [budgetPlans, setBudgetPlans] = useState<BudgetPlan[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isAddPlanOpen, setIsAddPlanOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { user, hasAnyRole } = useAuth();
  const { permissions: orgPerms, isLoading: orgPermsLoading } = useOrganizationPermissions();
  const { toast } = useToast();

  const canViewBudget = orgPerms.canViewBudget || orgPerms.canCreateBudget;
  const canManage = canViewBudget && orgPerms.canCreateBudget && hasAnyRole(["admin", "management", "finance"]);

  useEffect(() => {
    fetchData();
  }, [selectedYear]);

  const fetchData = async () => {
    setIsLoading(true);
    await Promise.all([fetchCostCenters(), fetchBudgetPlans(), fetchAlerts()]);
    setIsLoading(false);
  };

  const fetchCostCenters = async () => {
    const { data, error } = await supabase
      .from("cost_centers")
      .select("*")
      .eq("is_active", true)
      .like("code", "GW%")
      .order("name");

    if (!error) {
      setCostCenters(data || []);
    }
  };

  const fetchBudgetPlans = async () => {
    const { data, error } = await supabase
      .from("budget_plans")
      .select("*")
      .eq("fiscal_year", selectedYear)
      .order("created_at", { ascending: false });

    if (!error) {
      setBudgetPlans(data || []);
    }
  };

  const fetchAlerts = async () => {
    const { data, error } = await supabase
      .from("budget_alerts")
      .select("*")
      .eq("is_active", true);

    if (!error) {
      setAlerts(data || []);
    }
  };

  const handleAddPlan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    const formData = new FormData(e.currentTarget);
    const plannedAmount = parseFloat(formData.get("planned_amount") as string) || 0;

    const { error } = await supabase.from("budget_plans").insert({
      fiscal_year: selectedYear,
      cost_center_id: formData.get("cost_center_id") as string,
      planned_amount: plannedAmount,
      q1_amount: plannedAmount / 4,
      q2_amount: plannedAmount / 4,
      q3_amount: plannedAmount / 4,
      q4_amount: plannedAmount / 4,
      notes: formData.get("notes") as string,
      status: "draft",
      created_by: user.id,
    });

    if (error) {
      toast({ title: "Fehler", description: "Budget konnte nicht erstellt werden", variant: "destructive" });
    } else {
      toast({ title: "Erfolg", description: "Budgetplan wurde erstellt" });
      setIsAddPlanOpen(false);
      fetchBudgetPlans();
    }
  };

  const getCostCenterName = (id: string) => {
    return costCenters.find((c) => c.id === id)?.name || "Unbekannt";
  };

  const getCostCenterCode = (id: string) => {
    return costCenters.find((c) => c.id === id)?.code || "";
  };

  // Calculate totals
  const totalPlanned = budgetPlans.reduce((sum, p) => sum + (p.planned_amount || 0), 0);
  const totalActual = costCenters.reduce((sum, c) => sum + (c.budget_used || 0), 0);
  const totalBudget = costCenters.reduce((sum, c) => sum + (c.budget_annual || 0), 0);

  // Chart data
  const quarterlyData = [
    {
      name: "Q1",
      Geplant: budgetPlans.reduce((sum, p) => sum + (p.q1_amount || 0), 0),
      Ist: totalActual * 0.25, // Simplified - would need actual quarterly data
    },
    {
      name: "Q2",
      Geplant: budgetPlans.reduce((sum, p) => sum + (p.q2_amount || 0), 0),
      Ist: totalActual * 0.25,
    },
    {
      name: "Q3",
      Geplant: budgetPlans.reduce((sum, p) => sum + (p.q3_amount || 0), 0),
      Ist: totalActual * 0.25,
    },
    {
      name: "Q4",
      Geplant: budgetPlans.reduce((sum, p) => sum + (p.q4_amount || 0), 0),
      Ist: totalActual * 0.25,
    },
  ];

  // Group cost centers by organization (Gateway, MGI C, MGI M)
  const getOrganizationName = (code: string): string => {
    if (code.startsWith("GW")) return "Gateway";
    if (code.startsWith("MGIC")) return "MGI C";
    if (code.startsWith("MGIM")) return "MGI M";
    return code;
  };

  const costCenterData = Object.values(
    costCenters.reduce((acc, cc) => {
      const orgName = getOrganizationName(cc.code);
      if (!acc[orgName]) {
        acc[orgName] = { name: orgName, Budget: 0, Verwendet: 0 };
      }
      acc[orgName].Budget += cc.budget_annual || 0;
      acc[orgName].Verwendet += cc.budget_used || 0;
      return acc;
    }, {} as Record<string, { name: string; Budget: number; Verwendet: number }>)
  );

  // Alerts for over-budget
  const overBudgetCenters = costCenters.filter((cc) => {
    if (!cc.budget_annual) return false;
    const usagePercent = (cc.budget_used / cc.budget_annual) * 100;
    const alert = alerts.find((a) => a.cost_center_id === cc.id);
    return alert ? usagePercent >= alert.threshold_percent : usagePercent >= 80;
  });

  const years = [2024, 2025, 2026, 2027];

  return (
    <Layout title="Budget & Planung" subtitle="Jahresbudgets planen und überwachen">
      {orgPermsLoading ? (
        <div className="text-center py-8 text-muted-foreground">Laden...</div>
      ) : !canViewBudget ? (
        <div className="card-state p-8 max-w-md">
          <h2 className="text-xl font-semibold text-foreground mb-2">Zugriff verweigert</h2>
          <p className="text-muted-foreground">
            Sie haben keine Berechtigung, diese Seite anzuzeigen.
          </p>
        </div>
      ) : (
        <>
          {/* Budget Alerts */}
          {overBudgetCenters.length > 0 && (
            <Card className="mb-6 border-warning bg-warning/5">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-warning">Budget-Warnungen</p>
                    <p className="text-sm text-muted-foreground">
                      {overBudgetCenters.length} Kostenstelle(n) haben den Schwellenwert überschritten
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {overBudgetCenters.map((cc) => (
                        <Badge key={cc.id} variant="outline" className="border-warning text-warning">
                          {cc.code}: {Math.round((cc.budget_used / cc.budget_annual) * 100)}%
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Gesamtbudget</p>
                    <p className="text-2xl font-bold">
                      CHF {totalBudget.toLocaleString("de-CH")}
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Geplant ({selectedYear})</p>
                    <p className="text-2xl font-bold">
                      CHF {totalPlanned.toLocaleString("de-CH")}
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Target className="h-5 w-5 text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Verwendet</p>
                    <p className="text-2xl font-bold">
                      CHF {totalActual.toLocaleString("de-CH")}
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Verbleibend</p>
                    <p className="text-2xl font-bold">
                      CHF {(totalBudget - totalActual).toLocaleString("de-CH")}
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-amber-500" />
                  </div>
                </div>
                <Progress
                  value={totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0}
                  className="mt-3 h-2"
                />
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quartalsübersicht</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={quarterlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value: number) => `CHF ${value.toLocaleString("de-CH")}`}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="Geplant" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Ist" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Budget pro Kostenstelle</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={costCenterData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis dataKey="name" type="category" className="text-xs" width={80} />
                    <Tooltip
                      formatter={(value: number) => `CHF ${value.toLocaleString("de-CH")}`}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="Budget" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="Verwendet" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Budget Plans Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Budgetpläne</CardTitle>
                <div className="flex items-center gap-3">
                  <Select
                    value={selectedYear.toString()}
                    onValueChange={(v) => setSelectedYear(parseInt(v))}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {canManage && (
                    <Dialog open={isAddPlanOpen} onOpenChange={setIsAddPlanOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Neuer Plan
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Budgetplan erstellen</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleAddPlan} className="space-y-4">
                          <div>
                            <Label>Kostenstelle *</Label>
                            <Select name="cost_center_id" required>
                              <SelectTrigger>
                                <SelectValue placeholder="Auswählen..." />
                              </SelectTrigger>
                              <SelectContent>
                                {costCenters.map((cc) => (
                                  <SelectItem key={cc.id} value={cc.id}>
                                    {cc.code} - {cc.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="planned_amount">Geplantes Budget (CHF) *</Label>
                            <Input
                              id="planned_amount"
                              name="planned_amount"
                              type="number"
                              step="0.01"
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="notes">Notizen</Label>
                            <Textarea id="notes" name="notes" />
                          </div>
                          <Button type="submit" className="w-full">
                            Plan erstellen
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Laden...</div>
              ) : budgetPlans.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Keine Budgetpläne für {selectedYear} vorhanden
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kostenstelle</TableHead>
                      <TableHead className="text-right">Q1</TableHead>
                      <TableHead className="text-right">Q2</TableHead>
                      <TableHead className="text-right">Q3</TableHead>
                      <TableHead className="text-right">Q4</TableHead>
                      <TableHead className="text-right">Gesamt</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {budgetPlans.map((plan) => (
                      <TableRow key={plan.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{getCostCenterName(plan.cost_center_id)}</p>
                            <p className="text-sm text-muted-foreground">
                              {getCostCenterCode(plan.cost_center_id)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {plan.q1_amount?.toLocaleString("de-CH")}
                        </TableCell>
                        <TableCell className="text-right">
                          {plan.q2_amount?.toLocaleString("de-CH")}
                        </TableCell>
                        <TableCell className="text-right">
                          {plan.q3_amount?.toLocaleString("de-CH")}
                        </TableCell>
                        <TableCell className="text-right">
                          {plan.q4_amount?.toLocaleString("de-CH")}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          CHF {plan.planned_amount?.toLocaleString("de-CH")}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              plan.status === "approved"
                                ? "default"
                                : plan.status === "submitted"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {plan.status === "approved"
                              ? "Genehmigt"
                              : plan.status === "submitted"
                              ? "Eingereicht"
                              : plan.status === "rejected"
                              ? "Abgelehnt"
                              : "Entwurf"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </Layout>
  );
}