import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldOff } from "lucide-react";

interface DisableTwoFactorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function DisableTwoFactor({ open, onOpenChange, onSuccess }: DisableTwoFactorProps) {
  const [verifyCode, setVerifyCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleDisable = async () => {
    if (verifyCode.length !== 6) {
      setError("Bitte geben Sie einen 6-stelligen Code ein");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Get the user's TOTP factors
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      
      if (factorsError) throw factorsError;
      
      const totpFactor = factors.totp[0];
      
      if (!totpFactor) {
        throw new Error("Kein TOTP-Faktor gefunden");
      }

      // First verify the code
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challengeData.id,
        code: verifyCode
      });

      if (verifyError) throw verifyError;

      // Now unenroll the factor
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId: totpFactor.id
      });

      if (unenrollError) throw unenrollError;

      // Update security_settings
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("security_settings").update({
          two_factor_enabled: false,
          two_factor_secret: null,
          backup_codes: null
        }).eq("user_id", user.id);
      }

      toast({
        title: "2FA deaktiviert",
        description: "Zwei-Faktor-Authentifizierung wurde erfolgreich deaktiviert"
      });

      onSuccess();
      onOpenChange(false);
      setVerifyCode("");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Deaktivierung fehlgeschlagen";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setVerifyCode("");
    setError("");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldOff className="h-5 w-5" />
            2FA deaktivieren
          </DialogTitle>
          <DialogDescription>
            Geben Sie Ihren Authenticator-Code ein, um die Zwei-Faktor-Authentifizierung zu deaktivieren
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">
              <strong>Warnung:</strong> Das Deaktivieren von 2FA macht Ihr Konto weniger sicher. 
              Sie werden nur noch Ihr Passwort zur Anmeldung benötigen.
            </p>
          </div>

          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={verifyCode}
              onChange={setVerifyCode}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleClose}>
            Abbrechen
          </Button>
          <Button
            variant="destructive"
            onClick={handleDisable}
            disabled={isLoading || verifyCode.length !== 6}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Wird deaktiviert...
              </>
            ) : (
              "2FA deaktivieren"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
