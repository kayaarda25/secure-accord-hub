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
import { useMgiAggregation } from "@/hooks/useMgiAggregation";
import {
  Wallet,
  Building2,
  Users,
  Receipt,
} from "lucide-react";

interface CompanyStats {
  employeeCount: number;
  pendingExpenses: number;
  totalBudget: number;
  usedBudget: number;
}

const Index = () => {
  const { hasRole } = useAuth();
  const { aggregatedOrgs, mgiOrgIds, isGatewayUser, isLoading: orgsLoading } = useMgiAggregation();
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [companyStats, setCompanyStats] = useState<Record<string, CompanyStats>>({});
  const [loading, setLoading] = useState(true);

  const isManagement = hasRole("management") || hasRole("admin") || hasRole("state");

  useEffect(() => {
    if (!orgsLoading && aggregatedOrgs.length > 0) {
      fetchCompanyStats();
    }
  }, [aggregatedOrgs, orgsLoading, mgiOrgIds]);

  // Helper to get org IDs for stats fetching
  const getOrgIdsForStats = (aggregatedOrgId: string): string[] => {
    const org = aggregatedOrgs.find(o => o.id === aggregatedOrgId);
    if (org?.isAggregate && org.originalIds) {
      return org.originalIds;
    }
    return [aggregatedOrgId];
  };

  const fetchCompanyStats = async () => {
    try {
      const stats: Record<string, CompanyStats> = {};

      for (const company of aggregatedOrgs) {
        const orgIds = getOrgIdsForStats(company.id);
        
        // Aggregate stats from all org IDs (for MGI combined, this includes both MGI M and MGI C)
        let totalEmployees = 0;
        let totalPendingExpenses = 0;
        let totalBudget = 0;
        let totalUsedBudget = 0;

        for (const orgId of orgIds) {
          const { count: employeeCount } = await supabase
            .from("profiles")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", orgId);

          const { count: pendingExpenses } = await supabase
            .from("opex_expenses")
            .select("*, cost_centers!inner(organization_id)", { count: "exact", head: true })
            .eq("cost_centers.organization_id", orgId)
            .eq("status", "pending");

          const { data: costCenters } = await supabase
            .from("cost_centers")
            .select("budget_annual, budget_used")
            .eq("organization_id", orgId);

          totalEmployees += employeeCount || 0;
          totalPendingExpenses += pendingExpenses || 0;
          totalBudget += costCenters?.reduce((sum, cc) => sum + (cc.budget_annual || 0), 0) || 0;
          totalUsedBudget += costCenters?.reduce((sum, cc) => sum + (cc.budget_used || 0), 0) || 0;
        }

        stats[company.id] = {
          employeeCount: totalEmployees,
          pendingExpenses: totalPendingExpenses,
          totalBudget: totalBudget,
          usedBudget: totalUsedBudget,
        };
      }

      setCompanyStats(stats);
    } catch (error) {
      console.error("Error fetching company stats:", error);
    } finally {
      setLoading(false);
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

  // Filter companies for tabs - for Gateway users, show Gateway + MGI (combined)
  const displayCompanies = aggregatedOrgs;

  return (
    <Layout
      title="Dashboard"
      subtitle="Übersicht"
    >
      {/* Company Tabs for Management View */}
      {isManagement && displayCompanies.length > 0 && (
        <Tabs value={selectedCompany} onValueChange={setSelectedCompany} className="mb-6">
          <TabsList className="w-full flex">
            <TabsTrigger value="all" className="flex-1">Alle Unternehmen</TabsTrigger>
            {displayCompanies.map((company) => (
              <TabsTrigger key={company.id} value={company.id} className="flex-1">
                {company.name}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="all" className="mt-6">
            {/* Overview for all companies */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {displayCompanies.map((company) => {
                const stats = companyStats[company.id] || {
                  employeeCount: 0,
                  pendingExpenses: 0,
                  totalBudget: 0,
                  usedBudget: 0,
                };

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
                changeLabel="Alle Unternehmen"
                icon={<Wallet size={20} className="text-accent" />}
                variant="accent"
              />
              <MetricCard
                title="Mitarbeiter gesamt"
                value={totalStats.employees.toString()}
                changeLabel="Aktive Benutzer"
                icon={<Users size={20} className="text-success" />}
                variant="success"
              />
              <MetricCard
                title="Offene OPEX"
                value={totalStats.pendingExpenses.toString()}
                changeLabel="Warten auf Genehmigung"
                icon={<Receipt size={20} className="text-info" />}
              />
              <MetricCard
                title="Unternehmen"
                value={displayCompanies.length.toString()}
                changeLabel="Interne Organisationen"
                icon={<Building2 size={20} className="text-muted-foreground" />}
              />
            </div>
          </TabsContent>

          {displayCompanies.map((company) => {
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
                    title="Jahresbudget"
                    value={formatCurrency(stats.totalBudget)}
                    changeLabel={`${budgetPercent}% verwendet`}
                    icon={<Wallet size={20} className="text-accent" />}
                    variant="accent"
                  />
                  <MetricCard
                    title="Budget verwendet"
                    value={formatCurrency(stats.usedBudget)}
                    changeLabel="Ausgaben bis dato"
                    icon={<Wallet size={20} className="text-success" />}
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
                    changeLabel="Warten auf Genehmigung"
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
      {(!isManagement || displayCompanies.length === 0) && (
        <>
          {/* KPI Metrics from database */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricCard
              title="Gesamtbudget"
              value={formatCurrency(totalStats.totalBudget)}
              changeLabel="Alle Kostenstellen"
              icon={<Wallet size={20} className="text-accent" />}
              variant="accent"
            />
            <MetricCard
              title="Mitarbeiter"
              value={totalStats.employees.toString()}
              changeLabel="Registrierte Benutzer"
              icon={<Users size={20} className="text-success" />}
              variant="success"
            />
            <MetricCard
              title="Offene OPEX"
              value={totalStats.pendingExpenses.toString()}
              changeLabel="Warten auf Genehmigung"
              icon={<Receipt size={20} className="text-info" />}
            />
            <MetricCard
              title="Unternehmen"
              value={displayCompanies.length.toString()}
              changeLabel="Interne Organisationen"
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
