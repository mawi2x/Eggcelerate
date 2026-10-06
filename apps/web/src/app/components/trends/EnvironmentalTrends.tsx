import { ChevronDown, TableProperties } from "lucide-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Incubator } from "../../domain/types";
import { formatYTick } from "../../features/trends/chart-ticks";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Checkbox } from "../ui/checkbox";
import { FilterBar } from "../ui/filter-bar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "../ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Switch } from "../ui/switch";
import { ChartTooltip } from "./ChartTooltip";
import {
  BORDER,
  CARD,
  COMPARE_FONT,
  CONTROL_FONT,
  type Metric,
  MUTED,
  metricInfo,
  type RangeKey,
  RUST,
  ranges,
  SURFACE,
  TARGET_BAND_COLOR,
  TARGET_BAND_OPACITY,
  TEXT,
  toolbarInputStyle,
} from "./presentation";
import type { useEnvironmentalTrends } from "./useEnvironmentalTrends";

export function EnvironmentalTrends({
  model,
  units,
}: {
  model: ReturnType<typeof useEnvironmentalTrends>;
  units: Incubator[];
}) {
  const {
    unitId,
    setUnitId,
    range,
    setRange,
    setReadingsOpen,
    isMobile,
    compare,
    compareIds,
    metric,
    setMetric,
    setHighlightedUnitId,
    activeUnits,
    activeHighlightedUnitId,
    readingsLoading,
    readingsError,
    retryReadings,
    activeReadingCount,
    chartData,
    chartSeriesByUnit,
    bands,
    domain,
    xTickValues,
    xTickLabels,
    ySpan,
    colorFor,
    tooltipMeta,
    targetRangeLabel,
    targetRangeShort,
    toggleCompareId,
    handleCompareChange,
  } = model;
  const cardStyle = {
    backgroundColor: CARD,
    borderColor: BORDER,
    borderRadius: "var(--radius-card)",
    boxShadow: "var(--shadow-card)",
  };

  return (
    <>
      {/* Unified 2-row toolbar: chamber + metric controls, then time horizon. */}
      <div
        className="rounded-2xl border p-4"
        style={{
          borderColor: BORDER,
          backgroundColor: CARD,
          ...CONTROL_FONT,
        }}
      >
        {/* ROW 1 — chamber selection and metric. */}
        <div className="flex flex-col items-stretch gap-3 md:flex-row md:flex-wrap md:items-center">
          {!compare ? (
            <Select size="filter" value={unitId} onValueChange={setUnitId}>
              <SelectTrigger
                size="filter"
                className="h-[var(--control-height-mobile)] min-w-0 flex-1 rounded-xl md:w-[var(--trends-selector-width)] md:shrink-0"
                style={{
                  ...toolbarInputStyle,
                  ...CONTROL_FONT,
                  color: RUST,
                }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent style={CONTROL_FONT}>
                {units.map((u) => (
                  <SelectItem key={u.id} value={u.id} style={{ color: TEXT }}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            /* Compact multi-select dropdown — avoids chip wrapping. */
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex h-[var(--control-height-default)] min-w-0 flex-1 cursor-pointer items-center justify-between gap-1.5 rounded-xl border px-3 py-2 whitespace-nowrap transition-colors hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-[length:var(--focus-ring-width)] focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 md:h-[var(--control-height-toolbar)] md:w-[var(--trends-selector-width)] md:shrink-0"
                  style={{
                    ...toolbarInputStyle,
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--type-filter-value)",
                    fontWeight: "var(--weight-bold)",
                    lineHeight: "var(--leading-normal)",
                    border: `var(--border-width-hairline) solid ${toolbarInputStyle.borderColor}`,
                    color: RUST,
                  }}
                >
                  <span>
                    {compareIds.length} of {units.length} Chambers
                  </span>
                  <ChevronDown size={16} style={{ color: MUTED }} />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-64 p-0"
                align="start"
                style={COMPARE_FONT}
              >
                <div
                  className="px-3 py-2"
                  style={{
                    borderBottom: `var(--border-width-hairline) solid ${BORDER}`,
                  }}
                >
                  <span style={{ ...COMPARE_FONT, color: TEXT }}>
                    Select chambers
                  </span>
                  <p style={{ ...COMPARE_FONT, color: MUTED }}>
                    Keep at least two selected.
                  </p>
                </div>
                <div className="max-h-64 overflow-y-auto py-1">
                  {units.map((u) => {
                    const checked = compareIds.includes(u.id);
                    // The last two selections lock so the chart can never go blank.
                    const locked = checked && compareIds.length <= 2;
                    return (
                      <div
                        key={u.id}
                        className={`flex items-center gap-3 px-3 py-2 ${
                          locked
                            ? "cursor-default opacity-70"
                            : "cursor-pointer hover:bg-amber-50/60"
                        }`}
                      >
                        <Checkbox
                          id={`compare-chamber-${u.id}`}
                          checked={checked}
                          disabled={locked}
                          onCheckedChange={() => toggleCompareId(u.id)}
                          aria-label={u.name}
                        />
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor: checked ? colorFor(u.id) : BORDER,
                          }}
                        />
                        <span
                          className="min-w-0 break-words"
                          style={{
                            ...COMPARE_FONT,
                            color: TEXT,
                            overflowWrap: "anywhere",
                          }}
                        >
                          {u.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          )}

          <div className="flex min-w-0 w-full flex-wrap items-center justify-between gap-2 md:w-auto md:flex-1">
            <div
              className="flex shrink-0 cursor-pointer items-center gap-2"
              style={{ ...CONTROL_FONT, color: compare ? TEXT : MUTED }}
            >
              <Switch
                checked={compare}
                onCheckedChange={handleCompareChange}
                aria-label="Compare Chambers"
              />
              Compare Chambers
            </div>
            <button
              type="button"
              onClick={() => setReadingsOpen(true)}
              className="flex min-h-[var(--control-height-mobile)] max-w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-1 transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 md:min-h-[var(--control-height-compact)]"
              style={{
                color: "var(--brand-primary)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-caption)",
                fontWeight: "var(--weight-bold)",
              }}
            >
              <TableProperties size={16} aria-hidden="true" />
              <span>
                {compare
                  ? "Readings for compared chambers"
                  : "See all readings"}
              </span>
            </button>
          </div>
        </div>

        <div
          className="mt-4 flex flex-wrap items-center gap-2 pt-4"
          style={{
            borderTop: `var(--border-width-hairline) solid ${BORDER}`,
          }}
        >
          <FilterBar
            ariaLabel="Time horizon"
            variant="segmented"
            fitToScreenOnMobile
            value={range}
            onChange={(key) => setRange(key as RangeKey)}
            options={ranges.map((r) => ({ key: r.key, label: r.label }))}
          />
        </div>
      </div>

      <div className="space-y-2">
        {readingsLoading && (
          <p role="status" className="text-sm text-[var(--text-secondary)]">
            Loading environmental readings…
          </p>
        )}
        {readingsError && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 rounded-xl border p-3"
            style={{ borderColor: BORDER }}
          >
            <p className="text-sm text-[var(--text-secondary)]">
              {activeReadingCount > 0
                ? "Some readings could not be updated. Showing previously loaded readings; they may be out of date."
                : "Environmental readings could not be loaded."}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void retryReadings()}
            >
              <span>Retry</span>
            </Button>
          </div>
        )}
        {!readingsLoading && !readingsError && activeReadingCount === 0 && (
          <p role="status" className="text-sm text-[var(--text-secondary)]">
            No historical readings are available for this selection and time
            range.
          </p>
        )}
      </div>

      <Card style={{ ...cardStyle, backgroundColor: SURFACE }}>
        <CardContent className="p-4 md:p-6">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex min-w-0 flex-col gap-2">
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                <div className="min-w-0">
                  <h2
                    id="environmental-chart-title"
                    style={{
                      color: TEXT,
                      fontFamily: "var(--font-display)",
                      fontSize: "var(--type-heading-md)",
                      fontWeight: "var(--weight-bold)",
                      lineHeight: "var(--leading-snug)",
                    }}
                  >
                    {metricInfo[metric].label} Trend
                  </h2>
                  <p
                    style={{
                      color: MUTED,
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--type-caption)",
                      fontWeight: "var(--weight-semibold)",
                      lineHeight: "var(--leading-normal)",
                      overflowWrap: "anywhere",
                    }}
                    title={targetRangeLabel}
                  >
                    {targetRangeShort}
                  </p>
                </div>
                <SegmentedControl
                  flush
                  className="max-w-full self-start overflow-x-auto scrollbar-none"
                  aria-label="Chart metric"
                >
                  {(Object.keys(metricInfo) as Metric[]).map((mk) => {
                    const active = metric === mk;
                    return (
                      <SegmentedControlItem
                        key={mk}
                        flush
                        active={active}
                        aria-pressed={active}
                        onClick={() => setMetric(mk)}
                        className="px-1.5 md:px-3"
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: "var(--type-filter-label)",
                          fontWeight: "var(--weight-bold)",
                          lineHeight: "var(--leading-snug)",
                          letterSpacing: "var(--tracking-label)",
                          textTransform: "uppercase",
                        }}
                      >
                        {metricInfo[mk].label}
                      </SegmentedControlItem>
                    );
                  })}
                </SegmentedControl>
              </div>
              <fieldset
                aria-label="Chart legend"
                className="m-0 flex min-w-0 w-full flex-nowrap items-center justify-start gap-x-2.5 overflow-x-auto border-0 p-0 pr-1 text-left scrollbar-none"
                style={{
                  color: TEXT,
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--type-label)",
                  fontWeight: "var(--weight-semibold)",
                  letterSpacing: "var(--tracking-label)",
                  lineHeight: "var(--leading-snug)",
                }}
              >
                {activeUnits.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    aria-label={`Highlight ${u.name} series`}
                    onMouseEnter={() => setHighlightedUnitId(u.id)}
                    onMouseLeave={() => setHighlightedUnitId(null)}
                    onFocus={() => setHighlightedUnitId(u.id)}
                    onBlur={() => setHighlightedUnitId(null)}
                    className="flex h-[var(--control-height-mobile)] shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-0.5 transition-[background-color,opacity] duration-150 hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 motion-reduce:transition-none md:h-auto md:min-h-4"
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--type-label)",
                      fontWeight: "var(--weight-semibold)",
                      letterSpacing: "var(--tracking-label)",
                      lineHeight: "var(--leading-snug)",
                      opacity:
                        activeHighlightedUnitId &&
                        activeHighlightedUnitId !== u.id
                          ? 0.48
                          : 1,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 shrink-0"
                      style={{
                        backgroundColor: colorFor(u.id),
                        borderRadius: "2px",
                      }}
                    />
                    <span>{u.name}</span>
                  </button>
                ))}
              </fieldset>
            </div>
          </div>

          <p id="environmental-chart-desc" className="sr-only">
            {`${metricInfo[metric].label} readings for ${activeUnits.map((u) => u.name).join(", ")}`}
          </p>
          <div
            className="mt-3 h-[var(--trends-chart-height-mobile)] w-full border-t pt-3 md:mt-4 md:h-[var(--trends-chart-height-tablet)] md:pt-4 lg:h-[var(--trends-chart-height-desktop)]"
            style={{ borderColor: BORDER }}
            role="img"
            aria-labelledby="environmental-chart-title"
            aria-describedby="environmental-chart-desc environmental-chart-note"
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{
                  top: 8,
                  right: 18,
                  left: isMobile ? 4 : 22,
                  bottom: 12,
                }}
              >
                <defs key="defs">
                  {activeUnits.map((u) => (
                    <linearGradient
                      key={`gradient-${u.id}`}
                      id={`gradient-${u.id}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor={colorFor(u.id)}
                        stopOpacity={0.24}
                      />
                      <stop
                        offset="95%"
                        stopColor={colorFor(u.id)}
                        stopOpacity={0.0}
                      />
                    </linearGradient>
                  ))}
                </defs>
                {/* Every chart child carries an explicit key: recharts clones children
                        and reuses their keys, so unkeyed siblings collide. */}
                <CartesianGrid
                  key="grid"
                  stroke="var(--chart-grid)"
                  strokeWidth={1}
                />
                <XAxis
                  key={`x-axis-${range}-${metric}`}
                  dataKey="ts"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  ticks={xTickValues}
                  tick={{
                    fill: MUTED,
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--type-label)",
                    fontWeight: "var(--weight-medium)",
                  }}
                  tickFormatter={(_, index) => xTickLabels[index] ?? ""}
                  axisLine={{ stroke: "var(--input-border)" }}
                  tickLine={false}
                  tickMargin={10}
                  interval={0}
                />
                <YAxis
                  key="y-axis"
                  domain={domain}
                  width={isMobile ? 40 : 72}
                  tick={{
                    fill: MUTED,
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--type-label)",
                    fontWeight: "var(--weight-medium)",
                  }}
                  tickCount={5}
                  tickFormatter={(value) => formatYTick(Number(value), ySpan)}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={isMobile ? 4 : 8}
                  allowDecimals
                  label={
                    isMobile
                      ? undefined
                      : {
                          value: `${metricInfo[metric].label} (${metricInfo[metric].unit})`,
                          angle: -90,
                          position: "insideLeft",
                          fill: MUTED,
                          fontFamily: "var(--font-body)",
                          fontSize: "var(--type-label)",
                          fontWeight: "var(--weight-semibold)",
                        }
                  }
                />
                <Tooltip
                  key="tooltip"
                  cursor={{ stroke: "var(--input-border)", strokeWidth: 1 }}
                  wrapperStyle={{ outline: "none" }}
                  position={isMobile ? { y: 0 } : undefined}
                  allowEscapeViewBox={{ x: false, y: true }}
                  content={
                    <ChartTooltip
                      unit={metricInfo[metric].unit}
                      meta={tooltipMeta}
                      highlightedId={activeHighlightedUnitId}
                      compact={isMobile}
                      range={range}
                    />
                  }
                />
                {bands.map((b) => (
                  <ReferenceArea
                    key={`band-${b.min}-${b.max}`}
                    y1={b.min}
                    y2={b.max}
                    fill={TARGET_BAND_COLOR}
                    fillOpacity={
                      bands.length > 1
                        ? TARGET_BAND_OPACITY / 2
                        : TARGET_BAND_OPACITY
                    }
                    strokeOpacity={0}
                  />
                ))}
                {activeUnits.map((u) => (
                  <Area
                    key={`extrema-${u.id}`}
                    dataKey={`${u.id}_range`}
                    name={`${u.name} min–max`}
                    type="linear"
                    stroke={colorFor(u.id)}
                    strokeWidth={0.5}
                    fill={colorFor(u.id)}
                    fillOpacity={0.12}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ))}
                {/* Soft gradient under-fill for single unit or highlighted unit (Copilot Money style) */}
                {activeUnits.map((u) => {
                  const isSoleOrHighlighted =
                    activeUnits.length === 1 ||
                    activeHighlightedUnitId === u.id;
                  if (!isSoleOrHighlighted) return null;
                  return (
                    <Area
                      key={`area-${u.id}`}
                      type="monotone"
                      data={chartSeriesByUnit[u.id]}
                      dataKey={u.id}
                      stroke="none"
                      fill={`url(#gradient-${u.id})`}
                      fillOpacity={1}
                      connectNulls
                      isAnimationActive={false}
                    />
                  );
                })}
                {bands[0] && (
                  <ReferenceLine
                    key="target-reference-line"
                    y={Number(((bands[0].min + bands[0].max) / 2).toFixed(1))}
                    stroke="var(--chart-target-band)"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    strokeOpacity={0.75}
                  />
                )}
                {activeUnits.map((u) => {
                  const highlighted = activeHighlightedUnitId === u.id;
                  const faded = Boolean(
                    activeHighlightedUnitId && !highlighted,
                  );
                  return (
                    <Line
                      key={`gap-link-${u.id}`}
                      type="monotone"
                      data={chartSeriesByUnit[u.id]}
                      dataKey={u.id}
                      stroke={colorFor(u.id)}
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      strokeOpacity={faded ? 0.12 : 0.55}
                      dot={false}
                      activeDot={false}
                      tooltipType="none"
                      connectNulls
                      isAnimationActive={false}
                    />
                  );
                })}
                {activeUnits.map((u) => {
                  const highlighted = activeHighlightedUnitId === u.id;
                  const faded = Boolean(
                    activeHighlightedUnitId && !highlighted,
                  );
                  return (
                    <Line
                      key={`line-${u.id}`}
                      type="monotone"
                      data={chartSeriesByUnit[u.id]}
                      dataKey={u.id}
                      name={u.name}
                      stroke={colorFor(u.id)}
                      strokeWidth={highlighted ? 2.4 : 1.8}
                      strokeOpacity={faded ? 0.22 : 0.92}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      dot={(point: {
                        cx?: number;
                        cy?: number;
                        index?: number;
                        payload?: Record<string, unknown>;
                      }) => {
                        const rows = chartSeriesByUnit[u.id];
                        const index = point.index ?? -1;
                        const isolated =
                          rows[index - 1]?.[u.id] == null &&
                          rows[index + 1]?.[u.id] == null;
                        if (
                          !isolated ||
                          typeof point.payload?.[u.id] !== "number" ||
                          point.cx == null ||
                          point.cy == null
                        )
                          return <g key={`empty-${index}`} />;
                        return (
                          <circle
                            key={`point-${index}`}
                            cx={point.cx}
                            cy={point.cy}
                            r={2.5}
                            fill={colorFor(u.id)}
                            fillOpacity={faded ? 0.22 : 1}
                            stroke={SURFACE}
                            strokeWidth={1}
                          />
                        );
                      }}
                      activeDot={
                        faded || (activeUnits.length > 4 && !highlighted)
                          ? false
                          : {
                              r: highlighted ? 4 : 3,
                              strokeWidth: 1.5,
                              fill: SURFACE,
                            }
                      }
                      connectNulls={false}
                      isAnimationActive={false}
                      onMouseEnter={() => setHighlightedUnitId(u.id)}
                      onMouseLeave={() => setHighlightedUnitId(null)}
                      className="transition-opacity duration-150 motion-reduce:transition-none"
                    />
                  );
                })}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <p
        id="environmental-chart-note"
        className="text-(length:--type-caption) text-[var(--text-muted)]"
        data-screen-note="chart-reading-guide"
      >
        Solid lines and points are recorded bucket averages. Dashed links and
        soft shading show the trend across gaps, not measured values. Range
        shading preserves recorded minimum and maximum values. Use raw CSV for
        individual samples.
      </p>
    </>
  );
}
