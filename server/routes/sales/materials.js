import { Router } from 'express';
import { getDb } from '../../database.js';
import { handle, succ, fail, buildUpdateFields } from '../../utils/response.js';
import { tenantScope } from '../../utils/scope.js';

const router = Router();

router.get('/', handle((req, res) => {
  const db = getDb();
  const { category, keyword, page = 1, pageSize = 20 } = req.query;
  const scope = tenantScope(req.user);
  const params = [];
  let where = ' WHERE 1=1';
  if (scope !== undefined) { where += ' AND m.tenant_id = ?'; params.push(scope); }
  if (category) { where += ' AND m.category = ?'; params.push(category); }
  if (keyword) { where += ' AND (m.title LIKE ? OR m.content LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }

  const total = db.prepare(`SELECT COUNT(*) as total FROM sales_materials m${where}`).get(...params)?.total || 0;

  const sql = `
    SELECT m.*, u.name as author_name
    FROM sales_materials m
    LEFT JOIN users u ON m.author_id = u.id${where}
    ORDER BY m.is_pinned DESC, m.created_at DESC
    LIMIT ? OFFSET ?
  `;
  const list = db.prepare(sql).all(...params, Number(pageSize), (Number(page) - 1) * Number(pageSize));
  succ(res, { list, total, page: Number(page), pageSize: Number(pageSize) });
}));

router.get('/:id', handle((req, res) => {
  const db = getDb();
  const material = db.prepare(`
    SELECT m.*, u.name as author_name FROM sales_materials m
    LEFT JOIN users u ON m.author_id = u.id WHERE m.id = ?
  `).get(req.params.id);
  if (!material) return fail(res, '资料不存在', 404);
  const scope = tenantScope(req.user);
  if (scope !== undefined && material.tenant_id !== scope) return fail(res, '资料不存在', 404);
  db.prepare('UPDATE sales_materials SET view_count = view_count + 1 WHERE id = ?').run(req.params.id);
  material.view_count += 1;
  succ(res, material);
}));

router.post('/', handle((req, res) => {
  const db = getDb();
  const { title, content, category, file_url, is_pinned } = req.body;
  if (!title) return fail(res, '标题不能为空');
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO sales_materials (title, content, category, file_url, author_id, tenant_id, is_pinned, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, content || '', category || 'product', file_url || null, req.user.id, req.user.tenant_id || null, is_pinned ? 1 : 0, now, now);
  succ(res, { id: result.lastInsertRowid });
}));

router.put('/:id', handle((req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM sales_materials WHERE id = ?').get(req.params.id);
  if (!existing) return fail(res, '资料不存在', 404);
  const scope = tenantScope(req.user);
  if (scope !== undefined && existing.tenant_id !== scope) return fail(res, '资料不存在', 404);

  const { fields, values } = buildUpdateFields(req.body, {
    title: 'title', content: 'content', category: 'category',
    file_url: 'file_url', status: 'status',
  });
  if (req.body.is_pinned !== undefined) {
    fields.push('is_pinned=?');
    values.push(req.body.is_pinned ? 1 : 0);
  }
  if (fields.length === 0) return succ(res);
  fields.push('updated_at=?'); values.push(new Date().toISOString());
  values.push(req.params.id);
  db.prepare(`UPDATE sales_materials SET ${fields.join(', ')} WHERE id=?`).run(...values);
  succ(res);
}));

router.delete('/:id', handle((req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM sales_materials WHERE id = ?').get(req.params.id);
  if (!existing) return fail(res, '资料不存在', 404);
  const scope = tenantScope(req.user);
  if (scope !== undefined && existing.tenant_id !== scope) return fail(res, '资料不存在', 404);
  db.prepare('DELETE FROM sales_materials WHERE id = ?').run(req.params.id);
  succ(res);
}));

export default router;