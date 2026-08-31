CREATE TABLE "connection_history" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"kind" text NOT NULL,
	"payload_json" text NOT NULL,
	"bucket" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "plan" SET DEFAULT 'trial';--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "extra_seats" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "connection_history" ADD CONSTRAINT "connection_history_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connection_history" ADD CONSTRAINT "connection_history_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "history_conn_kind_bucket_key" ON "connection_history" USING btree ("connection_id","kind","bucket");--> statement-breakpoint
CREATE INDEX "history_org_bucket_idx" ON "connection_history" USING btree ("organization_id","bucket");