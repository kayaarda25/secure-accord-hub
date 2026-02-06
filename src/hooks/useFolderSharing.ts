import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface FolderShare {
  id: string;
  folder_id: string;
  shared_with_organization_id: string;
  shared_by: string;
  created_at: string;
  organization_name?: string;
}

export function useFolderSharing(folderId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch shares for a folder
  const { data: shares = [], isLoading } = useQuery({
    queryKey: ["folder-shares", folderId],
    queryFn: async () => {
      if (!folderId) return [];

      const { data, error } = await supabase
        .from("folder_shares")
        .select("*")
        .eq("folder_id", folderId);

      if (error) throw error;

      // Fetch organization names
      const orgIds = data.map((s: FolderShare) => s.shared_with_organization_id);
      
      if (orgIds.length === 0) return data;

      const { data: orgs } = await supabase
        .from("organizations")
        .select("id, name")
        .in("id", orgIds);

      const orgMap = new Map(
        (orgs || []).map((o: { id: string; name: string }) => [o.id, o.name])
      );

      return data.map((share: FolderShare) => ({
        ...share,
        organization_name: orgMap.get(share.shared_with_organization_id),
      }));
    },
    enabled: !!folderId && !!user,
  });

  // Share folder with organization
  const shareWithOrganization = useMutation({
    mutationFn: async ({
      folderId,
      organizationId,
    }: {
      folderId: string;
      organizationId: string;
    }) => {
      // First mark the folder as shared
      await supabase
        .from("document_folders")
        .update({ is_shared: true })
        .eq("id", folderId);

      // Then create the share record
      const { error } = await supabase.from("folder_shares").insert({
        folder_id: folderId,
        shared_with_organization_id: organizationId,
        shared_by: user!.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folder-shares"] });
      queryClient.invalidateQueries({ queryKey: ["document-folders"] });
      toast.success("Ordner mit Organisation geteilt");
    },
    onError: (error: Error) => {
      if (error.message.includes("duplicate")) {
        toast.info("Ordner bereits mit dieser Organisation geteilt");
      } else {
        toast.error("Fehler beim Teilen");
      }
    },
  });

  // Remove share
  const removeShare = useMutation({
    mutationFn: async (shareId: string) => {
      const { error } = await supabase
        .from("folder_shares")
        .delete()
        .eq("id", shareId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folder-shares"] });
      toast.success("Freigabe entfernt");
    },
    onError: () => {
      toast.error("Fehler beim Entfernen der Freigabe");
    },
  });

  return {
    shares,
    isLoading,
    shareWithOrganization,
    removeShare,
  };
}

// Fetch all organizations for sharing
export function useOrganizations() {
  return useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, org_type")
        .order("name");

      if (error) throw error;
      return data;
    },
  });
}

// Fetch users for a specific organization (uses security definer function to bypass RLS for sharing)
export function useOrganizationUsers(organizationId?: string) {
  return useQuery({
    queryKey: ["organization-users", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      // Use the security definer function to get users from any organization
      const { data, error } = await supabase
        .rpc("get_organization_users_for_sharing", { org_id: organizationId });

      if (error) throw error;
      return data as Array<{
        user_id: string;
        email: string;
        first_name: string | null;
        last_name: string | null;
        organization_id: string;
      }>;
    },
    enabled: !!organizationId,
  });
}
