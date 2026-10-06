import { Cpu, Loader2, TriangleAlert } from "lucide-react";
import { CHAMBER_NAME_MAX } from "../../data/account";
import { FieldCounterLabel } from "../FieldCounterLabel";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

import { inputStyle, MUTED, RUST } from "./presentation";
import type { useCreateIncubator } from "./useCreateIncubator";

export function CreateIncubatorDialog({
  model,
  isAddingIncubator,
}: {
  model: ReturnType<typeof useCreateIncubator>;
  isAddingIncubator: boolean;
}) {
  const {
    open,
    setOpen,
    deviceId,
    setDeviceId,
    name,
    setName,
    connecting,
    connectError,
    setConnectError,
    handleAdd,
  } = model;
  return (
    <>
      {/* Add incubator dialog */}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!connecting) {
            setOpen(o);
            if (!o) setConnectError(null);
          }
        }}
      >
        <DialogContent className="incubators-typography rounded-2xl md:max-w-md">
          <DialogHeader>
            <DialogTitle
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--type-heading-md)",
                fontWeight: "var(--weight-bold)",
                lineHeight: "var(--leading-snug)",
              }}
            >
              Add Incubator
            </DialogTitle>
            <DialogDescription
              style={{
                fontSize: "var(--type-body)",
                lineHeight: "var(--leading-normal)",
              }}
            >
              Enter the Device ID generated on your physical incubator screen
              and name this chamber.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {connectError && (
              <div
                className="flex items-start gap-2.5 rounded-xl px-3.5 py-3"
                style={{
                  backgroundColor: "var(--status-danger-bg)",
                  border:
                    "var(--border-width-hairline) solid var(--border-blush)",
                }}
                role="alert"
              >
                <TriangleAlert
                  size={16}
                  color="var(--status-danger-fg)"
                  className="mt-0.5 shrink-0"
                />
                <div>
                  <p
                    style={{
                      fontSize: "var(--type-body-sm)",
                      fontWeight: "var(--weight-bold)",
                      color: "var(--status-danger-fg)",
                    }}
                  >
                    Connection Failed
                  </p>
                  <p
                    style={{
                      fontSize: "var(--type-caption)",
                      color: "var(--status-danger-fg)",
                      lineHeight: 1.45,
                      marginTop: 2,
                    }}
                  >
                    {connectError === "invalid"
                      ? `Could not find an incubator with Device ID '${deviceId.trim()}'. Please check the display screen on your incubator and try again.`
                      : `Device '${deviceId.trim()}' is offline. Please make sure your incubator is powered on and connected to WiFi.`}
                  </p>
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="deviceId">Device ID</Label>
              <div className="relative mt-1.5">
                <Cpu
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: MUTED }}
                />
                <Input
                  id="deviceId"
                  value={deviceId}
                  onChange={(e) => {
                    setDeviceId(
                      e.target.value.replace(/[^A-Za-z0-9-]/g, "").slice(0, 20),
                    );
                    if (connectError) setConnectError(null);
                  }}
                  maxLength={20}
                  disabled={connecting}
                  placeholder="EGG-1015"
                  className="rounded-xl pl-9"
                  style={{
                    ...inputStyle,
                    borderColor: connectError
                      ? "var(--status-danger-fg)"
                      : inputStyle.borderColor,
                  }}
                  aria-invalid={!!connectError}
                />
              </div>
              {connecting && (
                <p
                  className="mt-2 flex items-center gap-1.5"
                  style={{
                    fontSize: "var(--type-caption)",
                    color: "var(--brand-primary-hover)",
                    fontWeight: "var(--weight-semibold)",
                  }}
                >
                  <Loader2 size={13} className="animate-spin" /> Verifying
                  hardware ID and establishing connection...
                </p>
              )}
            </div>
            <div>
              <FieldCounterLabel
                htmlFor="name"
                label="Chamber Name"
                value={name}
                max={CHAMBER_NAME_MAX}
              />
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={CHAMBER_NAME_MAX}
                disabled={connecting}
                placeholder="Chamber Thirteen"
                className="mt-1.5 rounded-xl"
                style={inputStyle}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-full"
              style={{
                height: "var(--incubator-action-height)",
                fontSize: "var(--type-button-label)",
                fontWeight: "var(--weight-bold)",
                lineHeight: "var(--leading-button)",
              }}
              disabled={connecting || isAddingIncubator}
              onClick={() => setOpen(false)}
            >
              <span>Cancel</span>
            </Button>
            <Button
              className="rounded-full"
              disabled={connecting || isAddingIncubator}
              aria-busy={connecting || isAddingIncubator}
              onClick={() => void handleAdd()}
              style={{
                backgroundColor: RUST,
                color: "var(--on-brand)",
                height: "var(--incubator-action-height)",
                fontSize: "var(--type-button-label)",
                fontWeight: "var(--weight-bold)",
                lineHeight: "var(--leading-button)",
              }}
            >
              {connecting || isAddingIncubator ? (
                <>
                  <Loader2 size={16} className="animate-spin" />{" "}
                  <span>Connecting to Incubator...</span>
                </>
              ) : connectError ? (
                <span>{"Retry Connection"}</span>
              ) : (
                <span>{"Connect Incubator"}</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
