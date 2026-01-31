import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface ClipboardItem {
  type: "document" | "folder";
  id: string;
  name: string;
  filePath?: string;
  operation: "copy" | "cut";
}

export function useExplorerClipboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [clipboard, setClipboard] = useState<ClipboardItem | null>(null);

  const copyDocument = (id: string, name: string, filePath: string) => {
    setClipboard({ type: "document", id, name, filePath, operation: "copy" });
    toast.success(`"${name}" in Zwischenablage kopiert`);
  };

  const cutDocument = (id: string, name: string, filePath: string) => {
    setClipboard({ type: "document", id, name, filePath, operation: "cut" });
    toast.success(`"${name}" zum Verschieben markiert`);
  };

  const pasteDocument = async (targetFolderId: string | null) => {
    if (!clipboard || clipboard.type !== "document" || !user) return;

    try {
      if (clipboard.operation === "copy" && clipboard.filePath) {
        // Download the file first
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("documents")
          .download(clipboard.filePath);

        if (downloadError) throw downloadError;

        // Create new path for the copy
        const ext = clipboard.filePath.split('.').pop();
        const newPath = `${user.id}/copied_${Date.now()}.${ext}`;

        // Upload copy
        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(newPath, fileData);

        if (uploadError) throw uploadError;

        // Get original document data
        const { data: originalDoc, error: docError } = await supabase
          .from("documents")
          .select("*")
          .eq("id", clipboard.id)
          .single();

        if (docError) throw docError;

        // Create new document record
        const { error: insertError } = await supabase
          .from("documents")
          .insert({
            name: `${clipboard.name} (Kopie)`,
            file_path: newPath,
            mime_type: originalDoc.mime_type,
            file_size: originalDoc.file_size,
            type: originalDoc.type,
            folder_id: targetFolderId,
            uploaded_by: user.id,
            description: originalDoc.description,
          });

        if (insertError) throw insertError;
        toast.success("Dokument eingefügt");
      } else if (clipboard.operation === "cut") {
        // Just move the document
        const { error } = await supabase
          .from("documents")
          .update({ folder_id: targetFolderId })
          .eq("id", clipboard.id);

        if (error) throw error;
        toast.success("Dokument verschoben");
        setClipboard(null); // Clear clipboard after cut
      }

      queryClient.invalidateQueries({ queryKey: ["explorer-documents"] });
    } catch (error) {
      console.error("Paste error:", error);
      toast.error("Fehler beim Einfügen");
    }
  };

  const clearClipboard = () => {
    setClipboard(null);
  };

  return {
    clipboard,
    copyDocument,
    cutDocument,
    pasteDocument,
    clearClipboard,
    hasClipboard: clipboard !== null,
  };
}
