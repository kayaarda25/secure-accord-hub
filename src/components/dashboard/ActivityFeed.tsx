import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Inbox } from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  table_name: string;
  created_at: string;
  user_id: string | null;
}

export function ActivityFeed() {
  const [activities, setActivities] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "CREATE":
        return "Erstellt";
      case "UPDATE":
        return "Aktualisiert";
      case "DELETE":
        return "Gelöscht";
      default:
        return action;
    }
  };

  const getTableLabel = (table: string) => {
    const labels: Record<string, string> = {
      profiles: "Profil",
      user_roles: "Benutzerrolle",
      opex_expenses: "OPEX-Ausgabe",
      cost_centers: "Kostenstelle",
      organizations: "Organisation",
      communication_threads: "Kommunikation",
    };
    return labels[table] || table;
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (hours < 1) return "Gerade eben";
    if (hours < 24) return `Vor ${hours} Stunden`;
    if (days < 7) return `Vor ${days} Tagen`;
    return date.toLocaleDateString("de-CH");
  };

  return (
    <div className="card-state p-6">
      <h3 className="font-semibold text-foreground mb-4">Letzte Aktivitäten</h3>
      
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Laden...</div>
      ) : activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            Noch keine Aktivitäten vorhanden
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {activities.map((activity, index) => (
            <div
              key={activity.id}
              className="flex items-start gap-4 animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="p-2 rounded-lg bg-muted/50">
                <div className="w-4 h-4 rounded-full bg-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {getActionLabel(activity.action)}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {getTableLabel(activity.table_name)}
                </p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatTime(activity.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}

      <button className="w-full mt-4 py-2 text-sm text-accent hover:text-accent/80 transition-colors">
        Alle Aktivitäten anzeigen →
      </button>
    </div>
  );
}
