import { Camera, Upload } from "lucide-react";
import { type ReactElement, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { CandlingCamera } from "./CandlingCamera";

export function PhotoActionMenu({
  trigger,
  onUpload,
  onCapture,
}: {
  trigger: ReactElement;
  onUpload: () => void;
  onCapture: (photo: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={6}
          className="w-64 rounded-xl p-1.5"
          style={{
            backgroundColor: "var(--surface-card)",
            borderColor: "var(--border-default)",
            color: "var(--text-primary)",
          }}
        >
          <div className="grid gap-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onUpload();
              }}
              className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-app)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-app)] text-[var(--brand-primary)]">
                <Upload size={17} aria-hidden="true" />
              </span>
              <span className="grid gap-0.5">
                <span className="text-sm font-semibold">Upload photo</span>
                <span className="text-xs text-[var(--text-muted)]">
                  Choose images from this device
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setCameraOpen(true);
              }}
              className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-app)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-app)] text-[var(--text-secondary)]">
                <Camera size={17} aria-hidden="true" />
              </span>
              <span className="grid gap-0.5">
                <span className="text-sm font-semibold">Open camera</span>
                <span className="text-xs text-[var(--text-muted)]">
                  Capture a candling photo
                </span>
              </span>
            </button>
          </div>
        </PopoverContent>
      </Popover>
      {cameraOpen && (
        <CandlingCamera
          onClose={() => setCameraOpen(false)}
          onAttach={onCapture}
        />
      )}
    </>
  );
}
