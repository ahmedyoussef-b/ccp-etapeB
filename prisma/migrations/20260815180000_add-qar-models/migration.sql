-- AlterTable: create new tables for Q/R functionality
CREATE TABLE "QARegistry" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("id")
);

CREATE TABLE "QAPair" (
    "id" SERIAL NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "registryId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("id")
);

-- Create index for QARegistry.title
CREATE INDEX "QARegistry_title_idx" ON "QARegistry"("title");

-- Create index for QAPair.registryId
CREATE INDEX "QAPair_registryId_idx" ON "QAPair"("registryId");

-- Create index for QAPair.question
CREATE INDEX "QAPair_question_idx" ON "QAPair"("question");

-- AddForeignKey: QAPair.registryId → QARegistry.id
ALTER TABLE "QAPair" ADD CONSTRAINT "QAPair_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "QARegistry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
