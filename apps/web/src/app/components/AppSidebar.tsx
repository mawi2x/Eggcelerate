import { Notepad } from "@phosphor-icons/react";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  LineChart,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import logoApp from "../../imports/logo-app.webp";
import {
  type Account,
  accountInitials,
  resolveDisplayName,
} from "../data/account";
import type { ScreenId } from "../routing/routes";
import { IncubatorDeviceIcon } from "./icons";
import { useIsMobile } from "./ui/use-mobile";

export type { ScreenId } from "../routing/routes";

interface NavItem {
  id: ScreenId;
  label: string;
  mobileLabel?: string;
  Icon: React.ComponentType<{
    size?: number | string;
    color?: string;
    className?: string;
    strokeWidth?: number | string;
  }>;
}

const items: NavItem[] = [
  { id: "overview", label: "Overview", Icon: LayoutGrid },
  { id: "incubators", label: "Incubators", Icon: IncubatorDeviceIcon },
  {
    id: "candling",
    label: "Candling Logs",
    mobileLabel: "Candling",
    Icon: Notepad,
  },
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

export function AppSidebar({
  active,
  onNavigate,
  alertCount,
  account,
  collapsed,
  onToggleCollapsed,
}: Props) {
  const isMobile = useIsMobile();
  const [hoverToggle, setHoverToggle] = useState(false);
  const [hoverEdge, setHoverEdge] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const mobileMoreMenuRef = useRef<HTMLDivElement>(null);
  const mobileMoreTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isMobile || !mobileMoreOpen) return;

    const closeMenu = () => {
      setMobileMoreOpen(false);
      mobileMoreTriggerRef.current?.focus();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        !target ||
        mobileMoreMenuRef.current?.contains(target) ||
        mobileMoreTriggerRef.current?.contains(target)
      )
        return;
      closeMenu();
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [isMobile, mobileMoreOpen]);

  // The per-incubator config page is a sub-view of the Incubators tab.
  const activeTab: ScreenId = active === "detail" ? "incubators" : active;

  if (isMobile) {
    // Keep the bottom navigation to five targets. Less-frequent destinations
    // remain one tap away in the More menu instead of becoming tiny targets.
    const mobileItems = items.filter(({ id }) =>
      ["overview", "incubators", "candling", "trends"].includes(id),
    );
    const moreItems = items.filter(({ id }) =>
      ["alerts", "settings"].includes(id),
    );
    const moreActive = moreItems.some(({ id }) => activeTab === id);

    return (
      <>
        <nav
          aria-label="Primary navigation"
          className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch justify-around border-t px-2 pb-[env(safe-area-inset-bottom)]"
          style={{
            backgroundColor: "var(--surface-card)",
            borderColor: "var(--border-subtle)",
          }}
        >
          {mobileItems.map(({ id, label, mobileLabel, Icon }) => {
            const isActive = activeTab === id;
            const displayLabel = mobileLabel ?? label;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setMobileMoreOpen(false);
                  onNavigate(id);
                }}
                className="relative flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
              >
                <div
                  className="flex h-8 w-11 max-[19rem]:w-8 items-center justify-center rounded-2xl transition-all duration-200"
                  style={{
                    backgroundColor: isActive
                      ? "var(--global-nav-selected-bg)"
                      : "transparent",
                    color: isActive
                      ? "var(--global-nav-selected-fg)"
                      : "var(--text-secondary)",
                    boxShadow: isActive ? "var(--shadow-lift)" : "none",
                  }}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span
                  className="max-[19rem]:hidden"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--type-label)",
                    fontWeight: isActive
                      ? "var(--weight-bold)"
                      : "var(--weight-semibold)",
                    lineHeight: "var(--leading-snug)",
                    letterSpacing: "var(--tracking-label)",
                    color: isActive
                      ? "var(--brand-primary)"
                      : "var(--text-secondary)",
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
            ref={mobileMoreTriggerRef}
            onClick={() => setMobileMoreOpen((open) => !open)}
            className="relative flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            aria-label="More navigation options"
            aria-haspopup="menu"
            aria-expanded={mobileMoreOpen}
            aria-controls="mobile-more-menu"
          >
            <div
              className="flex h-8 w-11 max-[19rem]:w-8 items-center justify-center rounded-2xl transition-all duration-200"
              style={{
                backgroundColor:
                  moreActive || mobileMoreOpen
                    ? "var(--global-nav-selected-bg)"
                    : "transparent",
                color:
                  moreActive || mobileMoreOpen
                    ? "var(--global-nav-selected-fg)"
                    : "var(--text-secondary)",
                boxShadow:
                  moreActive || mobileMoreOpen ? "var(--shadow-lift)" : "none",
              }}
            >
              <MoreHorizontal
                size={20}
                strokeWidth={moreActive || mobileMoreOpen ? 2.5 : 2}
              />
            </div>
            <span
              className="max-[19rem]:hidden"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-label)",
                fontWeight:
                  moreActive || mobileMoreOpen
                    ? "var(--weight-bold)"
                    : "var(--weight-semibold)",
                lineHeight: "var(--leading-snug)",
                letterSpacing: "var(--tracking-label)",
                color:
                  moreActive || mobileMoreOpen
                    ? "var(--brand-primary)"
                    : "var(--text-secondary)",
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
            ref={mobileMoreMenuRef}
            id="mobile-more-menu"
            role="menu"
            aria-label="More navigation options"
            className="fixed right-2 z-50 w-52 rounded-2xl border p-2 shadow-lg"
            style={{
              bottom: "var(--mobile-bottom-nav-clearance)",
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
                  className="flex min-h-[var(--control-height-default)] w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--nav-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  style={{
                    backgroundColor: isActive
                      ? "var(--local-nav-selected-bg)"
                      : "transparent",
                    color: isActive
                      ? "var(--local-nav-selected-fg)"
                      : "var(--text-secondary)",
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
        width: "var(--control-size-xs)",
        height: "var(--control-size-xs)",
        top: "50%",
        right: -14,
        transform: "translateY(-50%)",
        backgroundColor: hoverEdge
          ? "var(--brand-primary)"
          : "var(--surface-card)",
        border: `var(--border-width-hairline) solid ${hoverEdge ? "var(--brand-primary)" : "var(--border-subtle)"}`,
        color: hoverEdge ? "var(--on-brand)" : "var(--text-secondary)",
        boxShadow: "var(--shadow-edge)",
      }}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-expanded={!collapsed}
    >
      {collapsed ? (
        <ChevronRight size={16} strokeWidth={2.4} />
      ) : (
        <ChevronLeft size={16} strokeWidth={2.4} />
      )}
    </button>
  );

  // Expanded-state row renderer.
  const expandedNavButton = (
    id: ScreenId,
    label: string,
    Icon: NavItem["Icon"],
    badge?: number,
  ) => {
    const isActive = activeTab === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => onNavigate(id)}
        className={`relative flex cursor-pointer items-center gap-3 rounded-xl border px-3 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 ${isActive ? "border-[var(--global-nav-selected-bg)] bg-[var(--global-nav-selected-bg)] text-[var(--global-nav-selected-fg)]" : "border-transparent bg-transparent text-[var(--text-secondary)] hover:border-[var(--nav-hover-border)] hover:bg-[var(--nav-hover-bg)] hover:text-[var(--brand-primary)]"}`}
        style={{
          height: "var(--control-size-nav)",
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
              backgroundColor: isActive
                ? "var(--surface-card)"
                : "var(--brand-primary)",
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
      <div
        className="fixed left-0 top-0 z-40 flex h-full flex-col transition-all duration-200"
        style={{
          width: RAIL_W,
          backgroundColor: "var(--surface-card)",
          borderRight:
            "var(--border-width-hairline) solid var(--border-subtle)",
        }}
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
              width: "var(--control-size-icon)",
              height: "var(--control-size-icon)",
              backgroundColor: hoverToggle
                ? "var(--surface-muted)"
                : "transparent",
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
                width: "var(--control-size-sm)",
                height: "var(--control-size-sm)",
                objectFit: "cover",
                opacity: hoverToggle ? 0 : 1,
              }}
            />
            {/* Variant B — toggle icon overlay */}
            <PanelLeftOpen
              size={20}
              strokeWidth={2.2}
              className="absolute transition-opacity duration-150"
              style={{
                color: "var(--brand-primary)",
                opacity: hoverToggle ? 1 : 0,
              }}
            />
          </button>
        </div>

        {/* ② Nav icons — 16px gap */}
        <nav
          aria-label="Primary navigation"
          className="mt-8 flex flex-col items-center"
          style={{ gap: 16 }}
        >
          {mainItems.map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate(id)}
                className="relative flex cursor-pointer items-center justify-center rounded-xl transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1"
                style={{
                  width: "var(--control-size-nav)",
                  height: "var(--control-size-nav)",
                  backgroundColor: isActive
                    ? "var(--global-nav-selected-bg)"
                    : "transparent",
                  color: isActive
                    ? "var(--global-nav-selected-fg)"
                    : "var(--text-muted)",
                }}
                title={label}
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon size={20} strokeWidth={isActive ? 2.6 : 2} />
                {id === "alerts" && alertCount > 0 && (
                  <span
                    className="absolute rounded-full"
                    style={{
                      top: 7,
                      right: 7,
                      width: 8,
                      height: 8,
                      backgroundColor: "var(--status-danger-fg)",
                      border: "1.5px solid var(--surface-card)",
                    }}
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
              width: "var(--control-size-nav)",
              height: "var(--control-size-nav)",
              backgroundColor:
                activeTab === "settings"
                  ? "var(--global-nav-selected-bg)"
                  : "transparent",
              color:
                activeTab === "settings"
                  ? "var(--global-nav-selected-fg)"
                  : "var(--text-muted)",
            }}
            title="Settings"
            aria-label="Settings"
            aria-current={activeTab === "settings" ? "page" : undefined}
          >
            <Settings
              size={20}
              strokeWidth={activeTab === "settings" ? 2.6 : 2}
            />
          </button>

          {/* Profile avatar */}
          <span
            className="flex shrink-0 items-center justify-center rounded-full"
            style={{
              width: "var(--control-size-sm)",
              height: "var(--control-size-sm)",
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
      </div>
    );
  }

  // ── Full 256px expanded panel ───────────────────────────────────────────────
  return (
    <div
      className="fixed left-0 top-0 z-40 flex h-full flex-col border-r transition-all duration-200"
      style={{
        backgroundColor: "var(--surface-card)",
        borderColor: "var(--border-subtle)",
        width: PANEL_W,
      }}
    >
      <EdgeToggle />

      {/* Brand + inline collapse toggle (Variant C) */}
      <div className="flex items-center gap-2.5 px-4 pt-6">
        <img
          src={logoApp}
          alt="Eggcelerate logo"
          className="shrink-0 object-cover"
          style={{
            width: "var(--control-size-sm)",
            height: "var(--control-size-sm)",
          }}
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
          style={{
            width: "var(--control-size-sm)",
            height: "var(--control-size-sm)",
            color: "var(--text-secondary)",
          }}
          title="Collapse sidebar"
          aria-label="Collapse sidebar"
          aria-expanded
        >
          <PanelLeftClose size={20} strokeWidth={2.2} />
        </button>
      </div>

      {/* Primary navigation */}
      <nav
        aria-label="Primary navigation"
        className="mt-6 flex flex-col gap-1.5 px-3"
      >
        {mainItems.map(({ id, label, Icon }) =>
          expandedNavButton(
            id,
            label,
            Icon,
            id === "alerts" ? alertCount : undefined,
          ),
        )}
      </nav>

      {/* Settings */}
      <div className="mt-auto flex flex-col px-3 pb-2">
        {expandedNavButton("settings", "Settings", Settings)}
      </div>

      {/* Profile row */}
      <div
        className="flex w-full items-center gap-2.5 border-t"
        style={{
          backgroundColor: "var(--surface-card)",
          borderColor: "var(--border-subtle)",
          padding: 16,
        }}
      >
        <span
          className="flex shrink-0 items-center justify-center rounded-full"
          style={{
            width: "var(--control-size-icon)",
            height: "var(--control-size-icon)",
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
            className="max-w-full break-words"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--type-body)",
              fontWeight: "var(--weight-semibold)",
              lineHeight: "var(--leading-snug)",
              color: "var(--text-primary)",
              overflowWrap: "anywhere",
            }}
            title={resolveDisplayName(account)}
          >
            {resolveDisplayName(account)}
          </span>
          <span
            className="max-w-full break-words"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--type-caption)",
              fontWeight: "var(--weight-medium)",
              lineHeight: "var(--leading-normal)",
              color: "var(--text-secondary)",
              overflowWrap: "anywhere",
            }}
            title={account.farmName}
          >
            {account.farmName}
          </span>
        </span>
      </div>
    </div>
  );
}
