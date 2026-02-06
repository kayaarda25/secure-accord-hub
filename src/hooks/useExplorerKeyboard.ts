import { useEffect } from "react";

interface UseExplorerKeyboardProps {
  selectedDocumentId: string | null;
  selectedDocumentName: string | null;
  selectedDocumentFilePath: string | null;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onDelete: () => void;
  hasClipboard: boolean;
}

export function useExplorerKeyboard({
  selectedDocumentId,
  selectedDocumentName,
  selectedDocumentFilePath,
  onCopy,
  onCut,
  onPaste,
  onDelete,
  hasClipboard,
}: UseExplorerKeyboardProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const isCtrl = e.ctrlKey || e.metaKey;

      if (isCtrl && e.key === "c" && selectedDocumentId) {
        e.preventDefault();
        onCopy();
      } else if (isCtrl && e.key === "x" && selectedDocumentId) {
        e.preventDefault();
        onCut();
      } else if (isCtrl && e.key === "v" && hasClipboard) {
        e.preventDefault();
        onPaste();
      } else if (e.key === "Delete" && selectedDocumentId) {
        e.preventDefault();
        onDelete();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedDocumentId, selectedDocumentName, selectedDocumentFilePath, onCopy, onCut, onPaste, onDelete, hasClipboard]);
}
