import { Router } from 'express';
import { getDb } from '../database.js';

const router = Router();

function isAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ success: false, error: '仅管理员可操作' });
}

// 获取全部模板（含费项）
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const templates = db.prepare('SELECT * FROM fee_templates ORDER BY is_default DESC, id ASC').all();
    const itemsStmt = db.prepare('SELECT * FROM fee_template_items WHERE template_id = ? ORDER BY sort_order, id');
    const result = templates.map(t => ({
      ...t,
      items: itemsStmt.all(t.id)
    }));
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 获取单个模板
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const tpl = db.prepare('SELECT * FROM fee_templates WHERE id = ?').get(req.params.id);
    if (!tpl) return res.status(404).json({ success: false, error: '模板不存在' });
    tpl.items = db.prepare('SELECT * FROM fee_template_items WHERE template_id = ? ORDER BY sort_order, id').all(req.params.id);
    res.json({ success: true, data: tpl });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 创建模板
router.post('/', isAdmin, (req, res) => {
  try {
    const db = getDb();
    const { name, items } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, error: '模板名称不能为空' });

    const now = new Date().toISOString();
    const created_by = req.user?.id || 1;

    const doCreate = db.transaction(() => {
      const result = db.prepare(
        'INSERT INTO fee_templates (name, is_default, created_by, created_at, updated_at) VALUES (?, 0, ?, ?, ?)'
      ).run(name.trim(), created_by, now, now);

      const tplId = result.lastInsertRowid;
      if (items && items.length > 0) {
        const insertItem = db.prepare(
          'INSERT INTO fee_template_items (template_id, sort_order, item_name, standard, amount_type, amount_value, currency, note, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        items.forEach((item, idx) => {
          insertItem.run(tplId, idx, item.item_name, item.standard || '按每柜计费', item.amount_type || 'fixed', item.amount_value || '', item.currency || 'USD', item.note || '', item.category || 'fee');
        });
      }
      return tplId;
    });

    const tplId = doCreate();
    const tpl = db.prepare('SELECT * FROM fee_templates WHERE id = ?').get(tplId);
    tpl.items = db.prepare('SELECT * FROM fee_template_items WHERE template_id = ? ORDER BY sort_order, id').all(tplId);
    res.json({ success: true, data: tpl });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 更新模板
router.put('/:id', isAdmin, (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM fee_templates WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: '模板不存在' });

    const { name, items } = req.body;
    const now = new Date().toISOString();

    const doUpdate = db.transaction(() => {
      if (name && name.trim()) {
        db.prepare('UPDATE fee_templates SET name=?, updated_at=? WHERE id=?')
          .run(name.trim(), now, req.params.id);
      }
      if (items) {
        db.prepare('DELETE FROM fee_template_items WHERE template_id = ?').run(req.params.id);
        const insertItem = db.prepare(
          'INSERT INTO fee_template_items (template_id, sort_order, item_name, standard, amount_type, amount_value, currency, note, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        items.forEach((item, idx) => {
          insertItem.run(req.params.id, idx, item.item_name, item.standard || '按每柜计费', item.amount_type || 'fixed', item.amount_value || '', item.currency || 'USD', item.note || '', item.category || 'fee');
        });
      }
    });

    doUpdate();
    const tpl = db.prepare('SELECT * FROM fee_templates WHERE id = ?').get(req.params.id);
    tpl.items = db.prepare('SELECT * FROM fee_template_items WHERE template_id = ? ORDER BY sort_order, id').all(req.params.id);
    res.json({ success: true, data: tpl });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 删除模板
router.delete('/:id', isAdmin, (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM fee_templates WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: '模板不存在' });
    db.prepare('DELETE FROM fee_templates WHERE id = ?').run(req.params.id);
    res.json({ success: true, data: { message: '删除成功' } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 设为默认模板
router.put('/:id/set-default', isAdmin, (req, res) => {
  try {
    const db = getDb();
    db.prepare('UPDATE fee_templates SET is_default = 0').run();
    db.prepare('UPDATE fee_templates SET is_default = 1, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), req.params.id);
    res.json({ success: true, data: { message: '设置成功' } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;