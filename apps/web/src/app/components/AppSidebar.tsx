import { useState } from "react";
import {
  LayoutGrid,
  LineChart,
  Bell,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react";
import { Notepad } from "@phosphor-icons/react";
import { IncubatorDeviceIcon } from "./icons";
import { useIsMobile } from "./ui/use-mobile";
import { Account, accountInitials, resolveDisplayName } from "../data/account";
import logoApp from "../../imports/logo-app.webp";

export type ScreenId =
  | "overview"
  | "incubators"
  | "candling"
  | "detail"
  | "trends"
  | "alerts"
  | "settings"
  | "login"
  | "onboarding";

interface NavItem {
  id: ScreenId;
  label: string;
  mobileLabel?: string;
  Icon: React.ComponentType<{ size?: number | string; color?: string; className?: string; strokeWidth?: number | string }>;
}

const items: NavItem[] = [
  { id: "overview", label: "Overview", Icon: LayoutGrid },
  { id: "incubators", label: "Incubators", Icon: IncubatorDeviceIcon },
  { id: "candling", label: "Candling Logs", mobileLabel: "Candling", Icon: Notepad },
  { id: "trends", label: "Trends", mobileLabel: "Analytics", Icon: LineChart },
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
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  // The per-incubator config page is a sub-view of the Incubators tab.
  const activeTab: ScreenId = active === "detail" ? "incubators" : active;

  if (isMobile) {
    // Keep the bottom navigation to five targets. Less-frequent destinations
    // remain one tap away in the More menu instead of becoming tiny targets.
    const mobileItems = items.filter(({ id }) => ["overview", "incubators", "candling", "trends"].includes(id));
    const moreItems = items.filter(({ id }) => ["alerts", "settings"].includes(id));
    const moreActive = moreItems.some(({ id }) => activeTab === id);

    return (
      <>
        <nav
          aria-label="Primary navigation"
          className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch justify-around border-t px-2 pb-[env(safe-area-inset-bottom)]"
          style={{ backgroundColor: "var(--surface-card)", borderColor: "var(--border-subtle)" }}
        >
          {mobileItems.map(({ id, label, mobileLabel, Icon }) => {
            const isActive = activeTab === id;
            const displayLabel = mobileLabel ?? label;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate(id)}
                className="relative flex flex-1 cursor-pointer flex-col items-center gap-1 py-2.5 transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                style={{ color: isActive ? "var(--brand-primary)" : "var(--text-secondary)" }}
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon size={22} strokeWidth={isActive ? 2.6 : 2} />
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--type-label)",
                    fontWeight: "var(--weight-bold)",
                    lineHeight: "var(--leading-snug)",
                    letterSpacing: "var(--tracking-label)",
                  }}
                >
                  {displayLabel}
                </span>
                {id === "alerts" && alertCount > 0 && (
                  <span
                    className="absolute right-4 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1"
                    style={{
                      backgroundColor: "var(--brand-primary)",
                      color: "var(--on-brand)",
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--type-label)",
                      fontWeight: "var(--weight-bold)",
                      lineHeight: "var(--leading-snug)",
                    }}
                  >
                    {alertCount}
                  </span>
                )}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setMobileMoreOpen((open) => !open)}
            className="relative flex flex-1 cursor-pointer flex-col items-center gap-1 py-2.5 transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            style={{ color: moreActive || mobileMoreOpen ? "var(--brand-primary)" : "var(--text-secondary)" }}
            aria-label="More navigation options"
            aria-haspopup="menu"
            aria-expanded={mobileMoreOpen}
          >
            <MoreHorizontal size={22} strokeWidth={moreActive || mobileMoreOpen ? 2.6 : 2} />
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-label)",
                fontWeight: "var(--weight-bold)",
                lineHeight: "var(--leading-snug)",
                letterSpacing: "var(--tracking-label)",
              }}
            >
              More
            </span>
            {alertCount > 0 && (
              <span
                className="absolute right-4 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1"
                style={{
                  backgroundColor: "var(--brand-primary)",
                  color: "var(--on-brand)",
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--type-label)",
                  fontWeight: "var(--weight-bold)",
                  lineHeight: "var(--leading-snug)",
                }}
              >
                {alertCount}
              </span>
            )}
          </button>
        </nav>

        {mobileMoreOpen && (
          <div
            role="menu"
            aria-label="More navigation options"
            className="fixed right-2 z-50 w-52 rounded-2xl border p-2 shadow-lg"
            style={{
              bottom: "calc(4.5rem + env(safe-area-inset-bottom))",
              backgroundColor: "var(--surface-card)",
              borderColor: "var(--border-subtle)",
            }}
          >
            {moreItems.map(({ id, label, Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMobileMoreOpen(false);
                    onNavigate(id);
                  }}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--nav-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  style={{
                    backgroundColor: isActive ? "var(--local-nav-selected-bg)" : "transparent",
                    color: isActive ? "var(--local-nav-selected-fg)" : "var(--text-secondary)",
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--type-body)",
                    fontWeight: "var(--weight-semibold)",
                  }}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="flex-1">{label}</span>
                  {id === "alerts" && alertCount > 0 && (
                    <span
                      className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5"
                      style={{
                        backgroundColor: "var(--brand-primary)",
                        color: "var(--on-brand)",
                        fontFamily: "var(--font-body)",
                        fontSize: "var(--type-label)",
                        fontWeight: "var(--weight-bold)",
                        lineHeight: "var(--leading-snug)",
                      }}
                    >
                      {alertCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </>
    );
  }

  const RAIL_W = 64;
  const PANEL_W = 256;
  const mainItems = items.filter((it) => it.id !== "settings");

  // Circular chevron straddling the sidebar / content dividing line.
  const EdgeToggle = () => (
    <button
      type="button"
      onClick={onToggleCollapsed}
      onMouseEnter={() => setHoverEdge(true)}
      onMouseLeave={() => setHoverEdge(false)}
      onFocus={() => setHoverEdge(true)}
      onBlur={() => setHoverEdge(false)}
      className="absolute z-50 flex cursor-pointer items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
      style={{
        width: 28,
        height: 28,
        top: "50%",
        right: -14,
        transform: "translateY(-50%)",
        backgroundColor: hoverEdge ? "var(--brand-primary)" : "var(--surface-card)",
        border: `1px solid ${hoverEdge ? "var(--brand-primary)" : "var(--border-subtle)"}`,
        color: hoverEdge ? "var(--on-brand)" : "var(--text-secondary)",
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
  const expandedNavButton = (id: ScreenId, label: string, Icon: NavItem["Icon"], badge?: number) => {
    const isActive = activeTab === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => onNavigate(id)}
        className={`relative flex cursor-pointer items-center gap-3 rounded-xl border px-3 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 ${isActive ? "border-[var(--global-nav-selected-bg)] bg-[var(--global-nav-selected-bg)] text-[var(--global-nav-selected-fg)]" : "border-transparent bg-transparent text-[var(--text-secondary)] hover:border-[var(--nav-hover-border)] hover:bg-[var(--nav-hover-bg)] hover:text-[var(--brand-primary)]"}`}
        style={{
          height: 40,
          width: "100%",
          fontFamily: "var(--font-body)",
          fontSize: "var(--type-body)",
          fontWeight: "var(--weight-semibold)",
          lineHeight: "var(--leading-snug)",
        }}
        aria-label={label}
        aria-current={isActive ? "page" : undefined}
      >
        <Icon size={20} strokeWidth={isActive ? 2.6 : 2} />
        <span className="flex-1 truncate text-left">{label}</span>
        {badge !== undefined && badge > 0 && (
          <span
            className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5"
            style={{
              backgroundColor: isActive ? "var(--surface-card)" : "var(--brand-primary)",
              color: isActive ? "var(--brand-primary)" : "var(--on-brand)",
              fontFamily: "var(--font-body)",
              fontSize: "var(--type-label)",
              fontWeight: "var(--weight-bold)",
              lineHeight: "var(--leading-snug)",
            }}
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
        style={{ width: RAIL_W, backgroundColor: "var(--surface-card)", borderRight: "1px solid var(--border-subtle)" }}
      >
        <EdgeToggle />

        {/* ① Logo → toggle hover-swap (Variant A / Variant B) */}
        <div className="flex items-center justify-center pt-5">
          <button
            type="button"
            onClick={onToggleCollapsed}
            onMouseEnter={() => setHoverToggle(true)}
            onMouseLeave={() => setHoverToggle(false)}
            onFocus={() => setHoverToggle(true)}
            onBlur={() => setHoverToggle(false)}
            className="relative flex cursor-pointer items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1"
            style={{
              width: 36,
              height: 36,
              backgroundColor: hoverToggle ? "var(--surface-muted)" : "transparent",
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
              style={{ color: "var(--brand-primary)", opacity: hoverToggle ? 1 : 0 }}
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
                type="button"
                onClick={() => onNavigate(id)}
                className="relative flex cursor-pointer items-center justify-center rounded-xl transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1"
                style={{
                  width: 40,
                  height: 40,
                  backgroundColor: isActive ? "var(--global-nav-selected-bg)" : "transparent",
                  color: isActive ? "var(--global-nav-selected-fg)" : "var(--text-muted)",
                }}
                title={label}
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon size={20} strokeWidth={isActive ? 2.6 : 2} />
                {id === "alerts" && alertCount > 0 && (
                  <span
                    className="absolute rounded-full"
                    style={{ top: 7, right: 7, width: 8, height: 8, backgroundColor: "var(--status-danger-fg)", border: "1.5px solid var(--surface-card)" }}
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
            type="button"
            onClick={() => onNavigate("settings")}
            className="relative flex cursor-pointer items-center justify-center rounded-xl transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1"
            style={{
              width: 40,
              height: 40,
              backgroundColor: activeTab === "settings" ? "var(--global-nav-selected-bg)" : "transparent",
              color: activeTab === "settings" ? "var(--global-nav-selected-fg)" : "var(--text-muted)",
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
              backgroundColor: "var(--brand-primary)",
              color: "var(--on-brand)",
              fontFamily: "var(--font-body)",
              fontSize: "var(--type-caption)",
              fontWeight: "var(--weight-bold)",
              lineHeight: "var(--leading-normal)",
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
      style={{ backgroundColor: "var(--surface-card)", borderColor: "var(--border-subtle)", width: PANEL_W }}
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
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--type-heading-md)",
            fontWeight: "var(--weight-bold)",
            lineHeight: "var(--leading-snug)",
            color: "var(--text-primary)",
          }}
        >
          Eggcelerate
        </span>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1"
          style={{ width: 32, height: 32, color: "var(--text-secondary)" }}
          title="Collapse sidebar"
          aria-label="Collapse sidebar"
          aria-expanded
        >
          <PanelLeftClose size={20} strokeWidth={2.2} />
        </button>
      </div>

      {/* Primary navigation */}
      <nav className="mt-6 flex flex-col gap-1.5 px-3">
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
        style={{ backgroundColor: "var(--surface-card)", borderColor: "var(--border-subtle)", padding: 16 }}
      >
        <span
          className="flex shrink-0 items-center justify-center rounded-full"
          style={{
            width: 36,
            height: 36,
            backgroundColor: "var(--brand-primary)",
            color: "var(--on-brand)",
            fontFamily: "var(--font-body)",
            fontSize: "var(--type-body-sm)",
            fontWeight: "var(--weight-bold)",
            lineHeight: "var(--leading-normal)",
          }}
        >
          {accountInitials(account)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className="truncate"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--type-body)",
              fontWeight: "var(--weight-semibold)",
              lineHeight: "var(--leading-snug)",
              color: "var(--text-primary)",
            }}
            title={resolveDisplayName(account)}
          >
            {resolveDisplayName(account)}
          </span>
          <span
            className="truncate"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--type-caption)",
              fontWeight: "var(--weight-medium)",
              lineHeight: "var(--leading-normal)",
              color: "var(--text-secondary)",
            }}
            title={account.farmName}
          >
            {account.farmName}
          </span>
        </span>
      </div>
    </aside>
  );
}
