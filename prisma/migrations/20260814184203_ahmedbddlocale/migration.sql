-- CreateTable
CREATE TABLE "TreeNode" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "metadata" TEXT,
    "parentId" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreeNode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TreeNode_parentId_idx" ON "TreeNode"("parentId");

-- CreateIndex
CREATE INDEX "TreeNode_type_idx" ON "TreeNode"("type");

-- CreateIndex
CREATE UNIQUE INDEX "TreeNode_name_type_key" ON "TreeNode"("name", "type");

-- CreateIndex
CREATE UNIQUE INDEX "TreeNode_name_type_parentId_key" ON "TreeNode"("name", "type", "parentId");

-- AddForeignKey
ALTER TABLE "TreeNode" ADD CONSTRAINT "TreeNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "TreeNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
