import { Shield, CheckCircle, AlertTriangle, XCircle } from "lucide-react";

const complianceItems = [
  {
    name: "Datenschutz (DSG)",
    status: "compliant",
    lastAudit: "15.10.2024",
  },
  {
    name: "Finanzberichterstattung",
    status: "compliant",
    lastAudit: "01.10.2024",
  },
  {
    name: "Lizenz Uganda",
    status: "warning",
    lastAudit: "Fällig in 14 Tagen",
  },
  {
    name: "Partner-Verträge",
    status: "compliant",
    lastAudit: "20.09.2024",
  },
  {
    name: "Sicherheits-Audit",
    status: "compliant",
    lastAudit: "05.09.2024",
  },
];

export function ComplianceStatus() {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "compliant":
        return <CheckCircle size={16} className="text-success" />;
      case "warning":
        return <AlertTriangle size={16} className="text-warning" />;
      case "critical":
        return <XCircle size={16} className="text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "compliant":
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded status-success">
            Konform
          </span>
        );
      case "warning":
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded status-warning">
            Prüfen
          </span>
        );
      case "critical":
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded status-critical">
            Kritisch
          </span>
        );
      default:
        return null;
    }
  };

  const compliantCount = complianceItems.filter(
    (item) => item.status === "compliant"
  ).length;
  const totalCount = complianceItems.length;
  const percentage = Math.round((compliantCount / totalCount) * 100);

  return (
    <div className="card-state p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-foreground">Compliance-Status</h3>
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-success" />
          <span className="text-sm font-medium text-success">{percentage}%</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-muted rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-success rounded-full transition-all duration-1000"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="space-y-3">
        {complianceItems.map((item, index) => (
          <div
            key={item.name}
            className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 animate-fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-center gap-3">
              {getStatusIcon(item.status)}
              <span className="text-sm text-foreground">{item.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground hidden sm:block">
                {item.lastAudit}
              </span>
              {getStatusBadge(item.status)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
