import { useTemperatureDisplay } from "../providers/temperature-context";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  RawReadingOrder,
  ReadingBounds,
  ReadingWindow,
} from "../data/repositories/repository";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { PaginationBar } from "./ui/pagination-bar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

const DEFAULT_PAGE_SIZE = 200;
const PAGE_SIZE_OPTIONS = [50, 100, 200] as const;

export function RawReadingsDialog({
  ids,
  window,
  bounds,
  runId,
  onClose,
}: {
  ids: string[];
  window: ReadingWindow;
  bounds?: ReadingBounds;
  runId?: string;
  onClose: () => void;
}) {
  const temperature = useTemperatureDisplay();
  const repository = useRepository();
  const { isAuthenticated } = useAuth();
  const [end] = useState(() => bounds?.end ?? new Date().toISOString());
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [order, setOrder] = useState<RawReadingOrder>("newest");
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const scopeIdentity = [
    ids.join("\u0000"),
    window,
    bounds?.start ?? "",
    bounds?.end ?? "",
    runId ?? "",
  ].join("|");
  useEffect(() => {
    setPage(1);
    setPageSize(DEFAULT_PAGE_SIZE);
    setOrder("newest");
  }, [scopeIdentity]);

  const preview = useQuery({
    queryKey: [
      "farm",
      "readings",
      "raw-preview",
      ids,
      window,
      end,
      bounds?.start,
      runId,
    ],
    queryFn: async () =>
      requireResultData(
        await repository.previewRawReadings({
          incubatorIds: ids,
          window,
          end,
          ...(bounds ? { start: bounds.start } : {}),
          ...(runId ? { runId } : {}),
        }),
      ),
    enabled: isAuthenticated,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const pageQuery = useQuery({
    queryKey: [
      "farm",
      "readings",
      "raw-preview-page",
      preview.data?.scopeToken.slice(-64),
      page,
      pageSize,
      order,
    ],
    queryFn: async () => {
      if (!preview.data) throw new Error("The reading scope is not ready.");
      return requireResultData(
        await repository.pageRawReadings({
          scopeToken: preview.data.scopeToken,
          offset: (page - 1) * pageSize,
          limit: pageSize,
          order,
        }),
      );
    },
    enabled:
      isAuthenticated &&
      Boolean(preview.data) &&
      !(page === 1 && order === "newest"),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const currentPage =
    page === 1 && order === "newest"
      ? preview.data && {
          ...preview.data,
          rows: preview.data.rows.slice(0, pageSize),
        }
      : pageQuery.data;
  const chamberWord = ids.length === 1 ? "chamber" : "chambers";

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
    const scopeName = runId
      ? `run-${runId}`
      : bounds
        ? "custom"
        : window;
    link.download = `raw-readings-${scopeName}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success(
      `Exported ${preview.data.total.toLocaleString()} raw readings from ${ids.length} ${chamberWord}`,
    );
  };

  const observationScope = runId
    ? " Includes only readings from the selected run."
    : bounds
      ? ` Observation period (UTC): ${bounds.start} to ${end} (end excluded).`
      : ` UTC cutoff: ${end}.`;
  const description = preview.data
    ? `${preview.data.total.toLocaleString()} raw readings across ${ids.length} ${chamberWord}. CSV includes every sample in this scope.`
    : "Loading a bounded preview. The CSV export includes every raw sample.";

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        size="large"
        className="flex h-[90dvh] max-h-[90dvh] flex-col overflow-hidden rounded-2xl"
      >
        <DialogHeader className="shrink-0 pt-8 text-left">
          <DialogTitle>Raw chamber readings</DialogTitle>
          <DialogDescription>
            {description}
            {observationScope}
          </DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
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
            {preview.isPending && (
              <p role="status">Loading raw readings…</p>
            )}
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
            {pageQuery.error && preview.data && (
              <div role="alert" className="flex flex-wrap items-center gap-2">
                <p>Could not load this page.</p>
                <Button
                  variant="outline"
                  disabled={pageQuery.isFetching}
                  onClick={() => void pageQuery.refetch()}
                >
                  <span>Retry page</span>
                </Button>
              </div>
            )}
          </div>

          {preview.data && (
            <label className="grid min-w-[168px] gap-1 text-left">
              <span className="text-xs font-medium text-muted-foreground">
                Sort by timestamp
              </span>
              <Select
                value={order}
                onValueChange={(value) => {
                  setOrder(value as RawReadingOrder);
                  setPage(1);
                }}
              >
                <SelectTrigger
                  size="filter"
                  aria-label="Sort raw readings by timestamp"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                </SelectContent>
              </Select>
            </label>
          )}
        </div>

        {preview.data && (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border-default)]">
            <div className="min-h-0 flex-1 overflow-auto">
              {currentPage ? (
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-[var(--surface-tile)]">
                    <TableRow>
                      <TableHead>Chamber</TableHead>
                      <TableHead>Timestamp (UTC)</TableHead>
                      <TableHead>Temperature</TableHead>
                      <TableHead>Humidity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentPage.rows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No readings in this scope.
                        </TableCell>
                      </TableRow>
                    ) : (
                      currentPage.rows.map((p) => (
                        <TableRow key={`${p.incubatorId}-${p.reading.ts}`}>
                          <TableCell>{p.chamber}</TableCell>
                          <TableCell>
                            {new Date(p.reading.ts).toISOString()}
                          </TableCell>
                          <TableCell>
                            {temperature.format(p.reading.temp)}
                          </TableCell>
                          <TableCell>{p.reading.humidity}%</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              ) : pageQuery.isPending ? (
                <p role="status" className="p-4 text-sm text-muted-foreground">
                  Loading page {page}…
                </p>
              ) : pageQuery.error ? (
                <p className="p-4 text-sm text-muted-foreground">
                  Retry loading this page to continue browsing.
                </p>
              ) : null}
            </div>
            <PaginationBar
              page={page}
              pageSize={pageSize}
              totalItems={preview.data.total}
              itemLabel="readings"
              onPageChange={setPage}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageSizeChange={(value) => {
                setPageSize(value);
                setPage(1);
              }}
              className="shrink-0"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
