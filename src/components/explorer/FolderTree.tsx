import { useState } from "react";
import { 
  Folder, 
  FolderOpen, 
  ChevronRight, 
  ChevronDown,
  Plus,
  Trash2,
  MoreVertical,
  Pencil,
} from "lucide-react";
import { DocumentFolder } from "@/hooks/useDocumentExplorer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FolderTreeProps {
  folders: DocumentFolder[];
  currentFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
  onCreateFolder: (name: string, parentId: string | null, color?: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onRenameFolder?: (folderId: string, name: string) => void;
}

interface FolderNodeProps {
  folder: DocumentFolder;
  folders: DocumentFolder[];
  level: number;
  currentFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
  onCreateFolder: (name: string, parentId: string | null, color?: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onRenameFolder?: (folderId: string, name: string) => void;
}

const FOLDER_COLORS = [
  "#c97c5d", // copper
  "#5d9cc9", // blue
  "#5dc985", // green
  "#c95d9c", // pink
  "#9c5dc9", // purple
  "#c9b85d", // gold
];

function FolderNode({ 
  folder, 
  folders, 
  level, 
  currentFolderId, 
  onFolderSelect,
  onCreateFolder,
  onDeleteFolder,
  onRenameFolder,
}: FolderNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0]);

  const children = folders.filter(f => f.parent_id === folder.id);
  const hasChildren = children.length > 0;
  const isActive = currentFolderId === folder.id;

  const handleCreateSubfolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim(), folder.id, newFolderColor);
      setNewFolderName("");
      setShowNewFolderDialog(false);
    }
  };

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1.5 py-1.5 px-2 rounded-md cursor-pointer transition-all duration-150 text-sm",
          isActive 
            ? "bg-accent/15 text-accent" 
            : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => onFolderSelect(folder.id)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-0.5 hover:bg-muted rounded"
          >
            {isExpanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {isExpanded || isActive ? (
          <FolderOpen size={16} style={{ color: folder.color }} />
        ) : (
          <Folder size={16} style={{ color: folder.color }} />
        )}

        <span className="flex-1 truncate font-medium">{folder.name}</span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setShowNewFolderDialog(true)}>
              <Plus size={14} className="mr-2" />
              Unterordner erstellen
            </DropdownMenuItem>
            {onRenameFolder && (
              <DropdownMenuItem onClick={() => onRenameFolder(folder.id, folder.name)}>
                <Pencil size={14} className="mr-2" />
                Umbenennen
              </DropdownMenuItem>
            )}
            <DropdownMenuItem 
              onClick={() => onDeleteFolder(folder.id)}
              className="text-destructive"
            >
              <Trash2 size={14} className="mr-2" />
              Löschen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isExpanded && hasChildren && (
        <div>
          {children.map(child => (
            <FolderNode
              key={child.id}
              folder={child}
              folders={folders}
              level={level + 1}
              currentFolderId={currentFolderId}
              onFolderSelect={onFolderSelect}
              onCreateFolder={onCreateFolder}
              onDeleteFolder={onDeleteFolder}
              onRenameFolder={onRenameFolder}
            />
          ))}
        </div>
      )}

      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuer Unterordner in "{folder.name}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Ordnername</Label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Ordnername eingeben..."
              />
            </div>
            <div className="space-y-2">
              <Label>Farbe</Label>
              <div className="flex gap-2">
                {FOLDER_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setNewFolderColor(color)}
                    className={cn(
                      "w-8 h-8 rounded-full transition-transform",
                      newFolderColor === color && "ring-2 ring-offset-2 ring-accent scale-110"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolderDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleCreateSubfolder} disabled={!newFolderName.trim()}>
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function FolderTree({
  folders,
  currentFolderId,
  onFolderSelect,
  onCreateFolder,
  onDeleteFolder,
  onRenameFolder,
}: FolderTreeProps) {
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0]);

  const rootFolders = folders.filter(f => !f.parent_id);

  const handleCreateRootFolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim(), null, newFolderColor);
      setNewFolderName("");
      setShowNewFolderDialog(false);
    }
  };

  return (
    <div className="space-y-1">
      {/* All Documents */}
      <div
        className={cn(
          "flex items-center gap-2 py-2 px-3 rounded-md cursor-pointer transition-all duration-150 text-sm font-medium",
          currentFolderId === null
            ? "bg-accent/15 text-accent"
            : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
        )}
        onClick={() => onFolderSelect(null)}
      >
        <Folder size={16} />
        <span>Alle Dokumente</span>
      </div>

      {/* Folder Tree */}
      <div className="mt-2">
        {rootFolders.map(folder => (
          <FolderNode
            key={folder.id}
            folder={folder}
            folders={folders}
            level={0}
            currentFolderId={currentFolderId}
            onFolderSelect={onFolderSelect}
            onCreateFolder={onCreateFolder}
            onDeleteFolder={onDeleteFolder}
            onRenameFolder={onRenameFolder}
          />
        ))}
      </div>

      {/* New Folder Button */}
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start mt-2 text-muted-foreground"
        onClick={() => setShowNewFolderDialog(true)}
      >
        <Plus size={14} className="mr-2" />
        Neuer Ordner
      </Button>

      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuer Ordner</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Ordnername</Label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Ordnername eingeben..."
              />
            </div>
            <div className="space-y-2">
              <Label>Farbe</Label>
              <div className="flex gap-2">
                {FOLDER_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setNewFolderColor(color)}
                    className={cn(
                      "w-8 h-8 rounded-full transition-transform",
                      newFolderColor === color && "ring-2 ring-offset-2 ring-accent scale-110"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolderDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleCreateRootFolder} disabled={!newFolderName.trim()}>
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
