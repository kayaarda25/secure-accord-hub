import { Calendar, AlertCircle, Clock, FileText, Wallet } from "lucide-react";

const deadlines = [
  {
    id: 1,
    title: "Lizenzverlängerung Uganda",
    type: "license",
    date: "2024-10-28",
    daysLeft: 7,
    priority: "critical",
    icon: FileText,
  },
  {
    id: 2,
    title: "Quartalsabrechnung Q3",
    type: "finance",
    date: "2024-10-31",
    daysLeft: 10,
    priority: "warning",
    icon: Wallet,
  },
  {
    id: 3,
    title: "Partner-Review Meeting",
    type: "meeting",
    date: "2024-11-05",
    daysLeft: 15,
    priority: "normal",
    icon: Calendar,
  },
  {
    id: 4,
    title: "Vertragsverlängerung MTN",
    type: "contract",
    date: "2024-11-15",
    daysLeft: 25,
    priority: "normal",
    icon: FileText,
  },
];

export function UpcomingDeadlines() {
  const getPriorityStyles = (priority: string) => {
    switch (priority) {
      case "critical":
        return {
          border: "border-l-destructive",
          bg: "bg-destructive/5",
          badge: "status-critical",
          text: "text-destructive",
        };
      case "warning":
        return {
          border: "border-l-warning",
          bg: "bg-warning/5",
          badge: "status-warning",
          text: "text-warning",
        };
      default:
        return {
          border: "border-l-muted-foreground",
          bg: "bg-muted/30",
          badge: "status-info",
          text: "text-muted-foreground",
        };
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "short",
    });
  };

  return (
    <div className="card-state p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">Anstehende Fristen</h3>
        <button className="text-sm text-accent hover:text-accent/80 transition-colors">
          Alle anzeigen
        </button>
      </div>

      <div className="space-y-3">
        {deadlines.map((deadline, index) => {
          const styles = getPriorityStyles(deadline.priority);
          return (
            <div
              key={deadline.id}
              className={`flex items-center gap-4 p-3 rounded-lg border-l-2 ${styles.border} ${styles.bg} animate-fade-in`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex-shrink-0">
                <deadline.icon size={18} className={styles.text} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {deadline.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(deadline.date)}
                </p>
              </div>
              <div className={`px-2 py-1 rounded text-xs font-medium ${styles.badge}`}>
                {deadline.daysLeft === 1
                  ? "Morgen"
                  : `${deadline.daysLeft} Tage`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
