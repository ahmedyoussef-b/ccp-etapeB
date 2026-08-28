-- AlterTable: make dataUrl nullable
ALTER TABLE "media_items" ALTER COLUMN "dataUrl" DROP NOT NULL;
