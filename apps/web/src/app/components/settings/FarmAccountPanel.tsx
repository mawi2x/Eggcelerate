import { LoaderCircle, Upload } from "lucide-react";
import { useRef, useState } from "react";
import {
  ACCOUNT_HOLDER_MAX,
  type Account,
  accountInitials,
  DISPLAY_NAME_MAX,
  FARM_NAME_MAX,
  resolveDisplayName,
} from "../../data/account";
import { prepareProfilePhoto } from "../../features/account/profile-photo";
import { FieldCounterLabel } from "../FieldCounterLabel";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  BORDER,
  Field,
  GroupLabel,
  inputClass,
  inputStyle,
  labelStyle,
  MUTED,
  PanelHeader,
  RUST,
  TEXT,
} from "./tokens";

interface Props {
  account: Account;
  onPhotoPreparingChange?: (busy: boolean) => void;
  onUpdateAccount: (patch: Partial<Account>) => void;
  temperatureUnit: "c" | "f";
  timeZone: "gmt8" | "gmt0" | "est" | "pst";
  onTemperatureUnitChange: (value: "c" | "f") => void;
  onTimeZoneChange: (value: "gmt8" | "gmt0" | "est" | "pst") => void;
}

export function FarmAccountPanel({
  account,
  onPhotoPreparingChange,
  onUpdateAccount,
  temperatureUnit,
  timeZone,
  onTemperatureUnitChange,
  onTimeZoneChange,
}: Props) {
  const photoInput = useRef<HTMLInputElement>(null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const uploadPhoto = async (file: File) => {
    setPhotoError(null);
    setPreparingPhoto(true);
    onPhotoPreparingChange?.(true);
    try {
      onUpdateAccount({ profilePhoto: await prepareProfilePhoto(file) });
    } catch (error) {
      setPhotoError(
        error instanceof Error
          ? error.message
          : "Photo could not be added. Try another image.",
      );
    } finally {
      setPreparingPhoto(false);
      onPhotoPreparingChange?.(false);
    }
  };

  return (
    <div>
      <PanelHeader
        id="settings-panel-account"
        title="Farm & Account"
        description="Who you are, what your farm is called, and how units read."
      />

      {/* Identity strip */}
      <div
        className="flex min-w-0 flex-wrap items-center gap-3.5 py-5"
        style={{ borderBottom: `var(--border-width-hairline) solid ${BORDER}` }}
      >
        <span
          className="flex shrink-0 items-center justify-center rounded-full"
          style={{
            width: 56,
            height: 56,
            backgroundColor: RUST,
            color: "var(--on-brand)",
            fontSize: "var(--type-heading-lg)",
            fontWeight: "var(--weight-bold)",
          }}
        >
          {account.profilePhoto ? (
            <img
              src={account.profilePhoto}
              alt="Your profile"
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            accountInitials(account)
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="max-w-full break-words"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--type-heading-sm)",
              fontWeight: "var(--weight-bold)",
              color: TEXT,
              overflowWrap: "anywhere",
            }}
          >
            {resolveDisplayName(account)}
          </p>
          <p
            className="max-w-full break-words"
            style={{
              fontSize: "var(--type-body-sm)",
              color: MUTED,
              overflowWrap: "anywhere",
            }}
          >
            {account.farmName}
          </p>
        </div>
        <div className="w-full space-y-2 sm:w-auto">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-[12px]"
              disabled={preparingPhoto}
              aria-busy={preparingPhoto}
              onClick={() => photoInput.current?.click()}
            >
              {preparingPhoto ? (
                <LoaderCircle
                  size={16}
                  className="animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Upload size={16} aria-hidden="true" />
              )}
              <span>
                {preparingPhoto
                  ? "Preparing photo…"
                  : account.profilePhoto
                    ? "Change photo"
                    : "Upload photo"}
              </span>
            </Button>
            {account.profilePhoto && (
              <Button
                type="button"
                variant="ghost"
                className="rounded-[12px]"
                disabled={preparingPhoto}
                onClick={() => {
                  setPhotoError(null);
                  onUpdateAccount({ profilePhoto: null });
                }}
              >
                <span>Remove</span>
              </Button>
            )}
          </div>
          <input
            ref={photoInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Choose profile photo"
            className="hidden"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void uploadPhoto(file);
            }}
          />
          <p style={{ fontSize: "var(--type-caption)", color: MUTED }}>
            JPG, PNG or WebP · Max 2 MB
          </p>
          {photoError && (
            <p
              role="alert"
              style={{
                fontSize: "var(--type-caption)",
                color: "var(--status-danger-fg)",
              }}
            >
              {photoError}
            </p>
          )}
        </div>
      </div>

      <div className="pt-6">
        <GroupLabel>Profile</GroupLabel>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
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
              onChange={(e) =>
                onUpdateAccount({ accountHolder: e.target.value })
              }
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
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Temperature Units" htmlFor="units">
            <Select
              value={temperatureUnit}
              onValueChange={(value) =>
                onTemperatureUnitChange(value as "c" | "f")
              }
            >
              <SelectTrigger
                id="units"
                className={inputClass}
                style={inputStyle}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="c">Celsius (°C)</SelectItem>
                <SelectItem value="f">Fahrenheit (°F)</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Time Zone" htmlFor="tz">
            <Select
              value={timeZone}
              onValueChange={(value) =>
                onTimeZoneChange(value as Props["timeZone"])
              }
            >
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
