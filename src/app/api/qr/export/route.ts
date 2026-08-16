import { NextResponse } from "next/server";
import { createPair, exportPairsAsJson } from "@/lib/qr/server-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.items && body.filename) {
      console.log(`[Q/R export] exporting ${body.items.length} items to ${body.filename} (Web DB)`);
      const { prisma } = await import("@/lib/prisma");

      const baseName = body.filename.replace(/\.json$/, '').trim() || `export_qr_${new Date().toISOString().replace(/[:.]/g, '-')}`;
      const fileExt = '.json';
      let finalName = baseName + fileExt;

      const doc = {
        type: "qa",
        title: body.title || baseName,
        description: "",
        pairs: body.items.map((p: any) => ({ question: p.question, answer: p.answer })),
        createdAt: new Date().toISOString(),
        registryPath: `items/${finalName}`,
      };

      // Ensure "registry" and "items" folders exist in Web DB under the root node
      const rootNode = await prisma.treeNode.findFirst({ where: { type: "root" } });
      const rootId = rootNode ? rootNode.id : null;

      let registryFolder = await prisma.treeNode.findFirst({ where: { name: "registry", type: "directory", parentId: rootId } });
      if (!registryFolder) {
        registryFolder = await prisma.treeNode.create({ data: { name: "registry", type: "directory", parentId: rootId } });
      }

      let itemsFolder = await prisma.treeNode.findFirst({ where: { name: "items", type: "directory", parentId: registryFolder.id } });
      if (!itemsFolder) {
        itemsFolder = await prisma.treeNode.create({ data: { name: "items", type: "directory", parentId: registryFolder.id } });
      }

      let targetParentId = itemsFolder.id;
      finalName = baseName + fileExt;
      let registryPath = `items/${finalName}`;

      // Check if a directory for this name already exists
      let groupFolder = await prisma.treeNode.findFirst({
        where: { name: baseName, type: "directory", parentId: itemsFolder.id }
      });

      if (groupFolder) {
        // Third time or more: directory already exists
        targetParentId = groupFolder.id;
        let counter = 1;
        while (await prisma.treeNode.findFirst({ where: { name: `${baseName}_${counter}${fileExt}`, type: "file", parentId: targetParentId } })) {
          counter++;
        }
        finalName = `${baseName}_${counter}${fileExt}`;
        registryPath = `items/${baseName}/${finalName}`;
      } else {
        // Check if a file with this name already exists in the root itemsFolder
        const existingFile = await prisma.treeNode.findFirst({
          where: { name: finalName, type: "file", parentId: itemsFolder.id }
        });

        if (existingFile) {
          // Second time: duplication!
          // 1. Create the group folder
          groupFolder = await prisma.treeNode.create({
            data: { name: baseName, type: "directory", parentId: itemsFolder.id }
          });
          
          // 2. Move and rename the existing file to index 1
          const oldName = `${baseName}_1${fileExt}`;
          let oldDoc = {};
          try { oldDoc = JSON.parse(existingFile.metadata || "{}"); } catch(e){}
          await prisma.treeNode.update({
            where: { id: existingFile.id },
            data: { 
              name: oldName, 
              parentId: groupFolder.id,
              metadata: JSON.stringify({ ...oldDoc, registryPath: `items/${baseName}/${oldName}` })
            }
          });

          // 3. Set target for the new file to index 2
          targetParentId = groupFolder.id;
          finalName = `${baseName}_2${fileExt}`;
          registryPath = `items/${baseName}/${finalName}`;
        }
      }

      await prisma.treeNode.create({
        data: {
          name: finalName,
          type: "file",
          metadata: JSON.stringify({ ...doc, registryPath }),
          parentId: targetParentId,
        }
      });

      return NextResponse.json({ success: true, filename: finalName }, { status: 201 });
    }

    console.log("[Q/R export] received:", { q: body.question?.slice(0, 30), a: body.answer?.slice(0, 30) });

    // 1. Save to web DB (Prisma or file fallback)
    const pair = await createPair({
      question: body.question,
      answer: body.answer,
    });
    console.log("[Q/R export] pair created in DB, id =", pair.id);

    return NextResponse.json({ success: true, pairId: pair.id }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Q/R export] error:", msg, error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
