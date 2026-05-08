import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrationName1778169298593 implements MigrationInterface {
  name = 'MigrationName1778169298593';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "extracted_asset_fields" DROP CONSTRAINT "FK_ef0df803f8efc187e5cbbeca412"`,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_matches" DROP CONSTRAINT "FK_e74891f2c00d86d4e48b41e1a66"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ef0df803f8efc187e5cbbeca41"`,
    );
    await queryRunner.query(
      `ALTER TABLE "extracted_asset_fields" DROP COLUMN "extracted_asset_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "extracted_asset_fields" ADD "document_id" uuid NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "extracted_asset_fields" ADD "extraction_job_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "extracted_asset_fields" ADD "source_page_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "extracted_asset_fields" ADD "extraction_strategy" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "extracted_asset_fields" ADD "extraction_model" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "extracted_asset_fields" ADD "raw_asset_name" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "extracted_asset_fields" ADD "raw_payload" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "extracted_asset_fields" ADD "overall_confidence" numeric(5,2)`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."extracted_asset_fields_reviewstatus_enum" AS ENUM('pending', 'auto_approved', 'requires_review', 'rejected')`,
    );
    await queryRunner.query(
      `ALTER TABLE "extracted_asset_fields" ADD "reviewStatus" "public"."extracted_asset_fields_reviewstatus_enum" NOT NULL DEFAULT 'pending'`,
    );
    await queryRunner.query(
      `ALTER TABLE "extracted_asset_fields" ADD "source_row_index" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "extracted_asset_fields" ADD "source_sheet_name" character varying`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3e72353cd5adfd15f2117f4c54" ON "extracted_asset_fields" ("document_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_565a17efd5dbed9226db764785" ON "extracted_asset_fields" ("reviewStatus") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_205ec66f7e1e977a15586d964c" ON "extracted_asset_fields" ("source_row_index") `,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_matches" ADD CONSTRAINT "FK_e74891f2c00d86d4e48b41e1a66" FOREIGN KEY ("extracted_asset_id") REFERENCES "extracted_asset_fields"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "asset_matches" DROP CONSTRAINT "FK_e74891f2c00d86d4e48b41e1a66"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_205ec66f7e1e977a15586d964c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_565a17efd5dbed9226db764785"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3e72353cd5adfd15f2117f4c54"`,
    );
    await queryRunner.query(
      `ALTER TABLE "extracted_asset_fields" DROP COLUMN "source_sheet_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "extracted_asset_fields" DROP COLUMN "source_row_index"`,
    );
    await queryRunner.query(
      `ALTER TABLE "extracted_asset_fields" DROP COLUMN "reviewStatus"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."extracted_asset_fields_reviewstatus_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "extracted_asset_fields" DROP COLUMN "overall_confidence"`,
    );
    await queryRunner.query(
      `ALTER TABLE "extracted_asset_fields" DROP COLUMN "raw_payload"`,
    );
    await queryRunner.query(
      `ALTER TABLE "extracted_asset_fields" DROP COLUMN "raw_asset_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "extracted_asset_fields" DROP COLUMN "extraction_model"`,
    );
    await queryRunner.query(
      `ALTER TABLE "extracted_asset_fields" DROP COLUMN "extraction_strategy"`,
    );
    await queryRunner.query(
      `ALTER TABLE "extracted_asset_fields" DROP COLUMN "source_page_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "extracted_asset_fields" DROP COLUMN "extraction_job_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "extracted_asset_fields" DROP COLUMN "document_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "extracted_asset_fields" ADD "extracted_asset_id" uuid NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ef0df803f8efc187e5cbbeca41" ON "extracted_asset_fields" ("extracted_asset_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_matches" ADD CONSTRAINT "FK_e74891f2c00d86d4e48b41e1a66" FOREIGN KEY ("extracted_asset_id") REFERENCES "extracted_assets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "extracted_asset_fields" ADD CONSTRAINT "FK_ef0df803f8efc187e5cbbeca412" FOREIGN KEY ("extracted_asset_id") REFERENCES "extracted_assets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
