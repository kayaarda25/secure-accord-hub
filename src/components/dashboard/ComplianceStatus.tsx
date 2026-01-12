import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Inbox } from "lucide-react";

export function ComplianceStatus() {
  const [loading, setLoading] = useState(true);
  const [complianceItems, setComplianceItems] = useState<any[]>([]);

  useEffect(() => {
    // No placeholder data - show empty state
    setLoading(false);
    setComplianceItems([]);
  }, []);

  return (
    <div className="card-state p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-foreground">Compliance-Status</h3>
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">-</span>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Laden...</div>
      ) : complianceItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            Keine Compliance-Einträge vorhanden
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Fügen Sie Dokumente und Verträge hinzu
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Compliance items would be rendered here */}
        </div>
      )}
    </div>
  );
}
