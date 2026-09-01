CREATE TABLE "connection_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"kind" text NOT NULL,
	"payload_json" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "sync_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "next_sync_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "consecutive_failures" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "connection_snapshots" ADD CONSTRAINT "connection_snapshots_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connection_snapshots" ADD CONSTRAINT "connection_snapshots_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "snapshot_connection_kind_key" ON "connection_snapshots" USING btree ("connection_id","kind");--> statement-breakpoint
CREATE INDEX "snapshot_org_idx" ON "connection_snapshots" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "connections_due_idx" ON "connections" USING btree ("next_sync_at");