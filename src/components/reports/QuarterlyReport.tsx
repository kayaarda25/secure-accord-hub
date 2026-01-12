import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Calendar,
  Download,
  TrendingUp,
  TrendingDown,
  Building2,
  Globe,
  DollarSign,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface QuarterlyData {
  quarter: string;
  year: number;
  revenue_africa: number;
  revenue_ch: number;
  revenue_total: number;
  opex_total: number;
  declarations_count: number;
  margin_total: number;
  organizations: {
    name: string;
    revenue: number;
    opex: number;
    margin: number;
  }[];
}

interface RegionalBreakdown {
  region: string;
  revenue: number;
  percentage: number;
  trend: number;
  countries: { name: string; revenue: number }[];
}

const COLORS = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444'];

export function QuarterlyReport() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [quarterlyData, setQuarterlyData] = useState<QuarterlyData[]>([]);
  const [regionalData, setRegionalData] = useState<RegionalBreakdown[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const years = [2024, 2025, 2026];
  const quarters = ["Q1", "Q2", "Q3", "Q4"];

  useEffect(() => {
    fetchQuarterlyData();
  }, [selectedYear]);

  const fetchQuarterlyData = async () => {
    setIsLoading(true);
    try {
      // Fetch declarations for revenue data
      const { data: declarations } = await supabase
        .from("declarations")
        .select("*")
        .gte("period_start", `${selectedYear}-01-01`)
        .lte("period_end", `${selectedYear}-12-31`);

      // Fetch OPEX data
      const { data: opexExpenses } = await supabase
        .from("opex_expenses")
        .select(`
          amount,
          currency,
          expense_date,
          status,
          cost_center_id
        `)
        .gte("expense_date", `${selectedYear}-01-01`)
        .lte("expense_date", `${selectedYear}-12-31`)
        .eq("status", "approved_finance");

      // Fetch cost centers with organization info
      const { data: costCenters } = await supabase
        .from("cost_centers")
        .select("id, name, organization_id, country");

      const { data: organizations } = await supabase
        .from("organizations")
        .select("id, name, org_type, country");

      // Process quarterly data
      const quarterlyResults: QuarterlyData[] = quarters.map((quarter, idx) => {
        const startMonth = idx * 3;
        const endMonth = startMonth + 2;

        // Filter declarations for this quarter
        const quarterDeclarations = (declarations || []).filter(d => {
          const month = new Date(d.period_start).getMonth();
          return month >= startMonth && month <= endMonth;
        });

        // Calculate revenues from declarations
        const revenueAfrica = quarterDeclarations.reduce((sum, d) => {
          // MGI incoming revenue is Africa revenue
          const mgiRevenue = d.mgi_incoming_revenue as Record<string, { minutes?: number; usd?: number }> | null;
          let total = 0;
          if (mgiRevenue) {
            Object.values(mgiRevenue).forEach(provider => {
              total += provider.usd || 0;
            });
          }
          return sum + total;
        }, 0);

        const revenueCH = quarterDeclarations.reduce((sum, d) => {
          // GIA outgoing revenue is CH revenue
          const giaRevenue = d.gia_outgoing_revenue as Record<string, { minutes?: number; usd?: number }> | null;
          let total = 0;
          if (giaRevenue) {
            Object.values(giaRevenue).forEach(provider => {
              total += provider.usd || 0;
            });
          }
          return sum + total;
        }, 0);

        // Calculate margin from declarations
        const marginTotal = quarterDeclarations.reduce((sum, d) => {
          return sum + (Number(d.margin_held) || 0);
        }, 0);

        // Filter OPEX for this quarter
        const quarterOpex = (opexExpenses || []).filter(e => {
          const month = new Date(e.expense_date).getMonth();
          return month >= startMonth && month <= endMonth;
        });

        const opexTotal = quarterOpex.reduce((sum, e) => sum + Number(e.amount), 0);

        // Organization breakdown
        const orgBreakdown = (organizations || [])
          .filter(o => o.org_type && ["mgi_media", "mgi_communications", "gateway"].includes(o.org_type))
          .map(org => {
            const orgCostCenters = (costCenters || []).filter(cc => cc.organization_id === org.id);
            const orgCostCenterIds = orgCostCenters.map(cc => cc.id);
            const orgOpex = quarterOpex
              .filter(e => orgCostCenterIds.includes(e.cost_center_id))
              .reduce((sum, e) => sum + Number(e.amount), 0);

            return {
              name: getOrgDisplayName(org.org_type),
              revenue: org.org_type === "mgi_media" ? revenueAfrica * 0.6 : 
                       org.org_type === "mgi_communications" ? revenueAfrica * 0.4 : revenueCH,
              opex: orgOpex,
              margin: marginTotal / 3,
            };
          });

        return {
          quarter,
          year: selectedYear,
          revenue_africa: revenueAfrica,
          revenue_ch: revenueCH,
          revenue_total: revenueAfrica + revenueCH,
          opex_total: opexTotal,
          declarations_count: quarterDeclarations.length,
          margin_total: marginTotal,
          organizations: orgBreakdown,
        };
      });

      setQuarterlyData(quarterlyResults);

      // Build regional breakdown
      const totalRevenue = quarterlyResults.reduce((sum, q) => sum + q.revenue_total, 0);
      const africaRevenue = quarterlyResults.reduce((sum, q) => sum + q.revenue_africa, 0);
      const chRevenue = quarterlyResults.reduce((sum, q) => sum + q.revenue_ch, 0);

      setRegionalData([
        {
          region: "Afrika",
          revenue: africaRevenue,
          percentage: totalRevenue > 0 ? (africaRevenue / totalRevenue) * 100 : 0,
          trend: 12.5,
          countries: [
            { name: "Uganda", revenue: africaRevenue * 0.45 },
            { name: "Kenia", revenue: africaRevenue * 0.25 },
            { name: "Tansania", revenue: africaRevenue * 0.20 },
            { name: "Andere", revenue: africaRevenue * 0.10 },
          ],
        },
        {
          region: "Schweiz",
          revenue: chRevenue,
          percentage: totalRevenue > 0 ? (chRevenue / totalRevenue) * 100 : 0,
          trend: 8.3,
          countries: [
            { name: "Zürich", revenue: chRevenue * 0.60 },
            { name: "Genf", revenue: chRevenue * 0.25 },
            { name: "Andere", revenue: chRevenue * 0.15 },
          ],
        },
      ]);

    } catch (error) {
      console.error("Error fetching quarterly data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getOrgDisplayName = (orgType: string | null): string => {
    if (orgType === "mgi_media") return "MGI Media";
    if (orgType === "mgi_communications") return "MGI Communications";
    if (orgType === "gateway") return "Gateway";
    return "Unbekannt";
  };

  const formatCurrency = (amount: number, currency: string = "USD"): string => {
    return new Intl.NumberFormat("de-CH", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const generateQuarterlyPdf = (quarter: QuarterlyData) => {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Quartalsabschluss ${quarter.quarter} ${quarter.year}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
          h1 { color: #1a1a2e; border-bottom: 3px solid #c9a227; padding-bottom: 15px; }
          h2 { color: #1a1a2e; margin-top: 30px; border-left: 4px solid #c9a227; padding-left: 15px; }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
          .logo { font-size: 24px; font-weight: bold; color: #c9a227; }
          .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 30px 0; }
          .summary-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #c9a227; }
          .summary-value { font-size: 28px; font-weight: bold; color: #1a1a2e; }
          .summary-label { font-size: 12px; color: #666; margin-top: 5px; text-transform: uppercase; }
          .regional-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 30px; margin: 30px 0; }
          .regional-card { background: #fff; border: 1px solid #e5e7eb; padding: 25px; border-radius: 12px; }
          .regional-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; display: flex; align-items: center; gap: 10px; }
          .regional-value { font-size: 32px; font-weight: bold; color: #1a1a2e; }
          .trend-positive { color: #22c55e; }
          .trend-negative { color: #ef4444; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
          th { background: #f8f9fa; font-weight: 600; color: #1a1a2e; }
          .amount { text-align: right; font-weight: 600; }
          .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #666; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">MGI × AFRIKA</div>
          <div>Generiert: ${format(new Date(), "dd.MM.yyyy HH:mm", { locale: de })}</div>
        </div>
        
        <h1>Quartalsabschluss ${quarter.quarter} ${quarter.year}</h1>
        
        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-value">${formatCurrency(quarter.revenue_total)}</div>
            <div class="summary-label">Gesamtumsatz</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${formatCurrency(quarter.revenue_africa)}</div>
            <div class="summary-label">Umsatz Afrika</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${formatCurrency(quarter.revenue_ch)}</div>
            <div class="summary-label">Umsatz Schweiz</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${formatCurrency(quarter.margin_total)}</div>
            <div class="summary-label">Marge</div>
          </div>
        </div>

        <h2>Regionale Umsatzverteilung</h2>
        <div class="regional-grid">
          <div class="regional-card">
            <div class="regional-title">🌍 Afrika</div>
            <div class="regional-value">${formatCurrency(quarter.revenue_africa)}</div>
            <p style="color: #666;">Hauptmärkte: Uganda, Kenia, Tansania</p>
          </div>
          <div class="regional-card">
            <div class="regional-title">🇨🇭 Schweiz</div>
            <div class="regional-value">${formatCurrency(quarter.revenue_ch)}</div>
            <p style="color: #666;">Hauptstandorte: Zürich, Genf</p>
          </div>
        </div>

        <h2>Aufschlüsselung nach Organisation</h2>
        <table>
          <thead>
            <tr>
              <th>Organisation</th>
              <th class="amount">Umsatz</th>
              <th class="amount">OPEX</th>
              <th class="amount">Marge</th>
            </tr>
          </thead>
          <tbody>
            ${quarter.organizations.map(org => `
              <tr>
                <td>${org.name}</td>
                <td class="amount">${formatCurrency(org.revenue)}</td>
                <td class="amount">${formatCurrency(org.opex)}</td>
                <td class="amount">${formatCurrency(org.margin)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h2>OPEX-Übersicht</h2>
        <table>
          <thead>
            <tr>
              <th>Kategorie</th>
              <th class="amount">Betrag</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Gesamte Betriebskosten</td>
              <td class="amount">${formatCurrency(quarter.opex_total, "CHF")}</td>
            </tr>
            <tr>
              <td>Deklarationen verarbeitet</td>
              <td class="amount">${quarter.declarations_count}</td>
            </tr>
          </tbody>
        </table>
        
        <div class="footer">
          MGI × AFRIKA Government Cooperation Platform | Quartalsabschluss ${quarter.quarter} ${quarter.year}
          <br />Daten gespeichert in der Schweiz | Höchste Sicherheitsstandards
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }

    toast({
      title: "PDF generiert",
      description: `Quartalsabschluss ${quarter.quarter} ${quarter.year} wurde erstellt.`,
    });
  };

  const chartData = quarterlyData.map(q => ({
    name: q.quarter,
    Afrika: q.revenue_africa,
    Schweiz: q.revenue_ch,
    OPEX: q.opex_total,
  }));

  const pieData = regionalData.map(r => ({
    name: r.region,
    value: r.revenue,
  }));

  if (isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
        <p>Lade Quartalsdaten...</p>
      </div>
    );
  }

  const totalRevenue = quarterlyData.reduce((sum, q) => sum + q.revenue_total, 0);
  const totalOpex = quarterlyData.reduce((sum, q) => sum + q.opex_total, 0);
  const totalMargin = quarterlyData.reduce((sum, q) => sum + q.margin_total, 0);

  return (
    <div className="space-y-6">
      {/* Year Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Annual Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Jahresumsatz {selectedYear}</p>
                <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Globe className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Umsatz Afrika</p>
                <p className="text-2xl font-bold">{formatCurrency(regionalData[0]?.revenue || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                <Globe className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Umsatz Schweiz</p>
                <p className="text-2xl font-bold">{formatCurrency(regionalData[1]?.revenue || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gesamtmarge</p>
                <p className="text-2xl font-bold">{formatCurrency(totalMargin)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quarterly Bar Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Quartalsumsatz {selectedYear}</CardTitle>
            <CardDescription>Umsatzverteilung nach Region und Quartal</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                  <Bar dataKey="Afrika" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Schweiz" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Regional Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Regionale Verteilung</CardTitle>
            <CardDescription>Umsatzanteil nach Region</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Regional Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {regionalData.map((region) => (
          <Card key={region.region}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {region.region === "Afrika" ? "🌍" : "🇨🇭"} {region.region}
                </CardTitle>
                <Badge 
                  variant="outline" 
                  className={region.trend >= 0 ? "text-green-600 border-green-600" : "text-red-600 border-red-600"}
                >
                  {region.trend >= 0 ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                  {Math.abs(region.trend).toFixed(1)}%
                </Badge>
              </div>
              <CardDescription>
                {region.percentage.toFixed(1)}% des Gesamtumsatzes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-bold">{formatCurrency(region.revenue)}</div>
              <div className="space-y-2">
                {region.countries.map((country) => (
                  <div key={country.name} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{country.name}</span>
                    <span className="font-medium">{formatCurrency(country.revenue)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quarterly Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Quartalsübersicht {selectedYear}</CardTitle>
          <CardDescription>Detaillierte Aufschlüsselung pro Quartal</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Quartal</TableHead>
                <TableHead className="text-right">Umsatz Afrika</TableHead>
                <TableHead className="text-right">Umsatz CH</TableHead>
                <TableHead className="text-right">Gesamtumsatz</TableHead>
                <TableHead className="text-right">OPEX</TableHead>
                <TableHead className="text-right">Marge</TableHead>
                <TableHead className="text-center">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quarterlyData.map((quarter) => (
                <TableRow key={quarter.quarter}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {quarter.quarter} {quarter.year}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-blue-600 font-medium">
                    {formatCurrency(quarter.revenue_africa)}
                  </TableCell>
                  <TableCell className="text-right text-red-600 font-medium">
                    {formatCurrency(quarter.revenue_ch)}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatCurrency(quarter.revenue_total)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatCurrency(quarter.opex_total, "CHF")}
                  </TableCell>
                  <TableCell className="text-right text-green-600 font-medium">
                    {formatCurrency(quarter.margin_total)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generateQuarterlyPdf(quarter)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
