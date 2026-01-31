import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface LetterheadSettings {
  company_name: string;
  subtitle: string;
  address: string;
  logo_url: string | null;
  primary_color: string;
  show_logo: boolean;
  footer_text: string;
}

const defaultSettings: LetterheadSettings = {
  company_name: "MGI × AFRIKA",
  subtitle: "Government Cooperation Platform",
  address: "Zürich, Switzerland",
  logo_url: null,
  primary_color: "#c97c5d",
  show_logo: false,
  footer_text: "Confidential",
};

export function useLetterheadSettings() {
  const [settings, setSettings] = useState<LetterheadSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    if (!user) return;

    setIsLoading(true);
    const { data } = await supabase
      .from("letterhead_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (data) {
      setSettings({
        company_name: data.company_name,
        subtitle: data.subtitle || "",
        address: data.address || "",
        logo_url: data.logo_url,
        primary_color: data.primary_color || "#c97c5d",
        show_logo: data.show_logo || false,
        footer_text: data.footer_text || "Confidential",
      });
    }

    setIsLoading(false);
  };

  return { settings, isLoading, refetch: fetchSettings };
}

// Helper to convert hex to color without #
export function hexToColorCode(hex: string): string {
  return hex.replace("#", "");
}
