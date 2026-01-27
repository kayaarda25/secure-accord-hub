import { useState, useMemo } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganizationPermissions } from "@/hooks/useOrganizationPermissions";
import {
  LayoutDashboard,
  Wallet,
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
  Globe,
  LogOut,
  FileSpreadsheet,
  Banknote,
  X,
  CheckSquare,
  TrendingUp,
  BarChart,
  ScanLine,
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
  { name: "Authorities", href: "/authorities", icon: Globe },
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

  // Build navigation based on permissions
  const navigation: NavItem[] = useMemo(() => {
    const items: NavItem[] = [
      { name: "Dashboard", href: "/", icon: LayoutDashboard },
    ];

    // Don't show permission-based items while loading
    if (permissionsLoading) {
      // Only show basic items while loading
      items.push({ name: "Documents", href: "/documents", icon: FileText });
      items.push({ name: "Communication", href: "/communication", icon: MessageSquare });
      items.push({ name: "Calendar", href: "/calendar", icon: Calendar });
      items.push({ name: "Tasks", href: "/tasks", icon: CheckSquare });
      return items;
    }

    // Finances menu (Declarations, Invoices)
    const financeChildren: NavItem["children"] = [];
    
    if (permissions.canViewDeclarations || permissions.canCreateDeclarations) {
      financeChildren.push({ 
        name: "Declarations", 
        href: "/finances/declarations", 
        icon: FileSpreadsheet,
        permission: "view_declarations" 
      });
    }
    
    if (permissions.canViewInvoices || permissions.canCreateInvoices) {
      financeChildren.push({ 
        name: "Invoices", 
        href: "/finances/invoices", 
        icon: Banknote,
        permission: "view_invoices" 
      });
    }

    if (financeChildren.length > 0) {
      items.push({
        name: "Finances",
        href: "/finances",
        icon: Wallet,
        children: [
          { name: "Overview", href: "/finances", icon: Wallet },
          ...financeChildren
        ]
      });
    }

    // OPEX
    if (permissions.canViewOpex || permissions.canCreateOpex) {
      items.push({ name: "OPEX", href: "/opex", icon: Receipt, permission: "view_opex" });
      items.push({ name: "Receipt Scanner", href: "/receipt-scanner", icon: ScanLine, permission: "view_opex" });
    }

    // Budget
    if (permissions.canViewBudget || permissions.canCreateBudget) {
      items.push({ name: "Budget", href: "/budget", icon: TrendingUp, permission: "view_budget" });
    }

    // Invoices as standalone item (if user has permission)
    if (permissions.canViewInvoices || permissions.canCreateInvoices) {
      items.push({ name: "Invoices", href: "/finances/invoices", icon: Banknote });
    }

    // Reports (always visible)
    items.push({ name: "Reports", href: "/reports", icon: BarChart });

    // Documents (always visible)
    items.push({ name: "Documents", href: "/documents", icon: FileText });

    // Communication (always visible)
    items.push({ name: "Communication", href: "/communication", icon: MessageSquare });

    // Calendar and Tasks at the bottom
    items.push({ name: "Calendar", href: "/calendar", icon: Calendar });
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

  const getOrgLabel = () => {
    if (permissions.orgType === "gateway") return "Gateway";
    if (permissions.orgType === "mgi_media") return "MGI Media";
    if (permissions.orgType === "mgi_communications") return "MGI Comm";
    return "";
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center glow-gold">
              <span className="text-accent font-bold text-lg">M</span>
            </div>
            <div>
              <h1 className="font-semibold text-sidebar-accent-foreground text-sm">
                MGI × AFRICA
              </h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                State Cooperation
              </p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mx-auto glow-gold">
            <span className="text-accent font-bold text-lg">M</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-accent-foreground transition-colors hidden lg:block"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
        {/* Mobile close button */}
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="p-1.5 rounded-lg hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-accent-foreground transition-colors lg:hidden"
          >
            <X size={20} />
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
        <div className="mt-8 pt-4 border-t border-sidebar-border">
          {!collapsed && (
            <p className="section-header px-4 mb-2">Administration</p>
          )}
          <div className="space-y-1">
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
                  <item.icon size={20} className={isActive ? "text-accent" : ""} />
                  {!collapsed && <span>{item.name}</span>}
                </NavLink>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
        {!collapsed ? (
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center">
              <span className="text-sm font-medium text-accent">
                {profile?.first_name?.[0] || "U"}
                {profile?.last_name?.[0] || ""}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-accent-foreground truncate">
                {profile?.first_name || "User"} {profile?.last_name || ""}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {getRoleBadge()} {getOrgLabel() && `• ${getOrgLabel()}`}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-lg hover:bg-sidebar-accent text-muted-foreground hover:text-destructive transition-colors"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center">
              <span className="text-sm font-medium text-accent">
                {profile?.first_name?.[0] || "U"}
              </span>
            </div>
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-lg hover:bg-sidebar-accent text-muted-foreground hover:text-destructive transition-colors"
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
        className={`fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border flex-col transition-all duration-300 z-50 hidden lg:flex ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-72 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 z-50 lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
