import { useState } from "react";
import type { NotificationPreferences } from "../../data/settings";
import { Input } from "../ui/input";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "../ui/segmented-control";
import { Switch } from "../ui/switch";
import {
  BORDER,
  CRIT,
  Field,
  GroupLabel,
  inputClass,
  inputStyle,
  MUTED,
  PanelHeader,
  SettingRow,
  TEXT,
} from "./tokens";

// E.164: leading "+", country code 1-9, then 10-14 digits (max 15 total).
const PHONE_RE = /^\+[1-9]\d{1,14}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface Trigger {
  id: string;
  label: string;
  hint: string;
  toastLabel: string;
}

interface TriggerGroup {
  id: string;
  title: string;
  triggers: Trigger[];
}

const triggerGroups: TriggerGroup[] = [
  {
    id: "environment",
    title: "Critical Environment Alerts",
    triggers: [
      {
        id: "temp",
        label: "Temperature out of range",
        hint: "Fires the moment a chamber drifts past its Mode's target band.",
        toastLabel: "Temperature alerts",
      },
      {
        id: "humidity",
        label: "Humidity out of range",
        hint: "Fires on sustained deviation from the target humidity band.",
        toastLabel: "Humidity alerts",
      },
      {
        id: "water",
        label: "Water reservoir critical low",
        hint: "Warns before the humidifier runs dry.",
        toastLabel: "Water reservoir alerts",
      },
    ],
  },
  {
    id: "hardware",
    title: "Hardware & Power",
    triggers: [
      {
        id: "offline",
        label: "Device connection lost",
        hint: "No telemetry received for more than 2 minutes.",
        toastLabel: "Offline device alerts",
      },
      {
        id: "batteryLow",
        label: "Battery low (< 20%)",
        hint: "",
        toastLabel: "Low battery alerts",
      },
      {
        id: "batteryFull",
        label: "Battery fully charged",
        hint: "",
        toastLabel: "Full charge alerts",
      },
      {
        id: "power",
        label: "Power source switched",
        hint: "Mains ↔ battery transitions.",
        toastLabel: "Power source alerts",
      },
    ],
  },
  {
    id: "schedule",
    title: "Schedule Reminders",
    triggers: [
      {
        id: "candling",
        label: "Candling checkpoint due",
        hint: "",
        toastLabel: "Candling reminders",
      },
      {
        id: "turning",
        label: "Egg turning reminders",
        hint: "",
        toastLabel: "Egg turning reminders",
      },
      {
        id: "hatch",
        label: "Hatch day approaching (24h)",
        hint: "",
        toastLabel: "Hatch day alerts",
      },
    ],
  },
];

export function validateNotificationPreferences(
  value: NotificationPreferences,
): string | null {
  if (value.phone.trim() && !PHONE_RE.test(value.phone.trim())) {
    return "Use international phone format, e.g. +639171234567.";
  }
  if (value.emailAddress.trim() && !EMAIL_RE.test(value.emailAddress.trim())) {
    return "Enter a valid notification email address.";
  }
  return null;
}

