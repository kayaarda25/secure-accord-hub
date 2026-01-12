import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { month: "Jan", einnahmen: 420000, ausgaben: 180000 },
  { month: "Feb", einnahmen: 380000, ausgaben: 165000 },
  { month: "Mar", einnahmen: 510000, ausgaben: 195000 },
  { month: "Apr", einnahmen: 490000, ausgaben: 210000 },
  { month: "Mai", einnahmen: 620000, ausgaben: 225000 },
  { month: "Jun", einnahmen: 580000, ausgaben: 190000 },
  { month: "Jul", einnahmen: 710000, ausgaben: 235000 },
  { month: "Aug", einnahmen: 680000, ausgaben: 220000 },
  { month: "Sep", einnahmen: 750000, ausgaben: 245000 },
  { month: "Okt", einnahmen: 820000, ausgaben: 260000 },
];

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
  const [period, setPeriod] = useState("year");

  return (
    <div className="card-state p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-foreground">Finanzübersicht</h3>
          <p className="text-sm text-muted-foreground">
            Einnahmen vs. Ausgaben 2024
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

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorEinnahmen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#c9a227" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#c9a227" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorAusgaben" x1="0" y1="0" x2="0" y2="1">
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
              dataKey="einnahmen"
              name="Einnahmen"
              stroke="#c9a227"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorEinnahmen)"
            />
            <Area
              type="monotone"
              dataKey="ausgaben"
              name="Ausgaben"
              stroke="#64748b"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorAusgaben)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-accent" />
          <span className="text-sm text-muted-foreground">Einnahmen</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-muted-foreground" />
          <span className="text-sm text-muted-foreground">Ausgaben</span>
        </div>
      </div>
    </div>
  );
}
