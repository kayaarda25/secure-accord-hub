import { Layout } from "@/components/layout/Layout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { ComplianceStatus } from "@/components/dashboard/ComplianceStatus";
import { UpcomingDeadlines } from "@/components/dashboard/UpcomingDeadlines";
import { PartnerOverview } from "@/components/dashboard/PartnerOverview";
import { FinanceChart } from "@/components/dashboard/FinanceChart";
import {
  Wallet,
  TrendingUp,
  Building2,
  FileText,
  AlertTriangle,
} from "lucide-react";

const Index = () => {
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
        {/* Finance Chart - 2 columns */}
        <div className="lg:col-span-2">
          <FinanceChart />
        </div>

        {/* Compliance Status */}
        <div>
          <ComplianceStatus />
        </div>
      </div>

      {/* Secondary Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Partner Overview - 2 columns */}
        <div className="lg:col-span-2">
          <PartnerOverview />
        </div>

        {/* Upcoming Deadlines */}
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
