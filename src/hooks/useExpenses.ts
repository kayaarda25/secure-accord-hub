import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface HrExpense {
  id: string;
  employee_id: string;
  submitted_by: string;
  organization_id: string | null;
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  receipt_path: string | null;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  employee_name?: string;
}

export function useExpenses() {
  const { user, hasAnyPermission } = useAuth();
  const queryClient = useQueryClient();
  const isManager = hasAnyPermission(["expenses.approve", "admin.full_access"]);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["hr-expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_expenses" as any)
        .select("*, employee_records!inner(first_name, last_name)")
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return (data as any[]).map((e) => ({
        ...e,
        employee_name: `${e.employee_records?.first_name || ""} ${e.employee_records?.last_name || ""}`.trim() || "–",
      })) as HrExpense[];
    },
    enabled: !!user,
  });

  const totalPending = expenses
    .filter((e) => e.status === "pending")
    .reduce((s, e) => s + Number(e.amount), 0);

  const totalApproved = expenses
    .filter((e) => e.status === "approved")
    .reduce((s, e) => s + Number(e.amount), 0);

  const createExpense = useMutation({
    mutationFn: async (data: {
      employee_id: string;
      expense_date: string;
      category: string;
      description: string;
      amount: number;
      currency: string;
      notes?: string;
    }) => {
      const { error } = await supabase.from("hr_expenses" as any).insert({
        ...data,
        submitted_by: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-expenses"] });
      toast.success("Spesen erfolgreich erfasst");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const approveExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("hr_expenses" as any)
        .update({
          status: "approved",
          approved_by: user!.id,
          approved_at: new Date().toISOString(),
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-expenses"] });
      toast.success("Spesen genehmigt");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const rejectExpense = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase
        .from("hr_expenses" as any)
        .update({
          status: "rejected",
          rejected_by: user!.id,
          rejected_at: new Date().toISOString(),
          rejection_reason: reason,
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-expenses"] });
      toast.success("Spesen abgelehnt");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return {
    expenses,
    isLoading,
    isManager,
    totalPending,
    totalApproved,
    createExpense,
    approveExpense,
    rejectExpense,
  };
}
