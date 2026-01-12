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
  Building2,
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
  const { hasRole } = useAuth();
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
        const { count: employeeCount } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", company.id);

        const { count: pendingExpenses } = await supabase
          .from("opex_expenses")
          .select("*, cost_centers!inner(organization_id)", { count: "exact", head: true })
          .eq("cost_centers.organization_id", company.id)
          .eq("status", "pending");

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
    return new Intl.NumberFormat("en-US", {
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
      title="Dashboard"
      subtitle="Overview"
    >
      {/* Company Tabs for Management View */}
      {isManagement && companies.length > 0 && (
        <Tabs value={selectedCompany} onValueChange={setSelectedCompany} className="mb-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">All Companies</TabsTrigger>
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
                            Employees
                          </span>
                          <span className="font-semibold">{stats.employeeCount}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground flex items-center gap-2">
                            <Receipt className="h-4 w-4" />
                            Pending OPEX
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
                          {budgetPercent}% used
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
                title="Total Budget"
                value={formatCurrency(totalStats.totalBudget)}
                changeLabel="All companies"
                icon={<Wallet size={20} className="text-accent" />}
                variant="accent"
              />
              <MetricCard
                title="Total Employees"
                value={totalStats.employees.toString()}
                changeLabel="Active users"
                icon={<Users size={20} className="text-success" />}
                variant="success"
              />
              <MetricCard
                title="Pending OPEX"
                value={totalStats.pendingExpenses.toString()}
                changeLabel="Awaiting approval"
                icon={<Receipt size={20} className="text-info" />}
              />
              <MetricCard
                title="Companies"
                value={companies.length.toString()}
                changeLabel="Internal organizations"
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
            const budgetPercent = stats.totalBudget > 0 
              ? Math.round((stats.usedBudget / stats.totalBudget) * 100) 
              : 0;

            return (
              <TabsContent key={company.id} value={company.id} className="mt-6">
                {/* Company-specific KPI Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <MetricCard
                    title="Annual Budget"
                    value={formatCurrency(stats.totalBudget)}
                    changeLabel={`${budgetPercent}% used`}
                    icon={<Wallet size={20} className="text-accent" />}
                    variant="accent"
                  />
                  <MetricCard
                    title="Budget Used"
                    value={formatCurrency(stats.usedBudget)}
                    changeLabel="Expenses to date"
                    icon={<Wallet size={20} className="text-success" />}
                    variant="success"
                  />
                  <MetricCard
                    title="Employees"
                    value={stats.employeeCount.toString()}
                    changeLabel="Active users"
                    icon={<Users size={20} className="text-info" />}
                  />
                  <MetricCard
                    title="Pending OPEX"
                    value={stats.pendingExpenses.toString()}
                    changeLabel="Awaiting approval"
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
          {/* KPI Metrics from database */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricCard
              title="Total Budget"
              value={formatCurrency(totalStats.totalBudget)}
              changeLabel="All cost centers"
              icon={<Wallet size={20} className="text-accent" />}
              variant="accent"
            />
            <MetricCard
              title="Employees"
              value={totalStats.employees.toString()}
              changeLabel="Registered users"
              icon={<Users size={20} className="text-success" />}
              variant="success"
            />
            <MetricCard
              title="Pending OPEX"
              value={totalStats.pendingExpenses.toString()}
              changeLabel="Awaiting approval"
              icon={<Receipt size={20} className="text-info" />}
            />
            <MetricCard
              title="Companies"
              value={companies.length.toString()}
              changeLabel="Internal organizations"
              icon={<Building2 size={20} className="text-muted-foreground" />}
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
