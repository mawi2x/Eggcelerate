import { useState } from "react";
import {
  LayoutGrid,
  Boxes,
  LineChart,
  Bell,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useIsMobile } from "./ui/use-mobile";
import { Account, accountInitials, resolveDisplayName } from "../data/account";
import logoApp from "../../imports/logo-app.png";

export type ScreenId =
  | "overview"
  | "incubators"
  | "detail"
  | "trends"
  | "alerts"
  | "settings";

interface NavItem {
  id: ScreenId;
  label: string;
  Icon: typeof LayoutGrid;
}

const items: NavItem[] = [
  { id: "overview", label: "Overview", Icon: LayoutGrid },
  { id: "incubators", label: "Incubators", Icon: Boxes },
  { id: "trends", label: "Trends", Icon: LineChart },
  { id: "alerts", label: "Alerts", Icon: Bell },
  { id: "settings", label: "Settings", Icon: Settings },
];

interface Props {
  active: ScreenId;
  onNavigate: (id: ScreenId) => void;
  alertCount: number;
  account: Account;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function AppSidebar({ active, onNavigate, alertCount, account, collapsed, onToggleCollapsed }: Props) {
  const isMobile = useIsMobile();
  const [hoverToggle, setHoverToggle] = useState(false);
  const [hoverEdge, setHoverEdge] = useState(false);
  // The per-incubator config page is a sub-view of the Incubators tab.
  const activeTab: ScreenId = active === "detail" ? "incubators" : active;

  if (isMobile) {
    return (
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch justify-around border-t px-2 pb-[env(safe-area-inset-bottom)]"
        style={{ backgroundColor: "#FFFFFF", borderColor: "rgba(173,58,29,0.12)" }}
      >
        {items.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className="relative flex flex-1 flex-col items-center gap-1 py-2.5"
              style={{ color: isActive ? "#AD3A1D" : "#8A6B52" }}
            >
              <Icon size={22} strokeWidth={isActive ? 2.6 : 2} />
              <span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
              {id === "alerts" && alertCount > 0 && (
                <span
                  className="absolute right-4 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1"
                  style={{ backgroundColor: "#AD3A1D", color: "#fff", fontSize: 10, fontWeight: 700 }}
                >
                  {alertCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    );
  }

  const RAIL_W = 64;
  const PANEL_W = 256;
  const mainItems = items.filter((it) => it.id !== "settings");

  // Circular chevron straddling the sidebar / content dividing line.
  const EdgeToggle = () => (
    <button
      onClick={onToggleCollapsed}
      onMouseEnter={() => setHoverEdge(true)}
      onMouseLeave={() => setHoverEdge(false)}
      onFocus={() => setHoverEdge(true)}
      onBlur={() => setHoverEdge(false)}
      className="absolute z-50 flex items-center justify-center rounded-full transition-colors focus-visible:outline-none"
      style={{
        width: 28,
        height: 28,
        top: "50%",
        right: -14,
        transform: "translateY(-50%)",
        backgroundColor: hoverEdge ? "#AD3A1D" : "#FFFFFF",
        border: `1px solid ${hoverEdge ? "#AD3A1D" : "#EAE7E1"}`,
        color: hoverEdge ? "#FFFFFF" : "#5A4838",
        boxShadow: "0 2px 6px rgba(45,36,30,0.12)",
      }}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-expanded={!collapsed}
    >
      {collapsed ? <ChevronRight size={16} strokeWidth={2.4} /> : <ChevronLeft size={16} strokeWidth={2.4} />}
    </button>
  );


  // Expanded-state row renderer.
  const expandedNavButton = (id: ScreenId, label: string, Icon: typeof LayoutGrid, badge?: number) => {
    const isActive = activeTab === id;
    return (
      <button
        key={id}
        onClick={() => onNavigate(id)}
        className="relative flex items-center gap-3 rounded-xl px-3 transition-colors"
        style={{
          height: 40,
          width: "100%",
          backgroundColor: isActive ? "#AD3A1D" : "transparent",
          color: isActive ? "#FFFFFF" : "#5C4636",
          fontWeight: 600,
        }}
        aria-label={label}
        aria-current={isActive ? "page" : undefined}
      >
        <Icon size={20} strokeWidth={isActive ? 2.6 : 2} />
        <span className="flex-1 truncate text-left">{label}</span>
        {badge !== undefined && badge > 0 && (
          <span
            className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5"
            style={{ backgroundColor: isActive ? "#FFFFFF" : "#AD3A1D", color: isActive ? "#AD3A1D" : "#fff", fontSize: 11, fontWeight: 700 }}
          >
            {badge}
          </span>
        )}
      </button>
    );
  };

  // ── Slim 56px icon-rail layout ──────────────────────────────────────────────
  if (collapsed) {
    return (
      <aside
        className="fixed left-0 top-0 z-40 flex h-full flex-col transition-all duration-200"
        style={{ width: RAIL_W, backgroundColor: "#FFFFFF", borderRight: "1px solid #EAE7E1" }}
      >
        <EdgeToggle />

        {/* ① Logo → toggle hover-swap (Variant A / Variant B) */}
        <div className="flex items-center justify-center pt-5">
          <button
            onClick={onToggleCollapsed}
            onMouseEnter={() => setHoverToggle(true)}
            onMouseLeave={() => setHoverToggle(false)}
            onFocus={() => setHoverToggle(true)}
            onBlur={() => setHoverToggle(false)}
            className="relative flex items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2"
            style={{
              width: 36,
              height: 36,
              backgroundColor: hoverToggle ? "#F5EDD8" : "transparent",
            }}
            title="Expand sidebar"
            aria-label="Expand sidebar"
            aria-expanded={false}
          >
            {/* Variant A — logo */}
            <img
              src={logoApp}
              alt="Eggcelerate logo"
              className="absolute transition-opacity duration-150"
              style={{
                width: 32,
                height: 32,
                objectFit: "cover",
                opacity: hoverToggle ? 0 : 1,
              }}
            />
            {/* Variant B — toggle icon overlay */}
            <PanelLeftOpen
              size={20}
              strokeWidth={2.2}
              className="absolute transition-opacity duration-150"
              style={{ color: "#AD3A1D", opacity: hoverToggle ? 1 : 0 }}
            />
          </button>
        </div>

        {/* ② Nav icons — 16px gap */}
        <nav className="mt-8 flex flex-col items-center" style={{ gap: 16 }}>
          {mainItems.map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className="relative flex items-center justify-center rounded-xl transition-colors hover:bg-[#F5EDD8]"
                style={{
                  width: 40,
                  height: 40,
                  backgroundColor: isActive ? "#C85A32" : "transparent",
                  color: isActive ? "#FFFFFF" : "#78716C",
                }}
                title={label}
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon size={20} strokeWidth={isActive ? 2.6 : 2} />
                {id === "alerts" && alertCount > 0 && (
                  <span
                    className="absolute rounded-full"
                    style={{ top: 7, right: 7, width: 8, height: 8, backgroundColor: "#D92B0F", border: "1.5px solid #FFFFFF" }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* ③ Bottom anchored: Settings + Profile */}
        <div className="mt-auto flex flex-col items-center gap-3 pb-5">
          {/* Settings */}
          <button
            onClick={() => onNavigate("settings")}
            className="relative flex items-center justify-center rounded-xl transition-colors hover:bg-[#F5EDD8]"
            style={{
              width: 40,
              height: 40,
              backgroundColor: activeTab === "settings" ? "#C85A32" : "transparent",
              color: activeTab === "settings" ? "#FFFFFF" : "#78716C",
            }}
            title="Settings"
            aria-label="Settings"
            aria-current={activeTab === "settings" ? "page" : undefined}
          >
            <Settings size={20} strokeWidth={activeTab === "settings" ? 2.6 : 2} />
          </button>

          {/* Profile avatar */}
          <span
            className="flex shrink-0 items-center justify-center rounded-full"
            style={{
              width: 32,
              height: 32,
              backgroundColor: "#AD3A1D",
              color: "#FFFFFF",
              fontSize: 12,
              fontWeight: 700,
              cursor: "default",
            }}
            title={`${resolveDisplayName(account)} · ${account.farmName}`}
          >
            {accountInitials(account)}
          </span>
        </div>
      </aside>
    );
  }

  // ── Full 256px expanded panel ───────────────────────────────────────────────
  return (
    <aside
      className="fixed left-0 top-0 z-40 flex h-full flex-col border-r transition-all duration-200"
      style={{ backgroundColor: "#FFFFFF", borderColor: "#EAE7E1", width: PANEL_W }}
    >
      <EdgeToggle />

      {/* Brand + inline collapse toggle (Variant C) */}
      <div className="flex items-center gap-2.5 px-4 pt-6">
        <img
          src={logoApp}
          alt="Eggcelerate logo"
          className="shrink-0 object-cover"
          style={{ width: 32, height: 32 }}
        />
        {/* Sized to its own content so the brand never clips. */}
        <span
          className="flex-1 whitespace-nowrap"
          style={{ fontFamily: "Baloo 2, sans-serif", fontSize: 18, fontWeight: 700, color: "#1C1917" }}
        >
          Eggcelerate
        </span>
        <button
          onClick={onToggleCollapsed}
          className="flex shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-[#F5EDD8] focus-visible:outline-none focus-visible:ring-2"
          style={{ width: 32, height: 32, color: "#5A4838" }}
          title="Collapse sidebar"
          aria-label="Collapse sidebar"
          aria-expanded
        >
          <PanelLeftClose size={20} strokeWidth={2.2} />
        </button>
      </div>
      <p className="mt-1 px-4" style={{ color: "#78716C", fontSize: 12 }}>
        Smart incubation monitor
      </p>

      {/* Primary navigation */}
      <nav className="mt-8 flex flex-col gap-1.5 px-3">
        {mainItems.map(({ id, label, Icon }) =>
          expandedNavButton(id, label, Icon, id === "alerts" ? alertCount : undefined),
        )}
      </nav>

      {/* Settings */}
      <div className="mt-auto flex flex-col px-3 pb-2">
        {expandedNavButton("settings", "Settings", Settings)}
      </div>

      {/* Profile row */}
      <div
        className="flex w-full items-center gap-2.5 border-t"
        style={{ backgroundColor: "#FFFFFF", borderColor: "#EAE7E1", padding: 16 }}
      >
        <span
          className="flex shrink-0 items-center justify-center rounded-full"
          style={{ width: 36, height: 36, backgroundColor: "#AD3A1D", color: "#FFFFFF", fontSize: 13, fontWeight: 700 }}
        >
          {accountInitials(account)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className="truncate"
            style={{ fontSize: 14, fontWeight: 600, color: "#2D241E" }}
            title={resolveDisplayName(account)}
          >
            {resolveDisplayName(account)}
          </span>
          <span
            className="truncate"
            style={{ fontSize: 12, fontWeight: 500, color: "#5A4838" }}
            title={account.farmName}
          >
            {account.farmName}
          </span>
        </span>
      </div>
    </aside>
  );
}
