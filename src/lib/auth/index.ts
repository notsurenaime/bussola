import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins/organization";
import { and, count, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { isCloud, isSelfHosted } from "@/lib/edition";
import { createId } from "@/lib/id";

/**
 * Identity, in one place, for both editions.
 *
 * Self-hosted accepts exactly one account — the first person to reach /signup
 * claims the instance and every later attempt is refused. Cloud leaves signup
 * open. Everything else (password rules, sessions, organizations) is identical,
 * so there is one auth implementation to reason about rather than two.
 */
let authPromise: Promise<Auth> | undefined;

function secret(): string {
  const value = process.env.BETTER_AUTH_SECRET;
  if (value) return value;
  if (isCloud) {
    throw new Error(
      "BETTER_AUTH_SECRET is required when BUSSOLA_EDITION=cloud.",
    );
  }
  // Deterministic local-dev fallback, same policy as the encryption vault:
  // convenient on a laptop, refused in the hosted edition.
  return "bussola-local-dev-auth-secret";
}

/** A URL-safe organization slug derived from the account's email. */
function slugFor(email: string): string {
  const base =
    email
      .split("@")[0]
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "workspace";
  return `${base}-${createId().slice(0, 6)}`;
}

async function build() {
  const db = await getDb();

  return betterAuth({
    secret: secret(),
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
    database: drizzleAdapter(db, { provider: "pg", schema }),

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      // Phase 4 wires a real sender; until then a hosted deployment should keep
      // verification off rather than send nothing and lock people out.
      requireEmailVerification: false,
    },

    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },

    databaseHooks: {
      user: {
        create: {
          async before(data) {
            if (isSelfHosted) {
              const existing = await db
                .select({ id: schema.user.id })
                .from(schema.user)
                .limit(1);
              if (existing.length > 0) {
                throw new APIError("FORBIDDEN", {
                  message:
                    "This Bussola instance already has an account. Self-hosted installs are single-user; run the hosted edition for teams.",
                });
              }
            }
            return { data };
          },

          /**
           * Every account gets an organization immediately, so there is no
           * window in which a signed-in user has no tenant to act in.
           */
          async after(created) {
            const organizationId = createId("org");
            await db.insert(schema.organization).values({
              id: organizationId,
              name: created.name?.trim() || "Personal",
              slug: slugFor(created.email),
            });
            await db.insert(schema.member).values({
              id: createId("mem"),
              organizationId,
              userId: created.id,
              role: "owner",
            });
          },
        },
      },

      session: {
        create: {
          /** Bind each new session to the user's organization. */
          async before(data) {
            const [membership] = await db
              .select({ organizationId: schema.member.organizationId })
              .from(schema.member)
              .where(eq(schema.member.userId, data.userId))
              .limit(1);

            return {
              data: {
                ...data,
                activeOrganizationId: membership?.organizationId ?? null,
              },
            };
          },
        },
      },
    },

    plugins: [
      organization({
        /**
         * Seats are what the Team plan sells, so an invitation that would take
         * an organization past its allowance is refused before it is sent —
         * far better than letting someone accept and then bounce off a limit.
         */
        async beforeCreateInvitation({
          organization: org,
        }: {
          organization: { id: string };
        }) {
          const { entitlementsFor } = await import(
            "@/lib/billing/entitlements"
          );
          const entitlements = await entitlementsFor(org.id);
          if (!Number.isFinite(entitlements.limits.seats)) return;

          const [members] = await db
            .select({ value: count() })
            .from(schema.member)
            .where(eq(schema.member.organizationId, org.id));
          const [pending] = await db
            .select({ value: count() })
            .from(schema.invitation)
            .where(
              and(
                eq(schema.invitation.organizationId, org.id),
                eq(schema.invitation.status, "pending"),
              ),
            );

          const used = (members?.value ?? 0) + (pending?.value ?? 0);
          if (used >= entitlements.limits.seats) {
            throw new APIError("PAYMENT_REQUIRED", {
              message: `Your ${entitlements.planName} plan includes ${entitlements.limits.seats} seats. Add a seat to invite more people.`,
            });
          }
        },
        // Self-hosted has exactly one organization; cloud lets an owner run
        // several (agency with multiple clients, say).
        allowUserToCreateOrganization: isCloud,
      }),
      // Must stay last: it lets Better Auth set cookies from server actions.
      nextCookies(),
    ],
  });
}

/** Inferred from the concrete configuration so plugin routes stay typed. */
type Auth = Awaited<ReturnType<typeof build>>;

export function getAuth(): Promise<Auth> {
  authPromise ??= build();
  return authPromise;
}
