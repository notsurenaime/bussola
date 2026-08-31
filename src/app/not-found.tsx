import Link from "next/link";
import { BussolaMark } from "@/components/brand/bussola-mark";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <BussolaMark className="size-8 text-almond-cream-400" />
      <div className="space-y-1.5">
        <h1 className="text-lg font-medium">This page does not exist</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          The dashboard may have been deleted, or the link may be wrong.
        </p>
      </div>
      <Link
        href="/dashboards"
        className="text-sm font-medium underline-offset-4 hover:underline"
      >
        Back to dashboards
      </Link>
    </div>
  );
}
