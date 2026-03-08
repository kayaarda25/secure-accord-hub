import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface BexioAccount {
  id: string;
  organization_id: string;
  account_name: string;
  entity_type: string;
  is_active: boolean;
  created_at: string;
}

export function useMultiBexio() {
  const { user, profile } = useAuth();
  const [accounts, setAccounts] = useState<BexioAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchAccounts = async () => {
    if (!profile?.organization_id) {
      setAccounts([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("bexio_accounts")
        .select("id, organization_id, account_name, entity_type, is_active, created_at")
        .eq("organization_id", profile.organization_id)
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setAccounts((data as BexioAccount[]) || []);
      if (data && data.length > 0 && !selectedAccountId) {
        setSelectedAccountId(data[0].id);
      }
    } catch (error) {
      console.error("Error fetching Bexio accounts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [profile?.organization_id]);

  // Re-fetch accounts when returning from Bexio OAuth (new account added)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("bexio") === "connected") {
      fetchAccounts();
    }
  }, []);

  const addAccount = async (name: string, entityType: string = "default") => {
    if (!user || !profile?.organization_id) return;

    try {
      const { error } = await supabase.from("bexio_accounts").insert({
        organization_id: profile.organization_id,
        account_name: name,
        entity_type: entityType,
        created_by: user.id,
      });

      if (error) throw error;

      toast({ title: "Bexio-Konto hinzugefügt", description: `"${name}" wurde erfolgreich angelegt.` });
      fetchAccounts();
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    }
  };

  const removeAccount = async (accountId: string) => {
    try {
      const { error } = await supabase
        .from("bexio_accounts")
        .update({ is_active: false })
        .eq("id", accountId);

      if (error) throw error;

      toast({ title: "Bexio-Konto entfernt" });
      if (selectedAccountId === accountId) setSelectedAccountId(null);
      fetchAccounts();
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    }
  };

  return {
    accounts,
    selectedAccountId,
    setSelectedAccountId,
    isLoading,
    addAccount,
    removeAccount,
    refetch: fetchAccounts,
  };
}
