import { Router } from 'express';
import { getDb } from '../database.js';
import { authenticateToken } from './auth.js';
import { isAdminUser, isPlatformAdmin, tenantScope } from '../utils/scope.js';

const router = Router();

router.use(authenticateToken);

function isAdmin(req, res, next) {
  if (isAdminUser(req.user)) return next();
  return res.status(403).json({ success: false, error: '仅管理员可操作' });
}

// 读取过滤：平台管理员不过滤，其余可读本主体模版 + 平台公共模版（tenant_id 为空）
// 注意：SQLite 的 UPDATE 不允许用表名限定列名，这里统一不加别名
function tenantFilter(user) {
  const scope = tenantScope(user);
  if (scope === undefined) return { sql: '', params: [] };
  return { sql: ' AND (tenant_id = ? OR tenant_id IS NULL)', params: [scope] };
}

// 写入过滤：只动本主体模版，平台公共模版对主体账号只读
function ownFilter(user) {
  const scope = tenantScope(user);
  if (scope === undefined) return { sql: '', params: [] };
  return { sql: ' AND tenant_id = ?', params: [scope] };
}

function canAccess(user, tpl) {
  if (!tpl) return false;
  if (isPlatformAdmin(user)) return true;
  return tpl.tenant_id === (user.tenant_id || -1);
}

// 读取权限：本主体模版或平台公共模版
function canRead(user, tpl) {
  if (canAccess(user, tpl)) return true;
  return !tpl.tenant_id;
}

// 获取模板（含费项），按主体隔离
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const tf = tenantFilter(req.user);
    const templates = db.prepare(
      'SELECT * FROM fee_templates WHERE 1=1' + tf.sql + ' ORDER BY is_default DESC, id ASC'
    ).all(...tf.params);
    const itemsStmt = db.prepare('SELECT * FROM fee_template_items WHERE template_id = ? ORDER BY sort_order, id');
    const platform = isPlatformAdmin(req.user);
    const result = templates.map(t => ({
      ...t,
      is_global: !t.tenant_id,
      can_edit: platform || t.tenant_id === (req.user.tenant_id || -1),
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
    if (!canRead(req.user, tpl)) return res.status(404).json({ success: false, error: '模板不存在' });
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
    const tenantId = req.user?.tenant_id || null;

    // 当前可见范围内还没有默认模版时，新建的这条自动成为默认，避免新建模版永远轮不到
    const scopeFilter = isPlatformAdmin(req.user)
      ? { sql: ' AND tenant_id IS NULL', params: [] }
      : tenantFilter(req.user);
    const hasDefault = db.prepare(
      'SELECT COUNT(*) AS c FROM fee_templates WHERE is_default = 1' + scopeFilter.sql
    ).get(...scopeFilter.params).c > 0;

    const doCreate = db.transaction(() => {
      const result = db.prepare(
        'INSERT INTO fee_templates (name, is_default, created_by, tenant_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(name.trim(), hasDefault ? 0 : 1, created_by, tenantId, now, now);

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
    if (!canAccess(req.user, existing)) return res.status(404).json({ success: false, error: '模板不存在' });

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
    if (!canAccess(req.user, existing)) return res.status(404).json({ success: false, error: '模板不存在' });
    db.prepare('DELETE FROM fee_templates WHERE id = ?').run(req.params.id);
    res.json({ success: true, data: { message: '删除成功' } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 设为默认模板（仅在本主体内重置，不影响其他主体）
router.put('/:id/set-default', isAdmin, (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM fee_templates WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: '模板不存在' });
    if (!canAccess(req.user, existing)) return res.status(404).json({ success: false, error: '模板不存在' });

    // 重置默认时只清本主体，不能把平台公共模版的默认状态一起清掉
    const of = ownFilter(req.user);
    db.prepare('UPDATE fee_templates SET is_default = 0 WHERE 1=1' + of.sql).run(...of.params);
    db.prepare('UPDATE fee_templates SET is_default = 1, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), req.params.id);
    res.json({ success: true, data: { message: '设置成功' } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 复制模板
router.post('/copy', isAdmin, (req, res) => {
  try {
    const db = getDb();
    const templateId = req.body.id;
    const src = db.prepare('SELECT * FROM fee_templates WHERE id = ?').get(templateId);
    if (!src) return res.status(404).json({ success: false, error: '模板不存在' });
    if (!canAccess(req.user, src)) return res.status(404).json({ success: false, error: '模板不存在' });

    const now = new Date().toISOString();
    const created_by = req.user?.id || 1;
    // 复制后的模板归属操作者所在主体，避免跨主体复制泄露
    const tenantId = req.user?.tenant_id || null;

    const doCopy = db.transaction(() => {
      const result = db.prepare(
        'INSERT INTO fee_templates (name, is_default, created_by, tenant_id, created_at, updated_at) VALUES (?, 0, ?, ?, ?, ?)'
      ).run(src.name + ' (副本)', created_by, tenantId, now, now);

      const newId = result.lastInsertRowid;
      const items = db.prepare('SELECT * FROM fee_template_items WHERE template_id = ? ORDER BY sort_order, id').all(templateId);
      const insertItem = db.prepare(
        'INSERT INTO fee_template_items (template_id, sort_order, item_name, standard, amount_type, amount_value, currency, note, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      items.forEach((item, idx) => {
        insertItem.run(newId, idx, item.item_name || '', item.standard || '按每柜计费', item.amount_type || 'fixed', item.amount_value || '', item.currency || 'USD', item.note || '', item.category || 'fee');
      });
      return newId;
    });

    const newId = doCopy();
    const tpl = db.prepare('SELECT * FROM fee_templates WHERE id = ?').get(newId);
    tpl.items = db.prepare('SELECT * FROM fee_template_items WHERE template_id = ? ORDER BY sort_order, id').all(newId);
    res.json({ success: true, data: tpl });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;