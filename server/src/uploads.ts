// Сэтгэлийн Одод — файл байршуулалт (multer санах ой + диск хадгалалт).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { projectRoot, uploadsDir } from './paths';

export { projectRoot, uploadsDir };

export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export function ensureUploadsDir(): string {
  fs.mkdirSync(uploadsDir, { recursive: true });
  return uploadsDir;
}

function sanitizeFileName(fileName: string): string {
  const base = path.basename(fileName || 'file').replace(/[^A-Za-z0-9._-]/g, '_');
  return base.length > 0 ? base.slice(0, 100) : 'file';
}

/** Буферыг <төсөл>/uploads хавтаст аюулгүй, давхцдаггүй нэрээр хадгалж, нийтийн зам буцаана. */
export async function saveUpload(buffer: Buffer, fileName: string): Promise<string> {
  const dir = ensureUploadsDir();
  const safe = sanitizeFileName(fileName);
  const unique = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safe}`;
  await fs.promises.writeFile(path.join(dir, unique), buffer);
  return `/uploads/${unique}`;
}

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES },
});

/** Нэг файл ('file' талбар) хүлээн авах middleware. */
export const uploadSingle = upload.single('file');

/** Олон зураг ('images' талбар, хамгийн ихдээ 20) хүлээн авах middleware. */
export const uploadImages = upload.array('images', 20);
