import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface OpexLineItem {
  id: string;
  budget_id: string;
  category: string;
  label: string;
  amount: number;
  sort_order: number;
}

export interface OpexBudget {
  id: string;
  organization_id: string | null;
  cost_center_id: string | null;
  period: string;
  currency: string;
  total_amount: number;
  status: string;
  submitted_by: string;
  submitted_at: string;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  line_items?: OpexLineItem[];
}

export function useOpexBudgets() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [budgets, setBudgets] = useState<OpexBudget[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBudgets = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("opex_budgets")
        .select("*")
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      setBudgets((data as OpexBudget[]) || []);
    } catch (error) {
      console.error("Error fetching OPEX budgets:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLineItems = async (budgetId: string): Promise<OpexLineItem[]> => {
    const { data, error } = await supabase
      .from("opex_line_items")
      .select("*")
      .eq("budget_id", budgetId)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Error fetching line items:", error);
      return [];
    }
    return (data as OpexLineItem[]) || [];
  };

  const createBudget = async (
    costCenterId: string,
    organizationId: string | null,
    period: string,
    currency: string,
    notes: string,
    lineItems: Omit<OpexLineItem, "id" | "budget_id">[]
  ) => {
    if (!user) return null;

    try {
      const totalAmount = lineItems.reduce((s, li) => s + li.amount, 0);

      const { data: budget, error } = await supabase
        .from("opex_budgets")
        .insert({
          cost_center_id: costCenterId,
          organization_id: organizationId,
          period,
          currency,
          total_amount: totalAmount,
          submitted_by: user.id,
          notes: notes || null,
          status: "draft",
        })
        .select()
        .single();

      if (error) throw error;

      // Insert line items
      if (budget && lineItems.length > 0) {
        const items = lineItems.map((li, idx) => ({
          budget_id: budget.id,
          category: li.category,
          label: li.label,
          amount: li.amount,
          sort_order: li.sort_order ?? idx,
        }));

        const { error: liError } = await supabase
          .from("opex_line_items")
          .insert(items);

        if (liError) throw liError;
      }

      toast({ title: "OPEX-Budget erstellt", description: `Budget für ${period} wurde angelegt.` });
      fetchBudgets();
      return budget;
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return null;
    }
  };

  const approveBudget = async (budgetId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("opex_budgets")
        .update({
          status: "approved",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", budgetId);

      if (error) throw error;

      toast({ title: "OPEX genehmigt" });
      fetchBudgets();
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    }
  };

  const rejectBudget = async (budgetId: string, reason: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("opex_budgets")
        .update({
          status: "rejected",
          rejected_by: user.id,
          rejected_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq("id", budgetId);

      if (error) throw error;

      toast({ title: "OPEX abgelehnt" });
      fetchBudgets();
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    }
  };

  const submitBudget = async (budgetId: string) => {
    try {
      const { error } = await supabase
        .from("opex_budgets")
        .update({ status: "pending" })
        .eq("id", budgetId);

      if (error) throw error;

      toast({ title: "OPEX eingereicht", description: "Das Budget wurde zur Genehmigung eingereicht." });
      fetchBudgets();
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    }
  };

  useEffect(() => {
    if (user) fetchBudgets();
  }, [user]);

  return {
    budgets,
    isLoading,
    fetchBudgets,
    fetchLineItems,
    createBudget,
    approveBudget,
    rejectBudget,
    submitBudget,
  };
}
