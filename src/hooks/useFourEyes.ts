import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface FourEyesRule {
  id: string;
  action_type: string;
  approver_user_ids: string[];
  required_approvals: number;
  is_active: boolean;
  organization_id: string | null;
  created_by: string;
  created_at: string;
}

export interface FourEyesApproval {
  id: string;
  rule_id: string;
  target_record_id: string;
  target_table: string;
  approver_id: string;
  approved_at: string;
  comment: string | null;
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  "invoices.approve": "Rechnungen freigeben",
  "opex.approve": "OPEX genehmigen",
  "payments.confirm": "Zahlungen bestätigen",
  "documents.sign": "Dokumente signieren",
  "expenses.approve": "Spesen genehmigen",
  "vacations.approve": "Ferien genehmigen",
  "budget.manage": "Budget genehmigen",
};

export function useFourEyes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ["four-eyes-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("four_eyes_rules" as any)
        .select("*")
        .order("action_type");
      if (error) throw error;
      return data as unknown as FourEyesRule[];
    },
    enabled: !!user,
  });

  const { data: approvals = [], isLoading: approvalsLoading } = useQuery({
    queryKey: ["four-eyes-approvals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("four_eyes_approvals" as any)
        .select("*")
        .order("approved_at", { ascending: false });
      if (error) throw error;
      return data as unknown as FourEyesApproval[];
    },
    enabled: !!user,
  });

  const createRule = useMutation({
    mutationFn: async (data: {
      action_type: string;
      approver_user_ids: string[];
      organization_id?: string;
    }) => {
      const { error } = await supabase.from("four_eyes_rules" as any).insert({
        action_type: data.action_type,
        approver_user_ids: data.approver_user_ids,
        required_approvals: 2,
        is_active: true,
        created_by: user!.id,
        organization_id: data.organization_id || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["four-eyes-rules"] });
      toast.success("Vier-Augen-Regel erstellt");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("four_eyes_rules" as any)
        .update({ is_active, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["four-eyes-rules"] });
      toast.success("Regel aktualisiert");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const submitApproval = useMutation({
    mutationFn: async (data: {
      rule_id: string;
      target_record_id: string;
      target_table: string;
      comment?: string;
    }) => {
      const { error } = await supabase.from("four_eyes_approvals" as any).insert({
        rule_id: data.rule_id,
        target_record_id: data.target_record_id,
        target_table: data.target_table,
        approver_id: user!.id,
        comment: data.comment || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["four-eyes-approvals"] });
      toast.success("Freigabe erteilt");
    },
    onError: (e: any) => toast.error(e.message),
  });

  /**
   * Check if a record has been fully approved under the four-eyes principle.
   */
  const isFullyApproved = (actionType: string, recordId: string): boolean => {
    const rule = rules.find((r) => r.action_type === actionType && r.is_active);
    if (!rule) return true; // No rule = no restriction

    const recordApprovals = approvals.filter(
      (a) => a.rule_id === rule.id && a.target_record_id === recordId
    );

    // Check if required number of DIFFERENT approvers approved
    const uniqueApprovers = new Set(recordApprovals.map((a) => a.approver_id));
    return uniqueApprovers.size >= rule.required_approvals;
  };

  /**
   * Check if the current user can still approve (hasn't already approved).
   */
  const canUserApprove = (actionType: string, recordId: string): boolean => {
    const rule = rules.find((r) => r.action_type === actionType && r.is_active);
    if (!rule) return true;

    // Check user is in the approver list
    if (!rule.approver_user_ids.includes(user!.id)) return false;

    // Check user hasn't already approved
    const hasApproved = approvals.some(
      (a) => a.rule_id === rule.id && a.target_record_id === recordId && a.approver_id === user!.id
    );
    return !hasApproved;
  };

  /**
   * Get approval status for a record.
   */
  const getApprovalStatus = (actionType: string, recordId: string) => {
    const rule = rules.find((r) => r.action_type === actionType && r.is_active);
    if (!rule) return { required: false, current: 0, needed: 0, isComplete: true };

    const recordApprovals = approvals.filter(
      (a) => a.rule_id === rule.id && a.target_record_id === recordId
    );
    const uniqueApprovers = new Set(recordApprovals.map((a) => a.approver_id));

    return {
      required: true,
      current: uniqueApprovers.size,
      needed: rule.required_approvals,
      isComplete: uniqueApprovers.size >= rule.required_approvals,
      rule,
      approvals: recordApprovals,
    };
  };

  return {
    rules,
    approvals,
    rulesLoading,
    approvalsLoading,
    createRule,
    toggleRule,
    submitApproval,
    isFullyApproved,
    canUserApprove,
    getApprovalStatus,
    ACTION_TYPE_LABELS,
  };
}
