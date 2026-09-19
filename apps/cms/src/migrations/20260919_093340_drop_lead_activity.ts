import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "leads_activity" CASCADE;
  DROP TYPE "public"."enum_leads_activity_type";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_leads_activity_type" AS ENUM('call', 'wechat', 'visit', 'quote');
  CREATE TABLE "leads_activity" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"time" timestamp(3) with time zone NOT NULL,
  	"type" "enum_leads_activity_type",
  	"summary" varchar
  );
  
  ALTER TABLE "leads_activity" ADD CONSTRAINT "leads_activity_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "leads_activity_order_idx" ON "leads_activity" USING btree ("_order");
  CREATE INDEX "leads_activity_parent_id_idx" ON "leads_activity" USING btree ("_parent_id");`)
}
