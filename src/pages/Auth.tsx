import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Eye, EyeOff, Loader2, AlertTriangle, Mail, Building2 } from "lucide-react";
import { z } from "zod";
import { TwoFactorVerify } from "@/components/security/TwoFactorVerify";
import { useLoginProtection } from "@/hooks/useLoginProtection";
import { Badge } from "@/components/ui/badge";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signupSchema = loginSchema.extend({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

interface InvitationData {
  email: string;
  department: string | null;
  position: string | null;
  organizationName: string | null;
}

export default function Auth() {
  const [searchParams] = useSearchParams();
  const invitationToken = searchParams.get("invitation");
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [show2FAVerify, setShow2FAVerify] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState(5);
  
  // Invitation state
  const [invitationData, setInvitationData] = useState<InvitationData | null>(null);
  const [isLoadingInvitation, setIsLoadingInvitation] = useState(false);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  
  const { checkIfBlocked, logAttempt, maxAttempts, lockoutMinutes } = useLoginProtection();

  const { signIn, signUp, user, isLoading } = useAuth();
  const navigate = useNavigate();

  // Load invitation data if token is present
  useEffect(() => {
    if (invitationToken) {
      loadInvitation();
    }
  }, [invitationToken]);

  const loadInvitation = async () => {
    setIsLoadingInvitation(true);
    setInvitationError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke("get-invitation", {
        body: null,
        headers: {},
      });

      // Use fetch directly since we need query params
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-invitation?token=${invitationToken}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setInvitationError(result.error || "Ungültige Einladung");
        return;
      }

      setInvitationData(result);
      setEmail(result.email);
      setIsLogin(false); // Switch to signup mode for invitations
    } catch (err) {
      console.error("Error loading invitation:", err);
      setInvitationError("Fehler beim Laden der Einladung");
    } finally {
      setIsLoadingInvitation(false);
    }
  };

  useEffect(() => {
    if (user && !isLoading && !invitationToken) {
      // Check if user needs to complete 2FA
      checkMfaRequirement();
    }
  }, [user, isLoading, invitationToken]);

  const checkMfaRequirement = async () => {
    try {
      const { data: { currentLevel, nextLevel } } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      
      if (currentLevel === 'aal1' && nextLevel === 'aal2') {
        // User has MFA enabled but hasn't verified yet
        setShow2FAVerify(true);
      } else {
        // User is fully authenticated
        navigate("/");
      }
    } catch (err) {
      // If error, assume no MFA needed
      navigate("/");
    }
  };

  const handleInvitationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const validation = signupSchema.safeParse({
        email,
        password,
        firstName,
        lastName,
        confirmPassword,
      });
      
      if (!validation.success) {
        setError(validation.error.errors[0].message);
        setIsSubmitting(false);
        return;
      }

      // Accept the invitation via edge function
      const { data, error: fnError } = await supabase.functions.invoke("accept-invitation", {
        body: {
          token: invitationToken,
          password,
          firstName,
          lastName,
        },
      });

      if (fnError) {
        setError(fnError.message || "Fehler beim Akzeptieren der Einladung");
        return;
      }

      if (data?.error) {
        setError(data.error);
        return;
      }

      // Auto-login after successful registration
      const { error: signInError } = await signIn(email, password);
      if (signInError) {
        setSuccess("Konto erfolgreich erstellt! Bitte melden Sie sich an.");
        // Clear invitation token from URL and show login
        navigate("/auth");
        setIsLogin(true);
      } else {
        setSuccess("Willkommen! Sie werden weitergeleitet...");
        setTimeout(() => navigate("/"), 1500);
      }
    } catch (err) {
      setError("Ein unerwarteter Fehler ist aufgetreten.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // If this is an invitation, use the invitation flow
    if (invitationToken && invitationData) {
      return handleInvitationSubmit(e);
    }
    
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      if (isLogin) {
        const validation = loginSchema.safeParse({ email, password });
        if (!validation.success) {
          setError(validation.error.errors[0].message);
          setIsSubmitting(false);
          return;
        }

        // Check if login is blocked
        const blockStatus = await checkIfBlocked(email);
        if (blockStatus.isBlocked) {
          setIsBlocked(true);
          setError(`Zu viele Fehlversuche. Bitte warten Sie ${lockoutMinutes} Minuten.`);
          setIsSubmitting(false);
          return;
        }
        setRemainingAttempts(blockStatus.remainingAttempts);

        const { error } = await signIn(email, password);
        if (error) {
          // Log failed attempt
          await logAttempt(email, false);
          
          // Update remaining attempts
          const newStatus = await checkIfBlocked(email);
          setRemainingAttempts(newStatus.remainingAttempts);
          
          if (newStatus.isBlocked) {
            setIsBlocked(true);
            setError(`Konto gesperrt. Bitte warten Sie ${lockoutMinutes} Minuten.`);
          } else if (error.message.includes("Invalid login credentials")) {
            setError(`Ungültige Anmeldedaten. Noch ${newStatus.remainingAttempts} Versuche übrig.`);
          } else {
            setError(error.message);
          }
        } else {
          // Log successful attempt
          await logAttempt(email, true);
        }
      } else {
        // Regular signup is disabled - users must be invited
        setError("Registrierung ist nur per Einladung möglich. Bitte kontaktieren Sie einen Administrator.");
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || isLoadingInvitation) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  // Invitation error state
  if (invitationToken && invitationError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="card-state p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mb-4">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Ungültige Einladung</h2>
            <p className="text-muted-foreground mb-6">{invitationError}</p>
            <button
              onClick={() => navigate("/auth")}
              className="px-6 py-2 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/90 transition-colors"
            >
              Zur Anmeldung
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-accent/10 mb-4 glow-gold">
            <span className="text-accent font-bold text-2xl">M</span>
          </div>
          <h1 className="text-2xl font-semibold text-foreground">MGI × AFRIKA</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Government Cooperation Platform
          </p>
        </div>

        {/* Auth Card */}
        <div className="card-state p-8">
          {/* Invitation Banner */}
          {invitationData && (
            <div className="mb-6 p-4 rounded-lg bg-accent/10 border border-accent/20">
              <div className="flex items-center gap-2 text-accent font-medium mb-2">
                <Mail className="h-4 w-4" />
                Sie wurden eingeladen!
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">
                  <span className="text-foreground font-medium">{invitationData.email}</span>
                </p>
                {invitationData.organizationName && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{invitationData.organizationName}</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
                  {invitationData.department && (
                    <Badge variant="secondary">{invitationData.department}</Badge>
                  )}
                  {invitationData.position && (
                    <Badge variant="outline">{invitationData.position}</Badge>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 mb-6">
            <Shield size={20} className="text-success" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              Secure Login
            </span>
          </div>

          <h2 className="text-xl font-semibold text-foreground mb-6">
            {invitationData ? "Konto erstellen" : (isLogin ? "Anmelden" : "Registrieren")}
          </h2>

          {isBlocked && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm">
              <div className="flex items-center gap-2 text-destructive font-medium">
                <AlertTriangle className="h-4 w-4" />
                Konto temporär gesperrt
              </div>
              <p className="text-muted-foreground mt-1">
                Zu viele fehlgeschlagene Anmeldeversuche. Bitte warten Sie {lockoutMinutes} Minuten.
              </p>
            </div>
          )}

          {error && !isBlocked && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 rounded-lg bg-success/10 border border-success/20 text-sm text-success">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name fields for invitation signup */}
            {invitationData && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    Vorname *
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="Max"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    Nachname *
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="Mustermann"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                E-Mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
                placeholder="name@example.com"
                required
                disabled={!!invitationData}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                Passwort {invitationData && "*"}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent pr-10"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {invitationData && (
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  Passwort bestätigen *
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="••••••••"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || isBlocked}
              className="w-full py-3 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 glow-gold"
            >
              {isSubmitting && <Loader2 size={18} className="animate-spin" />}
              {invitationData ? "Konto erstellen" : (isLogin ? "Anmelden" : "Registrieren")}
            </button>
          </form>

          {!invitationData && (
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Registrierung ist nur per Einladung möglich.
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Protected by the highest security standards
          <br />
          Data stored exclusively in Switzerland
        </p>
      </div>

      {/* 2FA Verification Dialog */}
      <TwoFactorVerify
        open={show2FAVerify}
        onOpenChange={setShow2FAVerify}
        onSuccess={() => navigate("/")}
        onCancel={async () => {
          await supabase.auth.signOut();
          setShow2FAVerify(false);
        }}
      />
    </div>
  );
}
