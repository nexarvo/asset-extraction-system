import { MigrationInterface, QueryRunner } from "typeorm";

export class MigrationName1778261106024 implements MigrationInterface {
    name = 'MigrationName1778261106024'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "processing_jobs" ADD "session_id" uuid`);
        await queryRunner.query(`ALTER TABLE "documents" ADD "session_id" uuid`);
        await queryRunner.query(`ALTER TABLE "documents" ADD "sessionId" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_6a0e5a92b952f648251f7498a8" ON "processing_jobs" ("session_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_3e7a38bdd6dc5a362f0afaae45" ON "documents" ("session_id") `);
        await queryRunner.query(`ALTER TABLE "documents" ADD CONSTRAINT "FK_2a568968531c101fec40e1d8d65" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "documents" DROP CONSTRAINT "FK_2a568968531c101fec40e1d8d65"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3e7a38bdd6dc5a362f0afaae45"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6a0e5a92b952f648251f7498a8"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "sessionId"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "session_id"`);
        await queryRunner.query(`ALTER TABLE "processing_jobs" DROP COLUMN "session_id"`);
        await queryRunner.query(`DROP TABLE "sessions"`);
    }

}
