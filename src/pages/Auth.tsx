import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, Loader2, AlertTriangle, Mail, Building2, ArrowLeft } from "lucide-react";
import mgiLogo from "@/assets/mgi-logo.jpg";
import { z } from "zod";
import { TwoFactorVerify } from "@/components/security/TwoFactorVerify";
import { useLoginProtection } from "@/hooks/useLoginProtection";
import { Badge } from "@/components/ui/badge";

const emailSchema = z.string().email("Bitte geben Sie eine gültige E-Mail-Adresse ein");
const passwordSchema = z.string().min(6, "Passwort muss mindestens 6 Zeichen lang sein");

const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

interface InvitationData {
  email: string;
  department: string | null;
  position: string | null;
  organizationName: string | null;
}

type Step = "email" | "password";

export default function Auth() {
  const [searchParams] = useSearchParams();
  const invitationToken = searchParams.get("invitation");
  const [step, setStep] = useState<Step>("email");
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

  const [invitationData, setInvitationData] = useState<InvitationData | null>(null);
  const [isLoadingInvitation, setIsLoadingInvitation] = useState(false);
  const [invitationError, setInvitationError] = useState<string | null>(null);

  const { checkIfBlocked, logAttempt, maxAttempts, lockoutMinutes } = useLoginProtection();
  const { signIn, signUp, user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (invitationToken) {
      loadInvitation();
    }
  }, [invitationToken]);

  const loadInvitation = async () => {
    setIsLoadingInvitation(true);
    setInvitationError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-invitation?token=${invitationToken}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });
      const result = await response.json();
      if (!response.ok) {
        setInvitationError(result.error || "Ungültige Einladung");
        return;
      }
      setInvitationData(result);
      setEmail(result.email);
      setStep("password");
    } catch (err) {
      console.error("Error loading invitation:", err);
      setInvitationError("Fehler beim Laden der Einladung");
    } finally {
      setIsLoadingInvitation(false);
    }
  };

  useEffect(() => {
    if (user && !isLoading && !invitationToken) {
      checkMfaRequirement();
    }
  }, [user, isLoading, invitationToken]);

  const checkMfaRequirement = async () => {
    try {
      const { data: { currentLevel, nextLevel } } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (currentLevel === 'aal1' && nextLevel === 'aal2') {
        setShow2FAVerify(true);
      } else {
        navigate("/");
      }
    } catch (err) {
      navigate("/");
    }
  };

  const handleEmailContinue = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }
    setStep("password");
  };

  const handleBack = () => {
    setStep("email");
    setPassword("");
    setError(null);
    setIsBlocked(false);
  };

  const handleInvitationSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const validation = signupSchema.safeParse({ email, password, firstName, lastName, confirmPassword });
      if (!validation.success) {
        setError(validation.error.errors[0].message);
        setIsSubmitting(false);
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke("accept-invitation", {
        body: { token: invitationToken, password, firstName, lastName }
      });

      if (fnError) { setError(fnError.message || "Fehler beim Akzeptieren der Einladung"); return; }
      if (data?.error) { setError(data.error); return; }

      const { error: signInError } = await signIn(email, password);
      if (signInError) {
        setSuccess("Konto erfolgreich erstellt! Bitte melden Sie sich an.");
        navigate("/auth");
        setStep("email");
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

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (invitationToken && invitationData) {
      return handleInvitationSubmit();
    }

    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const pwResult = passwordSchema.safeParse(password);
      if (!pwResult.success) {
        setError(pwResult.error.errors[0].message);
        setIsSubmitting(false);
        return;
      }

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
        await logAttempt(email, false);
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
        await logAttempt(email, true);
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
            <button onClick={() => navigate("/auth")} className="px-6 py-2 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/90 transition-colors">
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
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl overflow-hidden mb-4 shadow-lg">
            <img src={mgiLogo} alt="MGI Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">MGI Hub</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Government Cooperation Platform
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
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
                  {invitationData.department && <Badge variant="secondary">{invitationData.department}</Badge>}
                  {invitationData.position && <Badge variant="outline">{invitationData.position}</Badge>}
                </div>
              </div>
            </div>
          )}

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

          {/* Step 1: Email */}
          {step === "email" && (
            <form onSubmit={handleEmailContinue} className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-1">
                  Wie lautet Ihre E-Mail-Adresse?
                </h2>
                <p className="text-sm text-muted-foreground">
                  Geben Sie Ihre E-Mail-Adresse ein, um sich anzumelden.
                </p>
              </div>

              <div>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-muted-foreground text-base"
                  placeholder="name@unternehmen.com"
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-foreground text-background rounded-lg font-semibold hover:opacity-90 transition-opacity text-base"
              >
                Weiter
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-3 text-muted-foreground">oder</span>
                </div>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                Registrierung ist nur per Einladung möglich.
              </p>
            </form>
          )}

          {/* Step 2: Password */}
          {step === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              <div>
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
                  disabled={!!invitationData}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Zurück
                </button>
                <h2 className="text-xl font-semibold text-foreground mb-1">
                  {invitationData ? "Konto erstellen" : "Passwort eingeben"}
                </h2>
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="text-sm text-muted-foreground">{email}</span>
                </div>
              </div>

              {/* Name fields for invitation */}
              {invitationData && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                      Vorname
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                      placeholder="Max"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                      Nachname
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                      placeholder="Mustermann"
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  Passwort
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent pr-10 text-base"
                    placeholder="••••••••"
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {invitationData && (
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    Passwort bestätigen
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent text-base"
                    placeholder="••••••••"
                    required
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || isBlocked}
                className="w-full py-3 bg-foreground text-background rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
              >
                {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                {invitationData ? "Konto erstellen" : "Anmelden"}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Geschützt durch höchste Sicherheitsstandards
          <br />
          Daten ausschliesslich in der Schweiz gespeichert
        </p>
      </div>

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
