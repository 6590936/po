import { Router } from 'express';
import { getDb } from '../../database.js';
import { handle, succ, fail, buildUpdateFields } from '../../utils/response.js';

const router = Router();

router.get('/', handle((req, res) => {
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
  succ(res, { list, total, page: Number(page), pageSize: Number(pageSize) });
}));

router.get('/:id', handle((req, res) => {
  const db = getDb();
  const item = db.prepare('SELECT f.*, u.name as user_name FROM feedback_summaries f LEFT JOIN users u ON f.user_id = u.id WHERE f.id = ?').get(req.params.id);
  if (!item) return fail(res, '记录不存在', 404);
  succ(res, item);
}));

router.post('/', handle((req, res) => {
  const db = getDb();
  const { title, content, related_call_ids, lessons_learned, action_items, file_url } = req.body;
  if (!title) return fail(res, '标题不能为空');
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO feedback_summaries (user_id, title, content, related_call_ids, lessons_learned, action_items, file_url, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, title, content || '', JSON.stringify(related_call_ids || []), lessons_learned || '', action_items || '', file_url || '', now, now);
  succ(res, { id: result.lastInsertRowid });
}));

router.put('/:id', handle((req, res) => {
  const db = getDb();
  const { fields, values } = buildUpdateFields(req.body, {
    title: 'title', content: 'content',
    lessons_learned: 'lessons_learned', action_items: 'action_items',
    file_url: 'file_url', status: 'status',
  });
  if (req.body.related_call_ids !== undefined) {
    fields.push('related_call_ids=?');
    values.push(JSON.stringify(req.body.related_call_ids));
  }
  if (fields.length === 0) return succ(res);
  fields.push('updated_at=?'); values.push(new Date().toISOString());
  values.push(req.params.id);
  db.prepare(`UPDATE feedback_summaries SET ${fields.join(', ')} WHERE id=?`).run(...values);
  succ(res);
}));

router.delete('/:id', handle((req, res) => {
  getDb().prepare('DELETE FROM feedback_summaries WHERE id = ?').run(req.params.id);
  succ(res);
}));

export default router;