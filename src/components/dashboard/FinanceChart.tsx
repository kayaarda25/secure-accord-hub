import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Inbox } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { de } from "date-fns/locale";

interface MonthlyData {
  month: string;
  revenue: number;
  declarations: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-elevated">
        <p className="text-sm font-medium text-foreground mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium text-foreground">
              {entry.dataKey === "declarations" 
                ? entry.value 
                : `USD ${(entry.value / 1000).toFixed(1)}K`}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function FinanceChart() {
  const [data, setData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"6months" | "year">("year");

  useEffect(() => {
    fetchDeclarationData();
  }, [period]);

  const fetchDeclarationData = async () => {
    setLoading(true);
    try {
      const monthsToFetch = period === "year" ? 12 : 6;
      const monthlyData: MonthlyData[] = [];
      
      for (let i = monthsToFetch - 1; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const monthStart = startOfMonth(date);
        const monthEnd = endOfMonth(date);
        
        // Fetch declarations for this month
        const { data: declarations, error } = await supabase
          .from("declarations")
          .select("total_mgi_balance, total_gia_balance, status")
          .gte("period_start", monthStart.toISOString().split("T")[0])
          .lte("period_end", monthEnd.toISOString().split("T")[0]);
        
        if (error) throw error;
        
        // Calculate total revenue from declarations
        const totalRevenue = declarations?.reduce((sum, decl) => {
          const mgiBalance = Number(decl.total_mgi_balance) || 0;
          const giaBalance = Number(decl.total_gia_balance) || 0;
          return sum + mgiBalance + giaBalance;
        }, 0) || 0;
        
        const declarationCount = declarations?.length || 0;
        
        monthlyData.push({
          month: format(date, "MMM yy", { locale: de }),
          revenue: totalRevenue,
          declarations: declarationCount,
        });
      }
      
      setData(monthlyData);
    } catch (error) {
      console.error("Error fetching declaration data:", error);
    } finally {
      setLoading(false);
    }
  };

  const hasAnyData = data.some(d => d.revenue > 0 || d.declarations > 0);

  return (
    <div className="card-state p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-foreground">Umsatzentwicklung</h3>
          <p className="text-sm text-muted-foreground">
            Declarations & Umsatz über Zeit
          </p>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {[
            { key: "6months", label: "6M" },
            { key: "year", label: "12M" },
          ].map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key as "6months" | "year")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                period === p.key
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          Laden...
        </div>
      ) : !hasAnyData ? (
        <div className="h-64 flex flex-col items-center justify-center text-center">
          <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            Keine Declarations vorhanden
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Erstellen Sie Declarations um Umsatzdaten zu sehen
          </p>
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorDeclarations" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#c9a227" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#c9a227" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              />
              <YAxis
                yAxisId="left"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                tickFormatter={(value) => value > 1000 ? `${(value / 1000).toFixed(0)}K` : value}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="revenue"
                name="Umsatz (USD)"
                stroke="#22c55e"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorRevenue)"
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="declarations"
                name="Declarations"
                stroke="#c9a227"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorDeclarations)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-success" />
          <span className="text-sm text-muted-foreground">Umsatz (USD)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-accent" />
          <span className="text-sm text-muted-foreground">Declarations</span>
        </div>
      </div>
    </div>
  );
}
