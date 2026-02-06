import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useMgiAggregation } from "@/hooks/useMgiAggregation";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { DashboardWidgetEditor } from "@/components/dashboard/DashboardWidgetEditor";
import { DashboardWidgetRenderer } from "@/components/dashboard/DashboardWidgetRenderer";

interface CompanyStats {
  employeeCount: number;
  pendingExpenses: number;
  declarationsCount: number;
  totalRevenue: number;
}

const Index = () => {
  const { hasRole } = useAuth();
  const { aggregatedOrgs, mgiOrgIds, isGatewayUser, isLoading: orgsLoading } = useMgiAggregation();
  const { widgets, visibleWidgets, loading: layoutLoading, saving, toggleWidget, moveWidget, resetLayout } = useDashboardLayout();
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [companyStats, setCompanyStats] = useState<Record<string, CompanyStats>>({});
  const [loading, setLoading] = useState(true);

  const isManagement = hasRole("management") || hasRole("admin") || hasRole("state");

  useEffect(() => {
    if (!orgsLoading && aggregatedOrgs.length > 0) {
      fetchCompanyStats();
    }
  }, [aggregatedOrgs, orgsLoading, mgiOrgIds]);

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
          declarationsCount,
          totalRevenue,
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
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getTotalStats = () => {
    const totals = { employees: 0, pendingExpenses: 0, declarationsCount: 0, totalRevenue: 0 };
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

  return (
    <Layout title="Dashboard" subtitle="Übersicht">
      {/* Widget Editor Toggle */}
      <div className="flex justify-end mb-4">
        <DashboardWidgetEditor
          widgets={widgets}
          saving={saving}
          onToggle={toggleWidget}
          onMove={moveWidget}
          onReset={resetLayout}
        />
      </div>

      {/* Customizable Widget Grid */}
      <DashboardWidgetRenderer
        visibleWidgets={visibleWidgets}
        isManagement={isManagement}
        displayCompanies={aggregatedOrgs}
        companyStats={companyStats}
        totalStats={totalStats}
        formatCurrency={formatCurrency}
        onSelectCompany={setSelectedCompany}
      />
    </Layout>
  );
};

export default Index;
