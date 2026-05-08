import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropUnusedTables1746741600000 implements MigrationInterface {
  name = 'DropUnusedTables1746741600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "asset_change_events" CASCADE`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "asset_versions" CASCADE`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "asset_matches" CASCADE`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "duplicate_clusters" CASCADE`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "asset_relationships" CASCADE`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "field_evidences" CASCADE`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "canonical_asset_fields" CASCADE`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "canonical_assets" CASCADE`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "extraction_errors" CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "canonical_assets" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "canonical_name" character varying NOT NULL, "asset_type" character varying, "jurisdiction" character varying, "currency" character varying, "estimated_value" numeric, "latitude" numeric, "longitude" numeric, "description" text, "review_status" character varying NOT NULL DEFAULT 'pending', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "duplicate_cluster_id" uuid, CONSTRAINT "PK_canonical_assets" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_canonical_assets_canonical_name" ON "canonical_assets" ("canonical_name") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_canonical_assets_review_status" ON "canonical_assets" ("review_status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_canonical_assets_jurisdiction" ON "canonical_assets" ("jurisdiction") `,
    );
    await queryRunner.query(
      `CREATE TABLE "canonical_asset_fields" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "field_name" character varying NOT NULL, "raw_value" text, "normalized_value" jsonb, "confidence_score" numeric(5,2), "source_column" character varying, "is_inferred" boolean NOT NULL DEFAULT false, "inference_explanation" text, "extraction_method" character varying, "canonical_asset_id" uuid NOT NULL, CONSTRAINT "PK_canonical_asset_fields" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_canonical_asset_fields_canonical_asset_id" ON "canonical_asset_fields" ("canonical_asset_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "canonical_asset_fields" ADD CONSTRAINT "FK_canonical_asset_fields_canonical_asset_id" FOREIGN KEY ("canonical_asset_id") REFERENCES "canonical_assets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE TABLE "field_evidences" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "field_id" uuid NOT NULL, "evidence_type" character varying NOT NULL, "source_document_id" uuid, "source_page_number" integer, "confidence_score" numeric(5,2), "extracted_text" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_field_evidences" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_field_evidences_field_id" ON "field_evidences" ("field_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "asset_relationships" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "relationship_type" character varying NOT NULL, "parent_asset_id" uuid NOT NULL, "child_asset_id" uuid NOT NULL, "confidence_score" numeric(5,2), "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_asset_relationships" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_asset_relationships_parent_asset_id" ON "asset_relationships" ("parent_asset_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_asset_relationships_child_asset_id" ON "asset_relationships" ("child_asset_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_relationships" ADD CONSTRAINT "FK_asset_relationships_parent_asset_id" FOREIGN KEY ("parent_asset_id") REFERENCES "canonical_assets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_relationships" ADD CONSTRAINT "FK_asset_relationships_child_asset_id" FOREIGN KEY ("child_asset_id") REFERENCES "canonical_assets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE TABLE "duplicate_clusters" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "cluster_hash" character varying NOT NULL, "cluster_size" integer NOT NULL DEFAULT 1, "representative_asset_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_duplicate_clusters" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_duplicate_clusters_cluster_hash" ON "duplicate_clusters" ("cluster_hash") `,
    );
    await queryRunner.query(
      `CREATE TABLE "asset_matches" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "match_type" character varying NOT NULL, "confidence_score" numeric(5,2) NOT NULL, "extracted_asset_id" uuid NOT NULL, "canonical_asset_id" uuid NOT NULL, "match_details" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_asset_matches" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_asset_matches_extracted_asset_id" ON "asset_matches" ("extracted_asset_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_asset_matches_canonical_asset_id" ON "asset_matches" ("canonical_asset_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_matches" ADD CONSTRAINT "FK_asset_matches_extracted_asset_id" FOREIGN KEY ("extracted_asset_id") REFERENCES "extracted_asset_fields"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_matches" ADD CONSTRAINT "FK_asset_matches_canonical_asset_id" FOREIGN KEY ("canonical_asset_id") REFERENCES "canonical_assets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE TABLE "asset_versions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "version_number" integer NOT NULL, "canonical_asset_id" uuid NOT NULL, "change_type" character varying NOT NULL, "previous_values" jsonb, "new_values" jsonb, "changed_by" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_asset_versions" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_asset_versions_canonical_asset_id" ON "asset_versions" ("canonical_asset_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_versions" ADD CONSTRAINT "FK_asset_versions_canonical_asset_id" FOREIGN KEY ("canonical_asset_id") REFERENCES "canonical_assets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE TABLE "asset_change_events" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "event_type" character varying NOT NULL, "canonical_asset_id" uuid NOT NULL, "previous_state" jsonb, "new_state" jsonb, "triggered_by" character varying, "metadata" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_asset_change_events" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_asset_change_events_canonical_asset_id" ON "asset_change_events" ("canonical_asset_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_change_events" ADD CONSTRAINT "FK_asset_change_events_canonical_asset_id" FOREIGN KEY ("canonical_asset_id") REFERENCES "canonical_assets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "canonical_assets" ADD CONSTRAINT "FK_canonical_assets_duplicate_cluster_id" FOREIGN KEY ("duplicate_cluster_id") REFERENCES "duplicate_clusters"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }
}