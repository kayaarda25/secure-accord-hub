import { ReactNode, useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { SessionTimeoutWarning } from "@/components/session/SessionTimeoutWarning";
import { LanguageSelectionDialog } from "@/components/session/LanguageSelectionDialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface LayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function Layout({ children, title, subtitle }: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [timeoutMinutes, setTimeoutMinutes] = useState(15);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    supabase
      .from("security_settings")
      .select("session_timeout_minutes")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.session_timeout_minutes) {
          setTimeoutMinutes(data.session_timeout_minutes);
        }
      });
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      <SessionTimeoutWarning timeoutMinutes={timeoutMinutes} />
      <LanguageSelectionDialog />
      <Sidebar 
        mobileOpen={mobileMenuOpen} 
        onMobileClose={() => setMobileMenuOpen(false)} 
      />
      
      {/* Desktop layout */}
      <div className="lg:pl-64 transition-all duration-300">
        <Header 
          title={title} 
          subtitle={subtitle} 
          onMenuClick={() => setMobileMenuOpen(true)}
        />
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}