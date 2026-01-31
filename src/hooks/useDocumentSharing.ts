import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface DocumentShare {
  id: string;
  document_id: string;
  shared_with_user_id: string | null;
  shared_with_organization_id: string | null;
  shared_by: string;
  created_at: string;
  user_email?: string;
  user_name?: string;
  organization_name?: string;
}

export function useDocumentSharing(documentId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch shares for a document
  const { data: shares = [], isLoading } = useQuery({
    queryKey: ["document-shares", documentId],
    queryFn: async () => {
      if (!documentId) return [];

      const { data, error } = await supabase
        .from("document_shares")
        .select("*")
        .eq("document_id", documentId);

      if (error) throw error;

      // Fetch user profiles
      const userIds = data
        .filter((s: DocumentShare) => s.shared_with_user_id)
        .map((s: DocumentShare) => s.shared_with_user_id) as string[];

      const orgIds = data
        .filter((s: DocumentShare) => s.shared_with_organization_id)
        .map((s: DocumentShare) => s.shared_with_organization_id) as string[];

      const [profilesRes, orgsRes] = await Promise.all([
        userIds.length > 0
          ? supabase
              .from("profiles")
              .select("user_id, email, first_name, last_name")
              .in("user_id", userIds)
          : { data: [] },
        orgIds.length > 0
          ? supabase.from("organizations").select("id, name").in("id", orgIds)
          : { data: [] },
      ]);

      const profileMap = new Map(
        (profilesRes.data || []).map((p: { user_id: string; email: string; first_name: string | null; last_name: string | null }) => [
          p.user_id,
          {
            email: p.email,
            name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email,
          },
        ])
      );

      const orgMap = new Map(
        (orgsRes.data || []).map((o: { id: string; name: string }) => [o.id, o.name])
      );

      return data.map((share: DocumentShare) => ({
        ...share,
        user_email: share.shared_with_user_id
          ? profileMap.get(share.shared_with_user_id)?.email
          : undefined,
        user_name: share.shared_with_user_id
          ? profileMap.get(share.shared_with_user_id)?.name
          : undefined,
        organization_name: share.shared_with_organization_id
          ? orgMap.get(share.shared_with_organization_id)
          : undefined,
      }));
    },
    enabled: !!documentId && !!user,
  });

  // Share with user
  const shareWithUser = useMutation({
    mutationFn: async ({
      documentId,
      userId,
    }: {
      documentId: string;
      userId: string;
    }) => {
      const { error } = await supabase.from("document_shares").insert({
        document_id: documentId,
        shared_with_user_id: userId,
        shared_by: user!.id,
      });

      if (error) throw error;

      // Log activity
      await supabase.from("document_activity").insert({
        document_id: documentId,
        user_id: user!.id,
        action: "shared",
        details: { shared_with_user: userId },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-shares"] });
      queryClient.invalidateQueries({ queryKey: ["document-activity"] });
      toast.success("Dokument geteilt");
    },
    onError: (error: Error) => {
      if (error.message.includes("duplicate")) {
        toast.info("Dokument bereits geteilt");
      } else {
        toast.error("Fehler beim Teilen");
      }
    },
  });

  // Share with organization
  const shareWithOrganization = useMutation({
    mutationFn: async ({
      documentId,
      organizationId,
    }: {
      documentId: string;
      organizationId: string;
    }) => {
      const { error } = await supabase.from("document_shares").insert({
        document_id: documentId,
        shared_with_organization_id: organizationId,
        shared_by: user!.id,
      });

      if (error) throw error;

      // Log activity
      await supabase.from("document_activity").insert({
        document_id: documentId,
        user_id: user!.id,
        action: "shared",
        details: { shared_with_organization: organizationId },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-shares"] });
      queryClient.invalidateQueries({ queryKey: ["document-activity"] });
      toast.success("Dokument mit Organisation geteilt");
    },
    onError: (error: Error) => {
      if (error.message.includes("duplicate")) {
        toast.info("Dokument bereits mit dieser Organisation geteilt");
      } else {
        toast.error("Fehler beim Teilen");
      }
    },
  });

  // Remove share
  const removeShare = useMutation({
    mutationFn: async (shareId: string) => {
      const { error } = await supabase
        .from("document_shares")
        .delete()
        .eq("id", shareId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-shares"] });
      toast.success("Freigabe entfernt");
    },
    onError: () => {
      toast.error("Fehler beim Entfernen der Freigabe");
    },
  });

  return {
    shares,
    isLoading,
    shareWithUser,
    shareWithOrganization,
    removeShare,
  };
}
