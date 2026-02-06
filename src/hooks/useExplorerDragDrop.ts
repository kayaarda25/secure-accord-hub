import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useExplorerDragDrop() {
  const queryClient = useQueryClient();
  const [draggedItem, setDraggedItem] = useState<{
    type: "document" | "folder";
    id: string;
    name: string;
  } | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent, type: "document" | "folder", id: string, name: string) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", JSON.stringify({ type, id, name }));
      setDraggedItem({ type, id, name });
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, folderId: string) => {
      e.preventDefault();
      e.stopPropagation();
      // Don't allow dropping a folder onto itself
      if (draggedItem?.type === "folder" && draggedItem.id === folderId) return;
      e.dataTransfer.dropEffect = "move";
      setDropTargetId(folderId);
    },
    [draggedItem]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDropTargetId(null);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetFolderId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setDropTargetId(null);
      setDraggedItem(null);

      try {
        const raw = e.dataTransfer.getData("text/plain");
        const item = JSON.parse(raw) as { type: string; id: string; name: string };

        if (item.type === "document") {
          const { error } = await supabase
            .from("documents")
            .update({ folder_id: targetFolderId })
            .eq("id", item.id);

          if (error) throw error;
          toast.success(`"${item.name}" verschoben`);
        } else if (item.type === "folder") {
          if (item.id === targetFolderId) return;
          const { error } = await supabase
            .from("document_folders")
            .update({ parent_id: targetFolderId })
            .eq("id", item.id);

          if (error) throw error;
          toast.success(`Ordner "${item.name}" verschoben`);
        }

        queryClient.invalidateQueries({ queryKey: ["explorer-documents"] });
        queryClient.invalidateQueries({ queryKey: ["document-folders"] });
      } catch (err) {
        console.error("Drop error:", err);
        toast.error("Fehler beim Verschieben");
      }
    },
    [queryClient]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDropTargetId(null);
  }, []);

  return {
    draggedItem,
    dropTargetId,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
  };
}
