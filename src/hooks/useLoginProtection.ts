import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface LoginProtectionResult {
  isBlocked: boolean;
  remainingAttempts: number;
  lockoutMinutes: number;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export function useLoginProtection() {
  const [isChecking, setIsChecking] = useState(false);

  const checkIfBlocked = useCallback(async (email: string): Promise<LoginProtectionResult> => {
    setIsChecking(true);
    
    try {
      const { data, error } = await supabase.rpc('is_login_blocked', {
        _email: email,
        _max_attempts: MAX_ATTEMPTS,
        _lockout_minutes: LOCKOUT_MINUTES
      });

      if (error) {
        console.error("Error checking login block status:", error);
        return { isBlocked: false, remainingAttempts: MAX_ATTEMPTS, lockoutMinutes: LOCKOUT_MINUTES };
      }

      // Get remaining attempts
      const { data: attempts } = await supabase
        .from("login_attempts")
        .select("*")
        .eq("email", email)
        .eq("success", false)
        .gte("attempted_at", new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000).toISOString());

      const failedCount = attempts?.length || 0;
      const remaining = Math.max(0, MAX_ATTEMPTS - failedCount);

      return {
        isBlocked: data === true,
        remainingAttempts: remaining,
        lockoutMinutes: LOCKOUT_MINUTES
      };
    } finally {
      setIsChecking(false);
    }
  }, []);

  const logAttempt = useCallback(async (email: string, success: boolean) => {
    try {
      await supabase.rpc('log_login_attempt', {
        _email: email,
        _success: success
      });
    } catch (error) {
      console.error("Error logging login attempt:", error);
    }
  }, []);

  return {
    checkIfBlocked,
    logAttempt,
    isChecking,
    maxAttempts: MAX_ATTEMPTS,
    lockoutMinutes: LOCKOUT_MINUTES
  };
}
