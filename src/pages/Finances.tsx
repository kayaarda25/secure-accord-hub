import { Layout } from "@/components/layout/Layout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Download,
  Filter,
  Plus,
  MoreHorizontal,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

const transactions = [
  {
    id: 1,
    date: "2024-10-18",
    description: "Revenue Share - MTN Uganda",
    category: "Einnahmen",
    currency: "CHF",
    amount: 125000,
    status: "completed",
    partner: "MTN Uganda",
  },
  {
    id: 2,
    date: "2024-10-17",
    description: "Betriebskosten Q3",
    category: "Ausgaben",
    currency: "CHF",
    amount: -45000,
    status: "completed",
    partner: "Intern",
  },
  {
    id: 3,
    date: "2024-10-15",
    description: "Lizenzgebühren Uganda",
    category: "Einnahmen",
    currency: "USD",
    amount: 89000,
    status: "pending",
    partner: "URA",
  },
  {
    id: 4,
    date: "2024-10-12",
    description: "Beratungshonorar",
    category: "Ausgaben",
    currency: "CHF",
    amount: -28000,
    status: "completed",
    partner: "External",
  },
  {
    id: 5,
    date: "2024-10-10",
    description: "Revenue Share - Airtel",
    category: "Einnahmen",
    currency: "EUR",
    amount: 67000,
    status: "completed",
    partner: "Airtel Africa",
  },
];

const currencyRates = [
  { currency: "USD", rate: 0.88, change: -0.2 },
  { currency: "EUR", rate: 0.94, change: 0.1 },
  { currency: "UGX", rate: 0.00024, change: -0.5 },
];

export default function Finances() {
  const formatCurrency = (amount: number, currency: string = "CHF") => {
    return new Intl.NumberFormat("de-CH", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
    }).format(Math.abs(amount));
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

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
          title="Gesamteinnahmen"
          value="CHF 5.96M"
          change={18.5}
          icon={<TrendingUp size={20} className="text-success" />}
          variant="success"
        />
        <MetricCard
          title="Gesamtausgaben"
          value="CHF 2.14M"
          change={8.2}
          icon={<TrendingDown size={20} className="text-muted-foreground" />}
        />
        <MetricCard
          title="Offene Zahlungen"
          value="CHF 340K"
          changeLabel="12 Transaktionen"
          icon={<CreditCard size={20} className="text-warning" />}
          variant="warning"
        />
        <MetricCard
          title="Netto-Cashflow"
          value="CHF 3.82M"
          change={12.3}
          icon={<Wallet size={20} className="text-accent" />}
          variant="accent"
        />
      </div>

      {/* Currency Rates */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {currencyRates.map((rate) => (
          <div key={rate.currency} className="card-state p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {rate.currency}/CHF
                </p>
                <p className="text-xl font-semibold text-foreground">
                  {rate.rate.toFixed(4)}
                </p>
              </div>
              <div
                className={`flex items-center gap-1 text-sm ${
                  rate.change >= 0 ? "text-success" : "text-destructive"
                }`}
              >
                {rate.change >= 0 ? (
                  <ArrowUpRight size={16} />
                ) : (
                  <ArrowDownRight size={16} />
                )}
                {Math.abs(rate.change)}%
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Transactions Table */}
      <div className="card-state">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Letzte Transaktionen</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Datum
                </th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Beschreibung
                </th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                  Partner
                </th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="text-right p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Betrag
                </th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx, index) => (
                <tr
                  key={tx.id}
                  className="table-row-state animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <td className="p-4 text-sm text-muted-foreground">
                    {formatDate(tx.date)}
                  </td>
                  <td className="p-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {tx.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tx.category}
                      </p>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground hidden md:table-cell">
                    {tx.partner}
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        tx.status === "completed"
                          ? "status-success"
                          : "status-warning"
                      }`}
                    >
                      {tx.status === "completed" ? "Abgeschlossen" : "Ausstehend"}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <span
                      className={`text-sm font-semibold ${
                        tx.amount >= 0 ? "text-success" : "text-foreground"
                      }`}
                    >
                      {tx.amount >= 0 ? "+" : "-"}
                      {formatCurrency(tx.amount, tx.currency)}
                    </span>
                  </td>
                  <td className="p-4">
                    <button className="p-1 rounded hover:bg-muted text-muted-foreground">
                      <MoreHorizontal size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-border flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Zeige 1-5 von 156 Transaktionen
          </p>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Zurück
            </button>
            <button className="px-3 py-1 text-sm bg-muted rounded text-foreground">
              1
            </button>
            <button className="px-3 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
              2
            </button>
            <button className="px-3 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
              3
            </button>
            <button className="px-3 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Weiter
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
