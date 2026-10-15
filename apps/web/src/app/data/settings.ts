import { type Account, initialAccount } from "./account";

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
  samplingIntervalSeconds?: 5 | 10 | 15 | 30;
  temperatureUnit: "c" | "f";
  timeZone: "gmt8" | "gmt0" | "est" | "pst";
};

export const initialSettings: SettingsPreferences = {
  account: initialAccount,
  notifications: {
    enabled: {
      temp: true,
      humidity: true,
      water: true,
      offline: true,
      batteryLow: false,
      batteryFull: false,
      power: false,
      candling: false,
      turning: true,
      hatch: true,
    },
    sms: true,
    email: true,
    phone: "",
    emailAddress: "",
  },
  samplingIntervalSeconds: 15,
  temperatureUnit: "c",
  timeZone: "gmt8",
};
