import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ReadingWindow } from "../data/repositories/repository";
import { requireResultData } from "../features/farm/repository-query";
import { useAuth } from "../providers/auth-context";
import { useRepository } from "../providers/repository-context";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

export function RawReadingsDialog({
  ids,
  window,
  onClose,
}: {
  ids: string[];
  window: ReadingWindow;
  onClose: () => void;
}) {
  const repository = useRepository();
  const { isAuthenticated } = useAuth();
  const [end] = useState(() => new Date().toISOString());
  const [exporting, setExporting] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const preview = useQuery({
    queryKey: ["farm", "readings", "raw-preview", ids, window, end],
    queryFn: async () =>
      requireResultData(
        await repository.previewRawReadings({ incubatorIds: ids, window, end }),
      ),
    enabled: isAuthenticated,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const download = async () => {
    if (!preview.data || exporting) return;
    setExporting(true);
    const result = await repository.exportRawReadings(preview.data.scopeToken);
    if (!alive.current) return;
    setExporting(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    const url = URL.createObjectURL(result.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = `raw-readings-${window}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success(
      `Exported ${preview.data.total.toLocaleString()} raw readings from ${ids.length} chambers`,
    );
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl md:max-w-2xl">
        <DialogHeader className="pt-8 text-left">
          <DialogTitle>Raw chamber readings</DialogTitle>
          <DialogDescription>
            {preview.data
              ? `Showing ${preview.data.rows.length.toLocaleString()} of ${preview.data.total.toLocaleString()} raw readings across ${ids.length} chambers. CSV includes every sample in this scope.`
              : "Loading a bounded preview. The CSV export includes every raw sample."}
            {` UTC cutoff: ${end}.`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => void download()}
            disabled={!preview.data || Boolean(preview.error) || exporting}
            aria-busy={exporting}
          >
            <Download size={16} />
            <span>
              {exporting ? "Preparing complete CSV…" : "Export complete CSV"}
            </span>
          </Button>
          {preview.isPending && <p role="status">Loading raw readings…</p>}
          {preview.error && (
            <div role="alert" className="flex flex-wrap items-center gap-2">
              <p>Could not load raw readings.</p>
              <Button
                variant="outline"
                disabled={preview.isFetching}
                onClick={() => void preview.refetch()}
              >
                <span>Retry raw readings</span>
              </Button>
            </div>
          )}
        </div>
        {preview.data && (
          <div className="max-h-[50vh] overflow-auto rounded-xl border border-[var(--border-default)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chamber</TableHead>
                  <TableHead>Timestamp (UTC)</TableHead>
                  <TableHead>Temperature</TableHead>
                  <TableHead>Humidity</TableHead>
                  <TableHead>Water</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.data.rows.map((p) => (
                  <TableRow key={`${p.incubatorId}-${p.reading.ts}`}>
                    <TableCell>{p.chamber}</TableCell>
                    <TableCell>
                      {new Date(p.reading.ts).toISOString()}
                    </TableCell>
                    <TableCell>{p.reading.temp}°C</TableCell>
                    <TableCell>{p.reading.humidity}%</TableCell>
                    <TableCell>{p.waterOk ? "OK" : "Low"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
