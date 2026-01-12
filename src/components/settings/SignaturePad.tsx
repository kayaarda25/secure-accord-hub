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
  const [existingSignature, setExistingSignature] = useState<string | null>(null);
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

    const { data } = await supabase
      .from("profiles")
      .select("signature_data, signature_type, signature_initials")
      .eq("user_id", user.id)
      .single();

    if (data) {
      setExistingSignature(data.signature_data);
      setExistingType(data.signature_type);
      if (data.signature_initials) {
        setInitials(data.signature_initials);
      }
      if (data.signature_type === "image" && data.signature_data) {
        setSignatureType("draw");
      }
    }
  };

  const handleClear = () => {
    if (sigCanvas.current) {
      sigCanvas.current.clear();
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);

    try {
      let signatureData: string | null = null;
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
        signatureData = sigCanvas.current.toDataURL("image/png");
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
          signature_data: signatureData,
          signature_type: sigType,
          signature_initials: sigInitials,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      setExistingSignature(signatureData);
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
      const { error } = await supabase
        .from("profiles")
        .update({
          signature_data: null,
          signature_type: "text",
          signature_initials: null,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      setExistingSignature(null);
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
        {(existingSignature || (existingType === "text" && initials)) && (
          <div className="p-4 bg-muted rounded-lg">
            <Label className="text-xs text-muted-foreground mb-2 block">
              Aktuelle Signatur
            </Label>
            <div className="bg-background p-4 rounded border border-border flex items-center justify-center min-h-[80px]">
              {existingType === "image" && existingSignature ? (
                <img
                  src={existingSignature}
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
          {(existingSignature || (existingType === "text" && initials)) && (
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
