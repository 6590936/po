import { Router } from 'express';
import { getDb } from '../../database.js';
import { handle, succ, fail, buildUpdateFields } from '../../utils/response.js';
import { tenantScope } from '../../utils/scope.js';

const router = Router();

router.get('/scenes', (req, res) => {
  res.json([
    { key: 'first_call', name: '初次电话', icon: '📞' },
    { key: 'follow_up', name: '跟进回访', icon: '🔄' },
    { key: 'quotation', name: '报价沟通', icon: '💰' },
    { key: 'objection', name: '异议处理', icon: '🛡️' },
    { key: 'closing', name: '促成成交', icon: '🤝' },
    { key: 'collection', name: '催款回款', icon: '💳' },
    { key: 'greeting', name: '节日问候', icon: '🎉' },
    { key: 'other', name: '其他场景', icon: '📋' },
  ]);
});

router.get('/favorites/mine', handle((req, res) => {
  const db = getDb();
  const scope = tenantScope(req.user);
  let sql = `
    SELECT s.* FROM sales_scripts s
    INNER JOIN script_favorites sf ON sf.script_id = s.id AND sf.user_id = ?
    WHERE 1=1
  `;
  const params = [req.user.id];
  if (scope !== undefined) { sql += ' AND s.tenant_id = ?'; params.push(scope); }
  sql += ' ORDER BY sf.created_at DESC';
  const list = db.prepare(sql).all(...params);
  succ(res, { list, total: 0 });
}));

router.get('/', handle((req, res) => {
  const db = getDb();
  const { scene_category, keyword, page = 1, pageSize = 20 } = req.query;
  const scope = tenantScope(req.user);
  const params = [req.user.id];
  let where = ' WHERE 1=1';
  if (scope !== undefined) { where += ' AND s.tenant_id = ?'; params.push(scope); }
  if (scene_category) { where += ' AND s.scene_category = ?'; params.push(scene_category); }
  if (keyword) { where += ' AND (s.title LIKE ? OR s.script_content LIKE ? OR s.keywords LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }

  const total = db.prepare(`
    SELECT COUNT(*) as total FROM sales_scripts s
    LEFT JOIN script_favorites sf ON sf.script_id = s.id AND sf.user_id = ?${where}
  `).get(...params)?.total || 0;

  const sql = `
    SELECT s.*, u.name as author_name,
      CASE WHEN sf.id IS NOT NULL THEN 1 ELSE 0 END as is_favorite
    FROM sales_scripts s
    LEFT JOIN users u ON s.author_id = u.id
    LEFT JOIN script_favorites sf ON sf.script_id = s.id AND sf.user_id = ?${where}
    ORDER BY s.usage_count DESC, s.created_at DESC
    LIMIT ? OFFSET ?
  `;
  const list = db.prepare(sql).all(...params, Number(pageSize), (Number(page) - 1) * Number(pageSize));
  succ(res, { list, total, page: Number(page), pageSize: Number(pageSize) });
}));

router.get('/:id', handle((req, res) => {
  const db = getDb();
  const script = db.prepare(`
    SELECT s.*, u.name as author_name FROM sales_scripts s
    LEFT JOIN users u ON s.author_id = u.id WHERE s.id = ?
  `).get(req.params.id);
  if (!script) return fail(res, '话术不存在', 404);
  const scope = tenantScope(req.user);
  if (scope !== undefined && script.tenant_id !== scope) return fail(res, '话术不存在', 404);
  db.prepare('UPDATE sales_scripts SET usage_count = usage_count + 1 WHERE id = ?').run(req.params.id);
  succ(res, script);
}));

router.post('/', handle((req, res) => {
  const db = getDb();
  const { title, scene_category, scene_name, script_content, notes, target_customer_type, keywords, file_url } = req.body;
  if (!title || !script_content) return fail(res, '标题和话术内容不能为空');
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO sales_scripts (title, scene_category, scene_name, script_content, notes, target_customer_type, keywords, file_url, author_id, tenant_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, scene_category || 'other', scene_name || '', script_content, notes || '', target_customer_type || '', keywords || '', file_url || '', req.user.id, req.user.tenant_id || null, now, now);
  succ(res, { id: result.lastInsertRowid });
}));

router.put('/:id', handle((req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM sales_scripts WHERE id = ?').get(req.params.id);
  if (!existing) return fail(res, '话术不存在', 404);
  const scope = tenantScope(req.user);
  if (scope !== undefined && existing.tenant_id !== scope) return fail(res, '话术不存在', 404);

  const { fields, values } = buildUpdateFields(req.body, {
    title: 'title', scene_category: 'scene_category', scene_name: 'scene_name',
    script_content: 'script_content', notes: 'notes',
    target_customer_type: 'target_customer_type', keywords: 'keywords',
    file_url: 'file_url', status: 'status',
  });
  if (fields.length === 0) return succ(res);
  fields.push('updated_at=?'); values.push(new Date().toISOString());
  values.push(req.params.id);
  db.prepare(`UPDATE sales_scripts SET ${fields.join(', ')} WHERE id=?`).run(...values);
  succ(res);
}));

router.delete('/:id', handle((req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM sales_scripts WHERE id = ?').get(req.params.id);
  if (!existing) return fail(res, '话术不存在', 404);
  const scope = tenantScope(req.user);
  if (scope !== undefined && existing.tenant_id !== scope) return fail(res, '话术不存在', 404);
  db.prepare('DELETE FROM sales_scripts WHERE id = ?').run(req.params.id);
  succ(res);
}));

router.post('/:id/favorite', handle((req, res) => {
  const db = getDb();
  const script = db.prepare('SELECT id, tenant_id FROM sales_scripts WHERE id = ?').get(req.params.id);
  if (!script) return fail(res, '话术不存在', 404);
  const scope = tenantScope(req.user);
  if (scope !== undefined && script.tenant_id !== scope) return fail(res, '话术不存在', 404);

  const existing = db.prepare('SELECT id FROM script_favorites WHERE user_id = ? AND script_id = ?').get(req.user.id, req.params.id);
  if (existing) {
    db.prepare('DELETE FROM script_favorites WHERE id = ?').run(existing.id);
    succ(res, { favorited: false });
  } else {
    db.prepare('INSERT INTO script_favorites (user_id, script_id, created_at) VALUES (?, ?, ?)').run(req.user.id, req.params.id, new Date().toISOString());
    succ(res, { favorited: true });
  }
}));

export default router;