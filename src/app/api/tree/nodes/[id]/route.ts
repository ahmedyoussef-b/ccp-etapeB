import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    await prisma.treeNode.deleteMany({
      where: { OR: [{ id }, { parentId: id }] },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete tree node:", error);
    return NextResponse.json({ error: "Failed to delete tree node" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    const { name } = await request.json();

    await prisma.treeNode.update({
      where: { id },
      data: { name },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to rename tree node:", error);
    return NextResponse.json({ error: "Failed to rename tree node" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const parentId = parseInt(params.id, 10);
    const { name, type = "directory" } = await request.json();

    const node = await prisma.treeNode.create({
      data: {
        name,
        type,
        parentId,
        order: 0,
      },
    });

    return NextResponse.json(node, { status: 201 });
  } catch (error) {
    console.error("Failed to create tree node:", error);
    return NextResponse.json({ error: "Failed to create tree node" }, { status: 500 });
  }
}
