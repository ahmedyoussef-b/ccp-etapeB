const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function fix() {
  try {
    const root = await prisma.treeNode.findFirst({ where: { type: "root" } });
    if (!root) {
      console.log("No root found");
      return;
    }

    let rootRegistry = await prisma.treeNode.findFirst({
      where: { parentId: root.id, name: "registry", type: "directory" },
    });
    if (!rootRegistry) {
      rootRegistry = await prisma.treeNode.create({
        data: { parentId: root.id, name: "registry", type: "directory" },
      });
    }

    let rootItems = await prisma.treeNode.findFirst({
      where: { parentId: rootRegistry.id, name: "items", type: "directory" },
    });
    if (!rootItems) {
      rootItems = await prisma.treeNode.create({
        data: { parentId: rootRegistry.id, name: "items", type: "directory" },
      });
    }

    // Find orphan registry folders (parentId: null, but not the root node itself)
    const orphans = await prisma.treeNode.findMany({
      where: { parentId: null, type: "directory", name: "registry" },
    });

    for (const orphan of orphans) {
      // Find items folders under this orphan
      const orphanItems = await prisma.treeNode.findMany({
        where: { parentId: orphan.id, name: "items", type: "directory" },
      });

      for (const oItem of orphanItems) {
        // Move all children of this items folder to the real rootItems
        const files = await prisma.treeNode.findMany({
          where: { parentId: oItem.id },
        });
        for (const file of files) {
          await prisma.treeNode.update({
            where: { id: file.id },
            data: { parentId: rootItems.id },
          });
          console.log(`Moved file ${file.name}`);
        }
        // delete empty orphan items folder
        await prisma.treeNode.delete({ where: { id: oItem.id } });
      }
      // delete empty orphan registry folder
      await prisma.treeNode.delete({ where: { id: orphan.id } });
    }
    console.log("Fix completed");
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

fix();
