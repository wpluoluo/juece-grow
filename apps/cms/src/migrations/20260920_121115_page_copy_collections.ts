import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_page_home_hero_diagram_nodes_tone" AS ENUM('saas', 'erp', 'yunque');
  CREATE TYPE "public"."enum_page_home_products_side_icon" AS ENUM('saas', 'erp', 'yunque');
  CREATE TYPE "public"."enum_page_home_cases_minis_tone" AS ENUM('saas', 'erp', 'yunque');
  CREATE TYPE "public"."enum_page_home_cta_rows_icon" AS ENUM('saas', 'erp', 'yunque');
  CREATE TYPE "public"."enum_page_home_cta_rows_action" AS ENUM('lead', 'href');
  CREATE TYPE "public"."enum_page_home_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_page_home_hero_primary_action" AS ENUM('lead', 'href');
  CREATE TYPE "public"."enum_page_home_products_spotlight_icon" AS ENUM('saas', 'erp', 'yunque');
  CREATE TYPE "public"."enum_page_features_blocks_agent_pegs_pos" AS ENUM('p1', 'p2', 'p3', 'p4');
  CREATE TYPE "public"."enum_page_features_blocks_agent_pegs_icon" AS ENUM('task', 'memory', 'gov', 'ext');
  CREATE TYPE "public"."enum_page_features_caps_tag_tone" AS ENUM('yb');
  CREATE TYPE "public"."enum_page_features_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_page_solutions_industries_tone" AS ENUM('saas', 'erp', 'yunque');
  CREATE TYPE "public"."enum_page_solutions_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_page_pricing_status" AS ENUM('draft', 'published');
  CREATE TABLE "page_home_hero_title_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL,
  	"emphasis" boolean
  );
  
  CREATE TABLE "page_home_hero_stats" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"strong" varchar NOT NULL,
  	"span" varchar NOT NULL
  );
  
  CREATE TABLE "page_home_hero_diagram_nodes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"no" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"sub" varchar NOT NULL,
  	"tone" "enum_page_home_hero_diagram_nodes_tone" NOT NULL
  );
  
  CREATE TABLE "page_home_products_side" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tag" varchar NOT NULL,
  	"icon" "enum_page_home_products_side_icon" NOT NULL,
  	"name" varchar NOT NULL,
  	"desc" varchar NOT NULL,
  	"link_label" varchar NOT NULL,
  	"link_href" varchar NOT NULL,
  	"link_external" boolean
  );
  
  CREATE TABLE "page_home_solutions_rows" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"audience" varchar NOT NULL,
  	"desc" varchar NOT NULL
  );
  
  CREATE TABLE "page_home_cases_feature_metrics" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar NOT NULL,
  	"label" varchar NOT NULL
  );
  
  CREATE TABLE "page_home_cases_minis" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"band" varchar NOT NULL,
  	"tone" "enum_page_home_cases_minis_tone",
  	"title" varchar NOT NULL,
  	"desc" varchar NOT NULL,
  	"tag" varchar NOT NULL
  );
  
  CREATE TABLE "page_home_resource_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"sub" varchar NOT NULL,
  	"href" varchar NOT NULL,
  	"external" boolean
  );
  
  CREATE TABLE "page_home_cta_rows" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"icon" "enum_page_home_cta_rows_icon" NOT NULL,
  	"head" varchar NOT NULL,
  	"desc" varchar NOT NULL,
  	"act" varchar NOT NULL,
  	"action" "enum_page_home_cta_rows_action" NOT NULL,
  	"href" varchar,
  	"external" boolean
  );
  
  CREATE TABLE "page_home" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"project_id" integer NOT NULL,
  	"status" "enum_page_home_status" DEFAULT 'draft' NOT NULL,
  	"meta_title" varchar NOT NULL,
  	"meta_description" varchar NOT NULL,
  	"hero_kicker" varchar NOT NULL,
  	"hero_desc" varchar NOT NULL,
  	"hero_primary_label" varchar NOT NULL,
  	"hero_primary_action" "enum_page_home_hero_primary_action" NOT NULL,
  	"hero_primary_href" varchar,
  	"hero_secondary_label" varchar NOT NULL,
  	"hero_secondary_href" varchar NOT NULL,
  	"hero_diagram_core_name" varchar NOT NULL,
  	"hero_diagram_core_sub" varchar NOT NULL,
  	"products_kicker" varchar NOT NULL,
  	"products_heading" varchar NOT NULL,
  	"products_desc" varchar NOT NULL,
  	"products_spotlight_tag" varchar NOT NULL,
  	"products_spotlight_icon" "enum_page_home_products_spotlight_icon" NOT NULL,
  	"products_spotlight_name" varchar NOT NULL,
  	"products_spotlight_desc" varchar NOT NULL,
  	"products_spotlight_link_label" varchar NOT NULL,
  	"products_spotlight_link_href" varchar NOT NULL,
  	"products_spotlight_link_external" boolean,
  	"solutions_kicker" varchar NOT NULL,
  	"solutions_heading" varchar NOT NULL,
  	"solutions_more_label" varchar NOT NULL,
  	"solutions_more_href" varchar NOT NULL,
  	"cases_kicker" varchar NOT NULL,
  	"cases_heading" varchar NOT NULL,
  	"cases_feature_band" varchar NOT NULL,
  	"cases_feature_title" varchar NOT NULL,
  	"cases_feature_desc" varchar NOT NULL,
  	"resource_kicker" varchar NOT NULL,
  	"resource_heading" varchar NOT NULL,
  	"resource_desc" varchar NOT NULL,
  	"cta_kicker" varchar NOT NULL,
  	"cta_heading" varchar NOT NULL,
  	"cta_desc" varchar NOT NULL,
  	"blog_kicker" varchar NOT NULL,
  	"blog_heading" varchar NOT NULL,
  	"blog_desc" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "page_home_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "page_features_hero_title_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL,
  	"emphasis" boolean
  );
  
  CREATE TABLE "page_features_hero_stats" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar NOT NULL,
  	"label" varchar NOT NULL
  );
  
  CREATE TABLE "page_features_blocks_blocks_blocks" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"no" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"note" varchar NOT NULL,
  	"w" varchar NOT NULL
  );
  
  CREATE TABLE "page_features_blocks_blocks" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"badge" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "page_features_blocks_chips_rows" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"w" numeric NOT NULL,
  	"val" varchar NOT NULL
  );
  
  CREATE TABLE "page_features_blocks_chips" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"badge" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "page_features_blocks_bars_kpis" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"val" varchar NOT NULL,
  	"label" varchar NOT NULL
  );
  
  CREATE TABLE "page_features_blocks_bars" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"badge" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "page_features_blocks_journey" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"badge" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "page_features_blocks_agent_pegs" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"pos" "enum_page_features_blocks_agent_pegs_pos" NOT NULL,
  	"icon" "enum_page_features_blocks_agent_pegs_icon" NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "page_features_blocks_agent" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"badge" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"core" varchar NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "page_features_caps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"no" varchar NOT NULL,
  	"tag" varchar NOT NULL,
  	"tag_tone" "enum_page_features_caps_tag_tone",
  	"title" varchar NOT NULL,
  	"reverse" boolean,
  	"aside_p" varchar NOT NULL
  );
  
  CREATE TABLE "page_features_base_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"desc" varchar NOT NULL
  );
  
  CREATE TABLE "page_features" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"project_id" integer NOT NULL,
  	"status" "enum_page_features_status" DEFAULT 'draft' NOT NULL,
  	"meta_title" varchar NOT NULL,
  	"meta_description" varchar NOT NULL,
  	"hero_kicker" varchar NOT NULL,
  	"hero_description" varchar NOT NULL,
  	"base_kicker" varchar NOT NULL,
  	"base_heading" varchar NOT NULL,
  	"cta_kicker" varchar NOT NULL,
  	"cta_heading" varchar NOT NULL,
  	"cta_desc" varchar NOT NULL,
  	"cta_btn_text" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "page_features_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "page_features_numbers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"number" numeric,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL
  );
  
  CREATE TABLE "page_solutions_hero_title_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL,
  	"emphasis" boolean
  );
  
  CREATE TABLE "page_solutions_hero_stats" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar NOT NULL,
  	"label" varchar NOT NULL
  );
  
  CREATE TABLE "page_solutions_industries_scenarios" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"desc" varchar NOT NULL
  );
  
  CREATE TABLE "page_solutions_industries" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"meta" varchar NOT NULL,
  	"blurb" varchar NOT NULL,
  	"tone" "enum_page_solutions_industries_tone" NOT NULL
  );
  
  CREATE TABLE "page_solutions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"project_id" integer NOT NULL,
  	"status" "enum_page_solutions_status" DEFAULT 'draft' NOT NULL,
  	"meta_title" varchar NOT NULL,
  	"meta_description" varchar NOT NULL,
  	"hero_kicker" varchar NOT NULL,
  	"hero_description" varchar NOT NULL,
  	"cta_kicker" varchar NOT NULL,
  	"cta_heading" varchar NOT NULL,
  	"cta_desc" varchar NOT NULL,
  	"cta_btn_text" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "page_solutions_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "page_pricing_hero_title_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL,
  	"emphasis" boolean
  );
  
  CREATE TABLE "page_pricing_plans" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"price" varchar NOT NULL,
  	"unit" varchar,
  	"currency" varchar,
  	"desc" varchar NOT NULL,
  	"btn_text" varchar NOT NULL,
  	"highlight" boolean,
  	"rec_tag" varchar
  );
  
  CREATE TABLE "page_pricing_eco_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"href" varchar NOT NULL,
  	"ghost" boolean
  );
  
  CREATE TABLE "page_pricing_faqs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"q" varchar NOT NULL,
  	"a" varchar NOT NULL
  );
  
  CREATE TABLE "page_pricing" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"project_id" integer NOT NULL,
  	"status" "enum_page_pricing_status" DEFAULT 'draft' NOT NULL,
  	"meta_title" varchar NOT NULL,
  	"meta_description" varchar NOT NULL,
  	"hero_kicker" varchar NOT NULL,
  	"hero_description" varchar NOT NULL,
  	"eco_kicker" varchar NOT NULL,
  	"eco_heading" varchar NOT NULL,
  	"eco_desc" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "page_pricing_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "page_home_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "page_features_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "page_solutions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "page_pricing_id" integer;
  ALTER TABLE "page_home_hero_title_lines" ADD CONSTRAINT "page_home_hero_title_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."page_home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_home_hero_stats" ADD CONSTRAINT "page_home_hero_stats_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."page_home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_home_hero_diagram_nodes" ADD CONSTRAINT "page_home_hero_diagram_nodes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."page_home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_home_products_side" ADD CONSTRAINT "page_home_products_side_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."page_home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_home_solutions_rows" ADD CONSTRAINT "page_home_solutions_rows_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."page_home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_home_cases_feature_metrics" ADD CONSTRAINT "page_home_cases_feature_metrics_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."page_home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_home_cases_minis" ADD CONSTRAINT "page_home_cases_minis_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."page_home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_home_resource_links" ADD CONSTRAINT "page_home_resource_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."page_home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_home_cta_rows" ADD CONSTRAINT "page_home_cta_rows_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."page_home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_home" ADD CONSTRAINT "page_home_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "page_home_texts" ADD CONSTRAINT "page_home_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."page_home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_features_hero_title_lines" ADD CONSTRAINT "page_features_hero_title_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."page_features"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_features_hero_stats" ADD CONSTRAINT "page_features_hero_stats_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."page_features"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_features_blocks_blocks_blocks" ADD CONSTRAINT "page_features_blocks_blocks_blocks_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."page_features_blocks_blocks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_features_blocks_blocks" ADD CONSTRAINT "page_features_blocks_blocks_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."page_features"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_features_blocks_chips_rows" ADD CONSTRAINT "page_features_blocks_chips_rows_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."page_features_blocks_chips"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_features_blocks_chips" ADD CONSTRAINT "page_features_blocks_chips_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."page_features"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_features_blocks_bars_kpis" ADD CONSTRAINT "page_features_blocks_bars_kpis_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."page_features_blocks_bars"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_features_blocks_bars" ADD CONSTRAINT "page_features_blocks_bars_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."page_features"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_features_blocks_journey" ADD CONSTRAINT "page_features_blocks_journey_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."page_features"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_features_blocks_agent_pegs" ADD CONSTRAINT "page_features_blocks_agent_pegs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."page_features_blocks_agent"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_features_blocks_agent" ADD CONSTRAINT "page_features_blocks_agent_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."page_features"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_features_caps" ADD CONSTRAINT "page_features_caps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."page_features"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_features_base_items" ADD CONSTRAINT "page_features_base_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."page_features"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_features" ADD CONSTRAINT "page_features_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "page_features_texts" ADD CONSTRAINT "page_features_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."page_features"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_features_numbers" ADD CONSTRAINT "page_features_numbers_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."page_features"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_solutions_hero_title_lines" ADD CONSTRAINT "page_solutions_hero_title_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."page_solutions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_solutions_hero_stats" ADD CONSTRAINT "page_solutions_hero_stats_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."page_solutions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_solutions_industries_scenarios" ADD CONSTRAINT "page_solutions_industries_scenarios_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."page_solutions_industries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_solutions_industries" ADD CONSTRAINT "page_solutions_industries_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."page_solutions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_solutions" ADD CONSTRAINT "page_solutions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "page_solutions_texts" ADD CONSTRAINT "page_solutions_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."page_solutions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_pricing_hero_title_lines" ADD CONSTRAINT "page_pricing_hero_title_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."page_pricing"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_pricing_plans" ADD CONSTRAINT "page_pricing_plans_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."page_pricing"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_pricing_eco_links" ADD CONSTRAINT "page_pricing_eco_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."page_pricing"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_pricing_faqs" ADD CONSTRAINT "page_pricing_faqs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."page_pricing"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_pricing" ADD CONSTRAINT "page_pricing_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "page_pricing_texts" ADD CONSTRAINT "page_pricing_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."page_pricing"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "page_home_hero_title_lines_order_idx" ON "page_home_hero_title_lines" USING btree ("_order");
  CREATE INDEX "page_home_hero_title_lines_parent_id_idx" ON "page_home_hero_title_lines" USING btree ("_parent_id");
  CREATE INDEX "page_home_hero_stats_order_idx" ON "page_home_hero_stats" USING btree ("_order");
  CREATE INDEX "page_home_hero_stats_parent_id_idx" ON "page_home_hero_stats" USING btree ("_parent_id");
  CREATE INDEX "page_home_hero_diagram_nodes_order_idx" ON "page_home_hero_diagram_nodes" USING btree ("_order");
  CREATE INDEX "page_home_hero_diagram_nodes_parent_id_idx" ON "page_home_hero_diagram_nodes" USING btree ("_parent_id");
  CREATE INDEX "page_home_products_side_order_idx" ON "page_home_products_side" USING btree ("_order");
  CREATE INDEX "page_home_products_side_parent_id_idx" ON "page_home_products_side" USING btree ("_parent_id");
  CREATE INDEX "page_home_solutions_rows_order_idx" ON "page_home_solutions_rows" USING btree ("_order");
  CREATE INDEX "page_home_solutions_rows_parent_id_idx" ON "page_home_solutions_rows" USING btree ("_parent_id");
  CREATE INDEX "page_home_cases_feature_metrics_order_idx" ON "page_home_cases_feature_metrics" USING btree ("_order");
  CREATE INDEX "page_home_cases_feature_metrics_parent_id_idx" ON "page_home_cases_feature_metrics" USING btree ("_parent_id");
  CREATE INDEX "page_home_cases_minis_order_idx" ON "page_home_cases_minis" USING btree ("_order");
  CREATE INDEX "page_home_cases_minis_parent_id_idx" ON "page_home_cases_minis" USING btree ("_parent_id");
  CREATE INDEX "page_home_resource_links_order_idx" ON "page_home_resource_links" USING btree ("_order");
  CREATE INDEX "page_home_resource_links_parent_id_idx" ON "page_home_resource_links" USING btree ("_parent_id");
  CREATE INDEX "page_home_cta_rows_order_idx" ON "page_home_cta_rows" USING btree ("_order");
  CREATE INDEX "page_home_cta_rows_parent_id_idx" ON "page_home_cta_rows" USING btree ("_parent_id");
  CREATE INDEX "page_home_project_idx" ON "page_home" USING btree ("project_id");
  CREATE INDEX "page_home_updated_at_idx" ON "page_home" USING btree ("updated_at");
  CREATE INDEX "page_home_created_at_idx" ON "page_home" USING btree ("created_at");
  CREATE INDEX "page_home_texts_order_parent" ON "page_home_texts" USING btree ("order","parent_id");
  CREATE INDEX "page_features_hero_title_lines_order_idx" ON "page_features_hero_title_lines" USING btree ("_order");
  CREATE INDEX "page_features_hero_title_lines_parent_id_idx" ON "page_features_hero_title_lines" USING btree ("_parent_id");
  CREATE INDEX "page_features_hero_stats_order_idx" ON "page_features_hero_stats" USING btree ("_order");
  CREATE INDEX "page_features_hero_stats_parent_id_idx" ON "page_features_hero_stats" USING btree ("_parent_id");
  CREATE INDEX "page_features_blocks_blocks_blocks_order_idx" ON "page_features_blocks_blocks_blocks" USING btree ("_order");
  CREATE INDEX "page_features_blocks_blocks_blocks_parent_id_idx" ON "page_features_blocks_blocks_blocks" USING btree ("_parent_id");
  CREATE INDEX "page_features_blocks_blocks_order_idx" ON "page_features_blocks_blocks" USING btree ("_order");
  CREATE INDEX "page_features_blocks_blocks_parent_id_idx" ON "page_features_blocks_blocks" USING btree ("_parent_id");
  CREATE INDEX "page_features_blocks_blocks_path_idx" ON "page_features_blocks_blocks" USING btree ("_path");
  CREATE INDEX "page_features_blocks_chips_rows_order_idx" ON "page_features_blocks_chips_rows" USING btree ("_order");
  CREATE INDEX "page_features_blocks_chips_rows_parent_id_idx" ON "page_features_blocks_chips_rows" USING btree ("_parent_id");
  CREATE INDEX "page_features_blocks_chips_order_idx" ON "page_features_blocks_chips" USING btree ("_order");
  CREATE INDEX "page_features_blocks_chips_parent_id_idx" ON "page_features_blocks_chips" USING btree ("_parent_id");
  CREATE INDEX "page_features_blocks_chips_path_idx" ON "page_features_blocks_chips" USING btree ("_path");
  CREATE INDEX "page_features_blocks_bars_kpis_order_idx" ON "page_features_blocks_bars_kpis" USING btree ("_order");
  CREATE INDEX "page_features_blocks_bars_kpis_parent_id_idx" ON "page_features_blocks_bars_kpis" USING btree ("_parent_id");
  CREATE INDEX "page_features_blocks_bars_order_idx" ON "page_features_blocks_bars" USING btree ("_order");
  CREATE INDEX "page_features_blocks_bars_parent_id_idx" ON "page_features_blocks_bars" USING btree ("_parent_id");
  CREATE INDEX "page_features_blocks_bars_path_idx" ON "page_features_blocks_bars" USING btree ("_path");
  CREATE INDEX "page_features_blocks_journey_order_idx" ON "page_features_blocks_journey" USING btree ("_order");
  CREATE INDEX "page_features_blocks_journey_parent_id_idx" ON "page_features_blocks_journey" USING btree ("_parent_id");
  CREATE INDEX "page_features_blocks_journey_path_idx" ON "page_features_blocks_journey" USING btree ("_path");
  CREATE INDEX "page_features_blocks_agent_pegs_order_idx" ON "page_features_blocks_agent_pegs" USING btree ("_order");
  CREATE INDEX "page_features_blocks_agent_pegs_parent_id_idx" ON "page_features_blocks_agent_pegs" USING btree ("_parent_id");
  CREATE INDEX "page_features_blocks_agent_order_idx" ON "page_features_blocks_agent" USING btree ("_order");
  CREATE INDEX "page_features_blocks_agent_parent_id_idx" ON "page_features_blocks_agent" USING btree ("_parent_id");
  CREATE INDEX "page_features_blocks_agent_path_idx" ON "page_features_blocks_agent" USING btree ("_path");
  CREATE INDEX "page_features_caps_order_idx" ON "page_features_caps" USING btree ("_order");
  CREATE INDEX "page_features_caps_parent_id_idx" ON "page_features_caps" USING btree ("_parent_id");
  CREATE INDEX "page_features_base_items_order_idx" ON "page_features_base_items" USING btree ("_order");
  CREATE INDEX "page_features_base_items_parent_id_idx" ON "page_features_base_items" USING btree ("_parent_id");
  CREATE INDEX "page_features_project_idx" ON "page_features" USING btree ("project_id");
  CREATE INDEX "page_features_updated_at_idx" ON "page_features" USING btree ("updated_at");
  CREATE INDEX "page_features_created_at_idx" ON "page_features" USING btree ("created_at");
  CREATE INDEX "page_features_texts_order_parent" ON "page_features_texts" USING btree ("order","parent_id");
  CREATE INDEX "page_features_numbers_order_parent_idx" ON "page_features_numbers" USING btree ("order","parent_id");
  CREATE INDEX "page_solutions_hero_title_lines_order_idx" ON "page_solutions_hero_title_lines" USING btree ("_order");
  CREATE INDEX "page_solutions_hero_title_lines_parent_id_idx" ON "page_solutions_hero_title_lines" USING btree ("_parent_id");
  CREATE INDEX "page_solutions_hero_stats_order_idx" ON "page_solutions_hero_stats" USING btree ("_order");
  CREATE INDEX "page_solutions_hero_stats_parent_id_idx" ON "page_solutions_hero_stats" USING btree ("_parent_id");
  CREATE INDEX "page_solutions_industries_scenarios_order_idx" ON "page_solutions_industries_scenarios" USING btree ("_order");
  CREATE INDEX "page_solutions_industries_scenarios_parent_id_idx" ON "page_solutions_industries_scenarios" USING btree ("_parent_id");
  CREATE INDEX "page_solutions_industries_order_idx" ON "page_solutions_industries" USING btree ("_order");
  CREATE INDEX "page_solutions_industries_parent_id_idx" ON "page_solutions_industries" USING btree ("_parent_id");
  CREATE INDEX "page_solutions_project_idx" ON "page_solutions" USING btree ("project_id");
  CREATE INDEX "page_solutions_updated_at_idx" ON "page_solutions" USING btree ("updated_at");
  CREATE INDEX "page_solutions_created_at_idx" ON "page_solutions" USING btree ("created_at");
  CREATE INDEX "page_solutions_texts_order_parent" ON "page_solutions_texts" USING btree ("order","parent_id");
  CREATE INDEX "page_pricing_hero_title_lines_order_idx" ON "page_pricing_hero_title_lines" USING btree ("_order");
  CREATE INDEX "page_pricing_hero_title_lines_parent_id_idx" ON "page_pricing_hero_title_lines" USING btree ("_parent_id");
  CREATE INDEX "page_pricing_plans_order_idx" ON "page_pricing_plans" USING btree ("_order");
  CREATE INDEX "page_pricing_plans_parent_id_idx" ON "page_pricing_plans" USING btree ("_parent_id");
  CREATE INDEX "page_pricing_eco_links_order_idx" ON "page_pricing_eco_links" USING btree ("_order");
  CREATE INDEX "page_pricing_eco_links_parent_id_idx" ON "page_pricing_eco_links" USING btree ("_parent_id");
  CREATE INDEX "page_pricing_faqs_order_idx" ON "page_pricing_faqs" USING btree ("_order");
  CREATE INDEX "page_pricing_faqs_parent_id_idx" ON "page_pricing_faqs" USING btree ("_parent_id");
  CREATE INDEX "page_pricing_project_idx" ON "page_pricing" USING btree ("project_id");
  CREATE INDEX "page_pricing_updated_at_idx" ON "page_pricing" USING btree ("updated_at");
  CREATE INDEX "page_pricing_created_at_idx" ON "page_pricing" USING btree ("created_at");
  CREATE INDEX "page_pricing_texts_order_parent" ON "page_pricing_texts" USING btree ("order","parent_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_page_home_fk" FOREIGN KEY ("page_home_id") REFERENCES "public"."page_home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_page_features_fk" FOREIGN KEY ("page_features_id") REFERENCES "public"."page_features"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_page_solutions_fk" FOREIGN KEY ("page_solutions_id") REFERENCES "public"."page_solutions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_page_pricing_fk" FOREIGN KEY ("page_pricing_id") REFERENCES "public"."page_pricing"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_page_home_id_idx" ON "payload_locked_documents_rels" USING btree ("page_home_id");
  CREATE INDEX "payload_locked_documents_rels_page_features_id_idx" ON "payload_locked_documents_rels" USING btree ("page_features_id");
  CREATE INDEX "payload_locked_documents_rels_page_solutions_id_idx" ON "payload_locked_documents_rels" USING btree ("page_solutions_id");
  CREATE INDEX "payload_locked_documents_rels_page_pricing_id_idx" ON "payload_locked_documents_rels" USING btree ("page_pricing_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "page_home_hero_title_lines" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_home_hero_stats" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_home_hero_diagram_nodes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_home_products_side" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_home_solutions_rows" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_home_cases_feature_metrics" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_home_cases_minis" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_home_resource_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_home_cta_rows" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_home" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_home_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_features_hero_title_lines" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_features_hero_stats" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_features_blocks_blocks_blocks" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_features_blocks_blocks" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_features_blocks_chips_rows" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_features_blocks_chips" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_features_blocks_bars_kpis" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_features_blocks_bars" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_features_blocks_journey" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_features_blocks_agent_pegs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_features_blocks_agent" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_features_caps" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_features_base_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_features" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_features_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_features_numbers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_solutions_hero_title_lines" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_solutions_hero_stats" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_solutions_industries_scenarios" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_solutions_industries" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_solutions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_solutions_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_pricing_hero_title_lines" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_pricing_plans" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_pricing_eco_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_pricing_faqs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_pricing" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_pricing_texts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "page_home_hero_title_lines" CASCADE;
  DROP TABLE "page_home_hero_stats" CASCADE;
  DROP TABLE "page_home_hero_diagram_nodes" CASCADE;
  DROP TABLE "page_home_products_side" CASCADE;
  DROP TABLE "page_home_solutions_rows" CASCADE;
  DROP TABLE "page_home_cases_feature_metrics" CASCADE;
  DROP TABLE "page_home_cases_minis" CASCADE;
  DROP TABLE "page_home_resource_links" CASCADE;
  DROP TABLE "page_home_cta_rows" CASCADE;
  DROP TABLE "page_home" CASCADE;
  DROP TABLE "page_home_texts" CASCADE;
  DROP TABLE "page_features_hero_title_lines" CASCADE;
  DROP TABLE "page_features_hero_stats" CASCADE;
  DROP TABLE "page_features_blocks_blocks_blocks" CASCADE;
  DROP TABLE "page_features_blocks_blocks" CASCADE;
  DROP TABLE "page_features_blocks_chips_rows" CASCADE;
  DROP TABLE "page_features_blocks_chips" CASCADE;
  DROP TABLE "page_features_blocks_bars_kpis" CASCADE;
  DROP TABLE "page_features_blocks_bars" CASCADE;
  DROP TABLE "page_features_blocks_journey" CASCADE;
  DROP TABLE "page_features_blocks_agent_pegs" CASCADE;
  DROP TABLE "page_features_blocks_agent" CASCADE;
  DROP TABLE "page_features_caps" CASCADE;
  DROP TABLE "page_features_base_items" CASCADE;
  DROP TABLE "page_features" CASCADE;
  DROP TABLE "page_features_texts" CASCADE;
  DROP TABLE "page_features_numbers" CASCADE;
  DROP TABLE "page_solutions_hero_title_lines" CASCADE;
  DROP TABLE "page_solutions_hero_stats" CASCADE;
  DROP TABLE "page_solutions_industries_scenarios" CASCADE;
  DROP TABLE "page_solutions_industries" CASCADE;
  DROP TABLE "page_solutions" CASCADE;
  DROP TABLE "page_solutions_texts" CASCADE;
  DROP TABLE "page_pricing_hero_title_lines" CASCADE;
  DROP TABLE "page_pricing_plans" CASCADE;
  DROP TABLE "page_pricing_eco_links" CASCADE;
  DROP TABLE "page_pricing_faqs" CASCADE;
  DROP TABLE "page_pricing" CASCADE;
  DROP TABLE "page_pricing_texts" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_page_home_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_page_features_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_page_solutions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_page_pricing_fk";
  
  DROP INDEX "payload_locked_documents_rels_page_home_id_idx";
  DROP INDEX "payload_locked_documents_rels_page_features_id_idx";
  DROP INDEX "payload_locked_documents_rels_page_solutions_id_idx";
  DROP INDEX "payload_locked_documents_rels_page_pricing_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "page_home_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "page_features_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "page_solutions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "page_pricing_id";
  DROP TYPE "public"."enum_page_home_hero_diagram_nodes_tone";
  DROP TYPE "public"."enum_page_home_products_side_icon";
  DROP TYPE "public"."enum_page_home_cases_minis_tone";
  DROP TYPE "public"."enum_page_home_cta_rows_icon";
  DROP TYPE "public"."enum_page_home_cta_rows_action";
  DROP TYPE "public"."enum_page_home_status";
  DROP TYPE "public"."enum_page_home_hero_primary_action";
  DROP TYPE "public"."enum_page_home_products_spotlight_icon";
  DROP TYPE "public"."enum_page_features_blocks_agent_pegs_pos";
  DROP TYPE "public"."enum_page_features_blocks_agent_pegs_icon";
  DROP TYPE "public"."enum_page_features_caps_tag_tone";
  DROP TYPE "public"."enum_page_features_status";
  DROP TYPE "public"."enum_page_solutions_industries_tone";
  DROP TYPE "public"."enum_page_solutions_status";
  DROP TYPE "public"."enum_page_pricing_status";`)
}
