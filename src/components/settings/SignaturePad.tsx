import { useRef, useState, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PenTool, Type, Trash2, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface SignaturePadProps {
  onSave?: () => void;
}

export function SignaturePad({ onSave }: SignaturePadProps) {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const { user, profile } = useAuth();
  const { toast } = useToast();
  
  const [signatureType, setSignatureType] = useState<"draw" | "text">("text");
  const [initials, setInitials] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [existingSignatureUrl, setExistingSignatureUrl] = useState<string | null>(null);
  const [existingType, setExistingType] = useState<string | null>(null);

  useEffect(() => {
    fetchExistingSignature();
  }, [user]);

  useEffect(() => {
    // Auto-generate initials from profile
    if (profile && !initials) {
      const first = profile.first_name?.[0] || "";
      const last = profile.last_name?.[0] || "";
      if (first || last) {
        setInitials(`${first}.${last}`.toUpperCase());
      }
    }
  }, [profile]);

  const fetchExistingSignature = async () => {
    if (!user) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("signature_data, signature_type, signature_initials")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileData) {
      setExistingType(profileData.signature_type);
      if (profileData.signature_initials) {
        setInitials(profileData.signature_initials);
      }
      if (profileData.signature_type === "image" && profileData.signature_data) {
        // signature_data now contains the storage path
        const { data } = await supabase.storage
          .from("signatures")
          .createSignedUrl(profileData.signature_data, 3600);
        if (data?.signedUrl) {
          setExistingSignatureUrl(data.signedUrl);
        }
        setSignatureType("draw");
      }
    }
  };

  const handleClear = () => {
    if (sigCanvas.current) {
      sigCanvas.current.clear();
    }
  };

  const dataURLtoBlob = (dataURL: string): Blob => {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);

    try {
      let signaturePath: string | null = null;
      let sigType: string = "text";
      let sigInitials: string | null = null;

      if (signatureType === "draw" && sigCanvas.current) {
        if (sigCanvas.current.isEmpty()) {
          toast({
            title: "Fehler",
            description: "Bitte zeichnen Sie Ihre Signatur",
            variant: "destructive",
          });
          setIsSaving(false);
          return;
        }
        
        // Convert canvas to blob and upload to storage
        const dataUrl = sigCanvas.current.toDataURL("image/png");
        const blob = dataURLtoBlob(dataUrl);
        const fileName = `${user.id}/signature_${Date.now()}.png`;
        
        // Delete old signature if exists
        const { data: oldProfile } = await supabase
          .from("profiles")
          .select("signature_data")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (oldProfile?.signature_data) {
          await supabase.storage
            .from("signatures")
            .remove([oldProfile.signature_data]);
        }
        
        const { error: uploadError } = await supabase.storage
          .from("signatures")
          .upload(fileName, blob, { upsert: true });

        if (uploadError) throw uploadError;
        
        signaturePath = fileName;
        sigType = "image";
      } else {
        if (!initials.trim()) {
          toast({
            title: "Fehler",
            description: "Bitte geben Sie Ihre Initialen ein",
            variant: "destructive",
          });
          setIsSaving(false);
          return;
        }
        sigInitials = initials.trim();
        sigType = "text";
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          signature_data: signaturePath,
          signature_type: sigType,
          signature_initials: sigInitials,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      // Refresh the signature URL
      if (signaturePath) {
        const { data } = await supabase.storage
          .from("signatures")
          .createSignedUrl(signaturePath, 3600);
        if (data?.signedUrl) {
          setExistingSignatureUrl(data.signedUrl);
        }
      } else {
        setExistingSignatureUrl(null);
      }
      
      setExistingType(sigType);

      toast({
        title: "Gespeichert",
        description: "Ihre Signatur wurde gespeichert",
      });

      onSave?.();
    } catch (error) {
      console.error("Error saving signature:", error);
      toast({
        title: "Fehler",
        description: "Signatur konnte nicht gespeichert werden",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;

    setIsSaving(true);

    try {
      // Delete from storage if image signature
      const { data: oldProfile } = await supabase
        .from("profiles")
        .select("signature_data, signature_type")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (oldProfile?.signature_type === "image" && oldProfile?.signature_data) {
        await supabase.storage
          .from("signatures")
          .remove([oldProfile.signature_data]);
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          signature_data: null,
          signature_type: "text",
          signature_initials: null,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      setExistingSignatureUrl(null);
      setExistingType(null);
      setInitials("");
      handleClear();

      toast({
        title: "Gelöscht",
        description: "Ihre Signatur wurde gelöscht",
      });
    } catch (error) {
      console.error("Error deleting signature:", error);
      toast({
        title: "Fehler",
        description: "Signatur konnte nicht gelöscht werden",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PenTool className="h-5 w-5" />
          Digitale Signatur
        </CardTitle>
        <CardDescription>
          Erstellen Sie Ihre digitale Signatur für Dokumente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Existing Signature Preview */}
        {(existingSignatureUrl || (existingType === "text" && initials)) && (
          <div className="p-4 bg-muted rounded-lg">
            <Label className="text-xs text-muted-foreground mb-2 block">
              Aktuelle Signatur
            </Label>
            <div className="bg-background p-4 rounded border border-border flex items-center justify-center min-h-[80px]">
              {existingType === "image" && existingSignatureUrl ? (
                <img
                  src={existingSignatureUrl}
                  alt="Your signature"
                  className="max-h-[60px] object-contain"
                />
              ) : (
                <span className="font-signature text-3xl text-foreground italic">
                  {initials}
                </span>
              )}
            </div>
          </div>
        )}

        <Tabs
          value={signatureType}
          onValueChange={(v) => setSignatureType(v as "draw" | "text")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="text" className="flex items-center gap-2">
              <Type className="h-4 w-4" />
              Initialen
            </TabsTrigger>
            <TabsTrigger value="draw" className="flex items-center gap-2">
              <PenTool className="h-4 w-4" />
              Zeichnen
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="space-y-4 mt-4">
            <div>
              <Label htmlFor="initials">Initialen / Kürzel</Label>
              <Input
                id="initials"
                value={initials}
                onChange={(e) => setInitials(e.target.value)}
                placeholder="z.B. A.Kaya"
                className="mt-2"
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Diese Initialen werden als Signatur verwendet
              </p>
            </div>

            {/* Preview */}
            <div className="p-4 bg-muted rounded-lg">
              <Label className="text-xs text-muted-foreground mb-2 block">
                Vorschau
              </Label>
              <div className="bg-background p-4 rounded border border-border flex items-center justify-center min-h-[80px]">
                <span className="font-signature text-3xl text-foreground italic">
                  {initials || "A.Kaya"}
                </span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="draw" className="space-y-4 mt-4">
            <div>
              <Label>Signatur zeichnen</Label>
              <div className="mt-2 border border-border rounded-lg overflow-hidden bg-white">
                <SignatureCanvas
                  ref={sigCanvas}
                  canvasProps={{
                    className: "w-full h-[150px] cursor-crosshair",
                    style: { width: "100%", height: "150px" },
                  }}
                  backgroundColor="white"
                  penColor="black"
                />
              </div>
              <div className="flex justify-end mt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClear}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Löschen
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex items-center gap-3 pt-4 border-t border-border">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Signatur speichern
          </Button>
          {(existingSignatureUrl || (existingType === "text" && initials)) && (
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={isSaving}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Entfernen
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
