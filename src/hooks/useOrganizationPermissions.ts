import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type OrganizationType = "mgi_media" | "mgi_communications" | "gateway";

export interface OrganizationPermissions {
  canCreateDeclarations: boolean;
  canCreateInvoices: boolean;
  canCreateOpex: boolean;
  canCreateBudget: boolean;
  canViewDeclarations: boolean;
  canViewInvoices: boolean;
  canViewOpex: boolean;
  canViewBudget: boolean;
  orgType: OrganizationType | null;
  isGateway: boolean;
  isMgi: boolean;
}

const defaultPermissions: OrganizationPermissions = {
  canCreateDeclarations: false,
  canCreateInvoices: false,
  canCreateOpex: false,
  canCreateBudget: false,
  canViewDeclarations: false,
  canViewInvoices: false,
  canViewOpex: false,
  canViewBudget: false,
  orgType: null,
  isGateway: false,
  isMgi: false,
};

// Debug: Log when permissions are fetched
const DEBUG = true;

export function useOrganizationPermissions() {
  const { user, profile, hasRole } = useAuth();
  const [permissions, setPermissions] = useState<OrganizationPermissions>(defaultPermissions);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchPermissions() {
      if (!user || !profile?.organization_id) {
        setPermissions(defaultPermissions);
        setIsLoading(false);
        return;
      }

      try {
        // Get organization type
        const { data: org, error: orgError } = await supabase
          .from("organizations")
          .select("org_type")
          .eq("id", profile.organization_id)
          .single();

        if (DEBUG) {
          console.log("Org fetch result:", { org, orgError, organization_id: profile.organization_id });
        }

        if (orgError || !org?.org_type) {
          console.error("Error fetching organization:", orgError);
          setPermissions(defaultPermissions);
          setIsLoading(false);
          return;
        }

        const orgType = org.org_type as OrganizationType;

        // Get permissions for this org type
        const { data: perms, error: permsError } = await supabase
          .from("organization_permissions")
          .select("*")
          .eq("org_type", orgType)
          .single();

        if (DEBUG) {
          console.log("Permissions fetch result:", { perms, permsError, orgType });
        }

        if (permsError || !perms) {
          console.error("Error fetching permissions:", permsError);
          setPermissions(defaultPermissions);
          setIsLoading(false);
          return;
        }

        // Admin override - admins can do everything
        const isAdmin = hasRole("admin");

        const newPermissions = {
          canCreateDeclarations: isAdmin || perms.can_create_declarations,
          canCreateInvoices: isAdmin || perms.can_create_invoices,
          canCreateOpex: isAdmin || perms.can_create_opex,
          canCreateBudget: isAdmin || perms.can_create_budget,
          canViewDeclarations: isAdmin || perms.can_view_declarations,
          canViewInvoices: isAdmin || perms.can_view_invoices,
          canViewOpex: isAdmin || perms.can_view_opex,
          canViewBudget: isAdmin || perms.can_view_budget,
          orgType,
          isGateway: orgType === "gateway",
          isMgi: orgType === "mgi_media" || orgType === "mgi_communications",
        };

        if (DEBUG) {
          console.log("Setting permissions:", newPermissions);
        }

        setPermissions(newPermissions);
      } catch (error) {
        console.error("Error in fetchPermissions:", error);
        setPermissions(defaultPermissions);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPermissions();
  }, [user, profile?.organization_id, hasRole]);

  return { permissions, isLoading };
}
