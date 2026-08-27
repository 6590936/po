import { Router } from 'express';
import { getDb } from '../database.js';
import { authenticateToken } from './auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mammoth from 'mammoth';
import xlsx from 'xlsx';
import AdmZip from 'adm-zip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', 'uploads');

// 确保上传目录存在
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

// Office文件预览 - 放最前面，用URL参数传token绕过认证
router.get('/preview', (req, res, next) => {
  if (req.query.token && !req.headers.authorization) {
    req.headers.authorization = 'Bearer ' + req.query.token;
  }
  next();
}, authenticateToken, (req, res) => {
  try {
    const filePath = req.query.file;
    if (!filePath) return res.status(400).send('缺少文件参数');
    const fullPath = path.join(__dirname, '..', filePath.replace(/^\/api\/uploads\//, 'uploads/'));
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

// 通用文件上传
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请选择文件' });
  const url = '/api/uploads/' + req.file.filename;
  res.json({ url, name: req.file.originalname, size: req.file.size });
});

// ==================== 培训资料库 ====================

// 获取资料列表
router.get('/materials', (req, res) => {
  try {
    const db = getDb();
    const { category, keyword, page = 1, pageSize = 20 } = req.query;
    let sql = `
      SELECT m.*, u.name as author_name
      FROM sales_materials m
      LEFT JOIN users u ON m.author_id = u.id
      WHERE 1=1
    `;
    const params = [];
    if (category) { sql += ' AND m.category = ?'; params.push(category); }
    if (keyword) { sql += ' AND (m.title LIKE ? OR m.content LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }
    sql += ' ORDER BY m.is_pinned DESC, m.created_at DESC';
    const countSql = sql.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total FROM');
    const total = db.prepare(countSql).get(...params)?.total || 0;
    sql += ' LIMIT ? OFFSET ?';
    params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));
    const list = db.prepare(sql).all(...params);
    res.json({ list, total, page: Number(page), pageSize: Number(pageSize) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取资料详情
router.get('/materials/:id', (req, res) => {
  try {
    const db = getDb();
    const material = db.prepare(`
      SELECT m.*, u.name as author_name FROM sales_materials m
      LEFT JOIN users u ON m.author_id = u.id WHERE m.id = ?
    `).get(req.params.id);
    if (!material) return res.status(404).json({ error: '资料不存在' });
    db.prepare('UPDATE sales_materials SET view_count = view_count + 1 WHERE id = ?').run(req.params.id);
    material.view_count += 1;
    res.json(material);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 创建资料
router.post('/materials', (req, res) => {
  try {
    const db = getDb();
    const { title, content, category, file_url, is_pinned } = req.body;
    if (!title) return res.status(400).json({ error: '标题不能为空' });
    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO sales_materials (title, content, category, file_url, author_id, is_pinned, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(title, content || '', category || 'product', file_url || null, req.user.id, is_pinned ? 1 : 0, now, now);
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 更新资料
router.put('/materials/:id', (req, res) => {
  try {
    const db = getDb();
    const fields = [];
    const values = [];
    if (req.body.title !== undefined) { fields.push('title=?'); values.push(req.body.title); }
    if (req.body.content !== undefined) { fields.push('content=?'); values.push(req.body.content); }
    if (req.body.category !== undefined) { fields.push('category=?'); values.push(req.body.category); }
    if (req.body.file_url !== undefined) { fields.push('file_url=?'); values.push(req.body.file_url); }
    if (req.body.status !== undefined) { fields.push('status=?'); values.push(req.body.status); }
    if (req.body.is_pinned !== undefined) { fields.push('is_pinned=?'); values.push(req.body.is_pinned ? 1 : 0); }
    if (fields.length === 0) return res.json({ success: true });
    fields.push('updated_at=?'); values.push(new Date().toISOString());
    values.push(req.params.id);
    db.prepare(`UPDATE sales_materials SET ${fields.join(', ')} WHERE id=?`).run(...values);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除资料
router.delete('/materials/:id', (req, res) => {
  try {
    getDb().prepare('DELETE FROM sales_materials WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 话术库 ====================

// 获取话术场景列表
router.get('/scripts/scenes', (req, res) => {
  const scenes = [
    { key: 'first_call', name: '初次电话', icon: '📞' },
    { key: 'follow_up', name: '跟进回访', icon: '🔄' },
    { key: 'quotation', name: '报价沟通', icon: '💰' },
    { key: 'objection', name: '异议处理', icon: '🛡️' },
    { key: 'closing', name: '促成成交', icon: '🤝' },
    { key: 'collection', name: '催款回款', icon: '💳' },
    { key: 'greeting', name: '节日问候', icon: '🎉' },
    { key: 'other', name: '其他场景', icon: '📋' },
  ];
  res.json(scenes);
});

// 获取话术列表
router.get('/scripts', (req, res) => {
  try {
    const db = getDb();
    const { scene_category, keyword, page = 1, pageSize = 20 } = req.query;
    let sql = `
      SELECT s.*, u.name as author_name,
        CASE WHEN sf.id IS NOT NULL THEN 1 ELSE 0 END as is_favorite
      FROM sales_scripts s
      LEFT JOIN users u ON s.author_id = u.id
      LEFT JOIN script_favorites sf ON sf.script_id = s.id AND sf.user_id = ?
      WHERE 1=1
    `;
    const params = [req.user.id];
    if (scene_category) { sql += ' AND s.scene_category = ?'; params.push(scene_category); }
    if (keyword) { sql += ' AND (s.title LIKE ? OR s.script_content LIKE ? OR s.keywords LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }
    sql += ' ORDER BY s.usage_count DESC, s.created_at DESC';
    const countSql = sql.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total FROM').replace(/CASE.*?END as is_favorite/, '1 as is_favorite');
    const countParams = [...params];
    const total = db.prepare(countSql).get(...countParams)?.total || 0;
    sql += ' LIMIT ? OFFSET ?';
    params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));
    const list = db.prepare(sql).all(...params);
    res.json({ list, total, page: Number(page), pageSize: Number(pageSize) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取话术详情
router.get('/scripts/:id', (req, res) => {
  try {
    const db = getDb();
    const script = db.prepare(`
      SELECT s.*, u.name as author_name FROM sales_scripts s
      LEFT JOIN users u ON s.author_id = u.id WHERE s.id = ?
    `).get(req.params.id);
    if (!script) return res.status(404).json({ error: '话术不存在' });
    db.prepare('UPDATE sales_scripts SET usage_count = usage_count + 1 WHERE id = ?').run(req.params.id);
    res.json(script);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 创建话术
router.post('/scripts', (req, res) => {
  try {
    const db = getDb();
    const { title, scene_category, scene_name, script_content, notes, target_customer_type, keywords, file_url } = req.body;
    if (!title || !script_content) return res.status(400).json({ error: '标题和话术内容不能为空' });
    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO sales_scripts (title, scene_category, scene_name, script_content, notes, target_customer_type, keywords, file_url, author_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(title, scene_category || 'other', scene_name || '', script_content, notes || '', target_customer_type || '', keywords || '', file_url || '', req.user.id, now, now);
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 更新话术
router.put('/scripts/:id', (req, res) => {
  try {
    const db = getDb();
    const fields = [];
    const values = [];
    if (req.body.title !== undefined) { fields.push('title=?'); values.push(req.body.title); }
    if (req.body.scene_category !== undefined) { fields.push('scene_category=?'); values.push(req.body.scene_category); }
    if (req.body.scene_name !== undefined) { fields.push('scene_name=?'); values.push(req.body.scene_name); }
    if (req.body.script_content !== undefined) { fields.push('script_content=?'); values.push(req.body.script_content); }
    if (req.body.notes !== undefined) { fields.push('notes=?'); values.push(req.body.notes); }
    if (req.body.target_customer_type !== undefined) { fields.push('target_customer_type=?'); values.push(req.body.target_customer_type); }
    if (req.body.keywords !== undefined) { fields.push('keywords=?'); values.push(req.body.keywords); }
    if (req.body.file_url !== undefined) { fields.push('file_url=?'); values.push(req.body.file_url); }
    if (req.body.status !== undefined) { fields.push('status=?'); values.push(req.body.status); }
    if (fields.length === 0) return res.json({ success: true });
    fields.push('updated_at=?'); values.push(new Date().toISOString());
    values.push(req.params.id);
    db.prepare(`UPDATE sales_scripts SET ${fields.join(', ')} WHERE id=?`).run(...values);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除话术
router.delete('/scripts/:id', (req, res) => {
  try {
    getDb().prepare('DELETE FROM sales_scripts WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 收藏/取消收藏话术
router.post('/scripts/:id/favorite', (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM script_favorites WHERE user_id = ? AND script_id = ?').get(req.user.id, req.params.id);
    if (existing) {
      db.prepare('DELETE FROM script_favorites WHERE id = ?').run(existing.id);
      res.json({ favorited: false });
    } else {
      db.prepare('INSERT INTO script_favorites (user_id, script_id, created_at) VALUES (?, ?, ?)').run(req.user.id, req.params.id, new Date().toISOString());
      res.json({ favorited: true });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取我的收藏
router.get('/scripts/favorites/mine', (req, res) => {
  try {
    const db = getDb();
    const list = db.prepare(`
      SELECT s.* FROM sales_scripts s
      INNER JOIN script_favorites sf ON sf.script_id = s.id AND sf.user_id = ?
      ORDER BY sf.created_at DESC
    `).all(req.user.id);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 新人培训 ====================

// 获取培训计划列表
router.get('/onboarding/plans', (req, res) => {
  try {
    const db = getDb();
    const plans = db.prepare('SELECT * FROM onboarding_plans ORDER BY created_at DESC').all();
    for (const p of plans) {
      p.tasks = db.prepare('SELECT * FROM onboarding_tasks WHERE plan_id = ? ORDER BY day_number, sort_order').all(p.id);
    }
    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取培训计划详情
router.get('/onboarding/plans/:id', (req, res) => {
  try {
    const db = getDb();
    const plan = db.prepare('SELECT * FROM onboarding_plans WHERE id = ?').get(req.params.id);
    if (!plan) return res.status(404).json({ error: '计划不存在' });
    plan.tasks = db.prepare('SELECT * FROM onboarding_tasks WHERE plan_id = ? ORDER BY day_number, sort_order').all(plan.id);
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 创建培训计划
router.post('/onboarding/plans', (req, res) => {
  try {
    const db = getDb();
    const { title, description, duration_days, tasks } = req.body;
    if (!title) return res.status(400).json({ error: '计划名称不能为空' });
    const now = new Date().toISOString();
    const result = db.prepare('INSERT INTO onboarding_plans (title, description, duration_days, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(title, description || '', duration_days || 14, now, now);
    const planId = result.lastInsertRowid;
    if (tasks && tasks.length > 0) {
      const insertTask = db.prepare('INSERT INTO onboarding_tasks (plan_id, day_number, title, description, task_type, material_id, script_id, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i];
        insertTask.run(planId, t.day_number, t.title, t.description || '', t.task_type || 'study', t.material_id || null, t.script_id || null, i, now);
      }
    }
    res.json({ id: planId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 更新培训计划
router.put('/onboarding/plans/:id', (req, res) => {
  try {
    const db = getDb();
    const { title, description, duration_days, status, tasks } = req.body;
    const now = new Date().toISOString();
    db.prepare('UPDATE onboarding_plans SET title=?, description=?, duration_days=?, status=?, updated_at=? WHERE id=?').run(title, description, duration_days, status, now, req.params.id);
    if (tasks) {
      db.prepare('DELETE FROM onboarding_tasks WHERE plan_id = ?').run(req.params.id);
      const insertTask = db.prepare('INSERT INTO onboarding_tasks (plan_id, day_number, title, description, task_type, material_id, script_id, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i];
        insertTask.run(req.params.id, t.day_number, t.title, t.description || '', t.task_type || 'study', t.material_id || null, t.script_id || null, i, now);
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除培训计划
router.delete('/onboarding/plans/:id', (req, res) => {
  try {
    getDb().prepare('DELETE FROM onboarding_plans WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 分配培训计划给用户
router.post('/onboarding/assign', (req, res) => {
  try {
    const db = getDb();
    const { user_id, plan_id } = req.body;
    if (!user_id || !plan_id) return res.status(400).json({ error: '参数不完整' });
    const tasks = db.prepare('SELECT * FROM onboarding_tasks WHERE plan_id = ?').all(plan_id);
    if (tasks.length === 0) return res.status(400).json({ error: '培训计划无任务' });
    const now = new Date().toISOString();
    const insert = db.prepare('INSERT OR IGNORE INTO user_onboarding (user_id, plan_id, task_id, status, created_at) VALUES (?, ?, ?, ?, ?)');
    const assignAll = db.transaction(() => {
      for (const t of tasks) {
        insert.run(user_id, plan_id, t.id, 'pending', now);
      }
    });
    assignAll();
    res.json({ success: true, taskCount: tasks.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取用户培训进度
router.get('/onboarding/progress/:userId', (req, res) => {
  try {
    const db = getDb();
    const progress = db.prepare(`
      SELECT uo.*, ot.title as task_title, ot.day_number, ot.task_type, op.title as plan_title, op.duration_days
      FROM user_onboarding uo
      JOIN onboarding_tasks ot ON uo.task_id = ot.id
      JOIN onboarding_plans op ON uo.plan_id = op.id
      WHERE uo.user_id = ?
      ORDER BY ot.day_number, ot.sort_order
    `).all(req.params.userId);
    const total = progress.length;
    const completed = progress.filter(p => p.status === 'completed').length;
    const planTitle = progress.length > 0 ? progress[0].plan_title : '';
    res.json({ progress, total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0, planTitle });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 更新任务状态
router.put('/onboarding/task/:taskId', (req, res) => {
  try {
    const db = getDb();
    const { status, score, mentor_comment } = req.body;
    const updates = [];
    const params = [];
    if (status) { updates.push('status = ?'); params.push(status); }
    if (score !== undefined) { updates.push('score = ?'); params.push(score); }
    if (mentor_comment !== undefined) { updates.push('mentor_comment = ?'); params.push(mentor_comment); }
    if (status === 'completed') { updates.push('completed_at = ?'); params.push(new Date().toISOString()); }
    if (updates.length === 0) return res.status(400).json({ error: '无更新内容' });
    params.push(req.params.taskId);
    db.prepare(`UPDATE user_onboarding SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取所有新人培训进度汇总
router.get('/onboarding/summary', (req, res) => {
  try {
    const db = getDb();
    const users = db.prepare(`
      SELECT DISTINCT u.id, u.name, u.username, u.role
      FROM user_onboarding uo
      JOIN users u ON uo.user_id = u.id
      ORDER BY u.name
    `).all();
    for (const user of users) {
      const stats = db.prepare(`
        SELECT COUNT(*) as total, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
        FROM user_onboarding WHERE user_id = ?
      `).get(user.id);
      user.total = stats.total;
      user.completed = stats.completed;
      user.percent = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
    }
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 通话记录 ====================

// 获取通话记录列表
router.get('/calls', (req, res) => {
  try {
    const db = getDb();
    const { user_id, customer_id, keyword, page = 1, pageSize = 20 } = req.query;
    let sql = `
      SELECT cl.*, u.name as user_name,
        (SELECT COUNT(*) FROM call_reviews WHERE call_log_id = cl.id) as review_count
      FROM call_logs cl
      LEFT JOIN users u ON cl.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    if (user_id) { sql += ' AND cl.user_id = ?'; params.push(user_id); }
    if (customer_id) { sql += ' AND cl.customer_id = ?'; params.push(customer_id); }
    if (keyword) { sql += ' AND (cl.customer_name LIKE ? OR cl.content LIKE ? OR cl.customer_response LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }
    sql += ' ORDER BY cl.created_at DESC';
    const countSql = sql.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total FROM').replace(/\(SELECT.*?review_count/, '0 as review_count');
    const total = db.prepare(countSql).get(...params)?.total || 0;
    sql += ' LIMIT ? OFFSET ?';
    params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));
    const list = db.prepare(sql).all(...params);
    res.json({ list, total, page: Number(page), pageSize: Number(pageSize) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取通话详情
router.get('/calls/:id', (req, res) => {
  try {
    const db = getDb();
    const call = db.prepare(`
      SELECT cl.*, u.name as user_name, s.title as script_title
      FROM call_logs cl
      LEFT JOIN users u ON cl.user_id = u.id
      LEFT JOIN sales_scripts s ON cl.script_id = s.id
      WHERE cl.id = ?
    `).get(req.params.id);
    if (!call) return res.status(404).json({ error: '记录不存在' });
    call.reviews = db.prepare(`
      SELECT cr.*, u.name as reviewer_name FROM call_reviews cr
      LEFT JOIN users u ON cr.reviewer_id = u.id
      WHERE cr.call_log_id = ? ORDER BY cr.created_at ASC
    `).all(call.id);
    res.json(call);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 创建通话记录
router.post('/calls', (req, res) => {
  try {
    const db = getDb();
    const { customer_id, customer_name, duration_minutes, scenario_id, script_id, content, customer_response, self_review, next_steps, file_url } = req.body;
    if (!content) return res.status(400).json({ error: '通话内容不能为空' });
    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO call_logs (user_id, customer_id, customer_name, duration_minutes, scenario_id, script_id, content, customer_response, self_review, next_steps, file_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, customer_id || null, customer_name || '', duration_minutes || 0, scenario_id || 0, script_id || null, content, customer_response || '', self_review || '', next_steps || '', file_url || '', now, now);
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 更新通话记录
router.put('/calls/:id', (req, res) => {
  try {
    const db = getDb();
    const fields = [];
    const values = [];
    if (req.body.customer_name !== undefined) { fields.push('customer_name=?'); values.push(req.body.customer_name); }
    if (req.body.duration_minutes !== undefined) { fields.push('duration_minutes=?'); values.push(req.body.duration_minutes); }
    if (req.body.content !== undefined) { fields.push('content=?'); values.push(req.body.content); }
    if (req.body.customer_response !== undefined) { fields.push('customer_response=?'); values.push(req.body.customer_response); }
    if (req.body.self_review !== undefined) { fields.push('self_review=?'); values.push(req.body.self_review); }
    if (req.body.next_steps !== undefined) { fields.push('next_steps=?'); values.push(req.body.next_steps); }
    if (req.body.file_url !== undefined) { fields.push('file_url=?'); values.push(req.body.file_url); }
    if (req.body.status !== undefined) { fields.push('status=?'); values.push(req.body.status); }
    if (fields.length === 0) return res.json({ success: true });
    fields.push('updated_at=?'); values.push(new Date().toISOString());
    values.push(req.params.id);
    db.prepare(`UPDATE call_logs SET ${fields.join(', ')} WHERE id=?`).run(...values);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除通话记录
router.delete('/calls/:id', (req, res) => {
  try {
    getDb().prepare('DELETE FROM call_logs WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 添加点评
router.post('/calls/:id/review', (req, res) => {
  try {
    const db = getDb();
    const { comment, rating } = req.body;
    if (!comment) return res.status(400).json({ error: '点评内容不能为空' });
    const result = db.prepare('INSERT INTO call_reviews (call_log_id, reviewer_id, comment, rating, created_at) VALUES (?, ?, ?, ?, ?)').run(req.params.id, req.user.id, comment, rating || 0, new Date().toISOString());
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 我的通话统计
router.get('/calls/stats/mine', (req, res) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const todayCount = db.prepare("SELECT COUNT(*) as cnt FROM call_logs WHERE user_id = ? AND date(created_at) = ?").get(req.user.id, today)?.cnt || 0;
    const weekCount = db.prepare("SELECT COUNT(*) as cnt FROM call_logs WHERE user_id = ? AND date(created_at) >= ?").get(req.user.id, weekAgo)?.cnt || 0;
    const totalCount = db.prepare("SELECT COUNT(*) as cnt FROM call_logs WHERE user_id = ?").get(req.user.id)?.cnt || 0;
    const totalDuration = db.prepare("SELECT SUM(duration_minutes) as total FROM call_logs WHERE user_id = ?").get(req.user.id)?.total || 0;
    res.json({ todayCount, weekCount, totalCount, totalDuration });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 反馈总结 ====================

// 获取反馈总结列表
router.get('/feedback', (req, res) => {
  try {
    const db = getDb();
    const { user_id, keyword, page = 1, pageSize = 20 } = req.query;
    let sql = 'SELECT f.*, u.name as user_name FROM feedback_summaries f LEFT JOIN users u ON f.user_id = u.id WHERE 1=1';
    const params = [];
    if (user_id) { sql += ' AND f.user_id = ?'; params.push(user_id); }
    if (keyword) { sql += ' AND (f.title LIKE ? OR f.content LIKE ? OR f.lessons_learned LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }
    sql += ' ORDER BY f.created_at DESC';
    const total = db.prepare(sql.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total FROM')).get(...params)?.total || 0;
    sql += ' LIMIT ? OFFSET ?';
    params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));
    const list = db.prepare(sql).all(...params);
    res.json({ list, total, page: Number(page), pageSize: Number(pageSize) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取反馈详情
router.get('/feedback/:id', (req, res) => {
  try {
    const db = getDb();
    const item = db.prepare('SELECT f.*, u.name as user_name FROM feedback_summaries f LEFT JOIN users u ON f.user_id = u.id WHERE f.id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: '记录不存在' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 创建反馈总结
router.post('/feedback', (req, res) => {
  try {
    const db = getDb();
    const { title, content, related_call_ids, lessons_learned, action_items, file_url } = req.body;
    if (!title) return res.status(400).json({ error: '标题不能为空' });
    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO feedback_summaries (user_id, title, content, related_call_ids, lessons_learned, action_items, file_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, title, content || '', JSON.stringify(related_call_ids || []), lessons_learned || '', action_items || '', file_url || '', now, now);
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 更新反馈总结
router.put('/feedback/:id', (req, res) => {
  try {
    const db = getDb();
    const fields = [];
    const values = [];
    if (req.body.title !== undefined) { fields.push('title=?'); values.push(req.body.title); }
    if (req.body.content !== undefined) { fields.push('content=?'); values.push(req.body.content); }
    if (req.body.related_call_ids !== undefined) { fields.push('related_call_ids=?'); values.push(JSON.stringify(req.body.related_call_ids)); }
    if (req.body.lessons_learned !== undefined) { fields.push('lessons_learned=?'); values.push(req.body.lessons_learned); }
    if (req.body.action_items !== undefined) { fields.push('action_items=?'); values.push(req.body.action_items); }
    if (req.body.file_url !== undefined) { fields.push('file_url=?'); values.push(req.body.file_url); }
    if (req.body.status !== undefined) { fields.push('status=?'); values.push(req.body.status); }
    if (fields.length === 0) return res.json({ success: true });
    fields.push('updated_at=?'); values.push(new Date().toISOString());
    values.push(req.params.id);
    db.prepare(`UPDATE feedback_summaries SET ${fields.join(', ')} WHERE id=?`).run(...values);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除反馈总结
router.delete('/feedback/:id', (req, res) => {
  try {
    getDb().prepare('DELETE FROM feedback_summaries WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 销售数据看板 ====================

router.get('/dashboard', (req, res) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    const todayCalls = db.prepare("SELECT COUNT(*) as cnt FROM call_logs WHERE date(created_at) = ?").get(today)?.cnt || 0;
    const todayFeedbacks = db.prepare("SELECT COUNT(*) as cnt FROM feedback_summaries WHERE date(created_at) = ?").get(today)?.cnt || 0;
    const activeTrainees = db.prepare("SELECT COUNT(DISTINCT user_id) as cnt FROM user_onboarding").get()?.cnt || 0;
    const completedTrainees = db.prepare(`
      SELECT COUNT(DISTINCT uo.user_id) as cnt FROM user_onboarding uo
      JOIN (SELECT user_id, plan_id, COUNT(*) as total FROM user_onboarding GROUP BY user_id, plan_id) t ON uo.user_id = t.user_id AND uo.plan_id = t.plan_id
      WHERE uo.status = 'completed' GROUP BY uo.user_id, uo.plan_id
      HAVING COUNT(*) = t.total
    `).all().length;

    const topScripts = db.prepare('SELECT id, title, scene_name, usage_count FROM sales_scripts ORDER BY usage_count DESC LIMIT 5').all();
    const topMaterials = db.prepare('SELECT id, title, category, view_count FROM sales_materials ORDER BY view_count DESC LIMIT 5').all();
    const weeklyCalls = db.prepare(`
      SELECT date(created_at) as day, COUNT(*) as cnt FROM call_logs
      WHERE date(created_at) >= ? GROUP BY date(created_at) ORDER BY day
    `).all(weekAgo);
    const commonProblems = db.prepare(`
      SELECT lessons_learned FROM feedback_summaries WHERE lessons_learned != '' ORDER BY created_at DESC LIMIT 10
    `).all().map(r => r.lessons_learned).filter(Boolean);

    res.json({ todayCalls, todayFeedbacks, activeTrainees, completedTrainees, topScripts, topMaterials, weeklyCalls, commonProblems });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;