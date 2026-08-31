import type { WidgetType } from "@/lib/widgets/registry";
import { cn } from "@/lib/utils";

/** Static SVG gallery previews — not live dashboard data. */
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

function previewContent(type: WidgetType) {
  switch (type) {
    case "railway-tracker":
      return (
        <g>
          <circle cx="14" cy="14" r="2.5" className="fill-success" />
          <text x="22" y="17" className="fill-muted-foreground" fontSize="8">
            api · Healthy
          </text>
          <text
            x="12"
            y="40"
            className="fill-destructive"
            fontSize="15"
            fontWeight="600"
          >
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
    case "vercel-tracker":
    case "netlify-tracker":
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
    case "sentry-projects":
    case "resend-domains":
    case "vercel-projects":
    case "netlify-sites":
      return (
        <g>
          {[0, 1, 2].map((row) => (
            <g key={row}>
              <circle
                cx="18"
                cy={22 + row * 16}
                r="3.5"
                className={row === 1 ? "fill-warning" : "fill-success"}
              />
              <rect
                x="28"
                y={19 + row * 16}
                width={88 - row * 14}
                height="6"
                rx="2"
                className="fill-muted-foreground/35"
              />
            </g>
          ))}
        </g>
      );
    // Revenue and issue counts share the single-number KPI shape.
    case "stripe-mrr":
    case "stripe-revenue":
    case "lemonsqueezy-mrr":
    case "lemonsqueezy-revenue":
    case "sentry-issues":
    case "netlify-health":
      return (
        <g>
          <text x="12" y="24" className="fill-muted-foreground" fontSize="8">
            ready
          </text>
          <text
            x="12"
            y="52"
            className="fill-foreground"
            fontSize="22"
            fontWeight="600"
          >
            4/4
          </text>
          <circle cx="128" cy="36" r="14" className="fill-success/30" />
          <circle cx="128" cy="36" r="7" className="fill-success" />
        </g>
      );
    case "vercel-deploys":
    case "netlify-deploys":
      return (
        <g>
          {[0, 1, 2].map((row) => (
            <g key={row}>
              <rect
                x="12"
                y={16 + row * 16}
                width="70"
                height="6"
                rx="2"
                className="fill-muted-foreground/35"
              />
              <rect
                x="110"
                y={16 + row * 16}
                width="36"
                height="6"
                rx="2"
                className={row === 1 ? "fill-warning/70" : "fill-success/70"}
              />
            </g>
          ))}
        </g>
      );
    case "netlify-builds":
      return (
        <g>
          <text x="12" y="24" className="fill-muted-foreground" fontSize="8">
            build mins
          </text>
          <text
            x="12"
            y="52"
            className="fill-foreground"
            fontSize="22"
            fontWeight="600"
          >
            312
          </text>
          <text x="90" y="52" className="fill-muted-foreground" fontSize="9">
            −8%
          </text>
        </g>
      );
    case "netlify-forms":
      return (
        <g>
          {[0, 1, 2].map((row) => (
            <g key={row}>
              <rect
                x="12"
                y={14 + row * 18}
                width="40"
                height="5"
                rx="2"
                className="fill-muted-foreground/35"
              />
              <rect
                x="12"
                y={22 + row * 18}
                width={95 - row * 24}
                height="5"
                rx="2.5"
                className="fill-primary/70"
              />
            </g>
          ))}
        </g>
      );
    case "railway-services":
      return (
        <g>
          {[0, 1, 2].map((row) => (
            <g key={row}>
              <circle
                cx="18"
                cy={22 + row * 16}
                r="3.5"
                className={row === 1 ? "fill-warning" : "fill-success"}
              />
              <rect
                x="28"
                y={19 + row * 16}
                width={90 - row * 14}
                height="6"
                rx="2"
                className="fill-muted-foreground/35"
              />
            </g>
          ))}
        </g>
      );
    case "railway-fleet":
      return (
        <g>
          <text x="12" y="24" className="fill-muted-foreground" fontSize="8">
            healthy
          </text>
          <text
            x="12"
            y="52"
            className="fill-foreground"
            fontSize="22"
            fontWeight="600"
          >
            5/6
          </text>
          <circle cx="128" cy="36" r="14" className="fill-success/30" />
          <circle cx="128" cy="36" r="7" className="fill-success" />
        </g>
      );
    case "railway-resources":
      return (
        <g>
          <text x="12" y="18" className="fill-muted-foreground" fontSize="7">
            cpu
          </text>
          <rect
            x="12"
            y="22"
            width="110"
            height="8"
            rx="4"
            className="fill-muted"
          />
          <rect
            x="12"
            y="22"
            width="48"
            height="8"
            rx="4"
            className="fill-primary/80"
          />
          <text x="12" y="46" className="fill-muted-foreground" fontSize="7">
            memory
          </text>
          <rect
            x="12"
            y="50"
            width="110"
            height="8"
            rx="4"
            className="fill-muted"
          />
          <rect
            x="12"
            y="50"
            width="78"
            height="8"
            rx="4"
            className="fill-foreground/60"
          />
        </g>
      );
    case "railway-usage":
      return (
        <g>
          {[0, 1, 2].map((row) => (
            <g key={row}>
              <rect
                x="12"
                y={14 + row * 18}
                width="36"
                height="5"
                rx="2"
                className="fill-muted-foreground/35"
              />
              <rect
                x="12"
                y={22 + row * 18}
                width={100 - row * 22}
                height="5"
                rx="2.5"
                className="fill-primary/70"
              />
            </g>
          ))}
        </g>
      );
    case "railway-deploys":
      return (
        <g>
          {[0, 1, 2].map((row) => (
            <g key={row}>
              <rect
                x="12"
                y={16 + row * 16}
                width="70"
                height="6"
                rx="2"
                className="fill-muted-foreground/35"
              />
              <rect
                x="110"
                y={16 + row * 16}
                width="36"
                height="6"
                rx="2"
                className={
                  row === 1 ? "fill-warning/70" : "fill-success/70"
                }
              />
            </g>
          ))}
        </g>
      );
    case "supabase-health":
      return (
        <g>
          <text x="12" y="24" className="fill-muted-foreground" fontSize="8">
            healthy
          </text>
          <text
            x="12"
            y="52"
            className="fill-foreground"
            fontSize="22"
            fontWeight="600"
          >
            3/3
          </text>
          <circle cx="128" cy="36" r="14" className="fill-success/30" />
          <circle cx="128" cy="36" r="7" className="fill-success" />
        </g>
      );
    case "supabase-projects":
    case "supabase-services":
      return (
        <g>
          {[0, 1, 2].map((row) => (
            <g key={row}>
              <circle
                cx="18"
                cy={22 + row * 16}
                r="3.5"
                className={row === 2 ? "fill-warning" : "fill-success"}
              />
              <rect
                x="28"
                y={19 + row * 16}
                width={88 - row * 12}
                height="6"
                rx="2"
                className="fill-muted-foreground/35"
              />
            </g>
          ))}
        </g>
      );
    case "supabase-traffic":
      return (
        <g>
          {[0, 1, 2, 3].map((row) => (
            <g key={row}>
              <rect
                x="12"
                y={12 + row * 14}
                width="28"
                height="4"
                rx="2"
                className="fill-muted-foreground/35"
              />
              <rect
                x="12"
                y={18 + row * 14}
                width={100 - row * 18}
                height="4"
                rx="2"
                className="fill-primary/70"
              />
            </g>
          ))}
        </g>
      );
    case "supabase-requests":
      return (
        <g>
          <text x="12" y="24" className="fill-muted-foreground" fontSize="8">
            7-day requests
          </text>
          <text
            x="12"
            y="52"
            className="fill-foreground"
            fontSize="20"
            fontWeight="600"
          >
            128k
          </text>
        </g>
      );
    case "supabase-advisors":
      return (
        <g>
          <text x="12" y="24" className="fill-muted-foreground" fontSize="8">
            findings
          </text>
          <text
            x="12"
            y="52"
            className="fill-foreground"
            fontSize="22"
            fontWeight="600"
          >
            2
          </text>
          <text x="90" y="52" className="fill-warning" fontSize="10">
            review
          </text>
        </g>
      );
    case "qonto-balance":
      return (
        <g>
          <text x="12" y="24" className="fill-muted-foreground" fontSize="8">
            total cash
          </text>
          <text
            x="12"
            y="52"
            className="fill-foreground"
            fontSize="20"
            fontWeight="600"
          >
            €48.2k
          </text>
        </g>
      );
    case "qonto-liquidity":
      return (
        <g>
          <text x="12" y="24" className="fill-muted-foreground" fontSize="8">
            available
          </text>
          <text
            x="12"
            y="48"
            className="fill-foreground"
            fontSize="18"
            fontWeight="600"
          >
            €46.1k
          </text>
          <text x="12" y="64" className="fill-muted-foreground" fontSize="7">
            €2.1k pending
          </text>
        </g>
      );
    case "qonto-cashflow":
      return (
        <g>
          <text x="12" y="24" className="fill-muted-foreground" fontSize="8">
            30-day net
          </text>
          <text
            x="12"
            y="52"
            className="fill-success"
            fontSize="20"
            fontWeight="600"
          >
            +€8.4k
          </text>
        </g>
      );
    case "qonto-in-out":
      return (
        <g>
          <text x="12" y="18" className="fill-muted-foreground" fontSize="7">
            in
          </text>
          <rect
            x="12"
            y="22"
            width="110"
            height="8"
            rx="4"
            className="fill-muted"
          />
          <rect
            x="12"
            y="22"
            width="96"
            height="8"
            rx="4"
            className="fill-success"
          />
          <text x="12" y="46" className="fill-muted-foreground" fontSize="7">
            out
          </text>
          <rect
            x="12"
            y="50"
            width="110"
            height="8"
            rx="4"
            className="fill-muted"
          />
          <rect
            x="12"
            y="50"
            width="62"
            height="8"
            rx="4"
            className="fill-foreground/60"
          />
        </g>
      );
    case "qonto-accounts":
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
          <rect
            x="78"
            y="22"
            width="52"
            height="5"
            rx="2"
            className="fill-muted-foreground/35"
          />
          <rect
            x="78"
            y="36"
            width="40"
            height="5"
            rx="2"
            className="fill-muted-foreground/35"
          />
          <rect
            x="78"
            y="50"
            width="34"
            height="5"
            rx="2"
            className="fill-muted-foreground/35"
          />
        </g>
      );
    case "qonto-history":
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
    // Payment, order, error and email feeds are all row lists.
    case "stripe-payments":
    case "lemonsqueezy-orders":
    case "sentry-recent":
    case "resend-emails":
    case "qonto-transactions":
      return (
        <g>
          {[0, 1, 2].map((row) => (
            <g key={row}>
              <rect
                x="12"
                y={16 + row * 16}
                width="70"
                height="6"
                rx="2"
                className="fill-muted-foreground/35"
              />
              <rect
                x="110"
                y={16 + row * 16}
                width="36"
                height="6"
                rx="2"
                className={
                  row === 0 ? "fill-success/70" : "fill-muted-foreground/35"
                }
              />
            </g>
          ))}
        </g>
      );
    case "status-board":
      return (
        <g>
          {[0, 1, 2].map((row) => (
            <g key={row}>
              <circle
                cx="18"
                cy={22 + row * 16}
                r="3.5"
                className={row === 2 ? "fill-warning" : "fill-success"}
              />
              <rect
                x="28"
                y={19 + row * 16}
                width={80 - row * 12}
                height="6"
                rx="2"
                className="fill-muted-foreground/35"
              />
            </g>
          ))}
        </g>
      );
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}
