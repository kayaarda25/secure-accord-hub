import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface DashboardWidget {
  id: string;
  label: string;
  visible: boolean;
  order: number;
}

const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: "kpi-metrics", label: "KPI Metriken", visible: true, order: 0 },
  { id: "company-cards", label: "Unternehmenskarten", visible: true, order: 1 },
  { id: "finance-chart", label: "Umsatzentwicklung", visible: true, order: 2 },
  { id: "upcoming-deadlines", label: "Anstehende Deadlines", visible: true, order: 3 },
  { id: "activity-feed", label: "Aktivitäten", visible: true, order: 4 },
  { id: "compliance-status", label: "Compliance Status", visible: false, order: 5 },
  { id: "partner-overview", label: "Partner Übersicht", visible: false, order: 6 },
];

export function useDashboardLayout() {
  const { user } = useAuth();
  const [widgets, setWidgets] = useState<DashboardWidget[]>(DEFAULT_WIDGETS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadLayout();
    }
  }, [user?.id]);

  const loadLayout = async () => {
    try {
      const { data, error } = await supabase
        .from("user_dashboard_layouts")
        .select("layout")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) throw error;

      if (data?.layout && Array.isArray(data.layout)) {
        // Merge saved layout with defaults (to pick up new widgets)
        const saved = data.layout as unknown as DashboardWidget[];
        const merged = DEFAULT_WIDGETS.map((def) => {
          const found = saved.find((s) => s.id === def.id);
          return found ? { ...def, visible: found.visible, order: found.order } : def;
        });
        merged.sort((a, b) => a.order - b.order);
        setWidgets(merged);
      }
    } catch (error) {
      console.error("Error loading dashboard layout:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveLayout = useCallback(
    async (updatedWidgets: DashboardWidget[]) => {
      if (!user?.id) return;
      setSaving(true);
      try {
        const payload = updatedWidgets.map(({ id, visible, order }) => ({ id, visible, order }));

        const { data: existing } = await supabase
          .from("user_dashboard_layouts")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("user_dashboard_layouts")
            .update({ layout: payload as any, updated_at: new Date().toISOString() })
            .eq("user_id", user.id);
        } else {
          await supabase
            .from("user_dashboard_layouts")
            .insert({ user_id: user.id, layout: payload as any });
        }
      } catch (error) {
        console.error("Error saving dashboard layout:", error);
      } finally {
        setSaving(false);
      }
    },
    [user?.id]
  );

  const toggleWidget = useCallback(
    (widgetId: string) => {
      setWidgets((prev) => {
        const updated = prev.map((w) =>
          w.id === widgetId ? { ...w, visible: !w.visible } : w
        );
        saveLayout(updated);
        return updated;
      });
    },
    [saveLayout]
  );

  const moveWidget = useCallback(
    (widgetId: string, direction: "up" | "down") => {
      setWidgets((prev) => {
        const idx = prev.findIndex((w) => w.id === widgetId);
        if (idx < 0) return prev;
        const swapIdx = direction === "up" ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= prev.length) return prev;

        const updated = [...prev];
        [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];
        const reordered = updated.map((w, i) => ({ ...w, order: i }));
        saveLayout(reordered);
        return reordered;
      });
    },
    [saveLayout]
  );

  const resetLayout = useCallback(() => {
    setWidgets(DEFAULT_WIDGETS);
    saveLayout(DEFAULT_WIDGETS);
  }, [saveLayout]);

  const visibleWidgets = widgets.filter((w) => w.visible);

  return { widgets, visibleWidgets, loading, saving, toggleWidget, moveWidget, resetLayout };
}
