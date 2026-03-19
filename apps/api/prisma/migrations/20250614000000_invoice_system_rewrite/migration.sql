-- Invoice system rewrite: add date range, penalty, reissue support; simplify status

-- Add new columns with defaults so existing rows survive
ALTER TABLE "invoices" ADD COLUMN "period_start" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN "period_end" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN "penalty" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN "parent_invoice_id" TEXT;

-- Backfill period_start/period_end from the linked booking
UPDATE "invoices" i
SET "period_start" = b."start_date",
    "period_end"   = b."end_date"
FROM "bookings" b
WHERE i."booking_id" = b."id";

-- Now make the period columns NOT NULL
ALTER TABLE "invoices" ALTER COLUMN "period_start" SET NOT NULL;
ALTER TABLE "invoices" ALTER COLUMN "period_end" SET NOT NULL;

-- Convert existing statuses to PENDING/PAID:
-- PAID stays PAID, everything else becomes PENDING
UPDATE "invoices" SET "status" = 'PENDING' WHERE "status" != 'PAID';

-- Recreate the enum with only PENDING and PAID
-- Step 1: Remove default
ALTER TABLE "invoices" ALTER COLUMN "status" DROP DEFAULT;
-- Step 2: Cast column to text temporarily
ALTER TABLE "invoices" ALTER COLUMN "status" TYPE TEXT;
-- Step 3: Drop old enum
DROP TYPE "InvoiceStatus";
-- Step 4: Create new enum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'PAID');
-- Step 5: Cast column back to enum
ALTER TABLE "invoices" ALTER COLUMN "status" TYPE "InvoiceStatus" USING "status"::"InvoiceStatus";
-- Step 6: Set new default
ALTER TABLE "invoices" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- Add self-referencing FK for reissue chain
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_parent_invoice_id_fkey"
  FOREIGN KEY ("parent_invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
