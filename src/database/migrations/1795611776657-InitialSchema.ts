import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1795611776657 implements MigrationInterface {
    name = 'InitialSchema1795611776657'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."user_role_enum" AS ENUM('ADMINISTRATOR', 'SUPERVISOR', 'OPERATOR')`);
        await queryRunner.query(`CREATE TABLE "user" ("id" SERIAL NOT NULL, "firstName" character varying NOT NULL, "lastName" character varying NOT NULL, "email" character varying, "password" character varying NOT NULL, "role" "public"."user_role_enum" NOT NULL DEFAULT 'OPERATOR', "isActive" boolean NOT NULL, CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_6620cd026ee2b231beac7cfe57" ON "user"  ("role") `);
        await queryRunner.query(`CREATE TABLE "revoked_token" ("id" SERIAL NOT NULL, "tokenHash" character varying(64) NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "revokedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_bf300a6daf55d675aba672ba1f7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_90fe284181bab93834ac63f20d" ON "revoked_token"  ("tokenHash") `);
        await queryRunner.query(`CREATE INDEX "IDX_286c90854f1b792998d2d74da2" ON "revoked_token"  ("expiresAt") `);
        // Supabase exposes the `public` schema through its Data API (PostgREST).
        // RLS with no policies denies every row to the API roles (anon,
        // authenticated); the app connects as the table owner, which bypasses RLS.
        await queryRunner.query(`ALTER TABLE "user" ENABLE ROW LEVEL SECURITY`);
        await queryRunner.query(`ALTER TABLE "revoked_token" ENABLE ROW LEVEL SECURITY`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_286c90854f1b792998d2d74da2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_90fe284181bab93834ac63f20d"`);
        await queryRunner.query(`DROP TABLE "revoked_token"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6620cd026ee2b231beac7cfe57"`);
        await queryRunner.query(`DROP TABLE "user"`);
        await queryRunner.query(`DROP TYPE "public"."user_role_enum"`);
    }

}
