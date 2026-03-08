import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  department: string | null;
  position: string | null;
  phone: string | null;
  avatar_url: string | null;
  organization_id: string | null;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  permissions: string[];
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  // Legacy compatibility - maps to permissions
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  roles: string[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Map old role names to permission keys for backward compatibility
const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  admin: ["admin.full_access"],
  management: ["employees.manage", "vacations.approve", "expenses.approve", "budget.manage", "documents.sign", "users.manage", "communication.manage"],
  finance: ["invoices.approve", "opex.approve", "payments.confirm", "budget.manage", "payroll.view", "declarations.manage"],
  state: ["audit.view", "declarations.view", "budget.view", "opex.view"],
  partner: ["communication.view", "documents.view"],
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchProfileAndPermissions(session.user.id);
          }, 0);

          if (event === "SIGNED_IN") {
            setTimeout(() => {
              registerSession(session.user.id);
            }, 0);
          }
        } else {
          setProfile(null);
          setPermissions([]);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfileAndPermissions(session.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfileAndPermissions = async (userId: string) => {
    try {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();
      
      if (profileData) {
        setProfile(profileData as Profile);
      }

      // Fetch permissions instead of roles
      const { data: permsData } = await supabase
        .from("user_permissions")
        .select("permission_key")
        .eq("user_id", userId);
      
      if (permsData) {
        setPermissions(permsData.map((p) => p.permission_key));
      }
    } catch (error) {
      console.error("Error fetching profile/permissions:", error);
    }
  };

  const registerSession = async (userId: string) => {
    const sessionKey = "mgi-session-registered";
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, "true");

    try {
      await supabase
        .from("user_sessions")
        .update({ is_active: false })
        .eq("user_id", userId)
        .eq("is_active", true);

      let ipAddress: string | null = null;
      try {
        const res = await fetch("https://api.ipify.org?format=json");
        const data = await res.json();
        ipAddress = data.ip;
      } catch {
        // IP fetch failed
      }

      await supabase.from("user_sessions").insert({
        user_id: userId,
        user_agent: navigator.userAgent,
        ip_address: ipAddress,
        is_active: true,
        last_active_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error registering session:", error);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { first_name: firstName, last_name: lastName },
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setPermissions([]);
  };

  const hasPermission = (permission: string) => {
    if (permissions.includes("admin.full_access")) return true;
    return permissions.includes(permission);
  };

  const hasAnyPermission = (perms: string[]) => {
    if (permissions.includes("admin.full_access")) return true;
    return perms.some((p) => permissions.includes(p));
  };

  // Legacy compatibility: hasRole checks if user has any permission that maps to that role
  const hasRole = (role: string) => {
    if (permissions.includes("admin.full_access")) return true;
    const mappedPerms = ROLE_PERMISSION_MAP[role] || [];
    return mappedPerms.some((p) => permissions.includes(p));
  };

  const hasAnyRole = (roles: string[]) => roles.some((r) => hasRole(r));

  // Derive legacy roles from permissions for backward compatibility
  const derivedRoles = Object.entries(ROLE_PERMISSION_MAP)
    .filter(([, perms]) => perms.some((p) => permissions.includes(p)))
    .map(([role]) => role);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        permissions,
        isLoading,
        signIn,
        signUp,
        signOut,
        hasPermission,
        hasAnyPermission,
        hasRole,
        hasAnyRole,
        roles: derivedRoles,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
