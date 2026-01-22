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
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import {
  Globe,
  MapPin,
  TrendingUp,
  TrendingDown,
  Download,
  Building2,
  Phone,
  ArrowUpRight,
  ArrowDownRight,
  Flag,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface CountryRevenue {
  country: string;
  countryCode: string;
  region: string;
  revenue: number;
  minutes: number;
  providers: { name: string; revenue: number; minutes: number }[];
  trend: number;
  monthlyData: { month: string; revenue: number }[];
}

interface RegionSummary {
  region: string;
  emoji: string;
  totalRevenue: number;
  totalMinutes: number;
  countries: CountryRevenue[];
  trend: number;
}

export function RevenueByRegion() {
  const [selectedPeriod, setSelectedPeriod] = useState("2025");
  const [regionData, setRegionData] = useState<RegionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const { toast } = useToast();

  const periods = ["2024", "2025", "2026"];

  useEffect(() => {
    fetchRevenueData();
  }, [selectedPeriod]);

  const fetchRevenueData = async () => {
    setIsLoading(true);
    try {
      // Fetch declarations for revenue data
      const { data: declarations } = await supabase
        .from("declarations")
        .select("*")
        .gte("period_start", `${selectedPeriod}-01-01`)
        .lte("period_end", `${selectedPeriod}-12-31`);

      // Process declarations into regional data
      const africaCountries: CountryRevenue[] = [
        {
          country: "Südsudan",
          countryCode: "SS",
          region: "Afrika",
          revenue: 0,
          minutes: 0,
          providers: [],
          trend: 18.5,
          monthlyData: [],
        },
        {
          country: "Angola",
          countryCode: "AO",
          region: "Afrika",
          revenue: 0,
          minutes: 0,
          providers: [],
          trend: 12.3,
          monthlyData: [],
        },
      ];

      // Calculate revenues from declarations
      (declarations || []).forEach(d => {
        const mgiRevenue = d.mgi_incoming_revenue as Record<string, { minutes?: number; usd?: number }> | null;
        const giaRevenue = d.gia_outgoing_revenue as Record<string, { minutes?: number; usd?: number }> | null;
        const month = format(new Date(d.period_start), "MMM", { locale: de });

        // MGI incoming = Africa revenue, distribute among countries
        if (mgiRevenue) {
          let totalMgiRevenue = 0;
          let totalMgiMinutes = 0;
          Object.entries(mgiRevenue).forEach(([provider, data]) => {
            totalMgiRevenue += data.usd || 0;
            totalMgiMinutes += data.minutes || 0;
          });

          // Distribute to African countries (weighted: Südsudan 60%, Angola 40%)
          const weights = [0.60, 0.40];
          africaCountries.forEach((country, idx) => {
            country.revenue += totalMgiRevenue * weights[idx];
            country.minutes += totalMgiMinutes * weights[idx];
            country.monthlyData.push({ month, revenue: totalMgiRevenue * weights[idx] });
          });
        }

      });

      // Add sample providers for each country
      africaCountries.forEach(country => {
        if (country.countryCode === "SS") {
          // Südsudan providers
          country.providers = [
            { name: "MTN South Sudan", revenue: country.revenue * 0.55, minutes: country.minutes * 0.55 },
            { name: "Zain", revenue: country.revenue * 0.45, minutes: country.minutes * 0.45 },
          ];
        } else if (country.countryCode === "AO") {
          // Angola providers
          country.providers = [
            { name: "Unitel", revenue: country.revenue * 0.50, minutes: country.minutes * 0.50 },
            { name: "Movicel", revenue: country.revenue * 0.35, minutes: country.minutes * 0.35 },
            { name: "Africell", revenue: country.revenue * 0.15, minutes: country.minutes * 0.15 },
          ];
        }
      });

      // Build region summaries
      const africaTotal = africaCountries.reduce((sum, c) => sum + c.revenue, 0);
      const africaMinutes = africaCountries.reduce((sum, c) => sum + c.minutes, 0);

      setRegionData([
        {
          region: "Afrika",
          emoji: "🌍",
          totalRevenue: africaTotal,
          totalMinutes: africaMinutes,
          countries: africaCountries,
          trend: 15.4,
        },
      ]);

    } catch (error) {
      console.error("Error fetching revenue data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("de-CH", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatMinutes = (minutes: number): string => {
    if (minutes >= 1000000) {
      return `${(minutes / 1000000).toFixed(1)}M`;
    }
    if (minutes >= 1000) {
      return `${(minutes / 1000).toFixed(0)}K`;
    }
    return minutes.toString();
  };

  const generateRegionalPdf = () => {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Regionaler Umsatzbericht ${selectedPeriod}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
          h1 { color: #1a1a2e; border-bottom: 3px solid #c9a227; padding-bottom: 15px; }
          h2 { color: #1a1a2e; margin-top: 30px; }
          .region-card { background: #f8f9fa; padding: 25px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #c9a227; }
          .region-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
          .region-title { font-size: 24px; font-weight: bold; }
          .region-total { font-size: 32px; font-weight: bold; color: #1a1a2e; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
          th { background: #fff; font-weight: 600; }
          .amount { text-align: right; font-weight: 600; }
          .trend-positive { color: #22c55e; }
          .trend-negative { color: #ef4444; }
          .footer { margin-top: 50px; font-size: 11px; color: #666; text-align: center; }
        </style>
      </head>
      <body>
        <h1>Regionaler Umsatzbericht ${selectedPeriod}</h1>
        
        ${regionData.map(region => `
          <div class="region-card">
            <div class="region-header">
              <div class="region-title">${region.emoji} ${region.region}</div>
              <div class="region-total">${formatCurrency(region.totalRevenue)}</div>
            </div>
            <p>Gesamtminuten: ${formatMinutes(region.totalMinutes)} | Trend: <span class="${region.trend >= 0 ? 'trend-positive' : 'trend-negative'}">${region.trend >= 0 ? '+' : ''}${region.trend}%</span></p>
            
            <table>
              <thead>
                <tr>
                  <th>Land</th>
                  <th class="amount">Umsatz</th>
                  <th class="amount">Minuten</th>
                  <th class="amount">Trend</th>
                </tr>
              </thead>
              <tbody>
                ${region.countries.map(country => `
                  <tr>
                    <td>${country.country}</td>
                    <td class="amount">${formatCurrency(country.revenue)}</td>
                    <td class="amount">${formatMinutes(country.minutes)}</td>
                    <td class="amount ${country.trend >= 0 ? 'trend-positive' : 'trend-negative'}">${country.trend >= 0 ? '+' : ''}${country.trend}%</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `).join('')}
        
        <div class="footer">
          MGI × AFRIKA | Regionaler Umsatzbericht ${selectedPeriod}<br />
          Generiert: ${format(new Date(), "dd.MM.yyyy HH:mm", { locale: de })}
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
      description: `Regionaler Umsatzbericht ${selectedPeriod} wurde erstellt.`,
    });
  };

  // Build chart data
  const chartData = regionData.length > 0 
    ? regionData[0].countries[0]?.monthlyData.map((_, idx) => {
        const result: Record<string, string | number> = {
          month: regionData[0].countries[0]?.monthlyData[idx]?.month || '',
        };
        regionData.forEach(region => {
          const regionTotal = region.countries.reduce((sum, c) => 
            sum + (c.monthlyData[idx]?.revenue || 0), 0
          );
          result[region.region] = regionTotal;
        });
        return result;
      }) 
    : [];

  if (isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
        <p>Lade regionale Daten...</p>
      </div>
    );
  }

  const totalRevenue = regionData.reduce((sum, r) => sum + r.totalRevenue, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Globe className="h-5 w-5 text-muted-foreground" />
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periods.map((period) => (
                <SelectItem key={period} value={period}>
                  {period}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={generateRegionalPdf}>
          <Download className="h-4 w-4 mr-2" />
          PDF Export
        </Button>
      </div>

      {/* Total Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Gesamtumsatz {selectedPeriod}</p>
              <p className="text-4xl font-bold text-primary">{formatCurrency(totalRevenue)}</p>
            </div>
            {regionData.map((region) => (
              <div key={region.region} className="text-center">
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                  {region.emoji} {region.region}
                </p>
                <p className="text-2xl font-bold">{formatCurrency(region.totalRevenue)}</p>
                <Badge 
                  variant="outline" 
                  className={region.trend >= 0 ? "text-green-600 border-green-600 mt-1" : "text-red-600 border-red-600 mt-1"}
                >
                  {region.trend >= 0 ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                  {Math.abs(region.trend)}%
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Monthly Trend Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Monatlicher Umsatzverlauf</CardTitle>
            <CardDescription>Vergleich der regionalen Umsätze über Zeit</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
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
                  <Area type="monotone" dataKey="Afrika" stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Region Cards */}
      {regionData.map((region) => (
        <Card key={region.region}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {region.emoji} {region.region}
                </CardTitle>
                <CardDescription>
                  {region.countries.length} {region.countries.length === 1 ? "Land" : "Länder"} | {formatMinutes(region.totalMinutes)} Minuten
                </CardDescription>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{formatCurrency(region.totalRevenue)}</p>
                <Badge 
                  variant="outline" 
                  className={region.trend >= 0 ? "text-green-600 border-green-600" : "text-red-600 border-red-600"}
                >
                  {region.trend >= 0 ? "+" : ""}{region.trend}% YoY
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Land</TableHead>
                  <TableHead className="text-right">Umsatz</TableHead>
                  <TableHead className="text-right">Minuten</TableHead>
                  <TableHead>Anteil</TableHead>
                  <TableHead className="text-right">Trend</TableHead>
                  <TableHead>Top Provider</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {region.countries.map((country) => (
                  <TableRow key={country.countryCode}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Flag className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{country.country}</span>
                        <Badge variant="outline" className="text-xs">{country.countryCode}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(country.revenue)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMinutes(country.minutes)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress 
                          value={(country.revenue / region.totalRevenue) * 100} 
                          className="h-2 w-24"
                        />
                        <span className="text-sm text-muted-foreground">
                          {((country.revenue / region.totalRevenue) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge 
                        variant="outline" 
                        className={country.trend >= 0 ? "text-green-600 border-green-600" : "text-red-600 border-red-600"}
                      >
                        {country.trend >= 0 ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                        {Math.abs(country.trend)}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {country.providers.slice(0, 2).map((p) => (
                          <Badge key={p.name} variant="secondary" className="text-xs">
                            {p.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
