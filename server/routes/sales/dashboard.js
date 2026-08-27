import { Router } from 'express';
import { getDb } from '../../database.js';
import { handle, succ } from '../../utils/response.js';

const router = Router();

router.get('/', handle((req, res) => {
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

  succ(res, { todayCalls, todayFeedbacks, activeTrainees, completedTrainees, topScripts, topMaterials, weeklyCalls, commonProblems });
}));

export default router;