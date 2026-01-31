import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface DocumentActivity {
  id: string;
  document_id: string;
  user_id: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

interface DbActivity {
  id: string;
  document_id: string;
  user_id: string;
  action: string;
  details: unknown;
  created_at: string;
}

interface ProfileData {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

export function useDocumentActivity(documentId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch activity for a specific document
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["document-activity", documentId],
    queryFn: async () => {
      if (!documentId) return [];
      
      const { data, error } = await supabase
        .from("document_activity")
        .select("*")
        .eq("document_id", documentId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const dbData = data as DbActivity[];

      // Fetch user profiles for the activities
      const userIds = [...new Set(dbData.map((a) => a.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, first_name, last_name")
        .in("user_id", userIds);

      const profileMap = new Map(
        ((profiles || []) as ProfileData[]).map((p) => [
          p.user_id,
          {
            email: p.email,
            name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email,
          },
        ])
      );

      return dbData.map((activity) => ({
        ...activity,
        details: (activity.details as Record<string, unknown>) || {},
        user_email: profileMap.get(activity.user_id)?.email || "Unbekannt",
        user_name: profileMap.get(activity.user_id)?.name || "Unbekannt",
      })) as DocumentActivity[];
    },
    enabled: !!documentId && !!user,
  });

  // Log activity mutation
  const logActivity = useMutation({
    mutationFn: async ({
      documentId,
      action,
      details = {},
    }: {
      documentId: string;
      action: string;
      details?: Record<string, unknown>;
    }) => {
      const { error } = await supabase.from("document_activity").insert([{
        document_id: documentId,
        user_id: user!.id,
        action,
        details: details as unknown as Record<string, never>,
      }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-activity"] });
    },
  });

  return {
    activities,
    isLoading,
    logActivity,
  };
}

// Helper to get action labels in German
export function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    created: "erstellt",
    viewed: "angesehen",
    downloaded: "heruntergeladen",
    edited: "bearbeitet",
    renamed: "umbenannt",
    moved: "verschoben",
    shared: "geteilt",
    unshared: "Freigabe entfernt",
    tagged: "getaggt",
  };
  return labels[action] || action;
}
