import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, PieChartIcon, Calendar } from "lucide-react";

interface OpexExpense {
  id: string;
  expense_number: string;
  title: string;
  description: string | null;
  cost_center_id: string;
  amount: number;
  currency: string;
  expense_date: string;
  status: string;
  submitted_at: string;
  category?: string;
  cost_center?: {
    code: string;
    name: string;
  };
}

interface OpexOverviewChartProps {
  expenses: OpexExpense[];
  expenseCategories: { value: string; label: string }[];
}

const COLORS = [
  "hsl(var(--accent))",
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7c43",
  "#a855f7",
  "#ec4899",
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
              style={{ backgroundColor: entry.fill || entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium text-foreground">
              CHF {entry.value.toLocaleString("de-CH")}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const PieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-elevated">
        <p className="text-sm font-medium text-foreground">{data.name}</p>
        <p className="text-sm text-muted-foreground">
          CHF {data.value.toLocaleString("de-CH")} ({data.payload.percent.toFixed(1)}%)
        </p>
      </div>
    );
  }
  return null;
};

export function OpexOverviewChart({ expenses, expenseCategories }: OpexOverviewChartProps) {
  const [period, setPeriod] = useState<"month" | "quarter">("month");
  const [chartType, setChartType] = useState<"bar" | "pie">("bar");

  // Get approved expenses only
  const approvedExpenses = useMemo(
    () => expenses.filter((e) => e.status === "approved_finance"),
    [expenses]
  );

  // Calculate category breakdown
  const categoryData = useMemo(() => {
    const categoryTotals: Record<string, number> = {};

    approvedExpenses.forEach((expense) => {
      const category = expense.category || "other";
      categoryTotals[category] = (categoryTotals[category] || 0) + expense.amount;
    });

    const total = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);

    return expenseCategories
      .map((cat) => ({
        name: cat.label,
        value: categoryTotals[cat.value] || 0,
        percent: total > 0 ? ((categoryTotals[cat.value] || 0) / total) * 100 : 0,
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [approvedExpenses, expenseCategories]);

  // Calculate monthly/quarterly data
  const timeSeriesData = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const data: { name: string; amount: number; key: string }[] = [];

    if (period === "month") {
      // Last 6 months
      for (let i = 5; i >= 0; i--) {
        const date = new Date(currentYear, now.getMonth() - i, 1);
        const monthKey = date.toISOString().slice(0, 7);
        const monthName = date.toLocaleDateString("de-DE", { month: "short" });

        const monthTotal = approvedExpenses
          .filter((e) => e.submitted_at.startsWith(monthKey))
          .reduce((sum, e) => sum + e.amount, 0);

        data.push({
          name: monthName,
          amount: monthTotal,
          key: monthKey,
        });
      }
    } else {
      // Quarters of current year
      for (let q = 1; q <= 4; q++) {
        const startMonth = (q - 1) * 3;
        const quarterStart = new Date(currentYear, startMonth, 1);
        const quarterEnd = new Date(currentYear, startMonth + 3, 0);

        const quarterTotal = approvedExpenses.filter((e) => {
          const expenseDate = new Date(e.submitted_at);
          return expenseDate >= quarterStart && expenseDate <= quarterEnd;
        }).reduce((sum, e) => sum + e.amount, 0);

        data.push({
          name: `Q${q}`,
          amount: quarterTotal,
          key: `Q${q}-${currentYear}`,
        });
      }
    }

    return data;
  }, [approvedExpenses, period]);

  const totalAmount = categoryData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="card-state p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-foreground">OPEX Übersicht</h3>
          <p className="text-sm text-muted-foreground">
            Genehmigte Ausgaben: CHF {totalAmount.toLocaleString("de-CH")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setChartType("bar")}
              className={`p-2 rounded-md transition-colors ${
                chartType === "bar"
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Balkendiagramm"
            >
              <BarChart3 size={16} />
            </button>
            <button
              onClick={() => setChartType("pie")}
              className={`p-2 rounded-md transition-colors ${
                chartType === "pie"
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Kreisdiagramm"
            >
              <PieChartIcon size={16} />
            </button>
          </div>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {(["month", "quarter"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  period === p
                    ? "bg-background text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p === "month" ? "Monat" : "Quartal"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="timeline" className="flex items-center gap-2">
            <Calendar size={14} />
            Zeitverlauf
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <PieChartIcon size={14} />
            Kategorien
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="h-[280px]">
          {timeSeriesData.every((d) => d.amount === 0) ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <p className="text-sm">Keine Daten für diesen Zeitraum</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeSeriesData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  tickFormatter={(value) =>
                    value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value
                  }
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="amount"
                  name="Ausgaben"
                  fill="hsl(var(--accent))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </TabsContent>

        <TabsContent value="categories" className="h-[280px]">
          {categoryData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <p className="text-sm">Keine kategorisierten Ausgaben</p>
            </div>
          ) : chartType === "pie" ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) =>
                    percent > 5 ? `${name.slice(0, 10)}${name.length > 10 ? "…" : ""}` : ""
                  }
                  labelLine={false}
                >
                  {categoryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical">
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  tickFormatter={(value) =>
                    value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value
                  }
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  width={100}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Betrag" radius={[0, 4, 4, 0]}>
                  {categoryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </TabsContent>
      </Tabs>

      {/* Category Legend */}
      {categoryData.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex flex-wrap gap-3">
            {categoryData.slice(0, 6).map((item, index) => (
              <div key={item.name} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-xs text-muted-foreground">
                  {item.name} ({item.percent.toFixed(0)}%)
                </span>
              </div>
            ))}
            {categoryData.length > 6 && (
              <span className="text-xs text-muted-foreground">
                +{categoryData.length - 6} weitere
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
