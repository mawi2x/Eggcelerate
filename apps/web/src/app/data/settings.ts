import { initialAccount, type Account } from "./account";

export type NotificationPreferences = {
  enabled: Record<string, boolean>;
  sms: boolean;
  email: boolean;
  phone: string;
  emailAddress: string;
};

export type SettingsPreferences = {
  account: Account;
  notifications: NotificationPreferences;
  temperatureUnit: "c" | "f";
  timeZone: "gmt8" | "gmt0" | "est" | "pst";
};

export const initialSettings: SettingsPreferences = {
  account: initialAccount,
  notifications: {
    enabled: {
      temp: true, humidity: true, water: true, offline: true, batteryLow: true,
      batteryFull: false, power: true, candling: false, turning: true, hatch: true,
    },
    sms: true,
    email: true,
    phone: "",
    emailAddress: "",
  },
  temperatureUnit: "c",
  timeZone: "gmt8",
};
