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
import { UserPlus, Shield, Trash2, Edit, Users as UsersIcon, Mail, Clock, CheckCircle, XCircle, Copy, Send, Building2, RefreshCw, Link, Lock, Eye, PenSquare } from "lucide-react";
import { useAuditLog } from "@/hooks/useAuditLog";
import { format } from "date-fns";
import { de } from "date-fns/locale";

type AppRole = "admin" | "state" | "management" | "finance" | "partner";

interface UserWithRoles {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  department: string | null;
  position: string | null;
  organization_id: string | null;
  is_active: boolean;
  roles: AppRole[];
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
  roles: AppRole[];
  status: string;
  expires_at: string;
  created_at: string;
}

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrator",
  state: "State",
  management: "Management",
  finance: "Finance",
  partner: "Partner",
};

const ROLE_COLORS: Record<AppRole, string> = {
  admin: "bg-destructive text-destructive-foreground",
  state: "bg-blue-500 text-white",
  management: "bg-purple-500 text-white",
  finance: "bg-green-500 text-white",
  partner: "bg-orange-500 text-white",
};

export default function UsersPage() {
  const { hasRole, user, profile } = useAuth();
  const { t } = useLanguage();
  const { logAction } = useAuditLog();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [adminOrganization, setAdminOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  
  const [newInvite, setNewInvite] = useState({
    email: "",
    department: "",
    position: "",
    roles: [] as AppRole[],
  });

  const isAdmin = hasRole("admin");

  useEffect(() => {
    if (isAdmin && profile?.organization_id) {
      fetchAdminOrganization();
      fetchUsers();
      fetchInvitations();
      fetchOrganizations();
    }
  }, [isAdmin, profile?.organization_id]);

  const fetchAdminOrganization = async () => {
    if (!profile?.organization_id) return;
    
    try {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("id", profile.organization_id)
        .single();
      
      if (!error && data) {
        setAdminOrganization(data);
      }
    } catch (error) {
      console.error("Error fetching admin organization:", error);
    }
  };

  const fetchUsers = async () => {
    if (!profile?.organization_id) return;
    
    try {
      // Only fetch users from the admin's organization
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const { data: allRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");

      if (rolesError) throw rolesError;

      const usersWithRoles: UserWithRoles[] = (profiles || []).map((profile) => {
        const userRoles = (allRoles || [])
          .filter((r) => r.user_id === profile.user_id)
          .map((r) => r.role as AppRole);

        return {
          id: profile.id,
          user_id: profile.user_id,
          email: profile.email,
          first_name: profile.first_name,
          last_name: profile.last_name,
          department: profile.department,
          position: profile.position,
          organization_id: profile.organization_id,
          is_active: profile.is_active ?? true,
          roles: userRoles,
        };
      });

      setUsers(usersWithRoles);
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
      // Only fetch invitations for the admin's organization
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

  const fetchOrganizations = async () => {
    try {
      const { data, error } = await supabase.from("organizations").select("id, name").order("name");
      if (error) throw error;
      setOrganizations(data || []);
    } catch (error) {
      console.error("Error fetching organizations:", error);
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
      // Always use the admin's organization
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          email: newInvite.email,
          department: newInvite.department || null,
          position: newInvite.position || null,
          organizationId: profile.organization_id,
          roles: newInvite.roles,
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      await logAction("CREATE", "user_invitations", data.invitationId, null, { email: newInvite.email, roles: newInvite.roles });

      toast.success("Einladung erfolgreich gesendet!", {
        description: `Eine E-Mail wurde an ${newInvite.email} gesendet.`,
      });

      // Show invitation link in case email fails
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
      setNewInvite({ email: "", department: "", position: "", roles: [] });
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
      // First cancel the old invitation
      await supabase
        .from("user_invitations")
        .update({ status: "cancelled" })
        .eq("id", invitation.id);

      // Create new invitation via edge function
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          email: invitation.email,
          department: invitation.department,
          position: invitation.position,
          organizationId: invitation.organization_id,
          roles: invitation.roles || [],
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success("Einladung erneut gesendet!", {
        description: `Eine neue E-Mail wurde an ${invitation.email} gesendet.`,
      });

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
      // Get the invitation token
      const { data, error } = await supabase
        .from("user_invitations")
        .select("token")
        .eq("id", invitationId)
        .single();

      if (error) throw error;

      const invitationUrl = `${window.location.origin}/auth?invitation=${data.token}`;
      await navigator.clipboard.writeText(invitationUrl);
      
      toast.success("Einladungslink kopiert!", {
        description: "Der Link wurde in die Zwischenablage kopiert.",
      });
    } catch (error) {
      console.error("Error copying invitation link:", error);
      toast.error("Fehler beim Kopieren des Links");
    }
  };

  const handleUpdateRoles = async (userId: string, roles: AppRole[]) => {
    try {
      const { error: deleteError } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (deleteError) throw deleteError;

      if (roles.length > 0) {
        const roleInserts = roles.map((role) => ({ user_id: userId, role: role, granted_by: user?.id }));
        const { error: insertError } = await supabase.from("user_roles").insert(roleInserts);
        if (insertError) throw insertError;
      }

      await logAction("UPDATE", "user_roles", userId, null, { roles });
      toast.success("Rollen erfolgreich aktualisiert");
      setEditDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      console.error("Error updating roles:", error);
      toast.error("Fehler beim Aktualisieren der Rollen");
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

  const toggleRole = (role: AppRole) => {
    setNewInvite((prev) => ({
      ...prev,
      roles: prev.roles.includes(role) ? prev.roles.filter((r) => r !== role) : [...prev.roles, role],
    }));
  };

  const toggleEditRole = (role: AppRole) => {
    if (!selectedUser) return;
    setSelectedUser((prev) => {
      if (!prev) return prev;
      return { ...prev, roles: prev.roles.includes(role) ? prev.roles.filter((r) => r !== role) : [...prev.roles, role] };
    });
  };

  const getStatusBadge = (status: string, expiresAt: string) => {
    const isExpired = new Date(expiresAt) < new Date();
    
    if (status === "accepted") {
      return <Badge className="bg-green-500 text-white"><CheckCircle className="h-3 w-3 mr-1" />Akzeptiert</Badge>;
    }
    if (status === "cancelled") {
      return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Abgebrochen</Badge>;
    }
    if (status === "expired" || isExpired) {
      return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Abgelaufen</Badge>;
    }
    return <Badge className="bg-amber-500 text-white"><Mail className="h-3 w-3 mr-1" />Ausstehend</Badge>;
  };

  if (!isAdmin || !profile?.organization_id) {
    return (
      <Layout title={t("common.accessDenied")}>
        <div className="flex items-center justify-center h-[60vh]">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Shield className="h-6 w-6" />
                Zugriff verweigert
              </CardTitle>
              <CardDescription>Sie benötigen Administrator-Rechte, um auf diese Seite zuzugreifen.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout 
      title={t("page.users.title")} 
      subtitle={t("page.users.subtitle")}
    >
      <div className="space-y-6">
        {/* Organization Badge */}
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
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Neuen Benutzer einladen</DialogTitle>
                <DialogDescription>Senden Sie eine Einladung per E-Mail. Der Benutzer kann dann sein eigenes Passwort und Namen festlegen.</DialogDescription>
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
                    <Label>Position</Label>
                    <Select value={newInvite.position} onValueChange={(value) => setNewInvite({ ...newInvite, position: value })}>
                      <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CEO">CEO</SelectItem>
                        <SelectItem value="Department Head">Abteilungsleiter</SelectItem>
                        <SelectItem value="Project Manager">Projektmanager</SelectItem>
                        <SelectItem value="Specialist">Spezialist</SelectItem>
                        <SelectItem value="Consultant">Berater</SelectItem>
                        <SelectItem value="Assistant">Assistent</SelectItem>
                        <SelectItem value="Intern">Praktikant</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Show the organization (read-only) */}
                {adminOrganization && (
                  <div className="space-y-2">
                    <Label>Organisation</Label>
                    <div className="flex items-center gap-2 p-2.5 bg-muted rounded-lg border border-border">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{adminOrganization.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Neue Benutzer werden automatisch Ihrer Organisation zugewiesen.</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Rollen</Label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(ROLE_LABELS) as AppRole[]).map((role) => (
                      <div key={role} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`role-${role}`} 
                          checked={newInvite.roles.includes(role)} 
                          onCheckedChange={() => toggleRole(role)} 
                        />
                        <label htmlFor={`role-${role}`} className="text-sm font-medium cursor-pointer">
                          {ROLE_LABELS[role]}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Abbrechen</Button>
                <Button onClick={handleInviteUser} disabled={isInviting}>
                  {isInviting ? (
                    <>Wird gesendet...</>
                  ) : (
                    <><Send className="mr-2 h-4 w-4" />Einladung senden</>
                  )}
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
              <Lock className="h-4 w-4" />
              Berechtigungen
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
                        <TableHead>Abteilung</TableHead>
                        <TableHead>Rollen</TableHead>
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
                          <TableCell>{u.department || "-"}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {u.roles.length > 0 ? u.roles.map((role) => (
                                <Badge key={role} className={ROLE_COLORS[role]}>{ROLE_LABELS[role]}</Badge>
                              )) : (
                                <span className="text-muted-foreground text-sm">Keine Rollen</span>
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
                              <Button variant="ghost" size="sm" onClick={() => { setSelectedUser(u); setEditDialogOpen(true); }}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleToggleActive(u.user_id, u.is_active)}>
                                {u.is_active ? (
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                ) : (
                                  <Shield className="h-4 w-4 text-green-500" />
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
                        <TableHead>Rollen</TableHead>
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
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {inv.roles && inv.roles.length > 0 ? inv.roles.map((role) => (
                                <Badge key={role} className={ROLE_COLORS[role]} variant="secondary">
                                  {ROLE_LABELS[role]}
                                </Badge>
                              )) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(inv.status, inv.expires_at)}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {format(new Date(inv.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {inv.status === "pending" && new Date(inv.expires_at) > new Date() && (
                                <>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handleCopyInvitationLink(inv.id)}
                                    title="Link kopieren"
                                  >
                                    <Link className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => handleCancelInvitation(inv.id)}
                                    className="text-destructive hover:text-destructive"
                                    title="Abbrechen"
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {(inv.status === "expired" || (inv.status === "pending" && new Date(inv.expires_at) <= new Date())) && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleResendInvitation(inv)}
                                  disabled={isInviting}
                                  title="Erneut senden"
                                  className="text-accent hover:text-accent"
                                >
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
              {/* Role descriptions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Rollenbeschreibungen
                  </CardTitle>
                  <CardDescription>Übersicht der verfügbaren Rollen und deren Berechtigungen im System</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[
                      { role: "admin" as AppRole, desc: "Vollzugriff auf alle Module. Kann Benutzer verwalten, Rollen zuweisen und Systemeinstellungen ändern." },
                      { role: "management" as AppRole, desc: "Zugriff auf Berichte, Budgetplanung, Projekte und Mitarbeiterverwaltung. Kann Genehmigungen erteilen." },
                      { role: "finance" as AppRole, desc: "Zugriff auf Finanzen, Rechnungen, OPEX, Budgetplanung und Sozialversicherung. Kann finanzielle Genehmigungen erteilen." },
                      { role: "state" as AppRole, desc: "Zugriff auf Berichte, Audit-Logs und Compliance-Übersichten. Lesender Zugriff auf die meisten Module." },
                      { role: "partner" as AppRole, desc: "Eingeschränkter Zugriff auf Partner-relevante Kommunikation und freigegebene Dokumente." },
                    ].map(({ role, desc }) => (
                      <div key={role} className="rounded-lg border p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge className={ROLE_COLORS[role]}>{ROLE_LABELS[role]}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{desc}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Per-user role overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UsersIcon className="h-5 w-5" />
                    Benutzer-Rollen-Übersicht
                  </CardTitle>
                  <CardDescription>Alle Benutzer und ihre zugewiesenen Rollen</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Benutzer</TableHead>
                        {(Object.keys(ROLE_LABELS) as AppRole[]).map((role) => (
                          <TableHead key={role} className="text-center">{ROLE_LABELS[role]}</TableHead>
                        ))}
                        <TableHead className="text-right">Bearbeiten</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">
                            <div>
                              <div>{u.first_name || u.last_name ? `${u.first_name || ""} ${u.last_name || ""}`.trim() : u.email}</div>
                              {(u.first_name || u.last_name) && (
                                <div className="text-xs text-muted-foreground">{u.email}</div>
                              )}
                            </div>
                          </TableCell>
                          {(Object.keys(ROLE_LABELS) as AppRole[]).map((role) => (
                            <TableCell key={role} className="text-center">
                              {u.roles.includes(role) ? (
                                <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          ))}
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => { setSelectedUser(u); setEditDialogOpen(true); }}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rollen bearbeiten</DialogTitle>
              <DialogDescription>{selectedUser?.email}</DialogDescription>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Rollen</Label>
                  <div className="flex flex-wrap gap-4">
                    {(Object.keys(ROLE_LABELS) as AppRole[]).map((role) => (
                      <div key={role} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`edit-role-${role}`} 
                          checked={selectedUser.roles.includes(role)} 
                          onCheckedChange={() => toggleEditRole(role)} 
                        />
                        <label htmlFor={`edit-role-${role}`} className="text-sm font-medium cursor-pointer">
                          {ROLE_LABELS[role]}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Abbrechen</Button>
              <Button onClick={() => selectedUser && handleUpdateRoles(selectedUser.user_id, selectedUser.roles)}>Speichern</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
