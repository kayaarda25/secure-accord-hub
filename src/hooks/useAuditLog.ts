import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useAuditLog() {
  const { user } = useAuth();

  const logAction = async (
    action: string,
    tableName: string,
    recordId?: string,
    oldValues?: Record<string, unknown>,
    newValues?: Record<string, unknown>
  ) => {
    if (!user) return;

    try {
      await supabase.from("audit_logs").insert([{
        user_id: user.id,
        action,
        table_name: tableName,
        record_id: recordId,
        old_values: oldValues as any,
        new_values: newValues as any,
      }]);
    } catch (error) {
      console.error("Failed to log audit action:", error);
    }
  };

  return { logAction };
}
