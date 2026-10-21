-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'RENTAL', 'EDITOR', 'READONLY');

-- AlterTable: roles, activity, lockout, invites and soft delete on admins.
-- DEFAULT 'ADMIN' keeps every existing admin at full access after the migration.
ALTER TABLE "admins" ADD COLUMN "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
ADD COLUMN "last_active_at" TIMESTAMP(3),
ADD COLUMN "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "locked_until" TIMESTAMP(3),
ADD COLUMN "invite_token_hash" TEXT,
ADD COLUMN "invite_expires_at" TIMESTAMP(3),
ADD COLUMN "deleted_at" TIMESTAMP(3);

-- AlterTable: optional vehicle description
ALTER TABLE "vehicles" ADD COLUMN "description" TEXT;

-- AlterTable: optional multi-line opening hours on locations
ALTER TABLE "locations" ADD COLUMN "opening_hours" TEXT;

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_invite_token_hash_key" ON "admins"("invite_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_admin_id_idx" ON "password_reset_tokens"("admin_id");

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
