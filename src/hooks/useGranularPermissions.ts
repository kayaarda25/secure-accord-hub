import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PermissionDefinition {
  id: string;
  permission_key: string;
  label: string;
  description: string | null;
  category: string;
}

export function useGranularPermissions() {
  const { user, permissions: userPermissions, hasPermission, hasAnyPermission } = useAuth();
  const [allDefinitions, setAllDefinitions] = useState<PermissionDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    async function fetchDefinitions() {
      setIsLoading(true);
      try {
        const { data: defs } = await supabase
          .from("permission_definitions")
          .select("*")
          .order("category", { ascending: true });

        if (defs) {
          setAllDefinitions(defs as PermissionDefinition[]);
        }
      } catch (error) {
        console.error("Error fetching permission definitions:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDefinitions();
  }, [user]);

  return {
    hasPermission,
    hasAnyPermission,
    userPermissions,
    allDefinitions,
    isLoading,
  };
}
