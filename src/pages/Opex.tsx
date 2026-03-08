import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganizationPermissions } from "@/hooks/useOrganizationPermissions";
import { useOpexBudgets } from "@/hooks/useOpexBudgets";
import { supabase } from "@/integrations/supabase/client";
import { OpexSubmissionList } from "@/components/opex/OpexSubmissionList";
import { Receipt, CheckCircle, Clock, Loader2 } from "lucide-react";

interface CostCenter {
  id: string;
  code: string;
  name: string;
  country: string | null;
  budget_annual: number;
  budget_used: number;
}

export default function Opex() {
  const { user, hasAnyRole } = useAuth();
  const { t } = useLanguage();
  const { permissions, isLoading: permissionsLoading } = useOrganizationPermissions();
  const isGatewayUser = permissions.isGateway;
  const { budgets, isLoading: budgetsLoading } = useOpexBudgets();
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || permissionsLoading) return;
    fetchCostCenters();
  }, [user, permissionsLoading, permissions.orgType]);

  const fetchCostCenters = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from("cost_centers")
        .select("*")
        .eq("is_active", true);

      if (data) {
        let filtered = data as CostCenter[];
        if (permissions.orgType === "mgi_media") {
          filtered = filtered.filter(
            (cc) => cc.code.startsWith("MGIM") && cc.name.toLowerCase().includes("allgemein")
          );
        } else if (permissions.orgType === "mgi_communications") {
          filtered = filtered.filter(
            (cc) => cc.code.startsWith("MGIC") && cc.name.toLowerCase().includes("allgemein")
          );
        } else if (permissions.orgType === "gateway") {
          filtered = filtered.filter(
            (cc) => cc.code.startsWith("GW") && cc.name.toLowerCase().includes("allgemein")
          );
        }
        setCostCenters(filtered);
      }
    } catch (error) {
      console.error("Error fetching cost centers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = "CHF") =>
    new Intl.NumberFormat("de-CH", { style: "currency", currency }).format(amount);

  // KPI calculations from budgets
  const totalPending = budgets
    .filter((b) => b.status === "pending")
    .reduce((sum, b) => sum + b.total_amount, 0);
  const totalApproved = budgets
    .filter((b) => b.status === "approved")
    .reduce((sum, b) => sum + b.total_amount, 0);

  if (isLoading || budgetsLoading) {
    return (
      <Layout title={t("page.opex.title")} subtitle={t("page.opex.subtitle")}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </Layout>
    );
  }

  // Org overview data
  const allCostCentersForOverview: CostCenter[] = [];
  // We need all cost centers for overview, not just filtered
  const buildOrgOverview = () => {
    const orgData = isGatewayUser
      ? [
          {
            id: "mgi-combined",
            name: "MGI",
            code: "MGI",
            prefix: ["MGIM", "MGIC"],
          },
          {
            id: "gateway",
            name: "Gateway",
            code: "GW",
            prefix: ["GW"],
          },
        ]
      : [
          { id: "mgi-media", name: "MGI Media", code: "MGI M", prefix: ["MGIM"] },
          { id: "mgi-communications", name: "MGI Communications", code: "MGI C", prefix: ["MGIC"] },
          { id: "gateway", name: "Gateway", code: "GW", prefix: ["GW"] },
        ];

    return orgData.map((org) => {
      // Calculate from budgets for this org's cost centers
      const orgBudgets = budgets.filter((b) => b.status === "approved");
      const totalApprovedOrg = orgBudgets.reduce((sum, b) => sum + b.total_amount, 0);

      return {
        ...org,
        totalApproved: totalApprovedOrg,
      };
    });
  };

  return (
    <Layout title={t("page.opex.title")} subtitle={t("page.opex.subtitle")}>
      {/* KPI Cards */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${isGatewayUser ? "lg:grid-cols-3" : ""} gap-4 mb-6`}>
        <MetricCard
          title="Ausstehend"
          value={formatCurrency(totalPending)}
          changeLabel={`${budgets.filter((b) => b.status === "pending").length} OPEX`}
          icon={<Clock size={20} className="text-warning" />}
          variant="warning"
        />
        <MetricCard
          title="Genehmigt"
          value={formatCurrency(totalApproved)}
          changeLabel={`${budgets.filter((b) => b.status === "approved").length} OPEX`}
          icon={<CheckCircle size={20} className="text-success" />}
          variant="success"
        />
        {isGatewayUser && (
          <MetricCard
            title="Budget Used"
            value={(() => {
              const gwCenters = costCenters.filter((cc) => cc.code.startsWith("GW"));
              const totalBudget = gwCenters.reduce((s, cc) => s + (cc.budget_annual || 0), 0);
              const usedBudget = gwCenters.reduce((s, cc) => s + (cc.budget_used || 0), 0);
              return totalBudget > 0 ? `${Math.round((usedBudget / totalBudget) * 100)}%` : "0%";
            })()}
            changeLabel="YTD"
            icon={<Receipt size={20} className="text-accent" />}
            variant="accent"
          />
        )}
      </div>

      {/* OPEX Submissions */}
      <OpexSubmissionList costCenters={costCenters} isGatewayUser={isGatewayUser} />
    </Layout>
  );
}
