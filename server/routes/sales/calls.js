import { Router } from 'express';
import { getDb } from '../../database.js';
import { handle, succ, fail, buildUpdateFields } from '../../utils/response.js';

const router = Router();

router.get('/stats/mine', handle((req, res) => {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const todayCount = db.prepare("SELECT COUNT(*) as cnt FROM call_logs WHERE user_id = ? AND date(created_at) = ?").get(req.user.id, today)?.cnt || 0;
  const weekCount = db.prepare("SELECT COUNT(*) as cnt FROM call_logs WHERE user_id = ? AND date(created_at) >= ?").get(req.user.id, weekAgo)?.cnt || 0;
  const totalCount = db.prepare("SELECT COUNT(*) as cnt FROM call_logs WHERE user_id = ?").get(req.user.id)?.cnt || 0;
  const totalDuration = db.prepare("SELECT SUM(duration_minutes) as total FROM call_logs WHERE user_id = ?").get(req.user.id)?.total || 0;
  succ(res, { todayCount, weekCount, totalCount, totalDuration });
}));

router.get('/', handle((req, res) => {
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
  succ(res, { list, total, page: Number(page), pageSize: Number(pageSize) });
}));

router.get('/:id', handle((req, res) => {
  const db = getDb();
  const call = db.prepare(`
    SELECT cl.*, u.name as user_name, s.title as script_title
    FROM call_logs cl
    LEFT JOIN users u ON cl.user_id = u.id
    LEFT JOIN sales_scripts s ON cl.script_id = s.id
    WHERE cl.id = ?
  `).get(req.params.id);
  if (!call) return fail(res, '记录不存在', 404);
  call.reviews = db.prepare(`
    SELECT cr.*, u.name as reviewer_name FROM call_reviews cr
    LEFT JOIN users u ON cr.reviewer_id = u.id
    WHERE cr.call_log_id = ? ORDER BY cr.created_at ASC
  `).all(call.id);
  succ(res, call);
}));

router.post('/', handle((req, res) => {
  const db = getDb();
  const { customer_id, customer_name, duration_minutes, scenario_id, script_id, content, customer_response, self_review, next_steps, file_url } = req.body;
  if (!content) return fail(res, '通话内容不能为空');
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO call_logs (user_id, customer_id, customer_name, duration_minutes, scenario_id, script_id, content, customer_response, self_review, next_steps, file_url, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, customer_id || null, customer_name || '', duration_minutes || 0, scenario_id || 0, script_id || null, content, customer_response || '', self_review || '', next_steps || '', file_url || '', now, now);
  succ(res, { id: result.lastInsertRowid });
}));

router.put('/:id', handle((req, res) => {
  const db = getDb();
  const { fields, values } = buildUpdateFields(req.body, {
    customer_name: 'customer_name', duration_minutes: 'duration_minutes',
    content: 'content', customer_response: 'customer_response',
    self_review: 'self_review', next_steps: 'next_steps',
    file_url: 'file_url', status: 'status',
  });
  if (fields.length === 0) return succ(res);
  fields.push('updated_at=?'); values.push(new Date().toISOString());
  values.push(req.params.id);
  db.prepare(`UPDATE call_logs SET ${fields.join(', ')} WHERE id=?`).run(...values);
  succ(res);
}));

router.delete('/:id', handle((req, res) => {
  getDb().prepare('DELETE FROM call_logs WHERE id = ?').run(req.params.id);
  succ(res);
}));

router.post('/:id/review', handle((req, res) => {
  const db = getDb();
  const { comment, rating } = req.body;
  if (!comment) return fail(res, '点评内容不能为空');
  const result = db.prepare('INSERT INTO call_reviews (call_log_id, reviewer_id, comment, rating, created_at) VALUES (?, ?, ?, ?, ?)').run(req.params.id, req.user.id, comment, rating || 0, new Date().toISOString());
  succ(res, { id: result.lastInsertRowid });
}));

export default router;