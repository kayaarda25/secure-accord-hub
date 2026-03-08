import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  FileText,
  CheckSquare,
  Calendar,
  Receipt,
  Users,
  MessageSquare,
  LayoutDashboard,
  Settings,
  Building2,
  Globe,
  TrendingUp,
  BarChart,
  Shield,
  Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganizationPermissions } from "@/hooks/useOrganizationPermissions";
import { useLanguage } from "@/contexts/LanguageContext";

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  type: "document" | "task" | "event" | "expense" | "user" | "message";
  link: string;
}

const quickActionDefs = [
  { nameKey: "nav.dashboard", icon: LayoutDashboard, href: "/" },
  { nameKey: "nav.documents", icon: FileText, href: "/documents" },
  { nameKey: "nav.tasks", icon: CheckSquare, href: "/tasks" },
  { nameKey: "nav.calendar", icon: Calendar, href: "/calendar" },
  { nameKey: "nav.opex", icon: Receipt, href: "/opex" },
  { nameKey: "nav.communication", icon: MessageSquare, href: "/communication" },
  { nameKey: "nav.budget", icon: TrendingUp, href: "/budget" },
  { nameKey: "nav.reports", icon: BarChart, href: "/reports" },
  { nameKey: "nav.partners", icon: Building2, href: "/partners" },
  { nameKey: "nav.authorities", icon: Globe, href: "/authorities" },
  { nameKey: "nav.users", icon: Users, href: "/users" },
  { nameKey: "nav.security", icon: Shield, href: "/security" },
  { nameKey: "nav.settings", icon: Settings, href: "/settings" },
];

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { permissions, isLoading: permissionsLoading } = useOrganizationPermissions();
  const { t } = useLanguage();

  const quickActions = useMemo(() => {
    const filtered = permissionsLoading
      ? quickActionDefs.filter((a) => a.href !== "/budget")
      : quickActionDefs.filter((a) => (a.href === "/budget" ? permissions.canViewBudget || permissions.canCreateBudget : true));
    return filtered.map((a) => ({ ...a, name: t(a.nameKey) }));
  }, [permissions, permissionsLoading, t]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2 || !user) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    const searchResults: SearchResult[] = [];

    try {
      // Search documents
      const { data: documents } = await supabase
        .from("documents")
        .select("id, name, description")
        .or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
        .limit(5);

      if (documents) {
        searchResults.push(
          ...documents.map((d) => ({
            id: d.id,
            title: d.name,
            description: d.description || undefined,
            type: "document" as const,
            link: "/documents",
          }))
        );
      }

      // Search tasks
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, description")
        .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
        .limit(5);

      if (tasks) {
        searchResults.push(
          ...tasks.map((t) => ({
            id: t.id,
            title: t.title,
            description: t.description || undefined,
            type: "task" as const,
            link: "/tasks",
          }))
        );
      }

      // Search calendar events
      const { data: events } = await supabase
        .from("calendar_events")
        .select("id, title, description")
        .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
        .limit(5);

      if (events) {
        searchResults.push(
          ...events.map((e) => ({
            id: e.id,
            title: e.title,
            description: e.description || undefined,
            type: "event" as const,
            link: "/calendar",
          }))
        );
      }

      // Search expenses
      const { data: expenses } = await supabase
        .from("opex_expenses")
        .select("id, title, description, expense_number")
        .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,expense_number.ilike.%${searchQuery}%`)
        .limit(5);

      if (expenses) {
        searchResults.push(
          ...expenses.map((e) => ({
            id: e.id,
            title: `${e.expense_number}: ${e.title}`,
            description: e.description || undefined,
            type: "expense" as const,
            link: "/opex",
          }))
        );
      }

      // Search users
      const { data: users } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, position")
        .or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .limit(5);

      if (users) {
        searchResults.push(
          ...users.map((u) => ({
            id: u.id,
            title: `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email,
            description: u.position || undefined,
            type: "user" as const,
            link: "/users",
          }))
        );
      }

      setResults(searchResults);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  }, [user]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      search(query);
    }, 300);

    return () => clearTimeout(debounce);
  }, [query, search]);

  const handleSelect = (link: string) => {
    setOpen(false);
    setQuery("");
    navigate(link);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "document": return FileText;
      case "task": return CheckSquare;
      case "event": return Calendar;
      case "expense": return Receipt;
      case "user": return Users;
      case "message": return MessageSquare;
      default: return Search;
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-muted/50 rounded-lg hover:bg-muted transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Suchen...</span>
        <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder={t("search.placeholder")}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {isSearching ? t("common.loading") : t("search.noResults")}
          </CommandEmpty>
          
          {results.length > 0 && (
            <CommandGroup heading={t("search.results")}>
              {results.map((result) => {
                const Icon = getIcon(result.type);
                return (
                  <CommandItem
                    key={`${result.type}-${result.id}`}
                    onSelect={() => handleSelect(result.link)}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                      <span>{result.title}</span>
                      {result.description && (
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {result.description}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {query.length < 2 && (
            <>
              <CommandSeparator />
              <CommandGroup heading={t("search.quickAccess")}>
                {quickActions.map((action) => (
                  <CommandItem
                    key={action.href}
                    onSelect={() => handleSelect(action.href)}
                  >
                    <action.icon className="mr-2 h-4 w-4" />
                    <span>{action.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
