-- Round 2 features: languages, currency, discounts & marketing, invoices + QR bill, contract templates,
-- damages & inspections, fines, driver details, email outbox.
--
-- Notes
--  * Existing bookings keep their start/end timestamps. Rows stored at exactly 00:00 are treated as whole days.
--  * bookings.contract_pdf_path now holds a key in the private storage (e.g. contracts/<id>.pdf). The API moves
--    the legacy files from UPLOAD_DIR/contracts to PRIVATE_UPLOAD_DIR on startup and rewrites the column.
--  * invoices.booking_id becomes optional (damage / fine / other invoices); existing invoices stay RENTAL.
--  * No data is dropped or rewritten here: every change is additive or relaxes a constraint.

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('RENTAL', 'DAMAGE', 'FINE', 'OTHER');

-- CreateEnum
CREATE TYPE "FeeCategory" AS ENUM ('DAMAGE', 'FINE_ADMIN', 'CLEANING', 'FUEL', 'LATE_RETURN', 'OTHER');

-- CreateEnum
CREATE TYPE "DamageView" AS ENUM ('top', 'left', 'right', 'front', 'rear');

-- CreateEnum
CREATE TYPE "DamageType" AS ENUM ('KRATZER', 'DELLE', 'STEINSCHLAG', 'RISS', 'LACK', 'FELGE', 'GLAS', 'INNENRAUM', 'SONSTIGES');

-- CreateEnum
CREATE TYPE "DamageSeverity" AS ENUM ('minor', 'medium', 'major');

-- CreateEnum
CREATE TYPE "DamageStatus" AS ENUM ('OPEN', 'REPAIRED');

-- CreateEnum
CREATE TYPE "InspectionType" AS ENUM ('PICKUP', 'RETURN');

