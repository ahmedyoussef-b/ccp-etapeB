import { NextResponse } from "next/server";
import { prisma, generateUUID } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.items && body.filename) {
      console.log(`[Q/R export] exporting ${body.items.length} items to ${body.filename} (Web DB)`);

      const baseName = body.filename.replace(/\.json$/, '').trim() || `export_qr_${new Date().toISOString().replace(/[:.]/g, '-')}`;
      const fileExt = '.json';
      let finalName = baseName + fileExt;

      const doc = {
        type: "qa",
        title: body.title || baseName,
        description: "",
        pairs: body.items.map((p: { question: string; answer: string }) => ({ question: p.question, answer: p.answer })),
        createdAt: new Date().toISOString(),
        registryPath: `items/${finalName}`,
      };

      const rootNode = await prisma.treeNode.findFirst({ where: { type: "root" } });
      const rootId = rootNode ? rootNode.id : null;

      let registryFolder = await prisma.treeNode.findFirst({ where: { name: "registry", type: "directory", parentId: rootId } });
      if (!registryFolder) {
        registryFolder = await prisma.treeNode.create({ data: { uuid: generateUUID(), name: "registry", type: "directory", parentId: rootId } });
      }

      let itemsFolder = await prisma.treeNode.findFirst({ where: { name: "items", type: "directory", parentId: registryFolder.id } });
      if (!itemsFolder) {
        itemsFolder = await prisma.treeNode.create({ data: { uuid: generateUUID(), name: "items", type: "directory", parentId: registryFolder.id } });
      }

      let targetParentId = itemsFolder.id;
      finalName = baseName + fileExt;
      let registryPath = `items/${finalName}`;

      let groupFolder = await prisma.treeNode.findFirst({
        where: { name: baseName, type: "directory", parentId: itemsFolder.id }
      });

      if (groupFolder) {
        targetParentId = groupFolder.id;
        let counter = 1;
        while (await prisma.treeNode.findFirst({ where: { name: `${baseName}_${counter}${fileExt}`, type: "file", parentId: targetParentId } })) {
          counter++;
        }
        finalName = `${baseName}_${counter}${fileExt}`;
        registryPath = `items/${baseName}/${finalName}`;
      } else {
        const existingFile = await prisma.treeNode.findFirst({
          where: { name: finalName, type: "file", parentId: itemsFolder.id }
        });

        if (existingFile) {
          groupFolder = await prisma.treeNode.create({
            data: { uuid: generateUUID(), name: baseName, type: "directory", parentId: itemsFolder.id }
          });

          const oldName = `${baseName}_1${fileExt}`;
          let oldDoc = {};
          try { oldDoc = JSON.parse(existingFile.metadata || "{}"); } catch {}
          await prisma.treeNode.update({
            where: { id: existingFile.id },
            data: {
              name: oldName,
              parentId: groupFolder.id,
              metadata: JSON.stringify({ ...oldDoc, registryPath: `items/${baseName}/${oldName}` })
            }
          });

          targetParentId = groupFolder.id;
          finalName = `${baseName}_2${fileExt}`;
          registryPath = `items/${baseName}/${finalName}`;
        }
      }

      await prisma.treeNode.create({
        data: {
          uuid: generateUUID(),
          name: finalName,
          type: "file",
          metadata: JSON.stringify({ ...doc, registryPath }),
          parentId: targetParentId,
        }
      });

      return NextResponse.json({ success: true, filename: finalName }, { status: 201 });
    }

    console.log("[Q/R export] received:", { q: body.question?.slice(0, 30), a: body.answer?.slice(0, 30) });

    const title = body.registryTitle || body.question?.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().substring(0, 60) || "Général";
    let registry = await prisma.qARegistry.findFirst({ where: { title } });
    if (!registry) {
      registry = await prisma.qARegistry.create({
        data: { uuid: generateUUID(), title, description: body.registryDescription ?? null },
      });
    }

    const pair = await prisma.qAPair.create({
      data: {
        uuid: generateUUID(),
        question: body.question.trim(),
        answer: body.answer.trim(),
        order: 0,
        registryId: registry.id,
      },
      include: { registry: true },
    });

    console.log("[Q/R export] pair created in DB, id =", pair.id);
    return NextResponse.json({ success: true, pairId: pair.id }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Q/R export] error:", msg, error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
