import { useState, useEffect } from "react";
import { Users, Building2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useOrganizations, useOrganizationUsers } from "@/hooks/useFolderSharing";
import { useLanguage } from "@/contexts/LanguageContext";

const FOLDER_COLORS = [
  "#c97c5d", "#5d9cc9", "#5dc985", "#c95d9c", "#9c5dc9", "#c9b85d",
];

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateFolder: (
    name: string, 
    parentId: string | null, 
    color: string,
    shareWithOrganizations: string[],
    shareWithUsers: string[]
  ) => void;
  parentId?: string | null;
  parentName?: string;
}

interface SelectedUser {
  user_id: string;
  display_name: string;
  organization_id: string;
}

export function CreateFolderDialog({
  open,
  onOpenChange,
  onCreateFolder,
  parentId = null,
  parentName,
}: CreateFolderDialogProps) {
  const { t } = useLanguage();
  const [folderName, setFolderName] = useState("");
  const [folderColor, setFolderColor] = useState(FOLDER_COLORS[0]);
  const [selectedOrganizations, setSelectedOrganizations] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<SelectedUser[]>([]);
  const [activeOrgForUsers, setActiveOrgForUsers] = useState<string | null>(null);

  const { data: organizations = [] } = useOrganizations();
  const { data: orgUsers = [] } = useOrganizationUsers(activeOrgForUsers || undefined);

  useEffect(() => {
    if (!open) {
      setFolderName("");
      setFolderColor(FOLDER_COLORS[0]);
      setSelectedOrganizations([]);
      setSelectedUsers([]);
      setActiveOrgForUsers(null);
    }
  }, [open]);

  const handleOrganizationToggle = (orgId: string) => {
    setSelectedOrganizations(prev => 
      prev.includes(orgId) ? prev.filter(id => id !== orgId) : [...prev, orgId]
    );
  };

  const handleUserToggle = (user: { user_id: string; email: string; first_name: string | null; last_name: string | null; organization_id: string }) => {
    const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;
    setSelectedUsers(prev => {
      const exists = prev.find(u => u.user_id === user.user_id);
      if (exists) return prev.filter(u => u.user_id !== user.user_id);
      return [...prev, { user_id: user.user_id, display_name: displayName, organization_id: user.organization_id }];
    });
  };

  const removeSelectedUser = (userId: string) => {
    setSelectedUsers(prev => prev.filter(u => u.user_id !== userId));
  };

  const handleCreate = () => {
    if (folderName.trim()) {
      onCreateFolder(folderName.trim(), parentId, folderColor, selectedOrganizations, selectedUsers.map(u => u.user_id));
      onOpenChange(false);
    }
  };

  const title = parentName 
    ? `${t("explorer.newSubfolderIn")} "${parentName}"`
    : t("explorer.newFolderTitle");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>{t("explorer.folderName")}</Label>
            <Input
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder={t("explorer.folderNamePlaceholder")}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>{t("explorer.color")}</Label>
            <div className="flex gap-2">
              {FOLDER_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setFolderColor(color)}
                  className={cn(
                    "w-8 h-8 rounded-full transition-transform",
                    folderColor === color && "ring-2 ring-offset-2 ring-accent scale-110"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Users size={16} />
              {t("explorer.shareWith")}
            </Label>
            
            <Tabs defaultValue="organizations" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="organizations" className="flex items-center gap-2">
                  <Building2 size={14} />
                  {t("explorer.organizations")}
                </TabsTrigger>
                <TabsTrigger value="members" className="flex items-center gap-2">
                  <Users size={14} />
                  {t("explorer.members")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="organizations" className="mt-3">
                <ScrollArea className="h-[150px] border rounded-md p-2">
                  <div className="space-y-2">
                    {organizations.map(org => (
                      <div key={org.id} className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded-md">
                        <Checkbox
                          id={`org-${org.id}`}
                          checked={selectedOrganizations.includes(org.id)}
                          onCheckedChange={() => handleOrganizationToggle(org.id)}
                        />
                        <label htmlFor={`org-${org.id}`} className="flex-1 text-sm font-medium cursor-pointer">
                          {org.name}
                        </label>
                        {org.org_type && (
                          <Badge variant="outline" className="text-xs">{org.org_type}</Badge>
                        )}
                      </div>
                    ))}
                    {organizations.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {t("explorer.noOrganizations")}
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="members" className="mt-3 space-y-3">
                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-muted/30">
                    {selectedUsers.map(user => (
                      <Badge key={user.user_id} variant="secondary" className="flex items-center gap-1">
                        {user.display_name}
                        <button onClick={() => removeSelectedUser(user.user_id)} className="ml-1 hover:bg-muted rounded-full">
                          <X size={12} />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    {t("explorer.selectOrgFirst")}
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    {organizations.map(org => (
                      <Button
                        key={org.id}
                        variant={activeOrgForUsers === org.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setActiveOrgForUsers(org.id)}
                        className="text-xs"
                      >
                        {org.name}
                      </Button>
                    ))}
                  </div>
                </div>

                {activeOrgForUsers && (
                  <ScrollArea className="h-[120px] border rounded-md p-2">
                    <div className="space-y-1">
                      {orgUsers.map(user => {
                        const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;
                        const isSelected = selectedUsers.some(u => u.user_id === user.user_id);
                        return (
                          <div key={user.user_id} className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded-md">
                            <Checkbox
                              id={`user-${user.user_id}`}
                              checked={isSelected}
                              onCheckedChange={() => handleUserToggle(user)}
                            />
                            <label htmlFor={`user-${user.user_id}`} className="flex-1 cursor-pointer">
                              <div className="text-sm font-medium">{displayName}</div>
                              <div className="text-xs text-muted-foreground">{user.email}</div>
                            </label>
                          </div>
                        );
                      })}
                      {orgUsers.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          {t("explorer.noMembers")}
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>
            </Tabs>

            {(selectedOrganizations.length > 0 || selectedUsers.length > 0) && (
              <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-md">
                {t("explorer.sharedWith")} {selectedOrganizations.length} {t("explorer.orgs")}, {selectedUsers.length} {t("explorer.membersCount")}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleCreate} disabled={!folderName.trim()}>
            {t("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}