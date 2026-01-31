import { useState } from "react";
import { Tag, Plus, X } from "lucide-react";
import { DocumentTag } from "@/hooks/useDocumentExplorer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TagManagerProps {
  tags: DocumentTag[];
  selectedTags: string[];
  onTagSelect: (tagId: string) => void;
  onCreateTag: (name: string, color: string) => void;
}

const TAG_COLORS = [
  "#c97c5d", // copper
  "#5d9cc9", // blue
  "#5dc985", // green
  "#c95d9c", // pink
  "#9c5dc9", // purple
  "#c9b85d", // gold
  "#5dc9c9", // teal
  "#c95d5d", // red
];

export function TagManager({
  tags,
  selectedTags,
  onTagSelect,
  onCreateTag,
}: TagManagerProps) {
  const [showNewTagDialog, setShowNewTagDialog] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);

  const handleCreateTag = () => {
    if (newTagName.trim()) {
      onCreateTag(newTagName.trim(), newTagColor);
      setNewTagName("");
      setShowNewTagDialog(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
          <Tag size={12} />
          <span>Tags</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setShowNewTagDialog(true)}
        >
          <Plus size={12} />
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {tags.map(tag => (
          <Badge
            key={tag.id}
            variant="outline"
            className={cn(
              "cursor-pointer transition-all duration-150 text-xs px-2 py-0.5",
              selectedTags.includes(tag.id) && "ring-2 ring-offset-1"
            )}
            style={{
              backgroundColor: selectedTags.includes(tag.id) 
                ? `${tag.color}20` 
                : "transparent",
              borderColor: tag.color,
              color: tag.color,
            }}
            onClick={() => onTagSelect(tag.id)}
          >
            {tag.name}
            {selectedTags.includes(tag.id) && (
              <X size={10} className="ml-1" />
            )}
          </Badge>
        ))}
        
        {tags.length === 0 && (
          <p className="text-xs text-muted-foreground">Keine Tags vorhanden</p>
        )}
      </div>

      <Dialog open={showNewTagDialog} onOpenChange={setShowNewTagDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuer Tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tag-Name</Label>
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="z.B. Wichtig, Archiviert, In Bearbeitung..."
              />
            </div>
            <div className="space-y-2">
              <Label>Farbe</Label>
              <div className="flex flex-wrap gap-2">
                {TAG_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setNewTagColor(color)}
                    className={cn(
                      "w-8 h-8 rounded-full transition-transform",
                      newTagColor === color && "ring-2 ring-offset-2 ring-accent scale-110"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="pt-2">
              <Label>Vorschau</Label>
              <div className="mt-2">
                <Badge
                  variant="outline"
                  style={{
                    borderColor: newTagColor,
                    color: newTagColor,
                    backgroundColor: `${newTagColor}20`,
                  }}
                >
                  {newTagName || "Tag-Name"}
                </Badge>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTagDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleCreateTag} disabled={!newTagName.trim()}>
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface DocumentTagsProps {
  tags: Array<{ id: string; name: string; color: string }>;
  allTags: DocumentTag[];
  onAssignTag: (tagId: string) => void;
  compact?: boolean;
}

export function DocumentTags({ tags, allTags, onAssignTag, compact = false }: DocumentTagsProps) {
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const assignedTagIds = tags.map(t => t.id);
  const availableTags = allTags.filter(t => !assignedTagIds.includes(t.id));

  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map(tag => (
        <Badge
          key={tag.id}
          variant="outline"
          className={cn("text-xs", compact && "px-1.5 py-0")}
          style={{
            borderColor: tag.color,
            color: tag.color,
            backgroundColor: `${tag.color}15`,
          }}
        >
          {tag.name}
        </Badge>
      ))}
      
      {availableTags.length > 0 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 rounded-full"
            onClick={() => setShowAssignDialog(true)}
          >
            <Plus size={10} />
          </Button>

          <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Tag hinzufügen</DialogTitle>
              </DialogHeader>
              <div className="flex flex-wrap gap-2 py-4">
                {availableTags.map(tag => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    className="cursor-pointer hover:scale-105 transition-transform"
                    style={{
                      borderColor: tag.color,
                      color: tag.color,
                    }}
                    onClick={() => {
                      onAssignTag(tag.id);
                      setShowAssignDialog(false);
                    }}
                  >
                    <Plus size={10} className="mr-1" />
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
