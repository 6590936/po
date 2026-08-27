import { Router } from 'express';
import { authenticateToken } from '../auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mammoth from 'mammoth';
import xlsx from 'xlsx';
import AdmZip from 'adm-zip';

import materialsRouter from './materials.js';
import scriptsRouter from './scripts.js';
import onboardingRouter from './onboarding.js';
import callsRouter from './calls.js';
import feedbackRouter from './feedback.js';
import dashboardRouter from './dashboard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

if (!fs.existsSync(uploadsDir)) { fs.mkdirSync(uploadsDir, { recursive: true }); }

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, unique + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|png|jpg|jpeg|gif)$/i;
    cb(null, allowed.test(path.extname(file.originalname)));
  }
});

const router = Router();

router.get('/preview', (req, res, next) => {
  if (req.query.token && !req.headers.authorization) {
    req.headers.authorization = 'Bearer ' + req.query.token;
  }
  next();
}, authenticateToken, (req, res) => {
  try {
    const filePath = req.query.file;
    if (!filePath) return res.status(400).send('缺少文件参数');
    const fullPath = path.join(__dirname, '..', '..', filePath.replace(/^\/api\/uploads\//, 'uploads/'));
    if (!fs.existsSync(fullPath)) return res.status(404).send('文件不存在');
    const ext = path.extname(fullPath).toLowerCase();
    const data = fs.readFileSync(fullPath);
    let html = '';

    if (ext === '.docx' || ext === '.doc') {
      mammoth.convertToHtml({ buffer: data })
        .then(result => res.send(`<html><head><meta charset="utf-8"><style>body{font-family:SimSun,serif;padding:20px;line-height:1.8}</style></head><body>${result.value}</body></html>`))
        .catch(() => res.status(500).send('文档转换失败'));
    } else if (ext === '.xlsx' || ext === '.xls') {
      const workbook = xlsx.read(data, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      html = xlsx.utils.sheet_to_html(sheet);
      res.send(`<html><head><meta charset="utf-8"><style>body{font-family:SimSun,serif;padding:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}</style></head><body>${html}</body></html>`);
    } else if (ext === '.pptx' || ext === '.ppt') {
      try {
        const zip = new AdmZip(data);
        const slideEntries = zip.getEntries().filter(e =>
          e.entryName.match(/^ppt\/slides\/slide\d+\.xml$/i)
        ).sort((a, b) => {
          const na = parseInt(a.entryName.match(/slide(\d+)/)?.[1] || 0);
          const nb = parseInt(b.entryName.match(/slide(\d+)/)?.[1] || 0);
          return na - nb;
        });
        let slidesHtml = '';
        slideEntries.forEach((entry, idx) => {
          const xml = entry.getData().toString('utf-8');
          const text = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          if (text) {
            slidesHtml += `<div style="margin:16px 0;padding:12px;background:#f9f9f9;border-left:4px solid #1890ff">
              <strong style="color:#1890ff">第${idx + 1}页</strong>
              <p style="margin:8px 0 0;line-height:1.8">${text}</p>
            </div>`;
          }
        });
        if (!slidesHtml) { res.status(500).send('PPT解析失败，请下载查看'); return; }
        res.send(`<html><head><meta charset="utf-8"><style>body{font-family:SimSun,serif;padding:20px;line-height:1.8}</style></head><body><h2>PPT内容</h2>${slidesHtml}</body></html>`);
      } catch {
        res.status(500).send('PPT解析失败，请下载查看');
      }
    } else {
      res.status(400).send('不支持的文件类型');
    }
  } catch (err) {
    res.status(500).send('预览失败: ' + err.message);
  }
});

router.use(authenticateToken);

router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请选择文件' });
  const url = '/api/uploads/' + req.file.filename;
  res.json({ url, name: req.file.originalname, size: req.file.size });
});

router.use('/materials', materialsRouter);
router.use('/scripts', scriptsRouter);
router.use('/onboarding', onboardingRouter);
router.use('/calls', callsRouter);
router.use('/feedback', feedbackRouter);
router.use('/dashboard', dashboardRouter);

export default router;