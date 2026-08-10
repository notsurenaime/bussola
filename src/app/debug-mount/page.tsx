"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";

export default function DebugMountPage() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/dashboards")
      .then((r) => r.json())
      .then((data: { dashboards?: Array<{ name: string }> }) => {
        setItems((data.dashboards || []).map((d) => d.name));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div className="space-y-4 p-4">
        <h1>Debug mount</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button type="button">Open</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create</DialogTitle>
              <DialogDescription>Test dialog</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" onClick={() => setOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <p>{loading ? "Loading…" : items.join(", ") || "empty"}</p>
        <Toaster />
      </div>
    </AppShell>
  );
}
