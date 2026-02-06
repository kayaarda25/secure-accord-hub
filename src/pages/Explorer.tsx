import { useState, useEffect } from "react";
import { 
  FileText, 
  Download, 
  ChevronRight,
  Home,
  FolderOpen,
  LayoutTemplate,
  Grid3X3,
  List,
  MoreVertical,
  Folder,
  Eye,
  Tag,
  Trash2,
  Pencil,
  Copy,
  Scissors,
  ClipboardPaste,
  Share2,
  Info,
  User,
  Clock,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { useDocumentExplorer } from "@/hooks/useDocumentExplorer";
import { useExplorerClipboard } from "@/hooks/useExplorerClipboard";
import { useDocumentActivity } from "@/hooks/useDocumentActivity";
import { FolderTree } from "@/components/explorer/FolderTree";
import { TagManager, DocumentTags } from "@/components/explorer/TagManager";
import { TemplateGenerator } from "@/components/explorer/TemplateGenerator";
import { RenameDialog } from "@/components/explorer/RenameDialog";
import { FileUploaderWithSharing } from "@/components/explorer/FileUploaderWithSharing";
import { useOrganizationPermissions } from "@/hooks/useOrganizationPermissions";
import { FolderUploader } from "@/components/explorer/FolderUploader";
import { DocumentDetailPanel } from "@/components/explorer/DocumentDetailPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";

type ViewMode = "grid" | "list";

interface RenameState {
  open: boolean;
  type: "folder" | "document";
  id: string;
  currentName: string;
}

interface SelectedDocument {
  id: string;
  name: string;
  file_size?: number;
  mime_type?: string;
  created_at: string;
  updated_at: string;
  uploaded_by: string;
  description?: string;
  document_tag_assignments?: Array<{
    document_tags: { id: string; name: string; color: string };
  }>;
}

export default function Explorer() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTemplateGenerator, setShowTemplateGenerator] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<SelectedDocument | null>(null);
  const [renameState, setRenameState] = useState<RenameState>({
    open: false,
    type: "document",
    id: "",
    currentName: "",
  });

  const { logActivity } = useDocumentActivity();
  const { permissions } = useOrganizationPermissions();

  const {
    folders,
    tags,
    documents,
    currentFolderId,
    setCurrentFolderId,
    isLoading,
    createFolder,
    deleteFolder,
    renameFolder,
    renameDocument,
    deleteDocument,
    createTag,
    assignTag,
    getBreadcrumbPath,
    getChildFolders,
  } = useDocumentExplorer();

  const {
    clipboard,
    copyDocument,
    cutDocument,
    pasteDocument,
    hasClipboard,
  } = useExplorerClipboard();

  // Get user's organization ID from profile
  const { data: userProfile } = useQuery({
    queryKey: ["user-profile-org"],
    queryFn: async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return null;
      const { data } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("user_id", authUser.id)
        .single();
      return data;
    },
  });

  // Filter folders: only show OPEX, Protokolle, and folders shared with user's org
  const allowedFolderNames = ["opex", "protokolle"];
  const filteredFolders = folders.filter(folder => {
    const folderNameLower = folder.name.toLowerCase();
    // Always show OPEX and Protokolle
    if (allowedFolderNames.includes(folderNameLower)) return true;
    // Show folders created by user
    // Show folders shared with user's organization
    const folderWithShares = folder as typeof folder & { folder_shares?: Array<{ shared_with_organization_id: string }> };
    if (folderWithShares.folder_shares && userProfile?.organization_id) {
      return folderWithShares.folder_shares.some(
        share => share.shared_with_organization_id === userProfile.organization_id
      );
    }
    return false;
  });

  const breadcrumbPath = getBreadcrumbPath(currentFolderId);
  const childFolders = getChildFolders(currentFolderId).filter(folder => {
    const folderNameLower = folder.name.toLowerCase();
    if (allowedFolderNames.includes(folderNameLower)) return true;
    const folderWithShares = folder as typeof folder & { folder_shares?: Array<{ shared_with_organization_id: string }> };
    if (folderWithShares.folder_shares && userProfile?.organization_id) {
      return folderWithShares.folder_shares.some(
        share => share.shared_with_organization_id === userProfile.organization_id
      );
    }
    return false;
  });

  // Fetch user profiles for documents
  const documentUserIds = [...new Set(documents.map(d => d.uploaded_by))];
  const { data: userProfiles = [] } = useQuery({
    queryKey: ["user-profiles", documentUserIds],
    queryFn: async () => {
      if (documentUserIds.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, email, first_name, last_name")
        .in("user_id", documentUserIds);
      if (error) throw error;
      return data;
    },
    enabled: documentUserIds.length > 0,
  });

  const userProfileMap = new Map(
    userProfiles.map((p: { user_id: string; email: string; first_name: string | null; last_name: string | null }) => [
      p.user_id,
      [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email,
    ])
  );

  // Filter documents by selected tags
  const filteredDocuments = selectedTags.length > 0
    ? documents.filter(doc => {
        const docTagIds = doc.document_tag_assignments?.map((a: { tag_id: string }) => a.tag_id) || [];
        return selectedTags.some(tagId => docTagIds.includes(tagId));
      })
    : documents;

  const handleTagSelect = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleDownload = async (filePath: string, fileName: string, mimeType?: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .download(filePath);

      if (error) throw error;

      // Create blob with proper mime type
      const blob = new Blob([data], { type: mimeType || data.type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Fehler beim Herunterladen");
      console.error(error);
    }
  };

  const handleRename = (newName: string) => {
    if (renameState.type === "folder") {
      renameFolder.mutate({ id: renameState.id, name: newName });
    } else {
      renameDocument.mutate({ id: renameState.id, name: newName });
    }
  };

  const handleDelete = async (docId: string, filePath: string) => {
    if (window.confirm("Dokument wirklich löschen?")) {
      deleteDocument.mutate({ id: docId, filePath });
    }
  };

  const handlePaste = () => {
    pasteDocument(currentFolderId);
  };

  const handleOpenDocumentDetails = (doc: SelectedDocument) => {
    setSelectedDocument(doc);
    // Log view activity
    logActivity.mutate({
      documentId: doc.id,
      action: "viewed",
    });
  };

  const handleCreateFolderWithReturn = async (name: string, parentId: string | null): Promise<{ id: string } | void> => {
    return new Promise((resolve) => {
      createFolder.mutate(
        { name, parentId, silent: true },
        {
          onSuccess: (result) => {
            resolve({ id: result.data.id });
          },
          onError: () => {
            resolve();
          },
        }
      );
    });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType?: string) => {
    if (!mimeType) return FileText;
    if (mimeType.includes("pdf")) return FileText;
    if (mimeType.includes("word") || mimeType.includes("document")) return FileText;
    return FileText;
  };

  return (
    <Layout title="Explorer" subtitle="Dokumente und Vorlagen verwalten">
      <div className="flex h-[calc(100vh-8rem)] gap-4">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0 flex flex-col gap-4">
          {/* Folders */}
          <Card className="flex-1 overflow-hidden">
            <CardContent className="p-3 h-full overflow-y-auto">
              <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                <FolderOpen size={12} />
                <span>Ordner</span>
              </div>
              <FolderTree
                folders={filteredFolders}
                currentFolderId={currentFolderId}
                onFolderSelect={setCurrentFolderId}
                onCreateFolder={(name, parentId, color, shareWithOrganizations, shareWithUsers) => 
                  createFolder.mutate({ name, parentId, color, shareWithOrganizations, shareWithUsers })
                }
                onDeleteFolder={(id) => deleteFolder.mutate(id)}
                onRenameFolder={(id, name) => setRenameState({
                  open: true,
                  type: "folder",
                  id,
                  currentName: name,
                })}
              />
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardContent className="p-3">
              <TagManager
                tags={tags}
                selectedTags={selectedTags}
                onTagSelect={handleTagSelect}
                onCreateTag={(name, color) => createTag.mutate({ name, color })}
              />
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm">
              {/* Breadcrumb */}
              <button
                onClick={() => setCurrentFolderId(null)}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Home size={14} />
                <span>Explorer</span>
              </button>
              {breadcrumbPath.map((folder) => (
                <div key={folder.id} className="flex items-center gap-2">
                  <ChevronRight size={14} className="text-muted-foreground" />
                  <button
                    onClick={() => setCurrentFolderId(folder.id)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {folder.name}
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {/* Paste Button */}
              {hasClipboard && (
                <Button variant="outline" onClick={handlePaste}>
                  <ClipboardPaste size={16} className="mr-2" />
                  Einfügen
                </Button>
              )}

              {/* View Mode Toggle */}
              <div className="flex items-center border rounded-md p-0.5">
                <button
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "p-1.5 rounded transition-colors",
                    viewMode === "grid" ? "bg-muted text-foreground" : "text-muted-foreground"
                  )}
                >
                  <Grid3X3 size={16} />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "p-1.5 rounded transition-colors",
                    viewMode === "list" ? "bg-muted text-foreground" : "text-muted-foreground"
                  )}
                >
                  <List size={16} />
                </button>
              </div>

              {/* Template Generator */}
              <Button 
                variant="outline" 
                onClick={() => setShowTemplateGenerator(true)}
              >
                <LayoutTemplate size={16} className="mr-2" />
                Vorlage erstellen
              </Button>

              {/* Folder Upload Button */}
              <FolderUploader 
                currentFolderId={currentFolderId}
                onCreateFolder={handleCreateFolderWithReturn}
              />

              {/* File Upload Button */}
              <FileUploaderWithSharing currentFolderId={currentFolderId} />
            </div>
          </div>

          {/* Content */}
          <Card className="flex-1 overflow-hidden">
            <CardContent className="p-4 h-full overflow-y-auto">
              {isLoading ? (
                <div className="grid grid-cols-4 gap-4">
                  {[...Array(8)].map((_, i) => (
                    <Skeleton key={i} className="h-32 rounded-lg" />
                  ))}
                </div>
              ) : (
                <>
                  {/* Child Folders */}
                  {childFolders.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        Ordner
                      </h3>
                      <div className={cn(
                        viewMode === "grid" 
                          ? "grid grid-cols-4 gap-3" 
                          : "space-y-2"
                      )}>
                        {childFolders.map(folder => (
                          <div
                            key={folder.id}
                            className={cn(
                              "group relative text-left transition-all duration-150 hover:scale-[1.02]",
                              viewMode === "grid"
                                ? "p-4 rounded-lg border bg-card hover:bg-muted/50 hover:border-accent/30"
                                : "flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50"
                            )}
                          >
                            <button
                              onClick={() => setCurrentFolderId(folder.id)}
                              className="flex-1 flex items-center gap-2"
                            >
                              <Folder 
                                size={viewMode === "grid" ? 32 : 20} 
                                style={{ color: folder.color }}
                                className={viewMode === "grid" ? "mb-2" : ""}
                              />
                              <span className="font-medium text-sm truncate">
                                {folder.name}
                              </span>
                            </button>
                            
                            {/* Folder Actions */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-opacity">
                                  <MoreVertical size={14} />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setRenameState({
                                  open: true,
                                  type: "folder",
                                  id: folder.id,
                                  currentName: folder.name,
                                })}>
                                  <Pencil size={14} className="mr-2" />
                                  Umbenennen
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => deleteFolder.mutate(folder.id)}
                                >
                                  <Trash2 size={14} className="mr-2" />
                                  Löschen
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Documents */}
                  {filteredDocuments.length > 0 ? (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        Dokumente ({filteredDocuments.length})
                      </h3>
                      
                      {viewMode === "grid" ? (
                        <div className="grid grid-cols-4 gap-3">
                          {filteredDocuments.map((doc) => {
                            const FileIcon = getFileIcon(doc.mime_type);
                            const docTags = doc.document_tag_assignments?.map(
                              (a: { document_tags: { id: string; name: string; color: string } }) => a.document_tags
                            ).filter(Boolean) || [];

                            return (
                              <div
                                key={doc.id}
                                className="group p-4 rounded-lg border bg-card hover:bg-muted/50 hover:border-accent/30 transition-all duration-150"
                              >
                                <div className="flex items-start justify-between mb-3">
                                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                                    <FileIcon size={20} className="text-accent" />
                                  </div>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-opacity">
                                        <MoreVertical size={14} />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => handleDownload(doc.file_path, doc.name, doc.mime_type)}>
                                        <Download size={14} className="mr-2" />
                                        Herunterladen
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => setRenameState({
                                        open: true,
                                        type: "document",
                                        id: doc.id,
                                        currentName: doc.name,
                                      })}>
                                        <Pencil size={14} className="mr-2" />
                                        Umbenennen
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => copyDocument(doc.id, doc.name, doc.file_path)}>
                                        <Copy size={14} className="mr-2" />
                                        Kopieren
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => cutDocument(doc.id, doc.name, doc.file_path)}>
                                        <Scissors size={14} className="mr-2" />
                                        Ausschneiden
                                      </DropdownMenuItem>
                                      <DropdownMenuItem>
                                        <Eye size={14} className="mr-2" />
                                        Anzeigen
                                      </DropdownMenuItem>
                                      <DropdownMenuItem>
                                        <Tag size={14} className="mr-2" />
                                        Tag hinzufügen
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem 
                                        className="text-destructive"
                                        onClick={() => handleDelete(doc.id, doc.file_path)}
                                      >
                                        <Trash2 size={14} className="mr-2" />
                                        Löschen
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>

                                <h4 className="font-medium text-sm truncate mb-1">
                                  {doc.name}
                                </h4>
                                <p className="text-xs text-muted-foreground mb-2">
                                  {formatFileSize(doc.file_size)} • {format(new Date(doc.created_at), "dd.MM.yyyy", { locale: de })}
                                </p>

                                {docTags.length > 0 && (
                                  <DocumentTags
                                    tags={docTags}
                                    allTags={tags}
                                    onAssignTag={(tagId) => assignTag.mutate({ documentId: doc.id, tagId })}
                                    compact
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {/* List Header */}
                          <div className="grid grid-cols-12 gap-4 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                            <div className="col-span-5">Name</div>
                            <div className="col-span-2">Erstellt von</div>
                            <div className="col-span-2">Geändert</div>
                            <div className="col-span-1">Grösse</div>
                            <div className="col-span-2 text-right">Aktionen</div>
                          </div>
                          
                          {filteredDocuments.map((doc) => {
                            const FileIcon = getFileIcon(doc.mime_type);
                            const docTags = doc.document_tag_assignments?.map(
                              (a: { document_tags: { id: string; name: string; color: string } }) => a.document_tags
                            ).filter(Boolean) || [];
                            const uploaderName = userProfileMap.get(doc.uploaded_by) || "Unbekannt";

                            return (
                              <div
                                key={doc.id}
                                className={cn(
                                  "group grid grid-cols-12 gap-4 items-center px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer",
                                  selectedDocument?.id === doc.id && "bg-muted/70"
                                )}
                                onClick={() => handleOpenDocumentDetails(doc as SelectedDocument)}
                              >
                                {/* Name Column */}
                                <div className="col-span-5 flex items-center gap-3 min-w-0">
                                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                    <FileIcon size={16} className="text-accent" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <h4 className="font-medium text-sm truncate">
                                      {doc.name}
                                    </h4>
                                    {docTags.length > 0 && (
                                      <div className="mt-0.5">
                                        <DocumentTags
                                          tags={docTags}
                                          allTags={tags}
                                          onAssignTag={(tagId) => assignTag.mutate({ documentId: doc.id, tagId })}
                                          compact
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Created By Column */}
                                <div className="col-span-2 flex items-center gap-2 min-w-0">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="flex items-center gap-2 min-w-0">
                                          <Avatar className="h-6 w-6 flex-shrink-0">
                                            <AvatarFallback className="text-[10px] bg-accent/20 text-accent">
                                              {uploaderName.slice(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                          </Avatar>
                                          <span className="text-xs text-muted-foreground truncate">
                                            {uploaderName}
                                          </span>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Erstellt von {uploaderName}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>

                                {/* Modified Column */}
                                <div className="col-span-2 flex items-center gap-1.5 min-w-0">
                                  <Clock size={12} className="text-muted-foreground flex-shrink-0" />
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="text-xs text-muted-foreground truncate">
                                          {formatDistanceToNow(new Date(doc.updated_at), { 
                                            locale: de, 
                                            addSuffix: true 
                                          })}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{format(new Date(doc.updated_at), "dd.MM.yyyy HH:mm", { locale: de })}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>

                                {/* Size Column */}
                                <div className="col-span-1">
                                  <span className="text-xs text-muted-foreground">
                                    {formatFileSize(doc.file_size)}
                                  </span>
                                </div>

                                {/* Actions Column */}
                                <div className="col-span-2 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenDocumentDetails(doc as SelectedDocument);
                                    }}
                                  >
                                    <Info size={14} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownload(doc.file_path, doc.name, doc.mime_type);
                                      logActivity.mutate({
                                        documentId: doc.id,
                                        action: "downloaded",
                                      });
                                    }}
                                  >
                                    <Download size={14} />
                                  </Button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-7 w-7"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <MoreVertical size={14} />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => handleOpenDocumentDetails(doc as SelectedDocument)}>
                                        <Info size={14} className="mr-2" />
                                        Details & Freigabe
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => setRenameState({
                                        open: true,
                                        type: "document",
                                        id: doc.id,
                                        currentName: doc.name,
                                      })}>
                                        <Pencil size={14} className="mr-2" />
                                        Umbenennen
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => copyDocument(doc.id, doc.name, doc.file_path)}>
                                        <Copy size={14} className="mr-2" />
                                        Kopieren
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => cutDocument(doc.id, doc.name, doc.file_path)}>
                                        <Scissors size={14} className="mr-2" />
                                        Ausschneiden
                                      </DropdownMenuItem>
                                      <DropdownMenuItem>
                                        <Share2 size={14} className="mr-2" />
                                        Teilen
                                      </DropdownMenuItem>
                                      <DropdownMenuItem>
                                        <Tag size={14} className="mr-2" />
                                        Tag hinzufügen
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem 
                                        className="text-destructive"
                                        onClick={() => handleDelete(doc.id, doc.file_path)}
                                      >
                                        <Trash2 size={14} className="mr-2" />
                                        Löschen
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                        <FileText size={24} className="text-muted-foreground" />
                      </div>
                      <h3 className="font-medium text-lg mb-1">Keine Dokumente</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {selectedTags.length > 0 
                          ? "Keine Dokumente mit den ausgewählten Tags gefunden"
                          : "Dieser Ordner ist leer"
                        }
                      </p>
                      <Button onClick={() => setShowTemplateGenerator(true)}>
                        <LayoutTemplate size={16} className="mr-2" />
                        Vorlage erstellen
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Document Detail Panel */}
        {selectedDocument && (
          <DocumentDetailPanel
            document={selectedDocument}
            onClose={() => setSelectedDocument(null)}
            uploaderName={userProfileMap.get(selectedDocument.uploaded_by)}
          />
        )}
      </div>

      {/* Template Generator Dialog */}
      <TemplateGenerator
        open={showTemplateGenerator}
        onOpenChange={setShowTemplateGenerator}
      />

      {/* Rename Dialog */}
      <RenameDialog
        open={renameState.open}
        onOpenChange={(open) => setRenameState(prev => ({ ...prev, open }))}
        currentName={renameState.currentName}
        itemType={renameState.type}
        onRename={handleRename}
      />
    </Layout>
  );
}
