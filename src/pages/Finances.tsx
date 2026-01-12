import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Download,
  Filter,
  Plus,
  Inbox,
} from "lucide-react";

interface CostCenterSummary {
  total_budget: number;
  used_budget: number;
  remaining_budget: number;
}

export default function Finances() {
  const { profile } = useAuth();
  const [summary, setSummary] = useState<CostCenterSummary>({
    total_budget: 0,
    used_budget: 0,
    remaining_budget: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFinanceSummary();
  }, [profile]);

  const fetchFinanceSummary = async () => {
    try {
      const { data: costCenters, error } = await supabase
        .from("cost_centers")
        .select("budget_annual, budget_used");

      if (error) throw error;

      const totalBudget = costCenters?.reduce((sum, cc) => sum + (cc.budget_annual || 0), 0) || 0;
      const usedBudget = costCenters?.reduce((sum, cc) => sum + (cc.budget_used || 0), 0) || 0;

      setSummary({
        total_budget: totalBudget,
        used_budget: usedBudget,
        remaining_budget: totalBudget - usedBudget,
      });
    } catch (error) {
      console.error("Error fetching finance summary:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = "CHF") => {
    return new Intl.NumberFormat("de-CH", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const budgetUsagePercent = summary.total_budget > 0 
    ? Math.round((summary.used_budget / summary.total_budget) * 100) 
    : 0;

  return (
    <Layout title="Finanzen" subtitle="Übersicht aller Finanztransaktionen">
      {/* Action Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-muted rounded-lg text-sm font-medium text-foreground hover:bg-muted/80 transition-colors flex items-center gap-2">
            <Filter size={16} />
            Filter
          </button>
          <select className="px-4 py-2 bg-muted rounded-lg text-sm font-medium text-foreground border-0 focus:ring-2 focus:ring-accent">
            <option>Alle Währungen</option>
            <option>CHF</option>
            <option>USD</option>
            <option>EUR</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-muted rounded-lg text-sm font-medium text-foreground hover:bg-muted/80 transition-colors flex items-center gap-2">
            <Download size={16} />
            Export
          </button>
          <button className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-2 glow-gold">
            <Plus size={16} />
            Neue Transaktion
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Gesamtbudget"
          value={formatCurrency(summary.total_budget)}
          changeLabel="Alle Kostenstellen"
          icon={<TrendingUp size={20} className="text-success" />}
          variant="success"
        />
        <MetricCard
          title="Verbraucht"
          value={formatCurrency(summary.used_budget)}
          changeLabel={`${budgetUsagePercent}% des Budgets`}
          icon={<TrendingDown size={20} className="text-muted-foreground" />}
        />
        <MetricCard
          title="Verfügbar"
          value={formatCurrency(summary.remaining_budget)}
          changeLabel="Noch verfügbar"
          icon={<CreditCard size={20} className="text-warning" />}
          variant="warning"
        />
        <MetricCard
          title="Budget-Auslastung"
          value={`${budgetUsagePercent}%`}
          changeLabel="Aktueller Stand"
          icon={<Wallet size={20} className="text-accent" />}
          variant="accent"
        />
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Letzte Transaktionen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Keine Transaktionen vorhanden</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Transaktionen werden hier angezeigt, sobald sie erfasst werden.
            </p>
            <button className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-2">
              <Plus size={16} />
              Erste Transaktion erstellen
            </button>
          </div>
        </CardContent>
      </Card>
    </Layout>
  );
}
