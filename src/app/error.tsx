"use client";

import { useEffect } from "react";
import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

/**
 * Anything that throws while rendering a page lands here instead of on Next's
 * default screen. It says what to do next and never shows the raw message,
 * which can carry internals; the digest is enough to find the real error in
 * the logs.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[bussola] page error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="space-y-1.5">
        <h1 className="text-lg font-medium">Something broke on this page</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          The rest of Bussola is unaffected. Try again — if it keeps happening,
          the reference below identifies it in the logs.
        </p>
      </div>
      <Button type="button" onClick={reset}>
        <ArrowClockwiseIcon className="size-4" />
        Try again
      </Button>
      {error.digest ? (
        <p className="font-mono text-xs text-muted-foreground">
          {error.digest}
        </p>
      ) : null}
    </div>
  );
}
