import { MigrationInterface, QueryRunner } from "typeorm";

export class MigrationName1778155340570 implements MigrationInterface {
    name = 'MigrationName1778155340570'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "extraction_errors" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "job_id" uuid NOT NULL, "error_code" character varying NOT NULL, "message" character varying NOT NULL, "stack_trace" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_96c42e418b2c97070a05f2cc6ee" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7cd4c79581390a1285de14cb44" ON "extraction_errors" ("job_id") `);
        await queryRunner.query(`CREATE TABLE "extraction_jobs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "file_name" character varying NOT NULL, "file_type" character varying NOT NULL, "status" "public"."extraction_jobs_status_enum" NOT NULL DEFAULT 'waiting', "attempts" integer NOT NULL DEFAULT '0', "error_message" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "completed_at" TIMESTAMP, CONSTRAINT "PK_d9f45b98a39908cb225d0acd633" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e6a2122d6b019988319b479d50" ON "extraction_jobs" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_311be04ab374e6febb2e5ac1b8" ON "extraction_jobs" ("created_at") `);
        await queryRunner.query(`CREATE TABLE "extracted_records" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "extraction_result_id" uuid NOT NULL, "page_number" integer, "block_type" character varying, "confidence_score" numeric(5,2), "raw_text" text, "structured_data" jsonb, "provenance" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2f2684dbe178b7c126375dd5eb4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_85a9c8dfe6a5e0db3a3456ef85" ON "extracted_records" ("extraction_result_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_1128d3976fc203cf4bbb98372a" ON "extracted_records" ("confidence_score") `);
        await queryRunner.query(`CREATE TABLE "extraction_results" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "job_id" uuid NOT NULL, "source_file" character varying NOT NULL, "extraction_strategy" character varying NOT NULL, "metadata" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f6ebf9c39b33c89700ffa07d6a3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "extraction_errors" ADD CONSTRAINT "FK_7cd4c79581390a1285de14cb443" FOREIGN KEY ("job_id") REFERENCES "extraction_jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "extracted_records" ADD CONSTRAINT "FK_85a9c8dfe6a5e0db3a3456ef85f" FOREIGN KEY ("extraction_result_id") REFERENCES "extraction_results"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "extraction_results" ADD CONSTRAINT "FK_b300251472326f861b43c63ad93" FOREIGN KEY ("job_id") REFERENCES "extraction_jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "extraction_results" DROP CONSTRAINT "FK_b300251472326f861b43c63ad93"`);
        await queryRunner.query(`ALTER TABLE "extracted_records" DROP CONSTRAINT "FK_85a9c8dfe6a5e0db3a3456ef85f"`);
        await queryRunner.query(`ALTER TABLE "extraction_errors" DROP CONSTRAINT "FK_7cd4c79581390a1285de14cb443"`);
        await queryRunner.query(`DROP TABLE "extraction_results"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1128d3976fc203cf4bbb98372a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_85a9c8dfe6a5e0db3a3456ef85"`);
        await queryRunner.query(`DROP TABLE "extracted_records"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_311be04ab374e6febb2e5ac1b8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e6a2122d6b019988319b479d50"`);
        await queryRunner.query(`DROP TABLE "extraction_jobs"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7cd4c79581390a1285de14cb44"`);
        await queryRunner.query(`DROP TABLE "extraction_errors"`);
    }

}
