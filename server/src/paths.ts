// Төслийн үндсэн хавтсыг олох — dev (server/src) болон compiled (dist/server/src)
// болон Docker (/app) байрлалд бүгдэд нь ажиллана.
import fs from 'node:fs';
import path from 'node:path';

export function findProjectRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    const hasPackageJson = fs.existsSync(path.join(dir, 'package.json'));
    const hasServerOrDist =
      fs.existsSync(path.join(dir, 'server')) || fs.existsSync(path.join(dir, 'dist'));
    if (hasPackageJson && hasServerOrDist) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(__dirname, '..', '..');
}

export const projectRoot = findProjectRoot();
export const uploadsDir = path.join(projectRoot, 'uploads');
