import { Inbox } from "lucide-react";

export function UpcomingDeadlines() {
  // Empty state - no placeholder data
  const deadlines: any[] = [];

  return (
    <div className="card-state p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">Anstehende Fristen</h3>
        <button className="text-sm text-accent hover:text-accent/80 transition-colors">
          Alle anzeigen
        </button>
      </div>

      {deadlines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            Keine anstehenden Fristen
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Deadline items would be rendered here */}
        </div>
      )}
    </div>
  );
}
