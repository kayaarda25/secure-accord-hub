import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { UpcomingDeadlines } from "@/components/dashboard/UpcomingDeadlines";
import { FinanceChart } from "@/components/dashboard/FinanceChart";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMgiAggregation } from "@/hooks/useMgiAggregation";
import {
  FileText,
  Building2,
  Users,
  Receipt,
  TrendingUp,
} from "lucide-react";

interface CompanyStats {
  employeeCount: number;
  pendingExpenses: number;
  declarationsCount: number;
  totalRevenue: number;
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

      // Fetch all declarations for revenue calculation
      const { data: allDeclarations } = await supabase
        .from("declarations")
        .select("total_mgi_balance, total_gia_balance, status");

      const totalRevenue = allDeclarations?.reduce((sum, decl) => {
        return sum + (Number(decl.total_mgi_balance) || 0) + (Number(decl.total_gia_balance) || 0);
      }, 0) || 0;

      const declarationsCount = allDeclarations?.length || 0;

      for (const company of aggregatedOrgs) {
        const orgIds = getOrgIdsForStats(company.id);
        
        let totalEmployees = 0;
        let totalPendingExpenses = 0;

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

          totalEmployees += employeeCount || 0;
          totalPendingExpenses += pendingExpenses || 0;
        }

        stats[company.id] = {
          employeeCount: totalEmployees,
          pendingExpenses: totalPendingExpenses,
          declarationsCount: declarationsCount,
          totalRevenue: totalRevenue,
        };
      }

      setCompanyStats(stats);
    } catch (error) {
      console.error("Error fetching company stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency = "USD") => {
    return new Intl.NumberFormat("de-CH", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getTotalStats = () => {
    const totals = {
      employees: 0,
      pendingExpenses: 0,
      declarationsCount: 0,
      totalRevenue: 0,
    };

    // Get first company's declarations stats (they're global)
    const firstStats = Object.values(companyStats)[0];
    if (firstStats) {
      totals.declarationsCount = firstStats.declarationsCount;
      totals.totalRevenue = firstStats.totalRevenue;
    }

    Object.values(companyStats).forEach((stats) => {
      totals.employees += stats.employeeCount;
      totals.pendingExpenses += stats.pendingExpenses;
    });

    return totals;
  };

  const totalStats = getTotalStats();

  // Filter companies for tabs
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
                  declarationsCount: 0,
                  totalRevenue: 0,
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
                title="Declarations"
                value={totalStats.declarationsCount.toString()}
                changeLabel="Alle Perioden"
                icon={<FileText size={20} className="text-accent" />}
                variant="accent"
              />
              <MetricCard
                title="Gesamtumsatz"
                value={formatCurrency(totalStats.totalRevenue)}
                changeLabel="Aus Declarations"
                icon={<TrendingUp size={20} className="text-success" />}
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
              declarationsCount: 0,
              totalRevenue: 0,
            };

            return (
              <TabsContent key={company.id} value={company.id} className="mt-6">
                {/* Company-specific KPI Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <MetricCard
                    title="Declarations"
                    value={stats.declarationsCount.toString()}
                    changeLabel="Alle Perioden"
                    icon={<FileText size={20} className="text-accent" />}
                    variant="accent"
                  />
                  <MetricCard
                    title="Gesamtumsatz"
                    value={formatCurrency(stats.totalRevenue)}
                    changeLabel="Aus Declarations"
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
                    changeLabel="Warten auf Genehmigung"
                    icon={<Receipt size={20} className="text-muted-foreground" />}
                  />
                </div>

                {/* Finance Chart for selected company */}
                <div className="mb-6">
                  <FinanceChart />
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      {/* Non-Management View or No Companies */}
      {(!isManagement || displayCompanies.length === 0) && (
        <>
          {/* KPI Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricCard
              title="Declarations"
              value={totalStats.declarationsCount.toString()}
              changeLabel="Alle Perioden"
              icon={<FileText size={20} className="text-accent" />}
              variant="accent"
            />
            <MetricCard
              title="Gesamtumsatz"
              value={formatCurrency(totalStats.totalRevenue)}
              changeLabel="Aus Declarations"
              icon={<TrendingUp size={20} className="text-success" />}
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

          {/* Main Content - Finance Chart Full Width */}
          <div className="mb-6">
            <FinanceChart />
          </div>
        </>
      )}

      {/* Upcoming Deadlines */}
      <div className="mb-6">
        <UpcomingDeadlines />
      </div>

      {/* Activity Feed - Full Width */}
      <div>
        <ActivityFeed />
      </div>
    </Layout>
  );
};

export default Index;
