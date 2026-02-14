import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bug, Lightbulb, AlertTriangle, Loader2, Send, CheckCircle } from "lucide-react";

type TicketType = "bug" | "error" | "feature";

export default function Support() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [type, setType] = useState<TicketType>("bug");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const typeIcons: Record<TicketType, React.ReactNode> = {
    bug: <Bug className="h-5 w-5" />,
    error: <AlertTriangle className="h-5 w-5" />,
    feature: <Lightbulb className="h-5 w-5" />,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      toast.error(t("support.fillRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("send-support-request", {
        body: {
          type,
          subject: subject.trim(),
          description: description.trim(),
          userName: `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "Unknown",
          userEmail: profile?.email || "Unknown",
        },
      });

      if (error) throw error;

      setSubmitted(true);
      toast.success(t("support.sent"));
      setSubject("");
      setDescription("");
      setType("bug");
      setTimeout(() => setSubmitted(false), 3000);
    } catch (err: any) {
      console.error("Support request error:", err);
      toast.error(t("support.sendError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout title={t("page.support.title")} subtitle={t("page.support.subtitle")}>
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              {t("support.newRequest")}
            </CardTitle>
            <CardDescription>{t("support.newRequestDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <CheckCircle className="h-16 w-16 text-primary" />
                <p className="text-lg font-medium">{t("support.thankYou")}</p>
                <p className="text-muted-foreground text-center">{t("support.thankYouDesc")}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("support.type")} *</label>
                  <Select value={type} onValueChange={(v) => setType(v as TicketType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bug">
                        <span className="flex items-center gap-2">
                          <Bug className="h-4 w-4" /> {t("support.typeBug")}
                        </span>
                      </SelectItem>
                      <SelectItem value="error">
                        <span className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" /> {t("support.typeError")}
                        </span>
                      </SelectItem>
                      <SelectItem value="feature">
                        <span className="flex items-center gap-2">
                          <Lightbulb className="h-4 w-4" /> {t("support.typeFeature")}
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("support.subject")} *</label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={t("support.subjectPlaceholder")}
                    required
                    maxLength={200}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("support.description")} *</label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t("support.descriptionPlaceholder")}
                    required
                    rows={6}
                    maxLength={5000}
                  />
                </div>

                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("support.sending")}
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      {t("support.send")}
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
