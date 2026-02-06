import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface VacationRequest {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
}

interface VacationEntitlement {
  id: string;
  user_id: string;
  year: number;
  total_days: number;
  carried_over: number;
  used_days: number;
}

export function useVacations() {
  const { user, hasAnyRole } = useAuth();
  const queryClient = useQueryClient();
  const isManager = hasAnyRole(["admin", "management"]);

  // Fetch vacation requests
  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ["vacation-requests"],
    queryFn: async () => {
      // First get vacation requests
      const { data: vacationData, error } = await supabase
        .from("vacation_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Then fetch profiles for each unique user_id
      const userIds = [...new Set(vacationData.map((r) => r.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .in("user_id", userIds);

      const profilesMap = new Map(
        profilesData?.map((p) => [p.user_id, p]) || []
      );

      return vacationData.map((r) => ({
        ...r,
        profiles: profilesMap.get(r.user_id),
      })) as VacationRequest[];
    },
    enabled: !!user,
  });

  // Fetch current user's entitlement
  const currentYear = new Date().getFullYear();
  const { data: entitlement } = useQuery({
    queryKey: ["vacation-entitlement", user?.id, currentYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vacation_entitlements")
        .select("*")
        .eq("user_id", user!.id)
        .eq("year", currentYear)
        .maybeSingle();

      if (error) throw error;
      return data as VacationEntitlement | null;
    },
    enabled: !!user,
  });

  // Create vacation request
  const createRequest = useMutation({
    mutationFn: async (data: {
      start_date: string;
      end_date: string;
      days_count: number;
      reason?: string;
    }) => {
      const { error } = await supabase.from("vacation_requests").insert({
        user_id: user!.id,
        start_date: data.start_date,
        end_date: data.end_date,
        days_count: data.days_count,
        reason: data.reason || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ferienantrag eingereicht");
      queryClient.invalidateQueries({ queryKey: ["vacation-requests"] });
    },
    onError: (error) => {
      toast.error("Fehler beim Einreichen: " + error.message);
    },
  });

  // Approve request
  const approveRequest = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from("vacation_requests")
        .update({
          status: "approved",
          approved_by: user!.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Antrag genehmigt");
      queryClient.invalidateQueries({ queryKey: ["vacation-requests"] });
    },
    onError: (error) => {
      toast.error("Fehler: " + error.message);
    },
  });

  // Reject request
  const rejectRequest = useMutation({
    mutationFn: async ({
      requestId,
      reason,
    }: {
      requestId: string;
      reason: string;
    }) => {
      const { error } = await supabase
        .from("vacation_requests")
        .update({
          status: "rejected",
          rejected_by: user!.id,
          rejected_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Antrag abgelehnt");
      queryClient.invalidateQueries({ queryKey: ["vacation-requests"] });
    },
    onError: (error) => {
      toast.error("Fehler: " + error.message);
    },
  });

  // Cancel own request
  const cancelRequest = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from("vacation_requests")
        .update({ status: "cancelled" })
        .eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Antrag storniert");
      queryClient.invalidateQueries({ queryKey: ["vacation-requests"] });
    },
    onError: (error) => {
      toast.error("Fehler: " + error.message);
    },
  });

  // Statistics
  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedThisMonth = requests.filter((r) => {
    if (r.status !== "approved") return false;
    const start = new Date(r.start_date);
    const now = new Date();
    return start.getMonth() === now.getMonth() && start.getFullYear() === now.getFullYear();
  }).length;

  const currentAbsences = requests.filter((r) => {
    if (r.status !== "approved") return false;
    const today = new Date().toISOString().split("T")[0];
    return r.start_date <= today && r.end_date >= today;
  }).length;

  const remainingDays = entitlement
    ? entitlement.total_days + entitlement.carried_over - entitlement.used_days
    : null;

  return {
    requests,
    requestsLoading,
    entitlement,
    remainingDays,
    pendingCount,
    approvedThisMonth,
    currentAbsences,
    isManager,
    createRequest,
    approveRequest,
    rejectRequest,
    cancelRequest,
  };
}
