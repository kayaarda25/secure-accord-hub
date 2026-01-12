import { Building2, Globe, TrendingUp, MoreHorizontal } from "lucide-react";

const partners = [
  {
    id: 1,
    name: "Uganda Revenue Authority",
    type: "Behörde",
    country: "Uganda",
    status: "active",
    revenue: "CHF 1.2M",
    trend: 12,
  },
  {
    id: 2,
    name: "MTN Uganda",
    type: "Telekom",
    country: "Uganda",
    status: "active",
    revenue: "CHF 850K",
    trend: 8,
  },
  {
    id: 3,
    name: "Ministry of ICT",
    type: "Behörde",
    country: "Rwanda",
    status: "pending",
    revenue: "CHF 0",
    trend: 0,
  },
  {
    id: 4,
    name: "Airtel Africa",
    type: "Telekom",
    country: "Regional",
    status: "active",
    revenue: "CHF 620K",
    trend: -3,
  },
];

export function PartnerOverview() {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded status-success">
            Aktiv
          </span>
        );
      case "pending":
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded status-warning">
            Ausstehend
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded status-info">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="card-state p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">Partner & Behörden</h3>
        <button className="text-sm text-accent hover:text-accent/80 transition-colors">
          Alle Partner
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Partner
              </th>
              <th className="text-left py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                Land
              </th>
              <th className="text-left py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              <th className="text-right py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Umsatz
              </th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {partners.map((partner, index) => (
              <tr
                key={partner.id}
                className="table-row-state animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      {partner.type === "Behörde" ? (
                        <Globe size={14} className="text-muted-foreground" />
                      ) : (
                        <Building2 size={14} className="text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {partner.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {partner.type}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="py-3 hidden md:table-cell">
                  <span className="text-sm text-muted-foreground">
                    {partner.country}
                  </span>
                </td>
                <td className="py-3">{getStatusBadge(partner.status)}</td>
                <td className="py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {partner.revenue}
                    </span>
                    {partner.trend !== 0 && (
                      <span
                        className={`text-xs ${
                          partner.trend > 0 ? "text-success" : "text-destructive"
                        }`}
                      >
                        {partner.trend > 0 ? "+" : ""}
                        {partner.trend}%
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3">
                  <button className="p-1 rounded hover:bg-muted text-muted-foreground">
                    <MoreHorizontal size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
