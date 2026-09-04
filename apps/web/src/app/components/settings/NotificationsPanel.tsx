import { useState } from "react";
import type { NotificationPreferences } from "../../data/settings";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import {
  CRIT,
  Field,
  GroupLabel,
  inputClass,
  inputStyle,
  MUTED,
  PanelHeader,
  SettingRow,
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
}: {
  value: NotificationPreferences;
  onChange: (value: NotificationPreferences) => void;
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
        title="Notifications & Alerts"
        description="Choose how you're reached and which events are worth interrupting you for."
      />

      <div className="pt-5">
        <GroupLabel>Delivery Channels</GroupLabel>
        <div className="mt-1">
          <SettingRow
            label="SMS"
            hint="Text the number below for critical alerts only."
            control={
              <Switch
                checked={value.sms}
                onCheckedChange={(v) => onChange({ ...value, sms: Boolean(v) })}
                aria-label="SMS delivery"
              />
            }
          />
          <SettingRow
            label="Email"
            hint="Full alert digest, including non-critical events."
            control={
              <Switch
                checked={value.email}
                onCheckedChange={(v) =>
                  onChange({ ...value, email: Boolean(v) })
                }
                aria-label="Email delivery"
              />
            }
          />
        </div>
        <p className="pt-3" style={{ color: MUTED, fontSize: 12 }}>
          SMS and email delivery are provisional in this research demo.
        </p>

        <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2">
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
                style={{ color: CRIT, fontSize: 12, fontWeight: 600 }}
              >
                {phoneErr}
              </p>
            )}
          </Field>
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
                style={{ color: CRIT, fontSize: 12, fontWeight: 600 }}
              >
                {emailErr}
              </p>
            )}
          </Field>
        </div>
      </div>

      {triggerGroups.map((g) => (
        <div key={g.id} className="pt-7">
          <GroupLabel>{g.title}</GroupLabel>
          <div className="mt-1">
            {g.triggers.map((t) => (
              <SettingRow
                key={t.id}
                label={t.label}
                hint={t.hint || undefined}
                control={
                  <Switch
                    checked={value.enabled[t.id]}
                    onCheckedChange={(v) =>
                      toggleNotif(t.id, t.toastLabel, Boolean(v))
                    }
                    aria-label={t.label}
                  />
                }
              />
            ))}
          </div>
        </div>
      ))}

      <p className="pt-4" style={{ color: MUTED, fontSize: 12 }}>
        Critical environment alerts always push to the in-app bell, regardless
        of the channels above.
      </p>
    </div>
  );
}
