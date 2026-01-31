import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface LetterheadSettings {
  id: string;
  preset_name: string;
  is_default: boolean;
  company_name: string;
  subtitle: string;
  address: string;
  logo_url: string | null;
  primary_color: string;
  show_logo: boolean;
  footer_text: string;
}

const defaultSettings: LetterheadSettings = {
  id: "",
  preset_name: "Standard",
  is_default: true,
  company_name: "MGI × AFRIKA",
  subtitle: "Government Cooperation Platform",
  address: "Zürich, Switzerland",
  logo_url: null,
  primary_color: "#c97c5d",
  show_logo: false,
  footer_text: "Confidential",
};

export function useLetterheadSettings() {
  const [presets, setPresets] = useState<LetterheadSettings[]>([]);
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
      .order("preset_name");

    if (data && data.length > 0) {
      const mappedPresets = data.map((p) => ({
        id: p.id,
        preset_name: p.preset_name || "Standard",
        is_default: p.is_default || false,
        company_name: p.company_name,
        subtitle: p.subtitle || "",
        address: p.address || "",
        logo_url: p.logo_url,
        primary_color: p.primary_color || "#c97c5d",
        show_logo: p.show_logo || false,
        footer_text: p.footer_text || "Confidential",
      }));
      setPresets(mappedPresets);
      
      // Set default preset as current
      const defaultPreset = mappedPresets.find(p => p.is_default) || mappedPresets[0];
      setSettings(defaultPreset);
    }

    setIsLoading(false);
  };

  return { presets, settings, isLoading, refetch: fetchSettings };
}

// Helper to convert hex to color without #
export function hexToColorCode(hex: string): string {
  return hex.replace("#", "");
}
