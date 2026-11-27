// Сэтгэлийн Одод — Express сервер.
// .env файл ачаалахгүй (dotenv байхгүй). Ажиллуулахын өмнө:
//   set -a; source .env; set +a; npm run dev:server
// Эсвэл орчны хувьсагчуудаа шууд export хийнэ үү.
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { router } from './routes';
import { uploadsDir } from './uploads';
import { projectRoot } from './paths';

const missing: string[] = [];
if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
if (!process.env.SESSION_SECRET) missing.push('SESSION_SECRET');
if (missing.length > 0) {
  console.error(
    `Алдаа: дараах орчны хувьсагч(ууд) тохируулагдаагүй байна: ${missing.join(', ')}. ` +
      'Эхлээд "set -a; source .env; set +a" гэж ачаалаад дахин ажиллуулна уу.',
  );
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api', router);

const clientDist = path.join(projectRoot, 'dist', 'client');
if (process.env.NODE_ENV === 'production' || fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback — /api болон /uploads замаас бусад нь index.html руу.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      next();
      return;
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
  console.log(`Сэтгэлийн Одод сервер ажиллаж байна: http://localhost:${PORT}`);
});
