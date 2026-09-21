import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE UNIQUE INDEX "project_idx" ON "page_home" USING btree ("project_id");
  CREATE UNIQUE INDEX "project_1_idx" ON "page_features" USING btree ("project_id");
  CREATE UNIQUE INDEX "project_2_idx" ON "page_solutions" USING btree ("project_id");
  CREATE UNIQUE INDEX "project_3_idx" ON "page_pricing" USING btree ("project_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "project_idx";
  DROP INDEX "project_1_idx";
  DROP INDEX "project_2_idx";
  DROP INDEX "project_3_idx";`)
}
