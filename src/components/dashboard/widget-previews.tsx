import type { WidgetType } from "@/lib/widgets/registry";
import { cn } from "@/lib/utils";

/**
 * Static SVG gallery previews — not live dashboard data.
 *
 * Each builder below mirrors one of the real display primitives in
 * `components/dashboard/widgets/` (stat card, status list, bar chart, data
 * table, …), so a widget's preview always matches the shape it actually
 * renders once added.
 */
export function WidgetPreview({
  type,
  className,
}: {
  type: WidgetType;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 160 72"
      className={cn("h-auto w-full", className)}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect
        width="160"
        height="72"
        rx="8"
        className="fill-muted/60 dark:fill-muted/40"
      />
      {previewContent(type)}
    </svg>
  );
}

/* ───────────────────────── shape builders ───────────────────────────────
 * One per display primitive. Widget cases below only supply the mock values,
 * not the layout. */

/** Mirrors `StatCard`: a label, a big number, and an optional hint/badge. */
function statCardPreview({
  label,
  value,
  valueTone = "fill-foreground",
  hint,
  hintTone = "fill-muted-foreground",
  below,
  badge,
}: {
  label: string;
  value: string;
  valueTone?: string;
  hint?: string;
  hintTone?: string;
  below?: string;
  badge?: boolean;
}) {
  const valueY = below ? 48 : 52;
  return (
    <g>
      <text x="12" y="24" className="fill-muted-foreground" fontSize="8">
        {label}
      </text>
      <text x="12" y={valueY} className={valueTone} fontSize="20" fontWeight="600">
        {value}
      </text>
      {below ? (
        <text x="12" y="64" className="fill-muted-foreground" fontSize="7">
          {below}
        </text>
      ) : null}
      {hint ? (
        <text x="90" y={valueY} className={hintTone} fontSize="9">
          {hint}
        </text>
      ) : null}
      {badge ? (
        <>
          <circle cx="128" cy="36" r="14" className="fill-success/30" />
          <circle cx="128" cy="36" r="7" className="fill-success" />
        </>
      ) : null}
    </g>
  );
}

/** Mirrors `StatusList`: a status dot and a name placeholder per row. */
function statusListPreview(
  rows: Array<{ tone?: "success" | "warning"; width: number }>,
) {
  return (
    <g>
      {rows.map((row, i) => (
        <g key={i}>
          <circle
            cx="18"
            cy={22 + i * 16}
            r="3.5"
            className={row.tone === "warning" ? "fill-warning" : "fill-success"}
          />
          <rect
            x="28"
            y={19 + i * 16}
            width={row.width}
            height="6"
            rx="2"
            className="fill-muted-foreground/35"
          />
        </g>
      ))}
    </g>
  );
}

/** Mirrors `BarChart`: a short label over a filled progress track, per row. */
function barChartPreview(
  rows: Array<{ label: string; pct: number; tone?: "in" | "out" | "neutral" }>,
) {
  const big = rows.length <= 2;
  const rowH = big ? 28 : 72 / rows.length;
  const trackW = 110;
  return (
    <g>
      {rows.map((row, i) => {
        const y = big ? 8 + i * rowH : 4 + i * rowH;
        const barY = y + (big ? 4 : 8);
        const barH = big ? 8 : 5;
        const fillW = Math.max((row.pct / 100) * trackW, 6);
        const fillClass =
          row.tone === "in"
            ? "fill-success"
            : row.tone === "out"
              ? "fill-foreground/60"
              : "fill-primary/70";
        return (
          <g key={row.label}>
            <text x="12" y={y + 6} className="fill-muted-foreground" fontSize="7">
              {row.label}
            </text>
            <rect
              x="12"
              y={barY}
              width={trackW}
              height={barH}
              rx={barH / 2}
              className="fill-muted"
            />
            <rect
              x="12"
              y={barY}
              width={fillW}
              height={barH}
              rx={barH / 2}
              className={fillClass}
            />
          </g>
        );
      })}
    </g>
  );
}

/** Mirrors `DataTable`: a primary column and a status-tinted trailing cell. */
function dataTablePreview(rows: Array<"success" | "warning" | "neutral">) {
  return (
    <g>
      {rows.map((tone, i) => (
        <g key={i}>
          <rect
            x="12"
            y={16 + i * 16}
            width="70"
            height="6"
            rx="2"
            className="fill-muted-foreground/35"
          />
          <rect
            x="110"
            y={16 + i * 16}
            width="36"
            height="6"
            rx="2"
            className={
              tone === "success"
                ? "fill-success/70"
                : tone === "warning"
                  ? "fill-warning/70"
                  : "fill-muted-foreground/35"
            }
          />
        </g>
      ))}
    </g>
  );
}

