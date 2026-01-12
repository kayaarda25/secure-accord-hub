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
} from "recharts";
import { Inbox } from "lucide-react";

interface MonthlyData {
  month: string;
  budget: number;
  used: number;
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
              CHF {(entry.value / 1000).toFixed(0)}K
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
  const [period, setPeriod] = useState("year");

  useEffect(() => {
    fetchBudgetData();
  }, []);

  const fetchBudgetData = async () => {
    try {
      const { data: costCenters, error } = await supabase
        .from("cost_centers")
        .select("budget_annual, budget_used");

      if (error) throw error;

      // If we have data, create a simple chart showing budget vs used
      if (costCenters && costCenters.length > 0) {
        const totalBudget = costCenters.reduce((sum, cc) => sum + (cc.budget_annual || 0), 0);
        const totalUsed = costCenters.reduce((sum, cc) => sum + (cc.budget_used || 0), 0);
        
        // Create simple monthly breakdown (would be replaced with actual transaction data)
        setData([
          { month: "Budget", budget: totalBudget, used: totalUsed },
        ]);
      }
    } catch (error) {
      console.error("Error fetching budget data:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card-state p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-foreground">Finanzübersicht</h3>
          <p className="text-sm text-muted-foreground">
            Budget vs. Verbrauch
          </p>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {["quarter", "year"].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                period === p
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p === "quarter" ? "Q4" : "Jahr"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          Laden...
        </div>
      ) : data.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-center">
          <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            Keine Finanzdaten vorhanden
          </p>
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorBudget" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#c9a227" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#c9a227" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorUsed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#64748b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#64748b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(220 15% 22%)"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(215 15% 55%)", fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(215 15% 55%)", fontSize: 12 }}
                tickFormatter={(value) => `${value / 1000}K`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="budget"
                name="Budget"
                stroke="#c9a227"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorBudget)"
              />
              <Area
                type="monotone"
                dataKey="used"
                name="Verbraucht"
                stroke="#64748b"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorUsed)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-accent" />
          <span className="text-sm text-muted-foreground">Budget</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-muted-foreground" />
          <span className="text-sm text-muted-foreground">Verbraucht</span>
        </div>
      </div>
    </div>
  );
}
