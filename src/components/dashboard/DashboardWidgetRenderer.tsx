import { ReactNode } from "react";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { UpcomingDeadlines } from "@/components/dashboard/UpcomingDeadlines";
import { FinanceChart } from "@/components/dashboard/FinanceChart";
import { ComplianceStatus } from "@/components/dashboard/ComplianceStatus";
import { PartnerOverview } from "@/components/dashboard/PartnerOverview";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { DashboardWidget } from "@/hooks/useDashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText,
  Building2,
  Users,
  Receipt,
  TrendingUp,
} from "lucide-react";

interface WidgetRendererProps {
  visibleWidgets: DashboardWidget[];
  isManagement: boolean;
  displayCompanies: Array<{ id: string; name: string }>;
  companyStats: Record<string, { employeeCount: number; pendingExpenses: number; declarationsCount: number; totalRevenue: number }>;
  totalStats: { employees: number; pendingExpenses: number; declarationsCount: number; totalRevenue: number };
  formatCurrency: (amount: number, currency?: string) => string;
  onSelectCompany?: (id: string) => void;
}

export function DashboardWidgetRenderer({
  visibleWidgets,
  isManagement,
  displayCompanies,
  companyStats,
  totalStats,
  formatCurrency,
  onSelectCompany,
}: WidgetRendererProps) {
  const renderWidget = (widget: DashboardWidget): ReactNode => {
    switch (widget.id) {
      case "kpi-metrics":
        return (
          <div key={widget.id} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
        );

      case "company-cards":
        if (!isManagement || displayCompanies.length === 0) return null;
        return (
          <div key={widget.id} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {displayCompanies.map((company) => {
              const stats = companyStats[company.id] || {
                employeeCount: 0,
                pendingExpenses: 0,
              };
              return (
                <Card
                  key={company.id}
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => onSelectCompany?.(company.id)}
                >
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
        );

      case "finance-chart":
        return <FinanceChart key={widget.id} />;

      case "upcoming-deadlines":
        return <UpcomingDeadlines key={widget.id} />;

      case "activity-feed":
        return <ActivityFeed key={widget.id} />;

      case "compliance-status":
        return <ComplianceStatus key={widget.id} />;

      case "partner-overview":
        return <PartnerOverview key={widget.id} />;

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {visibleWidgets.map((widget) => renderWidget(widget))}
    </div>
  );
}
