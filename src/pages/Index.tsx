import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { ComplianceStatus } from "@/components/dashboard/ComplianceStatus";
import { UpcomingDeadlines } from "@/components/dashboard/UpcomingDeadlines";
import { PartnerOverview } from "@/components/dashboard/PartnerOverview";
import { FinanceChart } from "@/components/dashboard/FinanceChart";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Wallet,
  TrendingUp,
  Building2,
  FileText,
  AlertTriangle,
  Users,
  Receipt,
} from "lucide-react";

interface Organization {
  id: string;
  name: string;
}

interface CompanyStats {
  employeeCount: number;
  pendingExpenses: number;
  totalBudget: number;
  usedBudget: number;
}

const Index = () => {
  const { profile, hasRole } = useAuth();
  const [companies, setCompanies] = useState<Organization[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [companyStats, setCompanyStats] = useState<Record<string, CompanyStats>>({});
  const [loading, setLoading] = useState(true);

  const isManagement = hasRole("management") || hasRole("admin") || hasRole("state");

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    if (companies.length > 0) {
      fetchCompanyStats();
    }
  }, [companies]);

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("type", "internal")
        .order("name");

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error("Error fetching companies:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanyStats = async () => {
    try {
      const stats: Record<string, CompanyStats> = {};

      for (const company of companies) {
        // Get employee count
        const { count: employeeCount } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", company.id);

        // Get pending expenses count
        const { count: pendingExpenses } = await supabase
          .from("opex_expenses")
          .select("*, cost_centers!inner(organization_id)", { count: "exact", head: true })
          .eq("cost_centers.organization_id", company.id)
          .eq("status", "pending");

        // Get budget info
        const { data: costCenters } = await supabase
          .from("cost_centers")
          .select("budget_annual, budget_used")
          .eq("organization_id", company.id);

        const totalBudget = costCenters?.reduce((sum, cc) => sum + (cc.budget_annual || 0), 0) || 0;
        const usedBudget = costCenters?.reduce((sum, cc) => sum + (cc.budget_used || 0), 0) || 0;

        stats[company.id] = {
          employeeCount: employeeCount || 0,
          pendingExpenses: pendingExpenses || 0,
          totalBudget,
          usedBudget,
        };
      }

      setCompanyStats(stats);
    } catch (error) {
      console.error("Error fetching company stats:", error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("de-CH", {
      style: "currency",
      currency: "CHF",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getTotalStats = () => {
    const totals = {
      employees: 0,
      pendingExpenses: 0,
      totalBudget: 0,
      usedBudget: 0,
    };

    Object.values(companyStats).forEach((stats) => {
      totals.employees += stats.employeeCount;
      totals.pendingExpenses += stats.pendingExpenses;
      totals.totalBudget += stats.totalBudget;
      totals.usedBudget += stats.usedBudget;
    });

    return totals;
  };

  const totalStats = getTotalStats();

  return (
    <Layout
      title="Executive Dashboard"
      subtitle="MGI × AFRIKA Staatliche Kooperation"
    >
      {/* Alert Banner */}
      <div className="mb-6 p-4 rounded-lg bg-warning/10 border border-warning/20 flex items-center gap-3 animate-fade-in">
        <AlertTriangle size={20} className="text-warning flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">
            Lizenzverlängerung Uganda läuft in 7 Tagen ab
          </p>
          <p className="text-xs text-muted-foreground">
            Bitte überprüfen Sie die Dokumente und leiten Sie die Verlängerung ein.
          </p>
        </div>
        <button className="px-4 py-2 text-sm font-medium text-warning hover:text-warning/80 transition-colors">
          Details →
        </button>
      </div>

      {/* Company Tabs for Management View */}
      {isManagement && companies.length > 0 && (
        <Tabs value={selectedCompany} onValueChange={setSelectedCompany} className="mb-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">Alle Firmen</TabsTrigger>
            {companies.map((company) => (
              <TabsTrigger key={company.id} value={company.id}>
                {company.name}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="all" className="mt-6">
            {/* Overview for all companies */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {companies.map((company) => {
                const stats = companyStats[company.id] || {
                  employeeCount: 0,
                  pendingExpenses: 0,
                  totalBudget: 0,
                  usedBudget: 0,
                };
                const budgetPercent = stats.totalBudget > 0 
                  ? Math.round((stats.usedBudget / stats.totalBudget) * 100) 
                  : 0;

                return (
                  <Card key={company.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedCompany(company.id)}>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Building2 className="h-5 w-5 text-accent" />
                        {company.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Mitarbeiter
                          </span>
                          <span className="font-semibold">{stats.employeeCount}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground flex items-center gap-2">
                            <Receipt className="h-4 w-4" />
                            Offene OPEX
                          </span>
                          <span className="font-semibold">{stats.pendingExpenses}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground flex items-center gap-2">
                            <Wallet className="h-4 w-4" />
                            Budget
                          </span>
                          <span className="font-semibold">{formatCurrency(stats.totalBudget)}</span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${budgetPercent > 80 ? 'bg-destructive' : budgetPercent > 60 ? 'bg-warning' : 'bg-success'}`}
                            style={{ width: `${Math.min(budgetPercent, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground text-right">
                          {budgetPercent}% verwendet
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Global KPI Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <MetricCard
                title="Gesamtbudget"
                value={formatCurrency(totalStats.totalBudget)}
                changeLabel="Alle Firmen"
                icon={<Wallet size={20} className="text-accent" />}
                variant="accent"
              />
              <MetricCard
                title="Mitarbeiter Gesamt"
                value={totalStats.employees.toString()}
                changeLabel="Aktive Benutzer"
                icon={<Users size={20} className="text-success" />}
                variant="success"
              />
              <MetricCard
                title="Offene OPEX"
                value={totalStats.pendingExpenses.toString()}
                changeLabel="Zur Genehmigung"
                icon={<Receipt size={20} className="text-info" />}
              />
              <MetricCard
                title="Firmen"
                value={companies.length.toString()}
                changeLabel="Interne Organisationen"
                icon={<Building2 size={20} className="text-muted-foreground" />}
              />
            </div>
          </TabsContent>

          {companies.map((company) => {
            const stats = companyStats[company.id] || {
              employeeCount: 0,
              pendingExpenses: 0,
              totalBudget: 0,
              usedBudget: 0,
            };

            return (
              <TabsContent key={company.id} value={company.id} className="mt-6">
                {/* Company-specific KPI Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <MetricCard
                    title="Jahresbudget"
                    value={formatCurrency(stats.totalBudget)}
                    changeLabel={`${Math.round((stats.usedBudget / stats.totalBudget) * 100) || 0}% verwendet`}
                    icon={<Wallet size={20} className="text-accent" />}
                    variant="accent"
                  />
                  <MetricCard
                    title="Verbrauchtes Budget"
                    value={formatCurrency(stats.usedBudget)}
                    changeLabel="Bisherige Ausgaben"
                    icon={<TrendingUp size={20} className="text-success" />}
                    variant="success"
                  />
                  <MetricCard
                    title="Mitarbeiter"
                    value={stats.employeeCount.toString()}
                    changeLabel="Aktive Benutzer"
                    icon={<Users size={20} className="text-info" />}
                  />
                  <MetricCard
                    title="Offene OPEX"
                    value={stats.pendingExpenses.toString()}
                    changeLabel="Zur Genehmigung"
                    icon={<Receipt size={20} className="text-muted-foreground" />}
                  />
                </div>

                {/* Finance Chart and Compliance for selected company */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                  <div className="lg:col-span-2">
                    <FinanceChart />
                  </div>
                  <div>
                    <ComplianceStatus />
                  </div>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      {/* Non-Management View or No Companies */}
      {(!isManagement || companies.length === 0) && (
        <>
          {/* KPI Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricCard
              title="Gesamtumsatz YTD"
              value="CHF 5.96M"
              change={18.5}
              changeLabel="vs. Vorjahr"
              icon={<Wallet size={20} className="text-accent" />}
              variant="accent"
            />
            <MetricCard
              title="Netto-Ertrag"
              value="CHF 3.82M"
              change={12.3}
              changeLabel="vs. Vorjahr"
              icon={<TrendingUp size={20} className="text-success" />}
              variant="success"
            />
            <MetricCard
              title="Aktive Partner"
              value="12"
              change={2}
              changeLabel="Neue Partner Q4"
              icon={<Building2 size={20} className="text-info" />}
            />
            <MetricCard
              title="Offene Verträge"
              value="8"
              changeLabel="3 zur Verlängerung"
              icon={<FileText size={20} className="text-muted-foreground" />}
            />
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2">
              <FinanceChart />
            </div>
            <div>
              <ComplianceStatus />
            </div>
          </div>
        </>
      )}

      {/* Secondary Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PartnerOverview />
        </div>
        <div>
          <UpcomingDeadlines />
        </div>
      </div>

      {/* Activity Feed - Full Width */}
      <div className="mt-6">
        <ActivityFeed />
      </div>
    </Layout>
  );
};

export default Index;
