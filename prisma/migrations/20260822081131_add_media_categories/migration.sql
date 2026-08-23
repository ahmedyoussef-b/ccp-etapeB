-- CreateTable
CREATE TABLE "MediaCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaCategory_name_key" ON "MediaCategory"("name");

-- CreateIndex
CREATE INDEX "MediaCategory_parentId_idx" ON "MediaCategory"("parentId");

-- CreateIndex
CREATE INDEX "MediaCategory_name_idx" ON "MediaCategory"("name");

-- AddForeignKey
ALTER TABLE "MediaCategory" ADD CONSTRAINT "MediaCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "MediaCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
