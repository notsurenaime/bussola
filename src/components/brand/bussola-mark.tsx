/*
 * The /ssr entry, not the default one: the default export is marked
 * "use client", so importing it into a server component (not-found, error
 * pages) fails at build time with "createContext is not a function". The SSR
 * build renders identically and stays usable from client components too.
 */
import { CompassRoseIcon } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";

type BussolaMarkProps = {
  className?: string;
  title?: string;
};

/** Phosphor CompassRose (fill) — brand mark. */
export function BussolaMark({
  className,
  title = "Bussola",
}: BussolaMarkProps) {
  return (
    <CompassRoseIcon
      weight="fill"
      alt={title}
      className={cn("size-5 shrink-0", className)}
      role="img"
    />
  );
}