/** Mirrors `ActivityTracker`: a strip of colored history blocks. */
function activityTrackerPreview() {
  return (
    <g>
      <text x="12" y="22" className="fill-muted-foreground" fontSize="8">
        deploys
      </text>
      {Array.from({ length: 18 }, (_, i) => {
        const tone =
          i === 14 || i === 15
            ? "fill-warning"
            : i === 16
              ? "fill-destructive"
              : "fill-success";
        return (
          <rect
            key={i}
            x={12 + i * 8}
            y={34}
            width="5"
            height="18"
            rx="1"
            className={tone}
          />
        );
      })}
    </g>
  );
}

/** Mirrors `ActivityPanel`: a status headline plus a couple of recent events. */
function activityPanelPreview() {
  return (
    <g>
      <circle cx="14" cy="14" r="2.5" className="fill-success" />
      <text x="22" y="17" className="fill-muted-foreground" fontSize="8">
        api · Healthy
      </text>
      <text x="12" y="40" className="fill-destructive" fontSize="15" fontWeight="600">
        2 behind
      </text>
      <text x="12" y="52" className="fill-muted-foreground" fontSize="7">
        live 14h · edfcd04
      </text>
      <text x="78" y="38" className="fill-muted-foreground" fontSize="7">
        13h
      </text>
      <text x="96" y="38" className="fill-destructive" fontSize="7">
        Deploy failed
      </text>
      <text x="78" y="50" className="fill-muted-foreground" fontSize="7">
        14h
      </text>
      <text x="96" y="50" className="fill-destructive" fontSize="7">
        Deploy failed
      </text>
    </g>
  );
}

/** Mirrors `DonutChart`: a ringed pie with a legend list. */
function donutChartPreview() {
  return (
    <g>
      <circle
        cx="44"
        cy="40"
        r="22"
        className="fill-none stroke-primary/80"
        strokeWidth="10"
        strokeDasharray="40 90"
        strokeLinecap="butt"
        transform="rotate(-90 44 40)"
      />
      <circle
        cx="44"
        cy="40"
        r="22"
        className="fill-none stroke-chart-2"
        strokeWidth="10"
        strokeDasharray="28 90"
        strokeDashoffset="-40"
        transform="rotate(-90 44 40)"
      />
      <circle
        cx="44"
        cy="40"
        r="22"
        className="fill-none stroke-chart-3"
        strokeWidth="10"
        strokeDasharray="20 90"
        strokeDashoffset="-68"
        transform="rotate(-90 44 40)"
      />
      <rect x="78" y="22" width="52" height="5" rx="2" className="fill-muted-foreground/35" />
      <rect x="78" y="36" width="40" height="5" rx="2" className="fill-muted-foreground/35" />
      <rect x="78" y="50" width="34" height="5" rx="2" className="fill-muted-foreground/35" />
    </g>
  );
}

/** Mirrors `LineChart`: a filled trend line. */
function lineChartPreview() {
  return (
    <g>
      <polyline
        points="12,52 36,40 58,44 82,28 108,34 140,18"
        fill="none"
        className="stroke-primary"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polyline
        points="12,58 36,46 58,50 82,34 108,40 140,24 140,58 12,58"
        className="fill-primary/15"
        stroke="none"
      />
    </g>
  );
}

/** Mirrors `ColumnChart`: a run of vertical columns. */
function columnChartPreview() {
  const heights = [18, 30, 24, 38, 22, 34, 44, 28];
  return (
    <g>
      {heights.map((h, i) => (
        <rect
          key={i}
          x={12 + i * 17}
          width="11"
          y={58 - h}
          height={h}
          rx="2"
          className="fill-primary/70"
        />
      ))}
    </g>
  );
}

/** Mirrors `DualLineChart`: a filled volume trail under a flatter rate line. */
function dualLineChartPreview() {
  return (
    <g>
      <polyline
        points="12,50 36,38 58,44 82,26 108,32 140,20 140,58 12,58"
        className="fill-primary/15"
        stroke="none"
      />
      <polyline
        points="12,50 36,38 58,44 82,26 108,32 140,20"
        fill="none"
        className="stroke-primary"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polyline
        points="12,22 36,20 58,24 82,18 108,21 140,16"
        fill="none"
        className="stroke-success"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </g>
  );
}

