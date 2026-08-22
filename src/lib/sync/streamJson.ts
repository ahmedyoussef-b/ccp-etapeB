import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { createGzip } from "node:zlib";

/**
 * Renvoie un payload JSON. Si le client annonce `Accept-Encoding: gzip`,
 * la réponse est compressée et diffusée en streaming (ReadableStream) afin
 * de limiter l'empreinte mémoire et le volume réseau pour les gros arbres.
 */
export function jsonStream(payload: unknown, request: Request): NextResponse {
  const acceptEncoding = request.headers.get("accept-encoding") || "";
  if (!acceptEncoding.includes("gzip")) {
    return NextResponse.json(payload);
  }

  const json = JSON.stringify(payload);
  const source = Readable.from([Buffer.from(json, "utf-8")]);
  const compressed = source.pipe(createGzip());
  const webStream = Readable.toWeb(compressed as never) as ReadableStream<Uint8Array>;

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Encoding": "gzip",
      "Cache-Control": "no-store",
    },
  });
}
