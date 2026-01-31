import { useRef, useState } from "react";
import { Upload, Loader2, Building2, Users, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOrganizations, useOrganizationUsers } from "@/hooks/useFolderSharing";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface FileUploaderWithSharingProps {
  currentFolderId: string | null;
}

interface SelectedOrg {
  id: string;
  name: string;
  selectedUsers: string[];
}

export function FileUploaderWithSharing({ currentFolderId }: FileUploaderWithSharingProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showSharingDialog, setShowSharingDialog] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [selectedOrgs, setSelectedOrgs] = useState<SelectedOrg[]>([]);
  const [expandedOrgId, setExpandedOrgId] = useState<string | null>(null);

  const { data: organizations = [] } = useOrganizations();
  const { data: orgUsers = [] } = useOrganizationUsers(expandedOrgId || undefined);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    setPendingFiles(Array.from(files));
    setShowSharingDialog(true);
  };

  const handleOrgToggle = (orgId: string, orgName: string) => {
    setSelectedOrgs(prev => {
      const existing = prev.find(o => o.id === orgId);
      if (existing) {
        return prev.filter(o => o.id !== orgId);
      }
      return [...prev, { id: orgId, name: orgName, selectedUsers: [] }];
    });
  };

  const handleUserToggle = (orgId: string, userId: string) => {
    setSelectedOrgs(prev => {
      return prev.map(org => {
        if (org.id !== orgId) return org;
        const hasUser = org.selectedUsers.includes(userId);
        return {
          ...org,
          selectedUsers: hasUser
            ? org.selectedUsers.filter(id => id !== userId)
            : [...org.selectedUsers, userId],
        };
      });
    });
  };

  const handleUpload = async () => {
    if (!user || pendingFiles.length === 0) return;

    setIsUploading(true);
    setShowSharingDialog(false);

    try {
      let uploadedCount = 0;
      const orgIds = selectedOrgs.map(o => o.id);

      for (const file of pendingFiles) {
        // Upload to storage
        const filePath = `${user.id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(filePath, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          continue;
        }

        // Create document record with shared_with_organizations
        const { data: doc, error: docError } = await supabase.from("documents").insert({
          name: file.name,
          file_path: filePath,
          mime_type: file.type || "application/octet-stream",
          file_size: file.size,
          folder_id: currentFolderId,
          uploaded_by: user.id,
          shared_with_organizations: orgIds,
        }).select().single();

        if (docError) {
          console.error("Document insert error:", docError);
          continue;
        }

        // Create document shares for individual users
        for (const org of selectedOrgs) {
          // Share with organization
          try {
            await supabase.from("document_shares").insert({
              document_id: doc.id,
              shared_with_organization_id: org.id,
              shared_by: user.id,
            });
          } catch {
            // Ignore duplicates
          }

          // Share with individual users if selected
          for (const userId of org.selectedUsers) {
            try {
              await supabase.from("document_shares").insert({
                document_id: doc.id,
                shared_with_user_id: userId,
                shared_by: user.id,
              });
            } catch {
              // Ignore duplicates
            }
          }
        }

        uploadedCount++;
      }

      const shareInfo = selectedOrgs.length > 0
        ? ` (geteilt mit ${selectedOrgs.map(o => o.name).join(", ")})`
        : "";
      toast.success(`${uploadedCount} Datei(en) hochgeladen${shareInfo}`);
      queryClient.invalidateQueries({ queryKey: ["explorer-documents"] });
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Fehler beim Hochladen");
    } finally {
      setIsUploading(false);
      setPendingFiles([]);
      setSelectedOrgs([]);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const handleCancel = () => {
    setShowSharingDialog(false);
    setPendingFiles([]);
    setSelectedOrgs([]);
    if (inputRef.current) {
      inputRef.current.value = "";
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

      <Dialog open={showSharingDialog} onOpenChange={setShowSharingDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dokumente teilen</DialogTitle>
            <DialogDescription>
              Wählen Sie die Organisationen und Mitarbeiter aus, mit denen Sie die Dokumente teilen möchten.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Selected files preview */}
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-1">
                {pendingFiles.length} Datei(en) ausgewählt:
              </p>
              <div className="flex flex-wrap gap-1">
                {pendingFiles.slice(0, 3).map((file, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {file.name}
                  </Badge>
                ))}
                {pendingFiles.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{pendingFiles.length - 3} weitere
                  </Badge>
                )}
              </div>
            </div>

            {/* Selected organizations summary */}
            {selectedOrgs.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedOrgs.map(org => (
                  <Badge key={org.id} className="flex items-center gap-1">
                    <Building2 size={12} />
                    {org.name}
                    <button
                      onClick={() => handleOrgToggle(org.id, org.name)}
                      className="ml-1 hover:bg-primary/20 rounded-full p-0.5"
                    >
                      <X size={12} />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Organization list */}
            <ScrollArea className="h-64 border rounded-lg">
              <div className="p-2 space-y-1">
                {organizations.map((org) => {
                  const isSelected = selectedOrgs.some(o => o.id === org.id);
                  const isExpanded = expandedOrgId === org.id;
                  const selectedOrg = selectedOrgs.find(o => o.id === org.id);

                  return (
                    <div key={org.id} className="space-y-1">
                      <div
                        className={cn(
                          "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                          isSelected ? "bg-primary/10" : "hover:bg-muted"
                        )}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleOrgToggle(org.id, org.name)}
                        />
                        <div 
                          className="flex-1 flex items-center gap-2"
                          onClick={() => {
                            handleOrgToggle(org.id, org.name);
                            if (!isSelected) {
                              setExpandedOrgId(org.id);
                            }
                          }}
                        >
                          <Building2 size={16} className="text-muted-foreground" />
                          <span className="text-sm font-medium">{org.name}</span>
                        </div>
                        {isSelected && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedOrgId(isExpanded ? null : org.id);
                            }}
                          >
                            <Users size={14} className="mr-1" />
                            {selectedOrg?.selectedUsers.length || 0} Mitarbeiter
                          </Button>
                        )}
                      </div>

                      {/* User list for expanded organization */}
                      {isExpanded && isSelected && (
                        <div className="ml-8 pl-2 border-l space-y-1">
                          {orgUsers.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-2">
                              Keine Mitarbeiter gefunden
                            </p>
                          ) : (
                            orgUsers.map((usr) => {
                              const userName = [usr.first_name, usr.last_name]
                                .filter(Boolean)
                                .join(" ") || usr.email;
                              const isUserSelected = selectedOrg?.selectedUsers.includes(usr.user_id);

                              return (
                                <div
                                  key={usr.user_id}
                                  className={cn(
                                    "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                                    isUserSelected ? "bg-accent/10" : "hover:bg-muted"
                                  )}
                                  onClick={() => handleUserToggle(org.id, usr.user_id)}
                                >
                                  <Checkbox checked={isUserSelected} />
                                  <Avatar className="h-6 w-6">
                                    <AvatarFallback className="text-[10px]">
                                      {userName.slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm truncate">{userName}</p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {usr.email}
                                    </p>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCancel}>
                Abbrechen
              </Button>
              <Button onClick={handleUpload}>
                <Check size={16} className="mr-2" />
                Hochladen {selectedOrgs.length > 0 && "& Teilen"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
