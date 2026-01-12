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
  const { hasRole, user } = useAuth();
  const { logAction } = useAuditLog();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  
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
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
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
      toast.error("Error loading users");
    } finally {
      setLoading(false);
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

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password) {
      toast.error("Email and password are required");
      return;
    }

    try {
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

      await logAction("CREATE", "profiles", data.userId, null, { email: newUser.email, roles: newUser.roles });

      toast.success("User created successfully");
      setCreateDialogOpen(false);
      setNewUser({ email: "", password: "", firstName: "", lastName: "", department: "", position: "", organizationId: "", roles: [] });
      fetchUsers();
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error(error.message || "Error creating user");
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
      toast.success("Roles updated successfully");
      setEditDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      console.error("Error updating roles:", error);
      toast.error("Error updating roles");
    }
  };

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    try {
      const { error } = await supabase.from("profiles").update({ is_active: !isActive }).eq("user_id", userId);
      if (error) throw error;
      await logAction("UPDATE", "profiles", userId, { is_active: isActive }, { is_active: !isActive });
      toast.success(isActive ? "User deactivated" : "User activated");
      fetchUsers();
    } catch (error) {
      console.error("Error toggling user status:", error);
      toast.error("Error changing user status");
    }
  };

  const toggleRole = (role: AppRole) => {
    setNewUser((prev) => ({
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

  if (!isAdmin) {
    return (
      <Layout title="Access Denied">
        <div className="flex items-center justify-center h-[60vh]">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Shield className="h-6 w-6" />
                Access Denied
              </CardTitle>
              <CardDescription>You need administrator privileges to access this page.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="User Management" subtitle="Manage user accounts and role assignments">
      <div className="space-y-6">
        <div className="flex items-center justify-end">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button><UserPlus className="mr-2 h-4 w-4" />New User</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>Create a new user account with role assignment</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label htmlFor="firstName">First Name</Label><Input id="firstName" value={newUser.firstName} onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })} /></div>
                  <div className="space-y-2"><Label htmlFor="lastName">Last Name</Label><Input id="lastName" value={newUser.lastName} onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })} /></div>
                </div>
                <div className="space-y-2"><Label htmlFor="email">Email *</Label><Input id="email" type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="password">Password *</Label><Input id="password" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Department</Label><Select value={newUser.department} onValueChange={(value) => setNewUser({ ...newUser, department: value })}><SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger><SelectContent><SelectItem value="Executive">Executive</SelectItem><SelectItem value="Finance">Finance</SelectItem><SelectItem value="Legal">Legal</SelectItem><SelectItem value="Administration">Administration</SelectItem><SelectItem value="Project Management">Project Management</SelectItem><SelectItem value="Communication">Communication</SelectItem><SelectItem value="IT">IT</SelectItem><SelectItem value="HR">HR</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>Position</Label><Select value={newUser.position} onValueChange={(value) => setNewUser({ ...newUser, position: value })}><SelectTrigger><SelectValue placeholder="Select position" /></SelectTrigger><SelectContent><SelectItem value="CEO">CEO</SelectItem><SelectItem value="Department Head">Department Head</SelectItem><SelectItem value="Project Manager">Project Manager</SelectItem><SelectItem value="Specialist">Specialist</SelectItem><SelectItem value="Consultant">Consultant</SelectItem><SelectItem value="Assistant">Assistant</SelectItem><SelectItem value="Intern">Intern</SelectItem></SelectContent></Select></div>
                </div>
                <div className="space-y-2"><Label>Organization</Label><Select value={newUser.organizationId} onValueChange={(value) => setNewUser({ ...newUser, organizationId: value })}><SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger><SelectContent>{organizations.map((org) => (<SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>))}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Roles</Label><div className="flex flex-wrap gap-2">{(Object.keys(ROLE_LABELS) as AppRole[]).map((role) => (<div key={role} className="flex items-center space-x-2"><Checkbox id={`role-${role}`} checked={newUser.roles.includes(role)} onCheckedChange={() => toggleRole(role)} /><label htmlFor={`role-${role}`} className="text-sm font-medium cursor-pointer">{ROLE_LABELS[role]}</label></div>))}</div></div>
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button><Button onClick={handleCreateUser}>Create</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><UsersIcon className="h-5 w-5" />Users</CardTitle><CardDescription>{users.length} users in system</CardDescription></CardHeader>
          <CardContent>
            {loading ? (<div className="text-center py-8 text-muted-foreground">Loading...</div>) : (
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Department</TableHead><TableHead>Roles</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id} className={!u.is_active ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{u.first_name || u.last_name ? `${u.first_name || ""} ${u.last_name || ""}`.trim() : "-"}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{u.department || "-"}</TableCell>
                      <TableCell><div className="flex flex-wrap gap-1">{u.roles.length > 0 ? u.roles.map((role) => (<Badge key={role} className={ROLE_COLORS[role]}>{ROLE_LABELS[role]}</Badge>)) : (<span className="text-muted-foreground text-sm">No roles</span>)}</div></TableCell>
                      <TableCell><Badge variant={u.is_active ? "default" : "secondary"}>{u.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                      <TableCell className="text-right"><div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => { setSelectedUser(u); setEditDialogOpen(true); }}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="sm" onClick={() => handleToggleActive(u.user_id, u.is_active)}>{u.is_active ? (<Trash2 className="h-4 w-4 text-destructive" />) : (<Shield className="h-4 w-4 text-green-500" />)}</Button></div></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Roles</DialogTitle><DialogDescription>{selectedUser?.email}</DialogDescription></DialogHeader>
            {selectedUser && (<div className="space-y-4"><div className="space-y-2"><Label>Roles</Label><div className="flex flex-wrap gap-4">{(Object.keys(ROLE_LABELS) as AppRole[]).map((role) => (<div key={role} className="flex items-center space-x-2"><Checkbox id={`edit-role-${role}`} checked={selectedUser.roles.includes(role)} onCheckedChange={() => toggleEditRole(role)} /><label htmlFor={`edit-role-${role}`} className="text-sm font-medium cursor-pointer">{ROLE_LABELS[role]}</label></div>))}</div></div></div>)}
            <DialogFooter><Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button><Button onClick={() => selectedUser && handleUpdateRoles(selectedUser.user_id, selectedUser.roles)}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
