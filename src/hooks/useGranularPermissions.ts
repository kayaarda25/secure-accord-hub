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
  const { user, roles } = useAuth();
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [allDefinitions, setAllDefinitions] = useState<PermissionDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setUserPermissions([]);
      setIsLoading(false);
      return;
    }

    async function fetchPermissions() {
      setIsLoading(true);
      try {
        const [{ data: perms }, { data: defs }] = await Promise.all([
          supabase
            .from("user_permissions")
            .select("permission_key")
            .eq("user_id", user!.id),
          supabase
            .from("permission_definitions")
            .select("*")
            .order("category", { ascending: true }),
        ]);

        if (perms) {
          setUserPermissions(perms.map((p: any) => p.permission_key));
        }
        if (defs) {
          setAllDefinitions(defs as PermissionDefinition[]);
        }
      } catch (error) {
        console.error("Error fetching permissions:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPermissions();
  }, [user]);

  const hasPermission = (key: string): boolean => {
    // Admins have all permissions
    if (roles.includes("admin")) return true;
    return userPermissions.includes(key);
  };

  const hasAnyPermission = (keys: string[]): boolean => {
    if (roles.includes("admin")) return true;
    return keys.some((k) => userPermissions.includes(k));
  };

  return {
    hasPermission,
    hasAnyPermission,
    userPermissions,
    allDefinitions,
    isLoading,
  };
}