-- CreateEnum
CREATE TYPE "FineStatus" AS ENUM ('NEW', 'ASSIGNED', 'FORWARDED', 'INVOICED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "CampaignCodeMode" AS ENUM ('NONE', 'SHARED', 'PERSONAL');

-- CreateEnum
CREATE TYPE "RecipientStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "admins" ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'de',
ADD COLUMN     "theme" TEXT NOT NULL DEFAULT 'system';

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "license_plate" TEXT,
ADD COLUMN     "translations" JSONB;

-- AlterTable
ALTER TABLE "contact_requests" ADD COLUMN     "discount_code" TEXT,
ADD COLUMN     "locale" TEXT;

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "company_signer_id" TEXT,
ADD COLUMN     "contract_sha256" TEXT,
ADD COLUMN     "contract_template_id" TEXT,
ADD COLUMN     "customer_locale" TEXT,
ADD COLUMN     "customer_phone" TEXT,
ADD COLUMN     "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "discount_code_id" TEXT,
ADD COLUMN     "driver_birth_date" DATE,
ADD COLUMN     "driver_city" TEXT,
ADD COLUMN     "driver_country" TEXT,
ADD COLUMN     "driver_license_country" TEXT,
ADD COLUMN     "driver_license_number" TEXT,
ADD COLUMN     "driver_street" TEXT,
ADD COLUMN     "driver_zip" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "customer_city" TEXT,
ADD COLUMN     "customer_country" TEXT,
ADD COLUMN     "customer_street" TEXT,
ADD COLUMN     "customer_zip" TEXT,
ADD COLUMN     "qr_reference" TEXT,
ADD COLUMN     "type" "InvoiceType" NOT NULL DEFAULT 'RENTAL',
ADD COLUMN     "with_qr_bill" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "booking_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "homepage_sections" ADD COLUMN     "translations" JSONB;

-- AlterTable
ALTER TABLE "testimonials" ADD COLUMN     "translations" JSONB;

-- AlterTable
ALTER TABLE "faq_items" ADD COLUMN     "translations" JSONB;

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "vat_rate" DECIMAL(5,2),
    "total" DECIMAL(10,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "fee_id" TEXT,
    "damage_id" TEXT,
    "fine_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fees" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "FeeCategory" NOT NULL DEFAULT 'OTHER',
    "default_amount" DECIMAL(10,2) NOT NULL,
    "vat_rate" DECIMAL(5,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_file_name" TEXT,
    "fields" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_damages" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "view" "DamageView" NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "zone" TEXT NOT NULL DEFAULT '',
    "type" "DamageType" NOT NULL DEFAULT 'SONSTIGES',
    "severity" "DamageSeverity" NOT NULL DEFAULT 'minor',
    "description" TEXT NOT NULL DEFAULT '',
    "status" "DamageStatus" NOT NULL DEFAULT 'OPEN',
    "repaired_at" TIMESTAMP(3),
    "discovered_booking_id" TEXT,
    "reported_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_damages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_damage_photos" (
    "id" TEXT NOT NULL,
    "damage_id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_damage_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_inspections" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "type" "InspectionType" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mileage" INTEGER,
    "fuel_level" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "damage_ids" JSONB NOT NULL DEFAULT '[]',
    "report_storage_key" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fines" (
    "id" TEXT NOT NULL,
    "license_plate" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "place" TEXT NOT NULL DEFAULT '',
    "authority" TEXT NOT NULL DEFAULT '',
    "reference" TEXT NOT NULL DEFAULT '',
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CHF',
    "description" TEXT NOT NULL DEFAULT '',
    "document_key" TEXT,
    "vehicle_id" TEXT,
    "booking_id" TEXT,
    "status" "FineStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT NOT NULL DEFAULT '',
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "type" "DiscountType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "currency" TEXT,
    "valid_from" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "max_redemptions" INTEGER,
    "per_email_limit" INTEGER NOT NULL DEFAULT 1,
    "min_days" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "campaign_id" TEXT,
    "recipient_email" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discount_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_redemptions" (
    "id" TEXT NOT NULL,
    "code_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "contact_request_id" TEXT,
    "booking_id" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discount_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_campaigns" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "code_mode" "CampaignCodeMode" NOT NULL DEFAULT 'NONE',
    "created_by_id" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_recipients" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "code_id" TEXT,
    "status" "RecipientStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "email_message_id" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_preferences" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "consent" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'customer',
    "unsubscribe_token" TEXT NOT NULL,
    "unsubscribed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_messages" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "to_name" TEXT,
    "subject" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "status" "EmailStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3),
    "provider" TEXT,
    "provider_message_id" TEXT,
    "error" TEXT,
    "related_type" TEXT,
    "related_id" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoice_items_invoice_id_idx" ON "invoice_items"("invoice_id");

-- CreateIndex
CREATE INDEX "vehicle_damages_vehicle_id_status_idx" ON "vehicle_damages"("vehicle_id", "status");

-- CreateIndex
CREATE INDEX "vehicle_damage_photos_damage_id_idx" ON "vehicle_damage_photos"("damage_id");

-- CreateIndex
CREATE INDEX "booking_inspections_booking_id_idx" ON "booking_inspections"("booking_id");

-- CreateIndex
CREATE INDEX "fines_license_plate_occurred_at_idx" ON "fines"("license_plate", "occurred_at");

-- CreateIndex
CREATE INDEX "fines_status_idx" ON "fines"("status");

-- CreateIndex
CREATE UNIQUE INDEX "discount_codes_code_key" ON "discount_codes"("code");

-- CreateIndex
CREATE INDEX "discount_codes_campaign_id_idx" ON "discount_codes"("campaign_id");

-- CreateIndex
CREATE INDEX "discount_codes_recipient_email_idx" ON "discount_codes"("recipient_email");

-- CreateIndex
CREATE INDEX "discount_redemptions_code_id_email_idx" ON "discount_redemptions"("code_id", "email");

-- CreateIndex
CREATE INDEX "marketing_campaigns_created_at_idx" ON "marketing_campaigns"("created_at");

-- CreateIndex
CREATE INDEX "marketing_recipients_campaign_id_status_idx" ON "marketing_recipients"("campaign_id", "status");

-- CreateIndex
CREATE INDEX "marketing_recipients_email_message_id_idx" ON "marketing_recipients"("email_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_preferences_email_key" ON "marketing_preferences"("email");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_preferences_unsubscribe_token_key" ON "marketing_preferences"("unsubscribe_token");

-- CreateIndex
CREATE INDEX "email_messages_status_next_attempt_at_idx" ON "email_messages"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "email_messages_created_at_idx" ON "email_messages"("created_at");

-- CreateIndex
CREATE INDEX "email_messages_related_type_related_id_idx" ON "email_messages"("related_type", "related_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_license_plate_key" ON "vehicles"("license_plate");

-- CreateIndex
CREATE INDEX "bookings_customer_email_idx" ON "bookings"("customer_email");

-- CreateIndex
CREATE INDEX "invoices_type_idx" ON "invoices"("type");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_discount_code_id_fkey" FOREIGN KEY ("discount_code_id") REFERENCES "discount_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_contract_template_id_fkey" FOREIGN KEY ("contract_template_id") REFERENCES "contract_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_company_signer_id_fkey" FOREIGN KEY ("company_signer_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_fee_id_fkey" FOREIGN KEY ("fee_id") REFERENCES "fees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_damage_id_fkey" FOREIGN KEY ("damage_id") REFERENCES "vehicle_damages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_fine_id_fkey" FOREIGN KEY ("fine_id") REFERENCES "fines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_templates" ADD CONSTRAINT "contract_templates_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_damages" ADD CONSTRAINT "vehicle_damages_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_damages" ADD CONSTRAINT "vehicle_damages_discovered_booking_id_fkey" FOREIGN KEY ("discovered_booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_damages" ADD CONSTRAINT "vehicle_damages_reported_by_id_fkey" FOREIGN KEY ("reported_by_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_damage_photos" ADD CONSTRAINT "vehicle_damage_photos_damage_id_fkey" FOREIGN KEY ("damage_id") REFERENCES "vehicle_damages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_inspections" ADD CONSTRAINT "booking_inspections_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_inspections" ADD CONSTRAINT "booking_inspections_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fines" ADD CONSTRAINT "fines_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fines" ADD CONSTRAINT "fines_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_code_id_fkey" FOREIGN KEY ("code_id") REFERENCES "discount_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_contact_request_id_fkey" FOREIGN KEY ("contact_request_id") REFERENCES "contact_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_recipients" ADD CONSTRAINT "marketing_recipients_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_recipients" ADD CONSTRAINT "marketing_recipients_code_id_fkey" FOREIGN KEY ("code_id") REFERENCES "discount_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

