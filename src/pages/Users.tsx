import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { UserPlus, Shield, Trash2, Edit, Users as UsersIcon } from "lucide-react";
import { useAuditLog } from "@/hooks/useAuditLog";

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

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrator",
  state: "Staat",
  management: "Management",
  finance: "Finanzen",
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
  const { hasRole, user } = useAuth();
  const { logAction } = useAuditLog();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  
  // Form state for creating users
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    department: "",
    position: "",
    organizationId: "",
    roles: [] as AppRole[],
  });

  const isAdmin = hasRole("admin");

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchOrganizations();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    try {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: allRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");

      if (rolesError) throw rolesError;

      // Combine profiles with roles
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

  const fetchOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name")
        .order("name");

      if (error) throw error;
      setOrganizations(data || []);
    } catch (error) {
      console.error("Error fetching organizations:", error);
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password) {
      toast.error("E-Mail und Passwort sind erforderlich");
      return;
    }

    try {
      // Call edge function to create user (admin only)
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          email: newUser.email,
          password: newUser.password,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          department: newUser.department,
          position: newUser.position,
          organizationId: newUser.organizationId || null,
          roles: newUser.roles,
        },
      });

      if (error) throw error;

      await logAction("CREATE", "profiles", data.userId, null, {
        email: newUser.email,
        roles: newUser.roles,
      });

      toast.success("Benutzer erfolgreich erstellt");
      setCreateDialogOpen(false);
      setNewUser({
        email: "",
        password: "",
        firstName: "",
        lastName: "",
        department: "",
        position: "",
        organizationId: "",
        roles: [],
      });
      fetchUsers();
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error(error.message || "Fehler beim Erstellen des Benutzers");
    }
  };

  const handleUpdateRoles = async (userId: string, roles: AppRole[]) => {
    try {
      // Delete existing roles
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      if (deleteError) throw deleteError;

      // Insert new roles
      if (roles.length > 0) {
        const roleInserts = roles.map((role) => ({
          user_id: userId,
          role: role,
          granted_by: user?.id,
        }));

        const { error: insertError } = await supabase
          .from("user_roles")
          .insert(roleInserts);

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
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: !isActive })
        .eq("user_id", userId);

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
    setNewUser((prev) => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role],
    }));
  };

  const toggleEditRole = (role: AppRole) => {
    if (!selectedUser) return;
    setSelectedUser((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        roles: prev.roles.includes(role)
          ? prev.roles.filter((r) => r !== role)
          : [...prev.roles, role],
      };
    });
  };

  if (!isAdmin) {
    return (
      <Layout title="Zugriff verweigert">
        <div className="flex items-center justify-center h-[60vh]">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Shield className="h-6 w-6" />
                Zugriff verweigert
              </CardTitle>
              <CardDescription>
                Sie benötigen Administrator-Rechte, um auf diese Seite zuzugreifen.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Benutzerverwaltung" subtitle="Verwalten Sie Benutzerkonten und Rollenzuweisungen">
      <div className="space-y-6">
        <div className="flex items-center justify-end">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Neuer Benutzer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Neuen Benutzer erstellen</DialogTitle>
                <DialogDescription>
                  Erstellen Sie ein neues Benutzerkonto mit Rollenzuweisung
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Vorname</Label>
                    <Input
                      id="firstName"
                      value={newUser.firstName}
                      onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Nachname</Label>
                    <Input
                      id="lastName"
                      value={newUser.lastName}
                      onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Passwort *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Abteilung</Label>
                    <Select
                      value={newUser.department}
                      onValueChange={(value) => setNewUser({ ...newUser, department: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Abteilung wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Geschäftsführung">Geschäftsführung</SelectItem>
                        <SelectItem value="Finanzen">Finanzen</SelectItem>
                        <SelectItem value="Recht">Recht</SelectItem>
                        <SelectItem value="Verwaltung">Verwaltung</SelectItem>
                        <SelectItem value="Projektmanagement">Projektmanagement</SelectItem>
                        <SelectItem value="Kommunikation">Kommunikation</SelectItem>
                        <SelectItem value="IT">IT</SelectItem>
                        <SelectItem value="Personal">Personal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Position</Label>
                    <Select
                      value={newUser.position}
                      onValueChange={(value) => setNewUser({ ...newUser, position: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Position wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Geschäftsführer">Geschäftsführer</SelectItem>
                        <SelectItem value="Abteilungsleiter">Abteilungsleiter</SelectItem>
                        <SelectItem value="Projektleiter">Projektleiter</SelectItem>
                        <SelectItem value="Sachbearbeiter">Sachbearbeiter</SelectItem>
                        <SelectItem value="Referent">Referent</SelectItem>
                        <SelectItem value="Berater">Berater</SelectItem>
                        <SelectItem value="Assistent">Assistent</SelectItem>
                        <SelectItem value="Praktikant">Praktikant</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Organisation</Label>
                  <Select
                    value={newUser.organizationId}
                    onValueChange={(value) => setNewUser({ ...newUser, organizationId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Organisation wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Rollen</Label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(ROLE_LABELS) as AppRole[]).map((role) => (
                      <div key={role} className="flex items-center space-x-2">
                        <Checkbox
                          id={`role-${role}`}
                          checked={newUser.roles.includes(role)}
                          onCheckedChange={() => toggleRole(role)}
                        />
                        <label
                          htmlFor={`role-${role}`}
                          className="text-sm font-medium cursor-pointer"
                        >
                          {ROLE_LABELS[role]}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button onClick={handleCreateUser}>Erstellen</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="h-5 w-5" />
              Benutzer
            </CardTitle>
            <CardDescription>
              {users.length} Benutzer im System
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Laden...
              </div>
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
                        {u.first_name || u.last_name
                          ? `${u.first_name || ""} ${u.last_name || ""}`.trim()
                          : "-"}
                      </TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{u.department || "-"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {u.roles.length > 0 ? (
                            u.roles.map((role) => (
                              <Badge
                                key={role}
                                className={ROLE_COLORS[role]}
                              >
                                {ROLE_LABELS[role]}
                              </Badge>
                            ))
                          ) : (
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(u);
                              setEditDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(u.user_id, u.is_active)}
                          >
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

        {/* Edit Roles Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rollen bearbeiten</DialogTitle>
              <DialogDescription>
                {selectedUser?.email}
              </DialogDescription>
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
                        <label
                          htmlFor={`edit-role-${role}`}
                          className="text-sm font-medium cursor-pointer"
                        >
                          {ROLE_LABELS[role]}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button
                onClick={() =>
                  selectedUser && handleUpdateRoles(selectedUser.user_id, selectedUser.roles)
                }
              >
                Speichern
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