/* ───────────────────────── per-widget mock values ────────────────────── */

function previewContent(type: WidgetType) {
  switch (type) {
    case "railway-tracker":
      return activityPanelPreview();
    case "vercel-tracker":
    case "netlify-tracker":
      return activityTrackerPreview();

    case "railway-services":
      return statusListPreview([
        { tone: "success", width: 90 },
        { tone: "warning", width: 76 },
        { tone: "success", width: 62 },
      ]);
    case "netlify-sites":
    case "vercel-projects":
    case "sentry-projects":
      return statusListPreview([
        { tone: "success", width: 88 },
        { tone: "warning", width: 74 },
        { tone: "success", width: 60 },
      ]);
    case "supabase-projects":
    case "supabase-services":
      return statusListPreview([
        { tone: "success", width: 88 },
        { tone: "success", width: 76 },
        { tone: "warning", width: 64 },
      ]);
    case "status-board":
      return statusListPreview([
        { tone: "success", width: 80 },
        { tone: "success", width: 68 },
        { tone: "warning", width: 56 },
      ]);

    case "railway-fleet":
      return statCardPreview({ label: "healthy", value: "5/6", badge: true });
    case "netlify-health":
    case "supabase-health":
    case "stripe-mrr":
    case "stripe-revenue":
    case "lemonsqueezy-mrr":
    case "lemonsqueezy-revenue":
    case "sentry-issues":
      return statCardPreview({ label: "ready", value: "4/4", badge: true });
    case "netlify-builds":
      return statCardPreview({ label: "build mins", value: "312", hint: "−8%" });
    case "supabase-requests":
      return statCardPreview({ label: "7-day requests", value: "128k" });
    case "supabase-advisors":
      return statCardPreview({
        label: "findings",
        value: "2",
        hint: "review",
        hintTone: "fill-warning",
      });
    case "qonto-balance":
      return statCardPreview({ label: "total cash", value: "€48.2k" });
    case "qonto-liquidity":
      return statCardPreview({
        label: "available",
        value: "€46.1k",
        below: "€2.1k pending",
      });
    case "qonto-cashflow":
      return statCardPreview({
        label: "30-day net",
        value: "+€8.4k",
        valueTone: "fill-success",
      });

    case "railway-resources":
      return barChartPreview([
        { label: "cpu", pct: 44, tone: "neutral" },
        { label: "memory", pct: 71, tone: "out" },
      ]);
    case "qonto-in-out":
      return barChartPreview([
        { label: "in", pct: 87, tone: "in" },
        { label: "out", pct: 56, tone: "out" },
      ]);
    case "railway-usage":
      return barChartPreview([
        { label: "compute", pct: 82, tone: "neutral" },
        { label: "egress", pct: 58, tone: "neutral" },
        { label: "storage", pct: 30, tone: "neutral" },
      ]);
    case "netlify-forms":
      return barChartPreview([
        { label: "contact", pct: 90, tone: "neutral" },
        { label: "waitlist", pct: 62, tone: "neutral" },
        { label: "feedback", pct: 34, tone: "neutral" },
      ]);
    case "supabase-traffic":
      return barChartPreview([
        { label: "mon", pct: 70, tone: "neutral" },
        { label: "tue", pct: 90, tone: "neutral" },
        { label: "wed", pct: 55, tone: "neutral" },
        { label: "thu", pct: 40, tone: "neutral" },
      ]);

    case "railway-deploys":
    case "netlify-deploys":
    case "vercel-deploys":
      return dataTablePreview(["success", "warning", "success"]);
    case "stripe-payments":
    case "lemonsqueezy-orders":
    case "sentry-recent":
    case "resend-emails":
    case "qonto-transactions":
      return dataTablePreview(["success", "neutral", "neutral"]);

    case "resend-domains":
    case "resend-broadcasts":
      return dataTablePreview(["success", "warning", "neutral"]);
    case "resend-delivery":
      return dualLineChartPreview();
    case "resend-open-rate":
    case "resend-click-rate":
      return columnChartPreview();
    case "resend-outcomes":
      return donutChartPreview();

    case "railway-projects":
    case "supabase-advisor-issues":
      return dataTablePreview(["success", "warning", "neutral"]);
    case "railway-billing":
      return statCardPreview({ label: "estimated bill", value: "$42.18" });
    case "railway-cpu":
    case "railway-memory":
    case "railway-egress":
    case "railway-disk":
      return lineChartPreview();

    case "qonto-accounts":
      return donutChartPreview();
    case "qonto-history":
      return lineChartPreview();

    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}
