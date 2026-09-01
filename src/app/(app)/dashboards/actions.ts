"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTenant } from "@/lib/auth/tenant";
import { overLimit } from "@/lib/billing/guard";

/**
 * Mutations for the dashboard list.
 *
 * Server Actions rather than fetch calls to the route handlers: the list is a
 * server component, so a mutation followed by revalidatePath re-renders it from
 * the database with no client-side copy of the data to keep in sync. The route
 * handlers stay for the MCP server and anything else outside the browser.
 */
const nameSchema = z.string().min(1).max(80);

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createDashboardAction(
  formData: FormData,
): Promise<ActionResult> {
  const parsed = nameSchema.safeParse(
    String(formData.get("name") ?? "").trim(),
  );
  if (!parsed.success) return { ok: false, error: "Name required" };

  const repos = await requireTenant();

  const denied = await overLimit(
    repos,
    "dashboards",
    await repos.dashboards.count(),
  );
  if (denied) {
    const body = (await denied.json()) as { error?: string };
    return { ok: false, error: body.error ?? "Plan limit reached" };
  }

  const dashboard = await repos.dashboards.create(parsed.data);
  revalidatePath("/dashboards");
  redirect(`/dashboards/${dashboard.id}?addWidget=1`);
}

export async function deleteDashboardAction(
  id: string,
): Promise<ActionResult> {
  const repos = await requireTenant();
  const removed = await repos.dashboards.remove(id);
  if (!removed) return { ok: false, error: "Dashboard not found" };

  revalidatePath("/dashboards");
  return { ok: true };
}

export async function starDashboardAction(
  id: string,
  starred: boolean,
): Promise<ActionResult> {
  const repos = await requireTenant();
  const dashboard = await repos.dashboards.star(id, starred);
  if (!dashboard) return { ok: false, error: "Dashboard not found" };

  revalidatePath("/dashboards", "layout");
  return { ok: true };
}
