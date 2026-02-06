import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FinanceChart } from "@/components/dashboard/FinanceChart";
import {
  FileText,
  TrendingUp,
  DollarSign,
  BarChart3,
  Download,
  Filter,
  Plus,
  Inbox,
} from "lucide-react";

interface DeclarationSummary {
  total_declarations: number;
  total_revenue: number;
  total_mgi_balance: number;
  total_gia_balance: number;
  pending_count: number;
  approved_count: number;
}

export default function Finances() {
  const { profile } = useAuth();
  const [summary, setSummary] = useState<DeclarationSummary>({
    total_declarations: 0,
    total_revenue: 0,
    total_mgi_balance: 0,
    total_gia_balance: 0,
    pending_count: 0,
    approved_count: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDeclarationSummary();
  }, [profile]);

  const fetchDeclarationSummary = async () => {
    try {
      const { data: declarations, error } = await supabase
        .from("declarations")
        .select("total_mgi_balance, total_gia_balance, status");

      if (error) throw error;

      const totalMgi = declarations?.reduce((sum, d) => sum + (Number(d.total_mgi_balance) || 0), 0) || 0;
      const totalGia = declarations?.reduce((sum, d) => sum + (Number(d.total_gia_balance) || 0), 0) || 0;
      const pendingCount = declarations?.filter(d => d.status === 'pending' || d.status === 'submitted').length || 0;
      const approvedCount = declarations?.filter(d => d.status === 'approved').length || 0;

      setSummary({
        total_declarations: declarations?.length || 0,
        total_revenue: totalMgi + totalGia,
        total_mgi_balance: totalMgi,
        total_gia_balance: totalGia,
        pending_count: pendingCount,
        approved_count: approvedCount,
      });
    } catch (error) {
      console.error("Error fetching declaration summary:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const approvalRate = summary.total_declarations > 0 
    ? Math.round((summary.approved_count / summary.total_declarations) * 100) 
    : 0;

  return (
    <Layout title="Finances" subtitle="Declarations & Revenue Overview">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <button className="px-4 py-2 bg-muted rounded-lg text-sm font-medium text-foreground hover:bg-muted/80 transition-colors flex items-center gap-2">
            <Filter size={16} />
            Filter
          </button>
          <select className="px-4 py-2 bg-muted rounded-lg text-sm font-medium text-foreground border-0 focus:ring-2 focus:ring-accent">
            <option>Alle Perioden</option>
            <option>Dieses Jahr</option>
            <option>Letztes Jahr</option>
            <option>Letztes Quartal</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-muted rounded-lg text-sm font-medium text-foreground hover:bg-muted/80 transition-colors flex items-center gap-2">
            <Download size={16} />
            Export
          </button>
          <button className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-2 glow-gold">
            <Plus size={16} />
            Neue Declaration
          </button>
        </div>
      </div>

      {/* KPI Cards - Declaration-oriented */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Gesamtumsatz"
          value={formatCurrency(summary.total_revenue)}
          changeLabel="MGI + GIA Balance"
          icon={<DollarSign size={20} className="text-success" />}
          variant="success"
        />
        <MetricCard
          title="Declarations"
          value={summary.total_declarations.toString()}
          changeLabel={`${summary.approved_count} genehmigt`}
          icon={<FileText size={20} className="text-accent" />}
          variant="accent"
        />
        <MetricCard
          title="MGI Balance"
          value={formatCurrency(summary.total_mgi_balance)}
          changeLabel="MGI Incoming Revenue"
          icon={<TrendingUp size={20} className="text-success" />}
        />
        <MetricCard
          title="GIA Balance"
          value={formatCurrency(summary.total_gia_balance)}
          changeLabel="GIA Outgoing Revenue"
          icon={<BarChart3 size={20} className="text-warning" />}
          variant="warning"
        />
      </div>

      {/* Revenue Chart */}
      <div className="mb-6">
        <FinanceChart />
      </div>

      {/* Recent Declarations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Aktuelle Declarations</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.total_declarations === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Keine Declarations vorhanden</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Declarations werden hier angezeigt, sobald sie erstellt wurden.
              </p>
              <button className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-2">
                <Plus size={16} />
                Erste Declaration erstellen
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {summary.total_declarations} Declarations gefunden • {summary.pending_count} ausstehend • {approvalRate}% Genehmigungsrate
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}
