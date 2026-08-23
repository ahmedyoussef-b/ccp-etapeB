-- CreateEnum
CREATE TYPE "NodeType" AS ENUM ('root', 'directory', 'file');

-- AlterEnum
ALTER TABLE "TreeNode" ALTER COLUMN "type" TYPE "NodeType" USING "type"::"NodeType";

-- DropTable
DROP TABLE "AuditLog";

-- DropTable
DROP TABLE "Procedure";

-- DropTable
DROP TABLE "TeamMember";

-- DropTable
DROP TABLE "Member";

-- DropTable
DROP TABLE "Team";
