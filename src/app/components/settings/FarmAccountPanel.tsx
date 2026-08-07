import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { FieldCounterLabel } from "../FieldCounterLabel";
import {
  Account,
  ACCOUNT_HOLDER_MAX,
  DISPLAY_NAME_MAX,
  FARM_NAME_MAX,
  accountInitials,
  resolveDisplayName,
} from "../../data/account";
import { PanelHeader, GroupLabel, Field, inputClass, inputStyle, labelStyle, RUST, BORDER, MUTED, TEXT } from "./tokens";

interface Props {
  account: Account;
  onUpdateAccount: (patch: Partial<Account>) => void;
}

export function FarmAccountPanel({ account, onUpdateAccount }: Props) {
  return (
    <div>
      <PanelHeader title="Farm & Account" description="Who you are, what your farm is called, and how units read." />

      {/* Identity strip */}
      <div className="flex items-center gap-3.5 py-5" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <span
          className="flex shrink-0 items-center justify-center rounded-full"
          style={{ width: 56, height: 56, backgroundColor: RUST, color: "#FFFFFF", fontSize: 20, fontWeight: 700 }}
        >
          {accountInitials(account)}
        </span>
        <div className="min-w-0">
          <p className="truncate" style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>
            {resolveDisplayName(account)}
          </p>
          <p className="truncate" style={{ fontSize: 13, color: MUTED }}>
            {account.farmName}
          </p>
        </div>
      </div>

      <div className="pt-6">
        <GroupLabel>Profile</GroupLabel>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            labelSlot={
              <FieldCounterLabel
                htmlFor="farm"
                label="Farm Name"
                value={account.farmName}
                max={FARM_NAME_MAX}
                labelStyle={labelStyle}
              />
            }
          >
            <Input
              id="farm"
              value={account.farmName}
              onChange={(e) => onUpdateAccount({ farmName: e.target.value })}
              maxLength={FARM_NAME_MAX}
              className={inputClass}
              style={inputStyle}
            />
          </Field>

          <Field
            labelSlot={
              <FieldCounterLabel
                htmlFor="owner"
                label="Account Holder"
                value={account.accountHolder}
                max={ACCOUNT_HOLDER_MAX}
                labelStyle={labelStyle}
              />
            }
          >
            <Input
              id="owner"
              value={account.accountHolder}
              onChange={(e) => onUpdateAccount({ accountHolder: e.target.value })}
              maxLength={ACCOUNT_HOLDER_MAX}
              placeholder="Farmer Juan Dela Cruz"
              className={inputClass}
              style={inputStyle}
            />
          </Field>

          <Field
            hint={`Short name for the sidebar profile card (max ${DISPLAY_NAME_MAX} chars)`}
            labelSlot={
              <FieldCounterLabel
                htmlFor="displayName"
                label="Display Name"
                value={account.displayName}
                max={DISPLAY_NAME_MAX}
                labelStyle={labelStyle}
              />
            }
          >
            <Input
              id="displayName"
              value={account.displayName}
              onChange={(e) => onUpdateAccount({ displayName: e.target.value })}
              maxLength={DISPLAY_NAME_MAX}
              placeholder="Farmer Juan"
              className={inputClass}
              style={inputStyle}
            />
          </Field>
        </div>
      </div>

      <div className="pt-7">
        <GroupLabel>Regional</GroupLabel>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Temperature Units" htmlFor="units">
            <Select defaultValue="c">
              <SelectTrigger id="units" className={inputClass} style={inputStyle}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="c">Celsius (°C)</SelectItem>
                <SelectItem value="f">Fahrenheit (°F)</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Time Zone" htmlFor="tz">
            <Select defaultValue="gmt8">
              <SelectTrigger id="tz" className={inputClass} style={inputStyle}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gmt8">GMT+8 (Manila)</SelectItem>
                <SelectItem value="gmt0">GMT+0 (London)</SelectItem>
                <SelectItem value="est">GMT−5 (New York)</SelectItem>
                <SelectItem value="pst">GMT−8 (Los Angeles)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>
    </div>
  );
}
