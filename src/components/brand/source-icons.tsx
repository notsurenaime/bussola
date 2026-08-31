import { cn } from "@/lib/utils";
import type { Provider } from "@/lib/providers";

type SourceIconProps = {
  provider: Provider | "multi";
  className?: string;
  /**
   * When false, swap light/dark assets for contrast on primary (inverted) surfaces.
   * Default true = brand asset matched to the current color scheme.
   */
  branded?: boolean;
};

type SourceMeta = {
  title: string;
  onLight?: string;
  onDark?: string;
  /** Inline fallback when no Brandfetch asset exists */
  path?: string;
  hex?: string;
};

const FALLBACK_MULTI: SourceMeta = {
  title: "Multi",
  hex: "E8B88A",
  path: "M4 6a2 2 0 0 1 2-2h4v6H4V6zm10-2h4a2 2 0 0 1 2 2v4h-6V4zM4 14h6v6H6a2 2 0 0 1-2-2v-4zm10 0h6v4a2 2 0 0 1-2 2h-4v-6z",
};

const FALLBACK_WEBTRAFFIC: SourceMeta = {
  title: "Webtraffic",
  hex: "92817A",
  path: "M3 17h3v4H3v-4zm5-6h3v10H8V11zm5-4h3v14h-3V7zm5-3h3v17h-3V4z",
};

/** Brandfetch assets in /public/brands — on-light = for light UI, on-dark = for dark UI */
const ICONS: Record<string, SourceMeta> = {
  railway: {
    title: "Railway",
    onLight: "/brands/railway/on-light.svg",
    onDark: "/brands/railway/on-dark.svg",
  },
  netlify: {
    title: "Netlify",
    onLight: "/brands/netlify/on-light.svg",
    onDark: "/brands/netlify/on-dark.svg",
  },
  supabase: {
    title: "Supabase",
    onLight: "/brands/supabase/on-light.svg",
    onDark: "/brands/supabase/on-dark.svg",
  },
  stripe: {
    title: "Stripe",
    onLight: "/brands/stripe/on-light.jpeg",
    onDark: "/brands/stripe/on-dark.jpeg",
  },
  vercel: {
    title: "Vercel",
    onLight: "/brands/vercel/on-light.svg",
    onDark: "/brands/vercel/on-dark.svg",
  },
  qonto: {
    title: "Qonto",
    onLight: "/brands/qonto/on-light.jpeg",
    onDark: "/brands/qonto/on-dark.jpeg",
  },
  attio: {
    title: "Attio",
    onLight: "/brands/attio/on-light.svg",
    onDark: "/brands/attio/on-dark.svg",
  },
  polar: {
    title: "Polar",
    onLight: "/brands/polar/on-light.png",
    onDark: "/brands/polar/on-dark.png",
  },
  webtraffic: FALLBACK_WEBTRAFFIC,
  multi: FALLBACK_MULTI,
};

export function getSourceMeta(provider: string): SourceMeta {
  return ICONS[provider] || FALLBACK_MULTI;
}

function FallbackIcon({
  meta,
  className,
  branded,
}: {
  meta: SourceMeta;
  className?: string;
  branded: boolean;
}) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-4 shrink-0", className)}
      aria-label={meta.title}
    >
      <title>{meta.title}</title>
      <path
        d={meta.path}
        fill={branded && meta.hex ? `#${meta.hex}` : "currentColor"}
      />
    </svg>
  );
}

export function SourceIcon({
  provider,
  className,
  branded = true,
}: SourceIconProps) {
  const meta = getSourceMeta(provider);

  if (!meta.onLight || !meta.onDark) {
    return (
      <FallbackIcon meta={meta} className={className} branded={branded} />
    );
  }

  // branded: match page theme. !branded: invert for contrast on primary buttons.
  const lightSrc = branded ? meta.onLight : meta.onDark;
  const darkSrc = branded ? meta.onDark : meta.onLight;

  return (
    <span
      className={cn("relative inline-flex size-4 shrink-0", className)}
      role="img"
      aria-label={meta.title}
    >
      <img
        src={lightSrc}
        alt=""
        className="size-full object-contain dark:hidden"
        draggable={false}
      />
      <img
        src={darkSrc}
        alt=""
        className="hidden size-full object-contain dark:block"
        draggable={false}
      />
    </span>
  );
}
