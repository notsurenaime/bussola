import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown while a server component fetches. Mirrors the page header plus a few
 * rows so the layout does not jump once the real content arrives.
 */
export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}
