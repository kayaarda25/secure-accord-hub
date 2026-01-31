import { useState } from "react";
import { 
  FileText, 
  Download, 
  ChevronRight,
  Home,
  FolderOpen,
  LayoutTemplate,
  Grid3X3,
  List,
  Upload,
  MoreVertical,
  Folder,
  Eye,
  Tag,
  Trash2,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { useDocumentExplorer } from "@/hooks/useDocumentExplorer";
import { FolderTree } from "@/components/explorer/FolderTree";
import { TagManager, DocumentTags } from "@/components/explorer/TagManager";
import { TemplateGenerator } from "@/components/explorer/TemplateGenerator";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { format } from "date-fns";
import { de } from "date-fns/locale";

type ViewMode = "grid" | "list";

export default function Explorer() {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTemplateGenerator, setShowTemplateGenerator] = useState(false);

  const {
    folders,
    tags,
    documents,
    currentFolderId,
    setCurrentFolderId,
    isLoading,
    createFolder,
    deleteFolder,
    createTag,
    assignTag,
    moveToFolder,
    getBreadcrumbPath,
    getChildFolders,
  } = useDocumentExplorer();

  const breadcrumbPath = getBreadcrumbPath(currentFolderId);
  const childFolders = getChildFolders(currentFolderId);

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

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Fehler beim Herunterladen");
      console.error(error);
    }
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
                folders={folders}
                currentFolderId={currentFolderId}
                onFolderSelect={setCurrentFolderId}
                onCreateFolder={(name, parentId, color) => 
                  createFolder.mutate({ name, parentId, color })
                }
                onDeleteFolder={(id) => deleteFolder.mutate(id)}
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

              {/* Upload Button */}
              <Button>
                <Upload size={16} className="mr-2" />
                Hochladen
              </Button>
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
                          <button
                            key={folder.id}
                            onClick={() => setCurrentFolderId(folder.id)}
                            className={cn(
                              "text-left transition-all duration-150 hover:scale-[1.02]",
                              viewMode === "grid"
                                ? "p-4 rounded-lg border bg-card hover:bg-muted/50 hover:border-accent/30"
                                : "flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50"
                            )}
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
                                      <DropdownMenuItem onClick={() => handleDownload(doc.file_path, doc.name)}>
                                        <Download size={14} className="mr-2" />
                                        Herunterladen
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
                                      <DropdownMenuItem className="text-destructive">
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
                        <div className="space-y-2">
                          {filteredDocuments.map((doc) => {
                            const FileIcon = getFileIcon(doc.mime_type);
                            const docTags = doc.document_tag_assignments?.map(
                              (a: { document_tags: { id: string; name: string; color: string } }) => a.document_tags
                            ).filter(Boolean) || [];

                            return (
                              <div
                                key={doc.id}
                                className="group flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                              >
                                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                  <FileIcon size={20} className="text-accent" />
                                </div>

                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-sm truncate">
                                    {doc.name}
                                  </h4>
                                  <div className="flex items-center gap-3 mt-1">
                                    <span className="text-xs text-muted-foreground">
                                      {formatFileSize(doc.file_size)}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(doc.created_at), "dd.MM.yyyy", { locale: de })}
                                    </span>
                                    {docTags.length > 0 && (
                                      <DocumentTags
                                        tags={docTags}
                                        allTags={tags}
                                        onAssignTag={(tagId) => assignTag.mutate({ documentId: doc.id, tagId })}
                                        compact
                                      />
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleDownload(doc.file_path, doc.name)}
                                  >
                                    <Download size={14} />
                                  </Button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreVertical size={14} />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem>
                                        <Eye size={14} className="mr-2" />
                                        Anzeigen
                                      </DropdownMenuItem>
                                      <DropdownMenuItem>
                                        <Tag size={14} className="mr-2" />
                                        Tag hinzufügen
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem className="text-destructive">
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
      </div>

      {/* Template Generator Dialog */}
      <TemplateGenerator
        open={showTemplateGenerator}
        onOpenChange={setShowTemplateGenerator}
      />
    </Layout>
  );
}
