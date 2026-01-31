import { useState } from "react";
import mgiLogo from "@/assets/mgi-media-logo.jfif";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganizationPermissions } from "@/hooks/useOrganizationPermissions";
import { LayoutDashboard, Receipt, FileText, MessageSquare, Calendar, Shield, Settings, ChevronLeft, ChevronRight, ChevronDown, Building2, Users, LogOut, X, CheckSquare, ClipboardList, BarChart, FolderOpen, Wallet, ScanLine, TrendingUp, Globe, Banknote } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}
export function Sidebar({
  mobileOpen,
  onMobileClose
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<string[]>(["finances", "documents", "collaboration"]);
  const location = useLocation();
  const navigate = useNavigate();
  const {
    profile,
    roles,
    signOut
  } = useAuth();
  const { permissions } = useOrganizationPermissions();
  const toggleGroup = (group: string) => {
    setOpenGroups(prev => prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]);
  };
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
  const isActive = (path: string) => location.pathname === path;
  const isGroupActive = (paths: string[]) => paths.some(p => location.pathname === p);
  const sidebarContent = <>
      {/* Logo */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-border">
        {!collapsed && <div className="flex items-center gap-3">
            <img src={mgiLogo} alt="MGI Media" className="w-8 h-8 rounded-lg object-cover" />
            <div>
              <h1 className="font-semibold text-foreground text-sm">MGI Hub</h1>
              <p className="text-[10px] text-muted-foreground">
                Government Platform
              </p>
            </div>
          </div>}
        {collapsed && <img src={mgiLogo} alt="MGI Media" className="w-8 h-8 rounded-lg object-cover mx-auto" />}
        <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors hidden lg:block">
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
        {/* Mobile close button */}
        {onMobileClose && <button onClick={onMobileClose} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors lg:hidden">
            <X size={18} />
          </button>}
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto">
        {/* Dashboard - standalone */}
        <NavLink to="/" onClick={handleNavClick} className={`nav-link mb-1 ${isActive("/") ? "nav-link-active" : ""} ${collapsed ? "justify-center px-2" : ""}`} title={collapsed ? "Dashboard" : undefined}>
          <LayoutDashboard size={18} className={isActive("/") ? "text-primary" : ""} />
          {!collapsed && <span>Dashboard</span>}
        </NavLink>

        {/* Finances Group */}
        {!collapsed ? <Collapsible open={openGroups.includes("finances")} onOpenChange={() => toggleGroup("finances")}>
            <CollapsibleTrigger className={`nav-link w-full justify-between mt-1 ${isGroupActive(["/finances", "/opex", "/receipt-scanner", "/budget", "/finances/invoices", "/finances/declarations"]) ? "text-primary" : ""}`}>
              <div className="flex items-center gap-3">
                <Wallet size={18} />
                <span>Finances</span>
              </div>
              <ChevronDown size={14} className={`transition-transform duration-200 ${openGroups.includes("finances") ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="ml-5 mt-0.5 space-y-0.5 border-l border-border pl-3">
              <NavLink to="/finances" onClick={handleNavClick} className={`nav-link text-[13px] py-1.5 ${isActive("/finances") ? "nav-link-active" : ""}`}>
                <BarChart size={16} className={isActive("/finances") ? "text-primary" : ""} />
                <span>Overview</span>
              </NavLink>
              <NavLink to="/opex" onClick={handleNavClick} className={`nav-link text-[13px] py-1.5 ${isActive("/opex") ? "nav-link-active" : ""}`}>
                <Receipt size={16} className={isActive("/opex") ? "text-primary" : ""} />
                <span>OPEX</span>
              </NavLink>
              <NavLink to="/receipt-scanner" onClick={handleNavClick} className={`nav-link text-[13px] py-1.5 ${isActive("/receipt-scanner") ? "nav-link-active" : ""}`}>
                <ScanLine size={16} className={isActive("/receipt-scanner") ? "text-primary" : ""} />
                <span>Receipt Scanner</span>
              </NavLink>
              {permissions.orgType !== "mgi_communications" && (
                <NavLink to="/finances/invoices" onClick={handleNavClick} className={`nav-link text-[13px] py-1.5 ${isActive("/finances/invoices") ? "nav-link-active" : ""}`}>
                  <Banknote size={16} className={isActive("/finances/invoices") ? "text-primary" : ""} />
                  <span>Invoices</span>
                </NavLink>
              )}
              {permissions.canViewDeclarations && (
                <NavLink to="/finances/declarations" onClick={handleNavClick} className={`nav-link text-[13px] py-1.5 ${isActive("/finances/declarations") ? "nav-link-active" : ""}`}>
                  <TrendingUp size={16} className={isActive("/finances/declarations") ? "text-primary" : ""} />
                  <span>Declarations</span>
                </NavLink>
              )}
              <NavLink to="/budget" onClick={handleNavClick} className={`nav-link text-[13px] py-1.5 ${isActive("/budget") ? "nav-link-active" : ""}`}>
                <TrendingUp size={16} className={isActive("/budget") ? "text-primary" : ""} />
                <span>Budget</span>
              </NavLink>
            </CollapsibleContent>
          </Collapsible> : <NavLink to="/finances" onClick={handleNavClick} className={`nav-link justify-center px-2 ${isActive("/finances") ? "nav-link-active" : ""}`} title="Finances">
            <Wallet size={18} className={isActive("/finances") ? "text-primary" : ""} />
          </NavLink>}

        {/* Reports - standalone */}
        <NavLink to="/reports" onClick={handleNavClick} className={`nav-link mt-1 ${isActive("/reports") ? "nav-link-active" : ""} ${collapsed ? "justify-center px-2" : ""}`} title={collapsed ? "Reports" : undefined}>
          <BarChart size={18} className={isActive("/reports") ? "text-primary" : ""} />
          {!collapsed && <span>Reports</span>}
        </NavLink>

        {/* Documents Group */}
        {!collapsed ? <Collapsible open={openGroups.includes("documents")} onOpenChange={() => toggleGroup("documents")}>
            <CollapsibleTrigger className={`nav-link w-full justify-between mt-1 ${isGroupActive(["/explorer", "/documents", "/protocols"]) ? "text-primary" : ""}`}>
              <div className="flex items-center gap-3">
                <FileText size={18} />
                <span>Documents</span>
              </div>
              <ChevronDown size={14} className={`transition-transform duration-200 ${openGroups.includes("documents") ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="ml-5 mt-0.5 space-y-0.5 border-l border-border pl-3">
              <NavLink to="/explorer" onClick={handleNavClick} className={`nav-link text-[13px] py-1.5 ${isActive("/explorer") ? "nav-link-active" : ""}`}>
                <FolderOpen size={16} className={isActive("/explorer") ? "text-primary" : ""} />
                <span>Explorer</span>
              </NavLink>
              <NavLink to="/documents" onClick={handleNavClick} className={`nav-link text-[13px] py-1.5 ${isActive("/documents") ? "nav-link-active" : ""}`}>
                <FileText size={16} className={isActive("/documents") ? "text-primary" : ""} />
                <span>Signatures</span>
              </NavLink>
              <NavLink to="/protocols" onClick={handleNavClick} className={`nav-link text-[13px] py-1.5 ${isActive("/protocols") ? "nav-link-active" : ""}`}>
                <ClipboardList size={16} className={isActive("/protocols") ? "text-primary" : ""} />
                <span>Protocols</span>
              </NavLink>
            </CollapsibleContent>
          </Collapsible> : <NavLink to="/documents" onClick={handleNavClick} className={`nav-link justify-center px-2 ${isActive("/documents") ? "nav-link-active" : ""}`} title="Documents">
            <FileText size={18} className={isActive("/documents") ? "text-primary" : ""} />
          </NavLink>}

        {/* Collaboration Group */}
        {!collapsed ? <Collapsible open={openGroups.includes("collaboration")} onOpenChange={() => toggleGroup("collaboration")}>
            <CollapsibleTrigger className={`nav-link w-full justify-between mt-1 ${isGroupActive(["/communication", "/calendar", "/tasks"]) ? "text-primary" : ""}`}>
              <div className="flex items-center gap-3">
                <MessageSquare size={18} />
                <span>Collaboration</span>
              </div>
              <ChevronDown size={14} className={`transition-transform duration-200 ${openGroups.includes("collaboration") ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="ml-5 mt-0.5 space-y-0.5 border-l border-border pl-3">
              <NavLink to="/communication" onClick={handleNavClick} className={`nav-link text-[13px] py-1.5 ${isActive("/communication") ? "nav-link-active" : ""}`}>
                <MessageSquare size={16} className={isActive("/communication") ? "text-primary" : ""} />
                <span>Communication</span>
              </NavLink>
              <NavLink to="/calendar" onClick={handleNavClick} className={`nav-link text-[13px] py-1.5 ${isActive("/calendar") ? "nav-link-active" : ""}`}>
                <Calendar size={16} className={isActive("/calendar") ? "text-primary" : ""} />
                <span>Calendar</span>
              </NavLink>
              <NavLink to="/tasks" onClick={handleNavClick} className={`nav-link text-[13px] py-1.5 ${isActive("/tasks") ? "nav-link-active" : ""}`}>
                <CheckSquare size={16} className={isActive("/tasks") ? "text-primary" : ""} />
                <span>Tasks</span>
              </NavLink>
            </CollapsibleContent>
          </Collapsible> : <NavLink to="/communication" onClick={handleNavClick} className={`nav-link justify-center px-2 ${isActive("/communication") ? "nav-link-active" : ""}`} title="Collaboration">
            <MessageSquare size={18} className={isActive("/communication") ? "text-primary" : ""} />
          </NavLink>}

        {/* Administration Section */}
        <div className="mt-4 pt-3 border-t border-border">
          {!collapsed && <p className="text-[11px] font-medium text-muted-foreground px-3 mb-1.5 uppercase tracking-wider">Admin</p>}
          <div className="space-y-0.5">
            <NavLink to="/users" onClick={handleNavClick} className={`nav-link ${isActive("/users") ? "nav-link-active" : ""} ${collapsed ? "justify-center px-2" : ""}`} title={collapsed ? "Users" : undefined}>
              <Users size={18} className={isActive("/users") ? "text-primary" : ""} />
              {!collapsed && <span>Users</span>}
            </NavLink>
            <NavLink to="/security" onClick={handleNavClick} className={`nav-link ${isActive("/security") ? "nav-link-active" : ""} ${collapsed ? "justify-center px-2" : ""}`} title={collapsed ? "Security" : undefined}>
              <Shield size={18} className={isActive("/security") ? "text-primary" : ""} />
              {!collapsed && <span>Security</span>}
            </NavLink>
            <NavLink to="/settings" onClick={handleNavClick} className={`nav-link ${isActive("/settings") ? "nav-link-active" : ""} ${collapsed ? "justify-center px-2" : ""}`} title={collapsed ? "Settings" : undefined}>
              <Settings size={18} className={isActive("/settings") ? "text-primary" : ""} />
              {!collapsed && <span>Settings</span>}
            </NavLink>
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        {!collapsed ? <div className="flex items-center gap-3 px-2">
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
            <button onClick={handleSignOut} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive transition-colors" title="Sign out">
              <LogOut size={16} />
            </button>
          </div> : <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <span className="text-sm font-medium text-foreground">
                {profile?.first_name?.[0] || "U"}
              </span>
            </div>
            <button onClick={handleSignOut} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive transition-colors" title="Sign out">
              <LogOut size={16} />
            </button>
          </div>}
      </div>
    </>;
  return <>
      {/* Desktop Sidebar */}
      <aside className={`fixed left-0 top-0 h-screen bg-sidebar border-r border-border flex-col transition-all duration-200 z-50 hidden lg:flex ${collapsed ? "w-16" : "w-56"}`}>
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && <div className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 lg:hidden" onClick={onMobileClose} />}

      {/* Mobile Sidebar */}
      <aside className={`fixed left-0 top-0 h-screen w-64 bg-sidebar border-r border-border flex flex-col transition-transform duration-200 z-50 lg:hidden ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {sidebarContent}
      </aside>
    </>;
}