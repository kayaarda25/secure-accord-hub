import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, Copy, Shield } from "lucide-react";

interface TwoFactorSetupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type SetupStep = "intro" | "qrcode" | "verify" | "backup" | "complete";

export function TwoFactorSetup({ open, onOpenChange, onSuccess }: TwoFactorSetupProps) {
  const [step, setStep] = useState<SetupStep>("intro");
  const [isLoading, setIsLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [factorId, setFactorId] = useState<string>("");
  const [verifyCode, setVerifyCode] = useState("");
  const [error, setError] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const { toast } = useToast();

  const handleStartSetup = async () => {
    setIsLoading(true);
    setError("");
    
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator App'
      });
      
      if (enrollError) throw enrollError;
      
      if (data) {
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
        setFactorId(data.id);
        setStep("qrcode");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Fehler bei der 2FA-Einrichtung";
      setError(errorMessage);
      toast({
        title: "Fehler",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (verifyCode.length !== 6) {
      setError("Bitte geben Sie einen 6-stelligen Code ein");
      return;
    }
    
    setIsLoading(true);
    setError("");
    
    try {
      // Create a challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId
      });
      
      if (challengeError) throw challengeError;
      
      // Verify the code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verifyCode
      });
      
      if (verifyError) throw verifyError;
      
      // Generate backup codes (we'll store them in the database)
      const codes = generateBackupCodes();
      setBackupCodes(codes);
      
      // Store backup codes in security_settings
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("security_settings").update({
          two_factor_enabled: true,
          two_factor_secret: factorId,
          backup_codes: codes
        }).eq("user_id", user.id);
      }
      
      setStep("backup");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Verifizierung fehlgeschlagen";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const generateBackupCodes = (): string[] => {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const code = Math.random().toString(36).substring(2, 6).toUpperCase() + 
                   "-" + 
                   Math.random().toString(36).substring(2, 6).toUpperCase();
      codes.push(code);
    }
    return codes;
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    toast({
      title: "Kopiert",
      description: "Backup-Codes wurden in die Zwischenablage kopiert"
    });
  };

  const handleComplete = () => {
    setStep("complete");
    setTimeout(() => {
      onSuccess();
      onOpenChange(false);
      // Reset state
      setStep("intro");
      setQrCode("");
      setSecret("");
      setFactorId("");
      setVerifyCode("");
      setBackupCodes([]);
    }, 2000);
  };

  const handleClose = () => {
    if (step === "qrcode" || step === "verify") {
      // Cancel the enrollment if user closes during setup
      if (factorId) {
        supabase.auth.mfa.unenroll({ factorId });
      }
    }
    onOpenChange(false);
    setStep("intro");
    setQrCode("");
    setSecret("");
    setFactorId("");
    setVerifyCode("");
    setError("");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Zwei-Faktor-Authentifizierung einrichten
          </DialogTitle>
          <DialogDescription>
            {step === "intro" && "Schützen Sie Ihr Konto mit einer zusätzlichen Sicherheitsebene"}
            {step === "qrcode" && "Scannen Sie den QR-Code mit Ihrer Authenticator-App"}
            {step === "verify" && "Geben Sie den Code aus Ihrer Authenticator-App ein"}
            {step === "backup" && "Speichern Sie Ihre Backup-Codes sicher ab"}
            {step === "complete" && "2FA wurde erfolgreich aktiviert"}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {step === "intro" && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <h4 className="font-medium">Was Sie benötigen:</h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• Eine Authenticator-App (z.B. Google Authenticator, Authy)</li>
                  <li>• Ihr Smartphone zum Scannen des QR-Codes</li>
                </ul>
              </div>
              <Button onClick={handleStartSetup} className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Wird vorbereitet...
                  </>
                ) : (
                  "Einrichtung starten"
                )}
              </Button>
            </div>
          )}

          {step === "qrcode" && (
            <div className="space-y-4">
              <div className="flex justify-center p-4 bg-white rounded-lg">
                {qrCode.startsWith('data:') ? (
                  <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
                ) : (
                  <div 
                    dangerouslySetInnerHTML={{ __html: qrCode }} 
                    className="[&>svg]:w-48 [&>svg]:h-48"
                  />
                )}
              </div>
              
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Manueller Schlüssel:</p>
                <code className="text-xs font-mono break-all select-all">{secret}</code>
              </div>
              
              <Button onClick={() => setStep("verify")} className="w-full">
                Weiter zur Verifizierung
              </Button>
            </div>
          )}

          {step === "verify" && (
            <div className="space-y-4">
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
              
              <Button 
                onClick={handleVerifyCode} 
                className="w-full" 
                disabled={isLoading || verifyCode.length !== 6}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Wird verifiziert...
                  </>
                ) : (
                  "Code verifizieren"
                )}
              </Button>
              
              <Button variant="ghost" onClick={() => setStep("qrcode")} className="w-full">
                Zurück zum QR-Code
              </Button>
            </div>
          )}

          {step === "backup" && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Wichtig:</strong> Speichern Sie diese Codes an einem sicheren Ort. 
                  Sie können sie verwenden, wenn Sie keinen Zugriff auf Ihre Authenticator-App haben.
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg font-mono text-sm">
                {backupCodes.map((code, index) => (
                  <div key={index} className="text-center py-1">{code}</div>
                ))}
              </div>
              
              <Button variant="outline" onClick={copyBackupCodes} className="w-full">
                <Copy className="h-4 w-4 mr-2" />
                Codes kopieren
              </Button>
              
              <Button onClick={handleComplete} className="w-full">
                Ich habe die Codes gespeichert
              </Button>
            </div>
          )}

          {step === "complete" && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-center font-medium">2FA erfolgreich aktiviert!</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
