import { FileText, Wallet, Users, AlertTriangle, CheckCircle } from "lucide-react";

const activities = [
  {
    id: 1,
    type: "payment",
    title: "Zahlung eingegangen",
    description: "CHF 125'000 von Uganda Revenue Authority",
    time: "Vor 2 Stunden",
    icon: Wallet,
    iconColor: "text-success",
    iconBg: "bg-success/10",
  },
  {
    id: 2,
    type: "document",
    title: "Vertrag unterzeichnet",
    description: "Kooperationsvertrag Phase II - Digital signiert",
    time: "Vor 4 Stunden",
    icon: FileText,
    iconColor: "text-accent",
    iconBg: "bg-accent/10",
  },
  {
    id: 3,
    type: "alert",
    title: "Frist in 7 Tagen",
    description: "Lizenzverlängerung Telekom Uganda",
    time: "Vor 6 Stunden",
    icon: AlertTriangle,
    iconColor: "text-warning",
    iconBg: "bg-warning/10",
  },
  {
    id: 4,
    type: "partner",
    title: "Neuer Partner hinzugefügt",
    description: "Ministry of ICT Rwanda",
    time: "Gestern",
    icon: Users,
    iconColor: "text-info",
    iconBg: "bg-info/10",
  },
  {
    id: 5,
    type: "compliance",
    title: "Audit abgeschlossen",
    description: "Q3 Finanzprüfung bestanden",
    time: "Vor 2 Tagen",
    icon: CheckCircle,
    iconColor: "text-success",
    iconBg: "bg-success/10",
  },
];

export function ActivityFeed() {
  return (
    <div className="card-state p-6">
      <h3 className="font-semibold text-foreground mb-4">Letzte Aktivitäten</h3>
      <div className="space-y-4">
        {activities.map((activity, index) => (
          <div
            key={activity.id}
            className="flex items-start gap-4 animate-fade-in"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className={`p-2 rounded-lg ${activity.iconBg}`}>
              <activity.icon size={16} className={activity.iconColor} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {activity.title}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {activity.description}
              </p>
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {activity.time}
            </span>
          </div>
        ))}
      </div>
      <button className="w-full mt-4 py-2 text-sm text-accent hover:text-accent/80 transition-colors">
        Alle Aktivitäten anzeigen →
      </button>
    </div>
  );
}
