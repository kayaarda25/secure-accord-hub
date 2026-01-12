import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
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
  Building2,
  Users,
  Globe,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Finanzen", href: "/finances", icon: Wallet },
  { name: "OPEX", href: "/opex", icon: Receipt },
  { name: "Verträge & Dokumente", href: "/documents", icon: FileText },
  { name: "Kommunikation", href: "/communication", icon: MessageSquare },
  { name: "Kalender & Fristen", href: "/calendar", icon: Calendar },
];

const secondaryNav = [
  { name: "Partner", href: "/partners", icon: Building2 },
  { name: "Behörden", href: "/authorities", icon: Globe },
  { name: "Benutzer", href: "/users", icon: Users },
  { name: "Sicherheit", href: "/security", icon: Shield },
  { name: "Einstellungen", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 z-50 ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center glow-gold">
              <span className="text-accent font-bold text-lg">M</span>
            </div>
            <div>
              <h1 className="font-semibold text-sidebar-accent-foreground text-sm">
                MGI × AFRIKA
              </h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                State Cooperation
              </p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mx-auto glow-gold">
            <span className="text-accent font-bold text-lg">M</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-accent-foreground transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        <div className="space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <NavLink
                key={item.name}
                to={item.href}
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
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-xs font-medium text-primary-foreground">AD</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-accent-foreground truncate">
                Admin User
              </p>
              <p className="text-xs text-muted-foreground truncate">
                Staatliche Verwaltung
              </p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-xs font-medium text-primary-foreground">AD</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
