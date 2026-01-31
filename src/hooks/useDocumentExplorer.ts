import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface DocumentFolder {
  id: string;
  name: string;
  parent_id: string | null;
  organization_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  color: string;
  icon: string;
}

export interface DocumentTag {
  id: string;
  name: string;
  color: string;
  organization_id: string | null;
  created_by: string;
  created_at: string;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  content: Record<string, unknown>;
  organization_id: string | null;
  is_global: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useDocumentExplorer() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  // Fetch folders
  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ["document-folders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_folders")
        .select(`
          *,
          folder_shares(shared_with_organization_id)
        `)
        .order("name");
      
      if (error) throw error;
      return data as (DocumentFolder & { folder_shares?: Array<{ shared_with_organization_id: string }> })[];
    },
    enabled: !!user,
  });

  // Fetch tags
  const { data: tags = [], isLoading: tagsLoading } = useQuery({
    queryKey: ["document-tags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_tags")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data as DocumentTag[];
    },
    enabled: !!user,
  });

  // Fetch templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ["document-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_templates")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data as DocumentTemplate[];
    },
    enabled: !!user,
  });

  // Fetch documents with folder and tag info
  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ["explorer-documents", currentFolderId],
    queryFn: async () => {
      let query = supabase
        .from("documents")
        .select(`
          *,
          document_tag_assignments(
            tag_id,
            document_tags(id, name, color)
          )
        `)
        .order("created_at", { ascending: false });

      if (currentFolderId) {
        query = query.eq("folder_id", currentFolderId);
      } else {
        query = query.is("folder_id", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Create folder mutation
  const createFolder = useMutation({
    mutationFn: async ({ name, parentId, color, silent }: { name: string; parentId?: string | null; color?: string; silent?: boolean }) => {
      const { data, error } = await supabase
        .from("document_folders")
        .insert({
          name,
          parent_id: parentId || null,
          color: color || "#c97c5d",
          created_by: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return { data, silent };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["document-folders"] });
      if (!result.silent) {
        toast.success("Ordner erstellt");
      }
    },
    onError: (error) => {
      toast.error("Fehler beim Erstellen des Ordners");
      console.error(error);
    },
  });

  // Rename folder mutation
  const renameFolder = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from("document_folders")
        .update({ name })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-folders"] });
      toast.success("Ordner umbenannt");
    },
    onError: (error) => {
      toast.error("Fehler beim Umbenennen");
      console.error(error);
    },
  });

  // Rename document mutation
  const renameDocument = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from("documents")
        .update({ name })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["explorer-documents"] });
      toast.success("Dokument umbenannt");
    },
    onError: (error) => {
      toast.error("Fehler beim Umbenennen");
      console.error(error);
    },
  });

  // Delete document mutation
  const deleteDocument = useMutation({
    mutationFn: async ({ id, filePath }: { id: string; filePath: string }) => {
      // Delete from storage first
      const { error: storageError } = await supabase.storage
        .from("documents")
        .remove([filePath]);

      if (storageError) console.error("Storage delete error:", storageError);

      // Delete from database
      const { error } = await supabase
        .from("documents")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["explorer-documents"] });
      toast.success("Dokument gelöscht");
    },
    onError: (error) => {
      toast.error("Fehler beim Löschen");
      console.error(error);
    },
  });

  // Delete folder mutation
  const deleteFolder = useMutation({
    mutationFn: async (folderId: string) => {
      const { error } = await supabase
        .from("document_folders")
        .delete()
        .eq("id", folderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-folders"] });
      toast.success("Ordner gelöscht");
    },
    onError: (error) => {
      toast.error("Fehler beim Löschen des Ordners");
      console.error(error);
    },
  });

  // Create tag mutation
  const createTag = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const { data, error } = await supabase
        .from("document_tags")
        .insert({
          name,
          color,
          created_by: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-tags"] });
      toast.success("Tag erstellt");
    },
    onError: (error) => {
      toast.error("Fehler beim Erstellen des Tags");
      console.error(error);
    },
  });

  // Assign tag to document
  const assignTag = useMutation({
    mutationFn: async ({ documentId, tagId }: { documentId: string; tagId: string }) => {
      const { error } = await supabase
        .from("document_tag_assignments")
        .insert({
          document_id: documentId,
          tag_id: tagId,
          assigned_by: user!.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["explorer-documents"] });
      toast.success("Tag zugewiesen");
    },
    onError: (error: Error) => {
      if (error.message.includes("duplicate")) {
        toast.info("Tag bereits zugewiesen");
      } else {
        toast.error("Fehler beim Zuweisen des Tags");
      }
    },
  });

  // Move document to folder
  const moveToFolder = useMutation({
    mutationFn: async ({ documentId, folderId }: { documentId: string; folderId: string | null }) => {
      const { error } = await supabase
        .from("documents")
        .update({ folder_id: folderId })
        .eq("id", documentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["explorer-documents"] });
      toast.success("Dokument verschoben");
    },
    onError: (error) => {
      toast.error("Fehler beim Verschieben");
      console.error(error);
    },
  });

  // Create template
  const createTemplate = useMutation({
    mutationFn: async (template: { name: string; description?: string; category: string; content: Record<string, unknown> }) => {
      const { data, error } = await supabase
        .from("document_templates")
        .insert([{
          name: template.name,
          description: template.description || null,
          category: template.category,
          content: JSON.parse(JSON.stringify(template.content)),
          created_by: user!.id,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      toast.success("Vorlage erstellt");
    },
    onError: (error) => {
      toast.error("Fehler beim Erstellen der Vorlage");
      console.error(error);
    },
  });

  // Get breadcrumb path
  const getBreadcrumbPath = (folderId: string | null): DocumentFolder[] => {
    if (!folderId) return [];
    
    const path: DocumentFolder[] = [];
    let current = folders.find(f => f.id === folderId);
    
    while (current) {
      path.unshift(current);
      current = current.parent_id ? folders.find(f => f.id === current!.parent_id) : undefined;
    }
    
    return path;
  };

  // Get child folders
  const getChildFolders = (parentId: string | null) => {
    return folders.filter(f => f.parent_id === parentId);
  };

  return {
    folders,
    tags,
    templates,
    documents,
    currentFolderId,
    setCurrentFolderId,
    isLoading: foldersLoading || tagsLoading || templatesLoading || documentsLoading,
    createFolder,
    deleteFolder,
    renameFolder,
    renameDocument,
    deleteDocument,
    createTag,
    assignTag,
    moveToFolder,
    createTemplate,
    getBreadcrumbPath,
    getChildFolders,
  };
}