export function NotificationsPanel({
  value,
  onChange,
  view,
  onViewChange,
}: {
  value: NotificationPreferences;
  onChange: (value: NotificationPreferences) => void;
  view: NotificationPanelView;
  onViewChange: (view: NotificationPanelView) => void;
}) {
  const [phoneErr, setPhoneErr] = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState<string | null>(null);

  const commitPhone = () => {
    const v = value.phone.trim();
    if (!v) {
      setPhoneErr(null);
      return;
    }
    if (!PHONE_RE.test(v)) {
      setPhoneErr("Use international format, e.g. +639171234567");
      return;
    }
    setPhoneErr(null);
  };

  const commitEmail = () => {
    const v = value.emailAddress.trim();
    if (!v) {
      setEmailErr(null);
      return;
    }
    if (!EMAIL_RE.test(v)) {
      setEmailErr("That doesn't look like a valid email address.");
      return;
    }
    setEmailErr(null);
  };

  const toggleNotif = (id: string, _toastLabel: string, enabled: boolean) => {
    onChange({ ...value, enabled: { ...value.enabled, [id]: enabled } });
  };

  return (
    <div>
      <PanelHeader
        id="settings-panel-notifications"
        title="Notifications & Alerts"
        description="Choose how you're notified and what deserves your attention."
      />

      <SegmentedControl
        role="tablist"
        aria-label="Notification settings sections"
        className="mt-5 w-full md:w-auto"
        flush
      >
        <SegmentedControlItem
          id="notification-delivery-tab"
          role="tab"
          aria-selected={view === "delivery"}
          aria-controls="notification-delivery-panel"
          active={view === "delivery"}
          flush
          className="flex-1 md:flex-none"
          onClick={() => onViewChange("delivery")}
        >
          Delivery & contacts
        </SegmentedControlItem>
        <SegmentedControlItem
          id="notification-rules-tab"
          role="tab"
          aria-selected={view === "rules"}
          aria-controls="notification-rules-panel"
          active={view === "rules"}
          flush
          className="flex-1 md:flex-none"
          onClick={() => onViewChange("rules")}
        >
          Alert rules
        </SegmentedControlItem>
      </SegmentedControl>

      {view === "delivery" ? (
        <div
          id="notification-delivery-panel"
          role="tabpanel"
          aria-labelledby="notification-delivery-tab"
          className="pt-5"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <section
              className="rounded-[var(--radius-dialog)] p-4"
              style={{ border: `var(--border-width-hairline) solid ${BORDER}` }}
              aria-labelledby="sms-delivery-title"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3
                    id="sms-delivery-title"
                    style={{
                      fontSize: "var(--type-body)",
                      fontWeight: "var(--weight-bold)",
                      color: TEXT,
                    }}
                  >
                    SMS alerts
                  </h3>
                  <p
                    className="mt-1"
                    style={{ color: MUTED, fontSize: "var(--type-caption)" }}
                  >
                    Critical alerts only.
                  </p>
                </div>
                <Switch
                  checked={value.sms}
                  onCheckedChange={(v) =>
                    onChange({ ...value, sms: Boolean(v) })
                  }
                  aria-label="SMS delivery"
                />
              </div>
              <div className="mt-5">
                <Field label="Phone number" htmlFor="phone">
                  <Input
                    id="phone"
                    type="tel"
                    maxLength={16}
                    value={value.phone}
                    onChange={(e) => {
                      onChange({ ...value, phone: e.target.value });
                      if (phoneErr) setPhoneErr(null);
                    }}
                    onBlur={commitPhone}
                    placeholder="+1 555 000 1234"
                    className={inputClass}
                    style={{
                      ...inputStyle,
                      borderColor: phoneErr ? CRIT : inputStyle.borderColor,
                    }}
                  />
                  {phoneErr && (
                    <p
                      className="mt-1.5"
                      style={{
                        color: CRIT,
                        fontSize: "var(--type-caption)",
                        fontWeight: "var(--weight-semibold)",
                      }}
                    >
                      {phoneErr}
                    </p>
                  )}
                </Field>
              </div>
            </section>

            <section
              className="rounded-[var(--radius-dialog)] p-4"
              style={{ border: `var(--border-width-hairline) solid ${BORDER}` }}
              aria-labelledby="email-delivery-title"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3
                    id="email-delivery-title"
                    style={{
                      fontSize: "var(--type-body)",
                      fontWeight: "var(--weight-bold)",
                      color: TEXT,
                    }}
                  >
                    Email alerts
                  </h3>
                  <p
                    className="mt-1"
                    style={{ color: MUTED, fontSize: "var(--type-caption)" }}
                  >
                    Full digest, including non-critical events.
                  </p>
                </div>
                <Switch
                  checked={value.email}
                  onCheckedChange={(v) =>
                    onChange({ ...value, email: Boolean(v) })
                  }
                  aria-label="Email delivery"
                />
              </div>
              <div className="mt-5">
                <Field label="Email address" htmlFor="email-addr">
                  <Input
                    id="email-addr"
                    type="email"
                    maxLength={254}
                    value={value.emailAddress}
                    onChange={(e) => {
                      onChange({ ...value, emailAddress: e.target.value });
                      if (emailErr) setEmailErr(null);
                    }}
                    onBlur={commitEmail}
                    placeholder="you@farm.com"
                    className={inputClass}
                    style={{
                      ...inputStyle,
                      borderColor: emailErr ? CRIT : inputStyle.borderColor,
                    }}
                  />
                  {emailErr && (
                    <p
                      className="mt-1.5"
                      style={{
                        color: CRIT,
                        fontSize: "var(--type-caption)",
                        fontWeight: "var(--weight-semibold)",
                      }}
                    >
                      {emailErr}
                    </p>
                  )}
                </Field>
              </div>
            </section>
          </div>

          <p
            className="pt-4"
            style={{ color: MUTED, fontSize: "var(--type-caption)" }}
          >
            SMS and email delivery are provisional in this research demo.
          </p>
        </div>
      ) : (
        <div
          id="notification-rules-panel"
          role="tabpanel"
          aria-labelledby="notification-rules-tab"
          className="pt-5"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {triggerGroups.map((group) => (
              <section
                key={group.id}
                aria-labelledby={`notification-rule-${group.id}`}
                className={`rounded-[var(--radius-dialog)] p-4 ${group.id === "schedule" ? "md:col-span-2" : ""}`}
                style={{
                  border: `var(--border-width-hairline) solid ${BORDER}`,
                }}
              >
                <GroupLabel id={`notification-rule-${group.id}`}>
                  {group.title}
                </GroupLabel>
                <div className="mt-1">
                  {group.triggers.map((trigger) => (
                    <SettingRow
                      key={trigger.id}
                      label={trigger.label}
                      hint={trigger.hint || undefined}
                      control={
                        <Switch
                          checked={value.enabled[trigger.id]}
                          onCheckedChange={(enabled) =>
                            toggleNotif(
                              trigger.id,
                              trigger.toastLabel,
                              Boolean(enabled),
                            )
                          }
                          aria-label={trigger.label}
                        />
                      }
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <p
            className="pt-4"
            style={{ color: MUTED, fontSize: "var(--type-caption)" }}
          >
            Critical environment alerts always push to the in-app bell,
            regardless of the delivery methods you choose.
          </p>
        </div>
      )}
    </div>
  );
}

export type NotificationPanelView = "delivery" | "rules";
