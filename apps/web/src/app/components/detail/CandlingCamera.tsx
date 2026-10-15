import { Camera, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

export function CandlingCamera({
  onClose,
  onAttach,
}: {
  onClose: () => void;
  onAttach: (photo: string) => Promise<boolean>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let disposed = false;
    let stream: MediaStream | undefined;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "Camera access requires HTTPS or localhost. You can use Upload photo instead.",
      );
      return;
    }
    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 960 },
          },
          audio: false,
        });
        if (disposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (cause) {
        stream?.getTracks().forEach((track) => track.stop());
        if (disposed) return;
        const name = cause instanceof DOMException ? cause.name : "";
        setError(
          name === "NotAllowedError"
            ? "Camera permission was denied. Allow camera access in your browser, or use Upload photo."
            : name === "NotFoundError"
              ? "No camera was found. Connect a camera or use Upload photo."
              : "The camera could not start. Close other apps using it, or use Upload photo.",
        );
      }
    }
    void start();
    return () => {
      disposed = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) return;
    try {
      const canvas = document.createElement("canvas");
      const scale = Math.min(
        1,
        1600 / Math.max(video.videoWidth, video.videoHeight),
      );
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Camera image unavailable");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      setPhoto(canvas.toDataURL("image/jpeg", 0.85));
    } catch {
      setError("The photo could not be captured. Please try again.");
    }
  };

  const attach = async () => {
    if (!photo || saving) return;
    setSaving(true);
    setError("");
    try {
      if (await onAttach(photo)) onClose();
      else
        setError(
          "The photo could not be attached. Your capture is still here; try again.",
        );
    } catch {
      setError(
        "The photo could not be attached. Your capture is still here; try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent className="md:max-w-2xl" hideClose={saving}>
        <DialogHeader>
          <DialogTitle>Candling photo</DialogTitle>
          <DialogDescription>
            Hold the egg over your candling light. Center it in the guide and
            keep the camera steady.
          </DialogDescription>
        </DialogHeader>
        <div className="relative overflow-hidden rounded-xl bg-black aspect-[4/3]">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            aria-label="Candling camera preview"
            onCanPlay={() => setReady(true)}
            className={`h-full w-full object-contain ${photo ? "hidden" : ""}`}
          />
          {photo ? (
            <img
              src={photo}
              alt="Captured candling photo"
              className="h-full w-full object-contain"
            />
          ) : (
            <>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 h-3/4 w-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-dashed border-white/80"
              />
              {!ready && !error && (
                <p
                  role="status"
                  className="absolute inset-0 flex items-center justify-center gap-2 text-white"
                >
                  <LoaderCircle className="animate-spin" size={20} />
                  Starting camera…
                </p>
              )}
            </>
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm text-[var(--status-danger-fg)]">
            {error}
          </p>
        )}
        <p className="text-sm text-[var(--text-muted)]">
          Photos are for your inspection record. Review and enter egg counts
          yourself.
        </p>
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="outline" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          {photo ? (
            <>
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => {
                  setPhoto(null);
                  setError("");
                }}
              >
                Retake
              </Button>
              <Button disabled={saving} onClick={() => void attach()}>
                {saving ? "Attaching…" : "Use photo"}
              </Button>
            </>
          ) : (
            <Button disabled={!ready || !!error} onClick={capture}>
              <Camera size={18} aria-hidden="true" />
              Capture photo
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
