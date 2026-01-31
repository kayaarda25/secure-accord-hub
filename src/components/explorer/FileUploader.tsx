import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface FileUploaderProps {
  currentFolderId: string | null;
}

export function FileUploader({ currentFolderId }: FileUploaderProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    setIsUploading(true);

    try {
      let uploadedCount = 0;
      
      for (const file of Array.from(files)) {
        // Upload to storage
        const filePath = `${user.id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(filePath, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          continue;
        }

        // Create document record
        await supabase.from("documents").insert({
          name: file.name,
          file_path: filePath,
          mime_type: file.type || "application/octet-stream",
          file_size: file.size,
          folder_id: currentFolderId,
          uploaded_by: user.id,
        });

        uploadedCount++;
      }

      toast.success(`${uploadedCount} Datei(en) hochgeladen`);
      queryClient.invalidateQueries({ queryKey: ["explorer-documents"] });
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Fehler beim Hochladen");
    } finally {
      setIsUploading(false);
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
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
      
      <Button
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
      >
        {isUploading ? (
          <Loader2 size={16} className="mr-2 animate-spin" />
        ) : (
          <Upload size={16} className="mr-2" />
        )}
        Hochladen
      </Button>
    </>
  );
}
