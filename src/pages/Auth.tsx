import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Eye, EyeOff, Loader2, AlertTriangle } from "lucide-react";
import { z } from "zod";
import { TwoFactorVerify } from "@/components/security/TwoFactorVerify";
import { useLoginProtection } from "@/hooks/useLoginProtection";

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

export default function Auth() {
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
  
  const { checkIfBlocked, logAttempt, maxAttempts, lockoutMinutes } = useLoginProtection();

  const { signIn, signUp, user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !isLoading) {
      // Check if user needs to complete 2FA
      checkMfaRequirement();
    }
  }, [user, isLoading]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

        const { error } = await signUp(email, password, firstName, lastName);
        if (error) {
          if (error.message.includes("already registered")) {
            setError("This email address is already registered.");
          } else {
            setError(error.message);
          }
        } else {
          setSuccess("Account created successfully! You will be redirected...");
        }
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
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
          <div className="flex items-center gap-2 mb-6">
            <Shield size={20} className="text-success" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              Secure Login
            </span>
          </div>

          <h2 className="text-xl font-semibold text-foreground mb-6">
            {isLogin ? "Sign In" : "Sign Up"}
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
            {!isLogin && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="John"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="Doe"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="name@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                Password
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

            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  Confirm Password
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
              disabled={isSubmitting}
              className="w-full py-3 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 glow-gold"
            >
              {isSubmitting && <Loader2 size={18} className="animate-spin" />}
              {isLogin ? "Sign In" : "Sign Up"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
                setSuccess(null);
              }}
              className="text-sm text-accent hover:text-accent/80 transition-colors"
            >
              {isLogin
                ? "Don't have an account? Sign up now"
                : "Already registered? Sign in"}
            </button>
          </div>
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
