import "server-only";
import { randomUUID } from "node:crypto";
import { analyzeComplaint } from "@/lib/intelligence/analyze";
import { validateComplaintAnalysisInput } from "@/lib/intelligence/input";
import { hasSupabaseConfiguration } from "@/lib/supabase/config";

const MAX_REQUEST_BYTES = 16 * 1024;

async function readBoundedBody(request: Request): Promise<string> {
  const contentLength = request.headers.get("content-length");
  if (
    contentLength &&
    (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_REQUEST_BYTES)
  )
    throw new RangeError("Request body is too large.");
  if (!request.body) throw new TypeError("A JSON request body is required.");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_REQUEST_BYTES) {
      await reader.cancel();
      throw new RangeError("Request body is too large.");
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(body);
}

export async function POST(request: Request): Promise<Response> {
  if (hasSupabaseConfiguration())
    return Response.json(
      { error: "Use the authenticated complaint analysis workflow." },
      { status: 410, headers: { "Cache-Control": "no-store" } },
    );
  const contentType = request.headers
    .get("content-type")
    ?.split(";")[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json")
    return Response.json(
      { error: "Content-Type must be application/json." },
      { status: 415, headers: { "Cache-Control": "no-store" } },
    );

  let body: unknown;
  try {
    body = JSON.parse(await readBoundedBody(request));
  } catch (error) {
    const tooLarge = error instanceof RangeError;
    return Response.json(
      {
        error: tooLarge
          ? "Request body exceeds the 16 KB limit."
          : "Request body must be valid, bounded JSON.",
      },
      {
        status: tooLarge ? 413 : 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  let complaint;
  try {
    complaint = validateComplaintAnalysisInput(body);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Request body failed validation.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await analyzeComplaint(complaint, { requestId: randomUUID() });
  return Response.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
