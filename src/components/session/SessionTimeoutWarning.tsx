import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Timer } from "lucide-react";

interface SessionTimeoutWarningProps {
  timeoutMinutes?: number;
}

export function SessionTimeoutWarning({ timeoutMinutes = 15 }: SessionTimeoutWarningProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const WARNING_SECONDS = 120; // 2 minutes before timeout

  const logout = useCallback(async () => {
    clearAllTimers();
    setShowWarning(false);
    sessionStorage.removeItem("mgi-session-start");
    sessionStorage.removeItem("mgi-session-registered");
    await supabase.auth.signOut();
  }, []);

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const startCountdown = useCallback(() => {
    setShowWarning(true);
    setSecondsLeft(WARNING_SECONDS);

    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const resetTimeout = useCallback(() => {
    if (!user || timeoutMinutes <= 0) return;

    lastActivityRef.current = Date.now();
    setShowWarning(false);
    clearAllTimers();

    const timeoutMs = timeoutMinutes * 60 * 1000;
    const warningMs = timeoutMs - WARNING_SECONDS * 1000;

    if (warningMs > 0) {
      warningRef.current = setTimeout(startCountdown, warningMs);
    }
    timeoutRef.current = setTimeout(logout, timeoutMs);
  }, [user, timeoutMinutes, logout, startCountdown, clearAllTimers]);

  const handleStayActive = useCallback(() => {
    resetTimeout();
    // Update session activity
    if (user) {
      supabase
        .from("user_sessions")
        .update({ last_active_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("is_current", true)
        .then(() => {});
    }
  }, [resetTimeout, user]);

  useEffect(() => {
    if (!user) return;

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"];

    // Throttled activity handler - only reset if warning is NOT showing
    const handleActivity = () => {
      if (showWarning) return; // Don't reset during warning countdown
      const now = Date.now();
      if (now - lastActivityRef.current < 30000) return; // Throttle to 30s
      resetTimeout();
    };

    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    resetTimeout();

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      clearAllTimers();
    };
  }, [user, resetTimeout, clearAllTimers, showWarning]);

  if (!showWarning || !user) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] animate-in slide-in-from-top duration-300">
      <div className="bg-destructive text-destructive-foreground px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">
                {t("session.timeout.title") !== "session.timeout.title" 
                  ? t("session.timeout.title") 
                  : "Session läuft ab"}
              </p>
              <p className="text-xs opacity-90">
                {t("session.timeout.description") !== "session.timeout.description"
                  ? t("session.timeout.description")
                  : "Sie werden wegen Inaktivität automatisch abgemeldet."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-destructive-foreground/20 font-mono text-lg font-bold tabular-nums">
              <Timer className="h-4 w-4" />
              {minutes.toString().padStart(2, "0")}:{seconds.toString().padStart(2, "0")}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleStayActive}
              className="font-semibold whitespace-nowrap"
            >
              {t("session.timeout.stayActive") !== "session.timeout.stayActive"
                ? t("session.timeout.stayActive")
                : "Ich bin noch aktiv"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
