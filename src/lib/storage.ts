import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

// Uploaded documents live outside /public and are served only through the
// authorised /api/files/[id] route.
const ROOT = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? path.join(process.cwd(), "storage", "uploads"));

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const ALLOWED: Record<string, { ext: string; magic: number[][] }> = {
  "application/pdf": { ext: "pdf", magic: [[0x25, 0x50, 0x44, 0x46]] },
  "image/jpeg": { ext: "jpg", magic: [[0xff, 0xd8, 0xff]] },
  "image/png": { ext: "png", magic: [[0x89, 0x50, 0x4e, 0x47]] },
};
export const ACCEPT_ATTR = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

export function validateUpload(file: File): string | null {
  if (file.size > MAX_UPLOAD_BYTES) return "File must be 5 MB or smaller.";
  if (!ALLOWED[file.type]) return "Upload a PDF, JPG or PNG file.";
  return null;
}

/** Saves the file and returns its stored name; rejects files whose content does not match their type. */
export async function storeUpload(file: File, folder: string, prefix: string) {
  const spec = ALLOWED[file.type];
  const buf = Buffer.from(await file.arrayBuffer());
  if (!spec || !spec.magic.some((m) => m.every((b, i) => buf[i] === b))) {
    throw new Error("The file content does not match a PDF, JPG or PNG.");
  }
  const dir = path.join(/*turbopackIgnore: true*/ ROOT, folder);
  await mkdir(dir, { recursive: true });
  const storedName = `${folder}/${prefix}-${randomBytes(8).toString("hex")}.${spec.ext}`;
  await writeFile(path.join(/*turbopackIgnore: true*/ ROOT, storedName), buf);
  return storedName;
}

const resolveSafe = (storedName: string) => {
  const p = path.resolve(/*turbopackIgnore: true*/ ROOT, storedName);
  if (!p.startsWith(ROOT + path.sep)) throw new Error("Invalid path");
  return p;
};

export const readUpload = (storedName: string) => readFile(/*turbopackIgnore: true*/ resolveSafe(storedName));
export const deleteUpload = (storedName: string) => unlink(/*turbopackIgnore: true*/ resolveSafe(storedName)).catch(() => {});
