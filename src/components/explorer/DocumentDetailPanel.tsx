import { useState } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  X,
  FileText,
  User,
  Calendar,
  Clock,
  HardDrive,
  Share2,
  History,
  Tag,
  Building2,
  UserPlus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDocumentActivity, getActionLabel } from "@/hooks/useDocumentActivity";
import { useDocumentSharing } from "@/hooks/useDocumentSharing";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface DocumentDetailPanelProps {
  document: {
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
  };
  onClose: () => void;
  uploaderName?: string;
}

export function DocumentDetailPanel({
  document,
  onClose,
  uploaderName,
}: DocumentDetailPanelProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");

  const { activities, isLoading: activitiesLoading } = useDocumentActivity(document.id);
  const { shares, shareWithUser, shareWithOrganization, removeShare } =
    useDocumentSharing(document.id);

  // Fetch all users for sharing
  const { data: users = [] } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, email, first_name, last_name")
        .order("email");
      if (error) throw error;
      return data;
    },
  });

  // Fetch all organizations for sharing
  const { data: organizations = [] } = useQuery({
    queryKey: ["all-organizations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const docTags =
    document.document_tag_assignments
      ?.map((a) => a.document_tags)
      .filter(Boolean) || [];

  const handleShareWithUser = () => {
    if (selectedUserId) {
      shareWithUser.mutate({ documentId: document.id, userId: selectedUserId });
      setSelectedUserId("");
    }
  };

  const handleShareWithOrg = () => {
    if (selectedOrgId) {
      shareWithOrganization.mutate({
        documentId: document.id,
        organizationId: selectedOrgId,
      });
      setSelectedOrgId("");
    }
  };

  return (
    <div className="w-80 border-l bg-card flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-sm truncate flex-1">{document.name}</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X size={16} />
        </Button>
      </div>

      {/* Content */}
      <Tabs defaultValue="details" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid grid-cols-3 m-4 mb-0">
          <TabsTrigger value="details" className="text-xs">
            Details
          </TabsTrigger>
          <TabsTrigger value="sharing" className="text-xs">
            Freigabe
          </TabsTrigger>
          <TabsTrigger value="activity" className="text-xs">
            Aktivität
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 p-4">
          {/* Details Tab */}
          <TabsContent value="details" className="mt-0 space-y-4">
            {/* File Info */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <FileText size={16} className="text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Typ</p>
                  <p>{document.mime_type || "Unbekannt"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <HardDrive size={16} className="text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Grösse</p>
                  <p>{formatFileSize(document.file_size)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <User size={16} className="text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Erstellt von</p>
                  <p>{uploaderName || "Unbekannt"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <Calendar size={16} className="text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Erstellt am</p>
                  <p>
                    {format(new Date(document.created_at), "dd.MM.yyyy HH:mm", {
                      locale: de,
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <Clock size={16} className="text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Zuletzt geändert</p>
                  <p>
                    {format(new Date(document.updated_at), "dd.MM.yyyy HH:mm", {
                      locale: de,
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Tags */}
            {docTags.length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Tag size={14} className="text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      Tags
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {docTags.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        className="text-xs"
                        style={{
                          borderColor: tag.color,
                          backgroundColor: `${tag.color}15`,
                        }}
                      >
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Description */}
            {document.description && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Beschreibung
                  </p>
                  <p className="text-sm">{document.description}</p>
                </div>
              </>
            )}
          </TabsContent>

          {/* Sharing Tab */}
          <TabsContent value="sharing" className="mt-0 space-y-4">
            {/* Share with User */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <UserPlus size={14} className="text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  Mit Benutzer teilen
                </span>
              </div>
              <div className="flex gap-2">
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="flex-1 text-xs">
                    <SelectValue placeholder="Benutzer wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {[u.first_name, u.last_name].filter(Boolean).join(" ") ||
                          u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={handleShareWithUser}
                  disabled={!selectedUserId}
                >
                  <Share2 size={14} />
                </Button>
              </div>
            </div>

            {/* Share with Organization */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Building2 size={14} className="text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  Mit Organisation teilen
                </span>
              </div>
              <div className="flex gap-2">
                <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                  <SelectTrigger className="flex-1 text-xs">
                    <SelectValue placeholder="Organisation wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={handleShareWithOrg}
                  disabled={!selectedOrgId}
                >
                  <Share2 size={14} />
                </Button>
              </div>
            </div>

            <Separator />

            {/* Current Shares */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Aktuelle Freigaben
              </p>
              {shares.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Keine Freigaben vorhanden
                </p>
              ) : (
                <div className="space-y-2">
                  {shares.map((share) => (
                    <div
                      key={share.id}
                      className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {share.user_name?.[0] || share.organization_name?.[0] || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs">
                          {share.user_name || share.organization_name}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => removeShare.mutate(share.id)}
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="mt-0">
            <div className="flex items-center gap-2 mb-3">
              <History size={14} className="text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                Aktivitätsverlauf
              </span>
            </div>

            {activitiesLoading ? (
              <p className="text-xs text-muted-foreground">Laden...</p>
            ) : activities.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Keine Aktivitäten
              </p>
            ) : (
              <div className="space-y-3">
                {activities.map((activity, index) => (
                  <div key={activity.id} className="relative pl-4">
                    {/* Timeline line */}
                    {index < activities.length - 1 && (
                      <div className="absolute left-1.5 top-5 w-px h-full bg-border" />
                    )}
                    {/* Timeline dot */}
                    <div
                      className={cn(
                        "absolute left-0 top-1 w-3 h-3 rounded-full border-2 bg-background",
                        activity.action === "created"
                          ? "border-green-500"
                          : activity.action === "shared"
                          ? "border-blue-500"
                          : activity.action === "deleted"
                          ? "border-red-500"
                          : "border-muted-foreground"
                      )}
                    />

                    <div>
                      <p className="text-xs">
                        <span className="font-medium">{activity.user_name}</span>{" "}
                        hat das Dokument{" "}
                        <span className="font-medium">{getActionLabel(activity.action)}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(activity.created_at), "dd.MM.yyyy HH:mm", {
                          locale: de,
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
