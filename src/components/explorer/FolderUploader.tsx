import { useRef, useState } from "react";
import { FolderUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

interface FolderUploaderProps {
  currentFolderId: string | null;
  onCreateFolder: (name: string, parentId: string | null) => Promise<{ id: string } | void>;
}

interface FileWithPath extends File {
  webkitRelativePath: string;
}

export function FolderUploader({ currentFolderId, onCreateFolder }: FolderUploaderProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const [uploadStats, setUploadStats] = useState({ total: 0, current: 0 });

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    setIsUploading(true);
    setShowProgress(true);
    setProgress(0);
    setUploadStats({ total: files.length, current: 0 });

    try {
      const fileList = Array.from(files) as FileWithPath[];
      
      const folderStructure = new Map<string, FileWithPath[]>();
      
      for (const file of fileList) {
        const path = file.webkitRelativePath;
        const parts = path.split("/");
        const folderPath = parts.slice(0, -1).join("/");
        if (!folderStructure.has(folderPath)) {
          folderStructure.set(folderPath, []);
        }
        folderStructure.get(folderPath)!.push(file);
      }

      const folderIdMap = new Map<string, string>();
      const sortedPaths = Array.from(folderStructure.keys()).sort();
      
      for (const folderPath of sortedPaths) {
        const parts = folderPath.split("/");
        let parentId = currentFolderId;
        let currentPath = "";
        
        for (const part of parts) {
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          if (!folderIdMap.has(currentPath)) {
            const result = await onCreateFolder(part, parentId);
            if (result && 'id' in result) {
              folderIdMap.set(currentPath, result.id);
              parentId = result.id;
            }
          } else {
            parentId = folderIdMap.get(currentPath)!;
          }
        }
      }

      let uploadedCount = 0;
      for (const file of fileList) {
        const path = file.webkitRelativePath;
        const folderPath = path.split("/").slice(0, -1).join("/");
        const folderId = folderIdMap.get(folderPath) || currentFolderId;
        
        const filePath = `${user.id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(filePath, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          continue;
        }

        await supabase.from("documents").insert({
          name: file.name,
          file_path: filePath,
          mime_type: file.type || "application/octet-stream",
          file_size: file.size,
          folder_id: folderId,
          uploaded_by: user.id,
        });

        uploadedCount++;
        setUploadStats({ total: files.length, current: uploadedCount });
        setProgress((uploadedCount / files.length) * 100);
      }

      toast.success(`${uploadedCount} ${t("explorer.filesUploadedLabel")}`);
      queryClient.invalidateQueries({ queryKey: ["explorer-documents"] });
      queryClient.invalidateQueries({ queryKey: ["document-folders"] });
    } catch (error) {
      console.error("Folder upload error:", error);
      toast.error(t("explorer.uploadError"));
    } finally {
      setIsUploading(false);
      setTimeout(() => setShowProgress(false), 2000);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        // @ts-ignore
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={handleFolderSelect}
      />
      
      <Button
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
      >
        {isUploading ? (
          <Loader2 size={16} className="mr-2 animate-spin" />
        ) : (
          <FolderUp size={16} className="mr-2" />
        )}
        {t("explorer.uploadFolder")}
      </Button>

      <Dialog open={showProgress} onOpenChange={setShowProgress}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("explorer.folderUploading")}</DialogTitle>
            <DialogDescription>
              {uploadStats.current} {t("explorer.filesUploadedOf")} {uploadStats.total} {t("explorer.filesUploadedLabel")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Progress value={progress} className="h-2" />
          </div>
          <DialogFooter>
            {!isUploading && (
              <Button onClick={() => setShowProgress(false)}>{t("common.close")}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}