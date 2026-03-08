import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Shield, Edit, Users as UsersIcon, Mail, Clock, CheckCircle, XCircle, Send, Building2, RefreshCw, Link, Lock, Key, Eye, Plus } from "lucide-react";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useGranularPermissions, type PermissionDefinition } from "@/hooks/useGranularPermissions";
import { useFourEyes } from "@/hooks/useFourEyes";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface UserWithPermissions {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  department: string | null;
  position: string | null;
  organization_id: string | null;
  is_active: boolean;
  permissions: string[];
}

interface Organization {
  id: string;
  name: string;
}

interface Invitation {
  id: string;
  email: string;
  department: string | null;
  position: string | null;
  organization_id: string | null;
  roles: string[];
  status: string;
  expires_at: string;
  created_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  administration: "Administration",
  finance: "Finanzen",
  documents: "Dokumente",
  hr: "HR",
  communication: "Kommunikation",
};

const CATEGORY_COLORS: Record<string, string> = {
  administration: "bg-destructive/10 text-destructive border-destructive/20",
  finance: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  documents: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  hr: "bg-purple-500/10 text-purple-700 border-purple-500/20",
  communication: "bg-amber-500/10 text-amber-700 border-amber-500/20",
};

export default function UsersPage() {
  const { hasPermission, user, profile } = useAuth();
  const { t } = useLanguage();
  const { logAction } = useAuditLog();
  const { allDefinitions } = useGranularPermissions();
  const { rules, createRule, toggleRule, ACTION_TYPE_LABELS } = useFourEyes();
  const [users, setUsers] = useState<UserWithPermissions[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [adminOrganization, setAdminOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithPermissions | null>(null);
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [isInviting, setIsInviting] = useState(false);
  
  const [newInvite, setNewInvite] = useState({
    email: "",
    department: "",
    position: "",
    permissions: [] as string[],
  });

  const canManage = hasPermission("users.manage") || hasPermission("permissions.manage") || hasPermission("admin.full_access");

  useEffect(() => {
    if (canManage && profile?.organization_id) {
      fetchAdminOrganization();
      fetchUsers();
      fetchInvitations();
    }
  }, [canManage, profile?.organization_id]);

  const fetchAdminOrganization = async () => {
    if (!profile?.organization_id) return;
    try {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("id", profile.organization_id)
        .single();
      if (!error && data) setAdminOrganization(data);
    } catch (error) {
      console.error("Error fetching admin organization:", error);
    }
  };

  const fetchUsers = async () => {
    if (!profile?.organization_id) return;
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false });
      if (profilesError) throw profilesError;

      const { data: allPerms, error: permsError } = await supabase
        .from("user_permissions")
        .select("*");
      if (permsError) throw permsError;

      const usersWithPerms: UserWithPermissions[] = (profiles || []).map((p) => ({
        id: p.id,
        user_id: p.user_id,
        email: p.email,
        first_name: p.first_name,
        last_name: p.last_name,
        department: p.department,
        position: p.position,
        organization_id: p.organization_id,
        is_active: p.is_active ?? true,
        permissions: (allPerms || [])
          .filter((perm) => perm.user_id === p.user_id)
          .map((perm) => perm.permission_key),
      }));

      setUsers(usersWithPerms);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Fehler beim Laden der Benutzer");
    } finally {
      setLoading(false);
    }
  };

  const fetchInvitations = async () => {
    if (!profile?.organization_id) return;
    try {
      const { data, error } = await supabase
        .from("user_invitations")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setInvitations(data || []);
    } catch (error) {
      console.error("Error fetching invitations:", error);
    }
  };

  const handleInviteUser = async () => {
    if (!newInvite.email) {
      toast.error("E-Mail-Adresse ist erforderlich");
      return;
    }
    if (!profile?.organization_id) {
      toast.error("Keine Organisation zugewiesen");
      return;
    }

    setIsInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          email: newInvite.email,
          department: newInvite.department || null,
          position: newInvite.position || null,
          organizationId: profile.organization_id,
          roles: [], // No longer using roles
          permissions: newInvite.permissions,
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      await logAction("CREATE", "user_invitations", data.invitationId, null, { email: newInvite.email, permissions: newInvite.permissions });
      toast.success("Einladung erfolgreich gesendet!", {
        description: `Eine E-Mail wurde an ${newInvite.email} gesendet.`,
      });

      if (data?.invitationUrl) {
        toast.info("Einladungslink", {
          description: "Der Link kann auch manuell geteilt werden.",
          action: {
            label: "Kopieren",
            onClick: () => {
              navigator.clipboard.writeText(data.invitationUrl);
              toast.success("Link kopiert!");
            },
          },
          duration: 10000,
        });
      }

      setInviteDialogOpen(false);
      setNewInvite({ email: "", department: "", position: "", permissions: [] });
      fetchInvitations();
    } catch (error: any) {
      console.error("Error inviting user:", error);
      toast.error(error.message || "Fehler beim Senden der Einladung");
    } finally {
      setIsInviting(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from("user_invitations")
        .update({ status: "cancelled" })
        .eq("id", invitationId);
      if (error) throw error;
      toast.success("Einladung abgebrochen");
      fetchInvitations();
    } catch (error) {
      console.error("Error cancelling invitation:", error);
      toast.error("Fehler beim Abbrechen der Einladung");
    }
  };

  const handleResendInvitation = async (invitation: Invitation) => {
    setIsInviting(true);
    try {
      await supabase
        .from("user_invitations")
        .update({ status: "cancelled" })
        .eq("id", invitation.id);

      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          email: invitation.email,
          department: invitation.department,
          position: invitation.position,
          organizationId: invitation.organization_id,
          roles: [],
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      toast.success("Einladung erneut gesendet!");
      fetchInvitations();
    } catch (error: any) {
      console.error("Error resending invitation:", error);
      toast.error(error.message || "Fehler beim erneuten Senden");
    } finally {
      setIsInviting(false);
    }
  };

  const handleCopyInvitationLink = async (invitationId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_invitations")
        .select("token")
        .eq("id", invitationId)
        .single();
      if (error) throw error;
      const invitationUrl = `${window.location.origin}/auth?invitation=${data.token}`;
      await navigator.clipboard.writeText(invitationUrl);
      toast.success("Einladungslink kopiert!");
    } catch (error) {
      console.error("Error copying invitation link:", error);
      toast.error("Fehler beim Kopieren des Links");
    }
  };

  const handleUpdatePermissions = async (userId: string, newPerms: string[]) => {
    try {
      // Delete existing permissions
      const { error: deleteError } = await supabase
        .from("user_permissions")
        .delete()
        .eq("user_id", userId);
      if (deleteError) throw deleteError;

      // Insert new permissions
      if (newPerms.length > 0) {
        const inserts = newPerms.map((key) => ({
          user_id: userId,
          permission_key: key,
          granted_by: user!.id,
        }));
        const { error: insertError } = await supabase
          .from("user_permissions")
          .insert(inserts);
        if (insertError) throw insertError;
      }

      await logAction("UPDATE", "user_permissions", userId, null, { permissions: newPerms });
      toast.success("Berechtigungen erfolgreich aktualisiert");
      setEditDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      console.error("Error updating permissions:", error);
      toast.error("Fehler beim Aktualisieren der Berechtigungen");
    }
  };

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    try {
      const { error } = await supabase.from("profiles").update({ is_active: !isActive }).eq("user_id", userId);
      if (error) throw error;
      await logAction("UPDATE", "profiles", userId, { is_active: isActive }, { is_active: !isActive });
      toast.success(isActive ? "Benutzer deaktiviert" : "Benutzer aktiviert");
      fetchUsers();
    } catch (error) {
      console.error("Error toggling user status:", error);
      toast.error("Fehler beim Ändern des Benutzerstatus");
    }
  };

  const openEditDialog = (u: UserWithPermissions) => {
    setSelectedUser(u);
    setEditPermissions([...u.permissions]);
    setEditDialogOpen(true);
  };

  const toggleEditPermission = (key: string) => {
    setEditPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const toggleInvitePermission = (key: string) => {
    setNewInvite((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter((p) => p !== key)
        : [...prev.permissions, key],
    }));
  };

  const getStatusBadge = (status: string, expiresAt: string) => {
    const isExpired = new Date(expiresAt) < new Date();
    if (status === "accepted") return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Akzeptiert</Badge>;
    if (status === "cancelled") return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Abgebrochen</Badge>;
    if (status === "expired" || isExpired) return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Abgelaufen</Badge>;
    return <Badge variant="outline"><Mail className="h-3 w-3 mr-1" />Ausstehend</Badge>;
  };

  // Group definitions by category
  const groupedDefinitions = allDefinitions.reduce<Record<string, PermissionDefinition[]>>((acc, def) => {
    if (!acc[def.category]) acc[def.category] = [];
    acc[def.category].push(def);
    return acc;
  }, {});

  const PermissionCheckboxGrid = ({
    selected,
    onToggle,
  }: {
    selected: string[];
    onToggle: (key: string) => void;
  }) => (
    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
      {Object.entries(groupedDefinitions).map(([category, defs]) => (
        <div key={category}>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className={CATEGORY_COLORS[category] || ""}>
              {CATEGORY_LABELS[category] || category}
            </Badge>
          </div>
          <div className="grid gap-2">
            {defs.map((def) => (
              <label
                key={def.permission_key}
                className="flex items-start gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
              >
                <Checkbox
                  checked={selected.includes(def.permission_key)}
                  onCheckedChange={() => onToggle(def.permission_key)}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-medium">{def.label}</div>
                  {def.description && (
                    <div className="text-xs text-muted-foreground">{def.description}</div>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  if (!canManage || !profile?.organization_id) {
    return (
      <Layout title={t("common.accessDenied")}>
        <div className="flex items-center justify-center h-[60vh]">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Shield className="h-6 w-6" />
                Zugriff verweigert
              </CardTitle>
              <CardDescription>Sie benötigen die entsprechenden Berechtigungen, um auf diese Seite zuzugreifen.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={t("page.users.title")} subtitle={t("page.users.subtitle")}>
      <div className="space-y-6">
        {adminOrganization && (
          <div className="flex items-center gap-2 p-3 bg-accent/10 rounded-lg border border-accent/20 w-fit">
            <Building2 className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium">Organisation: {adminOrganization.name}</span>
          </div>
        )}
        <div className="flex items-center justify-end">
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button><Mail className="mr-2 h-4 w-4" />Benutzer einladen</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Neuen Benutzer einladen</DialogTitle>
                <DialogDescription>Senden Sie eine Einladung per E-Mail mit den gewünschten Berechtigungen.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail-Adresse *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={newInvite.email}
                    onChange={(e) => setNewInvite({ ...newInvite, email: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Abteilung</Label>
                    <Select value={newInvite.department} onValueChange={(value) => setNewInvite({ ...newInvite, department: value })}>
                      <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Executive">Executive</SelectItem>
                        <SelectItem value="Finance">Finanzen</SelectItem>
                        <SelectItem value="Legal">Recht</SelectItem>
                        <SelectItem value="Administration">Administration</SelectItem>
                        <SelectItem value="Project Management">Projektmanagement</SelectItem>
                        <SelectItem value="Communication">Kommunikation</SelectItem>
                        <SelectItem value="IT">IT</SelectItem>
                        <SelectItem value="HR">Personal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Position (nur informativ)</Label>
                    <Input
                      value={newInvite.position}
                      onChange={(e) => setNewInvite({ ...newInvite, position: e.target.value })}
                      placeholder="z.B. Projektmanager"
                    />
                  </div>
                </div>

                {adminOrganization && (
                  <div className="space-y-2">
                    <Label>Organisation</Label>
                    <div className="flex items-center gap-2 p-2.5 bg-muted rounded-lg border border-border">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{adminOrganization.name}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Berechtigungen</Label>
                  <PermissionCheckboxGrid
                    selected={newInvite.permissions}
                    onToggle={toggleInvitePermission}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Abbrechen</Button>
                <Button onClick={handleInviteUser} disabled={isInviting}>
                  {isInviting ? "Wird gesendet..." : <><Send className="mr-2 h-4 w-4" />Einladung senden</>}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4" />
              Benutzer ({users.length})
            </TabsTrigger>
            <TabsTrigger value="invitations" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Einladungen ({invitations.filter(i => i.status === "pending").length})
            </TabsTrigger>
            <TabsTrigger value="permissions" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              Berechtigungsübersicht
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UsersIcon className="h-5 w-5" />
                  Registrierte Benutzer
                </CardTitle>
                <CardDescription>{users.length} Benutzer im System</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">Laden...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>E-Mail</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Berechtigungen</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Aktionen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => (
                        <TableRow key={u.id} className={!u.is_active ? "opacity-50" : ""}>
                          <TableCell className="font-medium">
                            {u.first_name || u.last_name ? `${u.first_name || ""} ${u.last_name || ""}`.trim() : "-"}
                          </TableCell>
                          <TableCell>{u.email}</TableCell>
                          <TableCell className="text-muted-foreground">{u.position || "-"}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {u.permissions.includes("admin.full_access") ? (
                                <Badge variant="destructive">Vollzugriff</Badge>
                              ) : u.permissions.length > 0 ? (
                                <Badge variant="secondary">{u.permissions.length} Rechte</Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">Keine</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={u.is_active ? "default" : "secondary"}>
                              {u.is_active ? "Aktiv" : "Inaktiv"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => openEditDialog(u)} title="Berechtigungen bearbeiten">
                                <Key className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleToggleActive(u.user_id, u.is_active)}>
                                {u.is_active ? (
                                  <XCircle className="h-4 w-4 text-destructive" />
                                ) : (
                                  <Shield className="h-4 w-4 text-emerald-500" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invitations">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Einladungen
                </CardTitle>
                <CardDescription>Versendete Einladungen verwalten</CardDescription>
              </CardHeader>
              <CardContent>
                {invitations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">Keine Einladungen vorhanden</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>E-Mail</TableHead>
                        <TableHead>Abteilung</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Erstellt am</TableHead>
                        <TableHead className="text-right">Aktionen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invitations.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium">{inv.email}</TableCell>
                          <TableCell>{inv.department || "-"}</TableCell>
                          <TableCell>{inv.position || "-"}</TableCell>
                          <TableCell>{getStatusBadge(inv.status, inv.expires_at)}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {format(new Date(inv.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {inv.status === "pending" && new Date(inv.expires_at) > new Date() && (
                                <>
                                  <Button variant="ghost" size="sm" onClick={() => handleCopyInvitationLink(inv.id)} title="Link kopieren">
                                    <Link className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleCancelInvitation(inv.id)} className="text-destructive hover:text-destructive" title="Abbrechen">
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {(inv.status === "expired" || (inv.status === "pending" && new Date(inv.expires_at) <= new Date())) && (
                                <Button variant="ghost" size="sm" onClick={() => handleResendInvitation(inv)} disabled={isInviting} title="Erneut senden">
                                  <RefreshCw className={`h-4 w-4 ${isInviting ? "animate-spin" : ""}`} />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="permissions">
            <div className="space-y-6">
              {/* Permission categories overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Verfügbare Berechtigungen
                  </CardTitle>
                  <CardDescription>Alle granularen Berechtigungen, die einzelnen Benutzern zugewiesen werden können</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2">
                    {Object.entries(groupedDefinitions).map(([category, defs]) => (
                      <div key={category} className="rounded-lg border p-4 space-y-3">
                        <Badge variant="outline" className={CATEGORY_COLORS[category] || ""}>
                          {CATEGORY_LABELS[category] || category}
                        </Badge>
                        <div className="space-y-2">
                          {defs.map((def) => (
                            <div key={def.permission_key} className="flex items-start gap-2">
                              <Lock className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                              <div>
                                <div className="text-sm font-medium">{def.label}</div>
                                <div className="text-xs text-muted-foreground">{def.description}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Per-user permission matrix */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UsersIcon className="h-5 w-5" />
                    Benutzer-Berechtigungsmatrix
                  </CardTitle>
                  <CardDescription>Übersicht welcher Benutzer welche Berechtigungen hat</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 bg-background min-w-[150px]">Benutzer</TableHead>
                          {Object.entries(CATEGORY_LABELS).map(([cat, label]) => (
                            <TableHead key={cat} className="text-center min-w-[100px]">{label}</TableHead>
                          ))}
                          <TableHead className="text-right">Bearbeiten</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell className="sticky left-0 bg-background font-medium">
                              <div>
                                <div>{u.first_name || u.last_name ? `${u.first_name || ""} ${u.last_name || ""}`.trim() : u.email}</div>
                                {(u.first_name || u.last_name) && (
                                  <div className="text-xs text-muted-foreground">{u.email}</div>
                                )}
                              </div>
                            </TableCell>
                            {Object.keys(CATEGORY_LABELS).map((cat) => {
                              const catPerms = groupedDefinitions[cat] || [];
                              const userCatPerms = catPerms.filter((d) => u.permissions.includes(d.permission_key));
                              const hasAll = u.permissions.includes("admin.full_access");
                              return (
                                <TableCell key={cat} className="text-center">
                                  {hasAll ? (
                                    <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" />
                                  ) : userCatPerms.length > 0 ? (
                                    <Badge variant="secondary" className="text-xs">{userCatPerms.length}/{catPerms.length}</Badge>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => openEditDialog(u)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Edit Permissions Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Berechtigungen bearbeiten</DialogTitle>
              <DialogDescription>
                {selectedUser?.first_name} {selectedUser?.last_name} ({selectedUser?.email})
              </DialogDescription>
            </DialogHeader>
            <PermissionCheckboxGrid
              selected={editPermissions}
              onToggle={toggleEditPermission}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Abbrechen</Button>
              <Button onClick={() => selectedUser && handleUpdatePermissions(selectedUser.user_id, editPermissions)}>
                Speichern
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
