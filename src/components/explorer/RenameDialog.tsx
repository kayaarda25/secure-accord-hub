import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";

interface RenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  itemType: "folder" | "document";
  onRename: (newName: string) => void;
}

export function RenameDialog({ open, onOpenChange, currentName, itemType, onRename }: RenameDialogProps) {
  const { t } = useLanguage();
  const [name, setName] = useState(currentName);

  useEffect(() => {
    if (open) setName(currentName);
  }, [open, currentName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && name.trim() !== currentName) {
      onRename(name.trim());
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {itemType === "folder" ? t("explorer.renameFolder") : t("explorer.renameDocument")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("explorer.newName")}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("explorer.newNamePlaceholder")}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!name.trim() || name.trim() === currentName}>
              {t("explorer.rename")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}