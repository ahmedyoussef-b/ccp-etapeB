import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = 'force-dynamic';

const DATA_DIR = path.join(process.cwd(), ".data");

function resolveLocalPath(requestedPath: string): string {
  let normalized: string;
  if (path.isAbsolute(requestedPath)) {
    normalized = path.normalize(requestedPath);
  } else {
    normalized = path.normalize(requestedPath).replace(/^(\.\.(\/)?)+/, '');
    normalized = path.join(DATA_DIR, normalized);
  }
  if (!normalized.startsWith(DATA_DIR)) {
    throw new Error("Invalid path");
  }
  return normalized;
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.txt': 'text/plain',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.ts': 'application/typescript',
    '.tsx': 'application/typescript',
    '.jsx': 'application/javascript',
    '.py': 'text/x-python',
    '.java': 'text/x-java',
    '.c': 'text/x-c',
    '.cpp': 'text/x-c++',
    '.h': 'text/x-c',
    '.md': 'text/markdown',
    '.csv': 'text/csv',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.bmp': 'image/bmp',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'video/ogg',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

export async function GET(
  request: Request,
  { params }: { params: { path: string } }
) {
  try {
    const decodedPath = decodeURIComponent(params.path);
    const fullPath = resolveLocalPath(decodedPath);

    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      return NextResponse.json({ error: "Cannot preview directory" }, { status: 400 });
    }

    const content = fs.readFileSync(fullPath);
    const mimeType = getMimeType(fullPath);
    const isText = mimeType.startsWith('text/') || 
                   mimeType === 'application/json' || 
                   mimeType === 'application/javascript' || 
                   mimeType === 'application/typescript' ||
                   mimeType === 'text/x-python' ||
                   mimeType === 'text/x-java' ||
                   mimeType === 'text/x-c' ||
                   mimeType === 'text/markdown' ||
                   mimeType === 'text/csv' ||
                   mimeType === 'application/xml' ||
                   mimeType === 'application/zip' ||
                   mimeType === 'application/x-tar' ||
                   mimeType === 'application/gzip';

    if (isText && content.length < 1024 * 1024) {
      const textContent = content.toString('utf-8');
      return NextResponse.json({
        content: textContent,
        mimeType,
        name: path.basename(fullPath),
        size: stat.size,
        isText: true,
      });
    }

    if (mimeType.startsWith('image/') || mimeType.startsWith('video/')) {
      const base64 = content.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64}`;
      return NextResponse.json({
        dataUrl,
        mimeType,
        name: path.basename(fullPath),
        size: stat.size,
        isText: false,
      });
    }

    return NextResponse.json({
      content: null,
      mimeType,
      name: path.basename(fullPath),
      size: stat.size,
      isText: false,
    });
  } catch (error) {
    console.error("Failed to view file:", error);
    return NextResponse.json({ error: "Failed to view file" }, { status: 500 });
  }
}
