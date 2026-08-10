import { CompassRoseIcon } from "@phosphor-icons/react";
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
