import { Router } from 'express';
import { getDb } from '../../database.js';
import { handle, succ, fail } from '../../utils/response.js';

const router = Router();

router.get('/plans', handle((req, res) => {
  const db = getDb();
  const plans = db.prepare('SELECT * FROM onboarding_plans ORDER BY created_at DESC').all();
  for (const p of plans) {
    p.tasks = db.prepare('SELECT * FROM onboarding_tasks WHERE plan_id = ? ORDER BY day_number, sort_order').all(p.id);
  }
  succ(res, { list: plans, total: plans.length });
}));

router.get('/plans/:id', handle((req, res) => {
  const db = getDb();
  const plan = db.prepare('SELECT * FROM onboarding_plans WHERE id = ?').get(req.params.id);
  if (!plan) return fail(res, '计划不存在', 404);
  plan.tasks = db.prepare('SELECT * FROM onboarding_tasks WHERE plan_id = ? ORDER BY day_number, sort_order').all(plan.id);
  succ(res, plan);
}));

router.post('/plans', handle((req, res) => {
  const db = getDb();
  const { title, description, duration_days, tasks } = req.body;
  if (!title) return fail(res, '计划名称不能为空');
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
  succ(res, { id: planId });
}));

router.put('/plans/:id', handle((req, res) => {
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
  succ(res);
}));

router.delete('/plans/:id', handle((req, res) => {
  getDb().prepare('DELETE FROM onboarding_plans WHERE id = ?').run(req.params.id);
  succ(res);
}));

router.post('/assign', handle((req, res) => {
  const db = getDb();
  const { user_id, plan_id } = req.body;
  if (!user_id || !plan_id) return fail(res, '参数不完整');
  const tasks = db.prepare('SELECT * FROM onboarding_tasks WHERE plan_id = ?').all(plan_id);
  if (tasks.length === 0) return fail(res, '培训计划无任务');
  const now = new Date().toISOString();
  const insert = db.prepare('INSERT OR IGNORE INTO user_onboarding (user_id, plan_id, task_id, status, created_at) VALUES (?, ?, ?, ?, ?)');
  const assignAll = db.transaction(() => {
    for (const t of tasks) {
      insert.run(user_id, plan_id, t.id, 'pending', now);
    }
  });
  assignAll();
  succ(res, { taskCount: tasks.length });
}));

router.get('/progress/:userId', handle((req, res) => {
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
  succ(res, { progress, total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0, planTitle });
}));

router.put('/task/:taskId', handle((req, res) => {
  const db = getDb();
  const { status, score, mentor_comment } = req.body;
  const updates = [];
  const params = [];
  if (status) { updates.push('status = ?'); params.push(status); }
  if (score !== undefined) { updates.push('score = ?'); params.push(score); }
  if (mentor_comment !== undefined) { updates.push('mentor_comment = ?'); params.push(mentor_comment); }
  if (status === 'completed') { updates.push('completed_at = ?'); params.push(new Date().toISOString()); }
  if (updates.length === 0) return fail(res, '无更新内容');
  params.push(req.params.taskId);
  db.prepare(`UPDATE user_onboarding SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  succ(res);
}));

router.get('/summary', handle((req, res) => {
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
  succ(res, { list: users, total: users.length });
}));

export default router;