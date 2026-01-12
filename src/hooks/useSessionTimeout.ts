import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export function useSessionTimeout(timeoutMinutes: number = 60) {
  const { user } = useAuth();
  const { toast } = useToast();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    toast({
      title: "Automatisch abgemeldet",
      description: "Sie wurden aufgrund von Inaktivität abgemeldet",
      variant: "destructive"
    });
  }, [toast]);

  const showWarning = useCallback(() => {
    toast({
      title: "Session läuft ab",
      description: "Sie werden in 2 Minuten automatisch abgemeldet. Bewegen Sie die Maus, um aktiv zu bleiben.",
    });
  }, [toast]);

  const resetTimeout = useCallback(() => {
    lastActivityRef.current = Date.now();

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
    }

    if (user && timeoutMinutes > 0) {
      const timeoutMs = timeoutMinutes * 60 * 1000;
      const warningMs = timeoutMs - 2 * 60 * 1000; // 2 minutes before timeout

      if (warningMs > 0) {
        warningRef.current = setTimeout(showWarning, warningMs);
      }
      timeoutRef.current = setTimeout(logout, timeoutMs);
    }
  }, [user, timeoutMinutes, logout, showWarning]);

  const updateSessionActivity = useCallback(async () => {
    if (!user) return;
    
    // Only update if at least 1 minute has passed
    const now = Date.now();
    if (now - lastActivityRef.current < 60000) return;
    
    lastActivityRef.current = now;
    
    await supabase
      .from("user_sessions")
      .update({ last_active_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("is_current", true);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"];
    
    const handleActivity = () => {
      resetTimeout();
      updateSessionActivity();
    };

    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Initial timeout setup
    resetTimeout();

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
    };
  }, [user, resetTimeout, updateSessionActivity]);

  return { resetTimeout };
}
