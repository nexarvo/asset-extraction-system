import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrationName1778258222388 implements MigrationInterface {
  name = 'MigrationName1778258222388';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "documents" ADD "inferred_schema" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "documents" DROP COLUMN "inferred_schema"`,
    );
  }
}
