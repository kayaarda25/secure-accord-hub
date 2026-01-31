import { useState, useMemo } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganizationPermissions } from "@/hooks/useOrganizationPermissions";
import {
  LayoutDashboard,
  Receipt,
  FileText,
  MessageSquare,
  Calendar,
  Shield,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Building2,
  Users,
  LogOut,
  X,
  CheckSquare,
  BarChart,
  FolderOpen,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface NavItem {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  children?: { name: string; href: string; icon: typeof LayoutDashboard; permission?: string }[];
  permission?: string;
}

const secondaryNav = [
  { name: "Partners", href: "/partners", icon: Building2 },
  { name: "Users", href: "/users", icon: Users },
  { name: "Security", href: "/security", icon: Shield },
  { name: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, roles, signOut } = useAuth();
  const { permissions, isLoading: permissionsLoading } = useOrganizationPermissions();

  // Build navigation based on permissions - simplified and clean
  const navigation: NavItem[] = useMemo(() => {
    const items: NavItem[] = [
      { name: "Dashboard", href: "/", icon: LayoutDashboard },
    ];

    // OPEX (if user has permission)
    if (!permissionsLoading && (permissions.canViewOpex || permissions.canCreateOpex)) {
      items.push({ name: "OPEX", href: "/opex", icon: Receipt });
    }

    // Reports
    items.push({ name: "Reports", href: "/reports", icon: BarChart });

    // Explorer - Document management
    items.push({ name: "Explorer", href: "/explorer", icon: FolderOpen });

    // Documents
    items.push({ name: "Documents", href: "/documents", icon: FileText });

    // Communication
    items.push({ name: "Communication", href: "/communication", icon: MessageSquare });

    // Calendar
    items.push({ name: "Calendar", href: "/calendar", icon: Calendar });

    // Tasks
    items.push({ name: "Tasks", href: "/tasks", icon: CheckSquare });

    return items;
  }, [permissions, permissionsLoading]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleNavClick = () => {
    if (onMobileClose) {
      onMobileClose();
    }
  };

  const getRoleBadge = () => {
    if (roles.includes("admin")) return "Admin";
    if (roles.includes("state")) return "State";
    if (roles.includes("management")) return "Management";
    if (roles.includes("finance")) return "Finance";
    if (roles.includes("partner")) return "Partner";
    return "User";
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-border">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-semibold text-sm">M</span>
            </div>
            <div>
              <h1 className="font-semibold text-foreground text-sm">
                MGI × AFRIKA
              </h1>
              <p className="text-[10px] text-muted-foreground">
                Government Platform
              </p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mx-auto">
            <span className="text-primary-foreground font-semibold text-sm">M</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors hidden lg:block"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
        {/* Mobile close button */}
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors lg:hidden"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        <div className="space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || 
              (item.children && item.children.some(c => location.pathname === c.href));
            const hasChildren = item.children && item.children.length > 0;

            if (hasChildren && !collapsed) {
              return (
                <Collapsible key={item.name} defaultOpen={isActive}>
                  <CollapsibleTrigger className={`nav-link w-full justify-between ${isActive ? "nav-link-active" : ""}`}>
                    <div className="flex items-center gap-3">
                      <item.icon size={20} className={isActive ? "text-accent" : ""} />
                      <span>{item.name}</span>
                    </div>
                    <ChevronDown size={16} className="transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-4 mt-1 space-y-1">
                    {item.children.map((child) => {
                      const isChildActive = location.pathname === child.href;
                      return (
                        <NavLink
                          key={child.name}
                          to={child.href}
                          onClick={handleNavClick}
                          className={`nav-link text-sm ${isChildActive ? "nav-link-active" : ""}`}
                        >
                          <child.icon size={16} className={isChildActive ? "text-accent" : ""} />
                          <span>{child.name}</span>
                        </NavLink>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              );
            }

            return (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={handleNavClick}
                className={`nav-link ${isActive ? "nav-link-active" : ""} ${
                  collapsed ? "justify-center px-2" : ""
                }`}
                title={collapsed ? item.name : undefined}
              >
                <item.icon size={20} className={isActive ? "text-accent" : ""} />
                {!collapsed && <span>{item.name}</span>}
              </NavLink>
            );
          })}
        </div>

        {/* Secondary Navigation */}
        <div className="mt-6 pt-4 border-t border-border">
          {!collapsed && (
            <p className="text-xs font-medium text-muted-foreground px-3 mb-2">Settings</p>
          )}
          <div className="space-y-0.5">
            {secondaryNav.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={handleNavClick}
                  className={`nav-link ${isActive ? "nav-link-active" : ""} ${
                    collapsed ? "justify-center px-2" : ""
                  }`}
                  title={collapsed ? item.name : undefined}
                >
                  <item.icon size={18} className={isActive ? "text-primary" : ""} />
                  {!collapsed && <span>{item.name}</span>}
                </NavLink>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        {!collapsed ? (
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <span className="text-sm font-medium text-foreground">
                {profile?.first_name?.[0] || "U"}
                {profile?.last_name?.[0] || ""}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {profile?.first_name || "User"} {profile?.last_name || ""}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {getRoleBadge()}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <span className="text-sm font-medium text-foreground">
                {profile?.first_name?.[0] || "U"}
              </span>
            </div>
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen bg-sidebar border-r border-border flex-col transition-all duration-200 z-50 hidden lg:flex ${
          collapsed ? "w-16" : "w-56"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-sidebar border-r border-border flex flex-col transition-transform duration-200 z-50 lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
