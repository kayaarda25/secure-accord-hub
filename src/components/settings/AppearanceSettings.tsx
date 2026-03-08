import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "mgi-appearance-prefs";

type SidebarDensity = "compact" | "default" | "comfortable";
type FontSize = "small" | "default" | "large";

interface AccentOption {
  name: string;
  value: string; // HSL values
  preview: string; // CSS color for preview swatch
}

const ACCENT_COLORS: AccentOption[] = [
  { name: "Apple Blue", value: "211 100% 50%", preview: "hsl(211, 100%, 50%)" },
  { name: "Indigo", value: "239 84% 67%", preview: "hsl(239, 84%, 67%)" },
  { name: "Violet", value: "271 91% 65%", preview: "hsl(271, 91%, 65%)" },
  { name: "Rose", value: "346 77% 50%", preview: "hsl(346, 77%, 50%)" },
  { name: "Orange", value: "25 95% 53%", preview: "hsl(25, 95%, 53%)" },
  { name: "Emerald", value: "160 84% 39%", preview: "hsl(160, 84%, 39%)" },
  { name: "Teal", value: "173 80% 40%", preview: "hsl(173, 80%, 40%)" },
  { name: "Gold", value: "40 76% 55%", preview: "hsl(40, 76%, 55%)" },
];

interface AppearancePrefs {
  accentColor: string;
  fontSize: FontSize;
  sidebarDensity: SidebarDensity;
  animationsEnabled: boolean;
  contentWidth: number; // percentage 80-100
}

const DEFAULT_PREFS: AppearancePrefs = {
  accentColor: "211 100% 50%",
  fontSize: "default",
  sidebarDensity: "default",
  animationsEnabled: true,
  contentWidth: 100,
};

function loadPrefs(): AppearancePrefs {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_PREFS, ...JSON.parse(stored) };
  } catch {}
  return DEFAULT_PREFS;
}

function applyPrefs(prefs: AppearancePrefs) {
  const root = document.documentElement;

  // Accent color
  root.style.setProperty("--primary", prefs.accentColor);
  root.style.setProperty("--accent", prefs.accentColor);
  root.style.setProperty("--ring", prefs.accentColor);
  root.style.setProperty("--sidebar-primary", prefs.accentColor);
  root.style.setProperty("--sidebar-ring", prefs.accentColor);
  root.style.setProperty("--info", prefs.accentColor);

  // Font size
  const fontSizeMap: Record<FontSize, string> = {
    small: "14px",
    default: "16px",
    large: "18px",
  };
  root.style.fontSize = fontSizeMap[prefs.fontSize];

  // Sidebar density
  root.dataset.sidebarDensity = prefs.sidebarDensity;

  // Animations
  if (!prefs.animationsEnabled) {
    root.style.setProperty("--animation-duration", "0s");
    root.classList.add("reduce-motion");
  } else {
    root.style.removeProperty("--animation-duration");
    root.classList.remove("reduce-motion");
  }

  // Content width
  root.style.setProperty("--content-max-width", `${prefs.contentWidth}%`);
}

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<AppearancePrefs>(loadPrefs);

  // Apply on mount and whenever prefs change
  useEffect(() => {
    applyPrefs(prefs);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const updatePref = <K extends keyof AppearancePrefs>(key: K, value: AppearancePrefs[K]) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setPrefs(DEFAULT_PREFS);
    setTheme("system");
    toast({ title: t("settings.appearance.resetDone") });
  };

  const themeOptions = [
    { value: "light" as const, icon: Sun, label: t("settings.appearance.light") },
    { value: "dark" as const, icon: Moon, label: t("settings.appearance.dark") },
    { value: "system" as const, icon: Monitor, label: t("settings.appearance.system") },
  ];

  return (
    <div className="space-y-6">
      {/* Theme / Color Scheme */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.appearance.title")}</CardTitle>
          <CardDescription>{t("settings.appearance.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Dark Mode Toggle */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">{t("settings.appearance.colorScheme")}</Label>
            <div className="grid grid-cols-3 gap-3">
              {themeOptions.map((opt) => {
                const Icon = opt.icon;
                const isActive = theme === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setTheme(opt.value)}
                    className={cn(
                      "relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all duration-200",
                      isActive
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
                    )}
                  >
                    {isActive && (
                      <div className="absolute top-2 right-2">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </div>
                    )}
                    <div className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className={cn(
                      "text-sm font-medium",
                      isActive ? "text-primary" : "text-foreground"
                    )}>
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Accent Color */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">{t("settings.appearance.accentColor")}</Label>
            <div className="flex flex-wrap gap-3">
              {ACCENT_COLORS.map((color) => {
                const isActive = prefs.accentColor === color.value;
                return (
                  <button
                    key={color.value}
                    onClick={() => updatePref("accentColor", color.value)}
                    className={cn(
                      "group relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-200",
                      isActive
                        ? "border-foreground scale-110 shadow-md"
                        : "border-transparent hover:scale-105 hover:shadow-sm"
                    )}
                    title={color.name}
                  >
                    <span
                      className="h-7 w-7 rounded-full"
                      style={{ backgroundColor: color.preview }}
                    />
                    {isActive && (
                      <Check className="absolute h-3.5 w-3.5 text-white drop-shadow-md" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Layout & UI */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.appearance.layoutTitle")}</CardTitle>
          <CardDescription>{t("settings.appearance.layoutDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Font Size */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">{t("settings.appearance.fontSize")}</Label>
            <Select value={prefs.fontSize} onValueChange={(v) => updatePref("fontSize", v as FontSize)}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">{t("settings.appearance.fontSmall")}</SelectItem>
                <SelectItem value="default">{t("settings.appearance.fontDefault")}</SelectItem>
                <SelectItem value="large">{t("settings.appearance.fontLarge")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("settings.appearance.fontHint")}</p>
          </div>

          {/* Sidebar Density */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">{t("settings.appearance.sidebarDensity")}</Label>
            <Select value={prefs.sidebarDensity} onValueChange={(v) => updatePref("sidebarDensity", v as SidebarDensity)}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">{t("settings.appearance.densityCompact")}</SelectItem>
                <SelectItem value="default">{t("settings.appearance.densityDefault")}</SelectItem>
                <SelectItem value="comfortable">{t("settings.appearance.densityComfortable")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("settings.appearance.densityHint")}</p>
          </div>

          {/* Content Width */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{t("settings.appearance.contentWidth")}</Label>
              <span className="text-sm text-muted-foreground">{prefs.contentWidth}%</span>
            </div>
            <Slider
              value={[prefs.contentWidth]}
              onValueChange={([v]) => updatePref("contentWidth", v)}
              min={80}
              max={100}
              step={5}
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">{t("settings.appearance.contentWidthHint")}</p>
          </div>

          {/* Animations */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">{t("settings.appearance.animations")}</Label>
              <p className="text-sm text-muted-foreground">{t("settings.appearance.animationsDesc")}</p>
            </div>
            <Switch
              checked={prefs.animationsEnabled}
              onCheckedChange={(v) => updatePref("animationsEnabled", v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Reset */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={handleReset}>
          {t("settings.appearance.reset")}
        </Button>
      </div>
    </div>
  );
}

// Apply saved preferences on app startup
export function initAppearancePrefs() {
  applyPrefs(loadPrefs());
}
