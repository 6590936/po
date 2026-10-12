// 机器人暖宝 - 企微外部群RPA接口
// 供本地Python机器人调用：查询订单/客户/报价 + 主动推送队列
import express from 'express';
import { getDb } from '../database.js';
import crypto from 'crypto';

const router = express.Router();

// 支持 Query ?token= 或 Header x-bot-key
const BOT_KEYS = ['meiou-nuanbao-2026', 'meiou-rpa-2024'];

function authenticateBot(req, res, next) {
  const key = req.headers['x-bot-key'] || req.query.token || req.query.key;
  if (!BOT_KEYS.includes(key)) {
    return res.status(401).json({ error: '机器人密钥错误' });
  }
  next();
}

router.use(authenticateBot);

// ============ 推送队列（内存，带ID/状态/重试）============
function getQueue() {
  if (!global._rpaPushQueue) global._rpaPushQueue = [];
  return global._rpaPushQueue;
}
function genId() {
  return crypto.randomBytes(8).toString('hex');
}
function fmtDate(d) {
  if (!d) return '—';
  if (typeof d === 'string' && d.length >= 10) return d.slice(0, 10);
  try { return new Date(d).toISOString().slice(0, 10); } catch { return '—'; }
}

// ============ 状态映射（云雾云FMS数字状态码）============
function statusText(code) {
  const map = {
    10: '草稿', 20: '待确认', 30: '已确认', 40: '装柜中',
    50: '进行中', 60: '已到港', 70: '已完成', 80: '已取消',
  };
  return map[code] || (code != null ? `状态${code}` : '—');
}

// ============ 主查询入口 ============
router.post('/chat', (req, res) => {
  const { message = '', group_name = '', sender_name = '' } = req.body;
  const raw = (typeof message === 'string' ? message : '').trim();
  // 去掉@机器人暖宝
  const msg = raw.replace(/@[^\s@]+(?:\s*[\u2005\u00a0])?/g, '').trim();
  const db = getDb();

  if (!msg) {
    return res.json({
      reply: '你好！我是美鸥物流助手暖宝🐧\n发送「帮助」查看我能做什么。',
    });
  }

  // 帮助
  if (/^(帮助|help|菜单|指令|你好|hi|hello|在吗)$/i.test(msg)) {
    return res.json({
      reply: [
        '📋 美鸥暖宝指令列表',
        '━━━━━━━━━━━━━━━',
        '🔍 查订单：订单 工作单号',
        '   例：订单 MEIOU20260801001',
        '   或：订单 SO123456',
        '',
        '👥 查客户：客户 公司名/简称',
        '   例：客户 跨境',
        '',
        '🚢 在途订单：在途',
        '📊 我的数据：统计 客户简称',
        '❓ 帮助：帮助',
      ].join('\n'),
    });
  }

  // 订单查询：订单 XXX / 运单 XXX / 查单 XXX
  const orderMatch = msg.match(/^(?:订单|运单|货单|查单|查询订单|查订单)\s*(.+)$/i);
  if (orderMatch) {
    const keyword = orderMatch[1].trim().replace(/['";\\]/g, '');
    const kw = `%${keyword}%`;
    const order = db.prepare(`
      SELECT * FROM yunwuyun_orders
      WHERE job_no LIKE ? OR so_no LIKE ?
         OR bl_no_domestic LIKE ? OR bl_no_overseas LIKE ?
         OR carrier_jobno LIKE ?
      ORDER BY job_date DESC LIMIT 1
    `).get(kw, kw, kw, kw, kw);

    if (!order) {
      return res.json({ reply: `❌ 未找到「${keyword}」相关订单，请确认单号是否正确。` });
    }

    const lines = [
      '📦 订单详情',
      '━━━━━━━━━━━━━━━',
      `工作单号：${order.job_no || '—'}`,
      order.so_no ? `SO号：${order.so_no}` : '',
      order.bl_no_domestic ? `国内提单：${order.bl_no_domestic}` : '',
      order.bl_no_overseas ? `海外提单：${order.bl_no_overseas}` : '',
      `客户：${order.client_name || order.client_abbr || '—'}`,
      `类型：${order.job_type || '—'} | 运输：${order.transport_type || '—'}`,
      `船名航次：${(order.vessel || '—') + (order.voyage ? ' ' + order.voyage : '')}`,
      `起运/目的：${order.delivery_country || '—'} → ${order.dest_country || '—'}`,
      `货物：${order.goods_name || '—'} | ${order.pieces || 0}件 / ${order.goods_cbm || 0}CBM / ${order.gross_kgs || 0}KG`,
      `箱量：${order.cnt_nos || 0 } | 状态：${statusText(order.order_status)}${order.close_status ? '（' + order.close_status + '）' : ''}`,
      `ETD：${fmtDate(order.etd)} | ETA：${fmtDate(order.eta)}`,
      order.atd ? `ATD：${fmtDate(order.atd)}` : '',
      order.job_remarks ? `备注：${order.job_remarks}` : '',
    ].filter(Boolean);
    return res.json({ reply: lines.join('\n') });
  }

  // 在途订单
  if (/^(在途|进行中|当前订单|在运|最近订单)$/i.test(msg)) {
    // 云雾云FMS：70=已完成, 80=已取消；其余均为在途
    const rows = db.prepare(`
      SELECT job_no, vessel, voyage, etd, eta, dest_country, order_status, client_name
      FROM yunwuyun_orders
      WHERE order_status NOT IN (70, 80)
      ORDER BY job_date DESC LIMIT 10
    `).all();

    if (rows.length === 0) {
      return res.json({ reply: '📋 当前没有在途订单。' });
    }

    const lines = ['🚢 在途订单列表（最近10条）', '━━━━━━━━━━━━━━━'];
    rows.forEach((o, i) => {
      lines.push(
        `${i + 1}. ${o.job_no || '—'} | ${o.client_name || ''}`,
        `   ${o.vessel || '—'} ${o.voyage || ''} | ETA ${fmtDate(o.eta)} | ${statusText(o.order_status)}`,
      );
    });
    return res.json({ reply: lines.join('\n') });
  }

  // 客户查询
  const customerMatch = msg.match(/^(?:客户|查询客户|查客户)\s*(.+)$/i);
  if (customerMatch) {
    const keyword = customerMatch[1].trim().replace(/['";\\]/g, '');
    const kw = `%${keyword}%`;
    const customers = db.prepare(`
      SELECT client_id, client_code, client_name, client_abbr, contact_name, mobile_no,
             office_tel, country_name, client_class, sales_name
      FROM yunwuyun_customers
      WHERE client_name LIKE ? OR client_abbr LIKE ? OR client_code LIKE ? OR contact_name LIKE ?
      LIMIT 5
    `).all(kw, kw, kw, kw);

    if (customers.length === 0) {
      return res.json({ reply: `❌ 未找到「${keyword}」相关客户。` });
    }

    const lines = ['👥 客户信息', '━━━━━━━━━━━━━━━'];
    customers.forEach((c, i) => {
      lines.push(`${i + 1}. ${c.client_name}${c.client_abbr ? '（' + c.client_abbr + '）' : ''}`);
      lines.push(`   编码：${c.client_code || '—'} | 等级：${c.client_class || '—'}`);
      lines.push(`   联系人：${c.contact_name || '—'} ${c.mobile_no || c.office_tel || ''}`);
      lines.push(`   国家：${c.country_name || '—'} | 销售：${c.sales_name || '—'}`);
      lines.push('');
    });
    return res.json({ reply: lines.join('\n').trim() });
  }

  // 统计：统计 客户简称
  const statsMatch = msg.match(/^(?:统计|数据|概况)\s*(.+)$/i);
  if (statsMatch) {
    const keyword = statsMatch[1].trim().replace(/['";\\]/g, '');
    const kw = `%${keyword}%`;
    const c = db.prepare(`
      SELECT client_id, client_name, client_abbr
      FROM yunwuyun_customers
      WHERE client_name LIKE ? OR client_abbr LIKE ? OR client_code LIKE ?
      LIMIT 1
    `).get(kw, kw, kw);

    if (!c) {
      return res.json({ reply: `❌ 未找到「${keyword}」客户，无法统计。` });
    }

    const total = db.prepare('SELECT COUNT(*) as cnt FROM yunwuyun_orders WHERE client_id = ?').get(c.client_id).cnt;
    const inTransit = db.prepare(`SELECT COUNT(*) as cnt FROM yunwuyun_orders WHERE client_id = ? AND order_status NOT IN (70, 80)`).get(c.client_id).cnt;
    const sumCBM = db.prepare('SELECT COALESCE(SUM(goods_cbm),0) as s FROM yunwuyun_orders WHERE client_id = ?').get(c.client_id).s;
    const sumAR = db.prepare('SELECT COALESCE(SUM(ar_amt),0) as s FROM yunwuyun_orders WHERE client_id = ?').get(c.client_id).s;
    const recent = db.prepare('SELECT job_no, job_date, order_status FROM yunwuyun_orders WHERE client_id = ? ORDER BY job_date DESC LIMIT 3').all(c.client_id);

    const lines = [
      `📊 ${c.client_name} 订单统计`,
      '━━━━━━━━━━━━━━━',
      `总订单：${total} 单`,
      `在途：${inTransit} 单`,
      `累计体积：${Number(sumCBM).toFixed(2)} CBM`,
      `应收金额：${Number(sumAR).toFixed(2)}`,
      '',
      '最近订单：',
      ...recent.map((r, i) => `  ${i + 1}. ${r.job_no}（${r.job_date ? r.job_date.slice(0, 10) : '—'}）`),
    ];
    return res.json({ reply: lines.join('\n') });
  }

  // 未匹配
  return res.json({
    reply: `抱歉，我没有理解「${msg}」。\n发送「帮助」查看指令列表。`,
  });
});

// ============ 主动推送（CRM内部调用）============
router.post('/push', (req, res) => {
  const { group_name, message } = req.body;
  if (!group_name || !message) {
    return res.status(400).json({ error: '缺少group_name或message' });
  }
  const queue = getQueue();
  const item = {
    id: genId(),
    group_name,
    message,
    status: 'pending',
    created_at: new Date().toISOString(),
    sent_at: null,
    fail_reason: null,
    retry_count: 0,
  };
  queue.push(item);
  res.json({ ok: true, id: item.id, queued: queue.length });
});

// ============ 拉取待推送 ============
router.get('/pending', (req, res) => {
  const queue = getQueue();
  const limit = parseInt(req.query.limit) || 10;
  const items = queue.filter(q => q.status === 'pending').slice(0, limit);
  res.json({ items, total: queue.filter(q => q.status === 'pending').length });
});

// ============ 回调：已发送 ============
router.post('/sent/:id', (req, res) => {
  const item = getQueue().find(q => q.id === req.params.id);
  if (!item) return res.status(404).json({ error: '消息不存在' });
  item.status = 'sent';
  item.sent_at = new Date().toISOString();
  res.json({ ok: true, id: item.id });
});

// ============ 回调：失败（自动重试3次）============
router.post('/failed/:id', (req, res) => {
  const item = getQueue().find(q => q.id === req.params.id);
  if (!item) return res.status(404).json({ error: '消息不存在' });
  item.fail_reason = req.body?.reason || 'unknown';
  item.retry_count = (item.retry_count || 0) + 1;
  item.status = item.retry_count < 3 ? 'pending' : 'failed';
  res.json({ ok: true, id: item.id, retry_count: item.retry_count, will_retry: item.status === 'pending' });
});

// 队列状态（调试）
router.get('/queue/status', (req, res) => {
  const queue = getQueue();
  res.json({
    total: queue.length,
    pending: queue.filter(q => q.status === 'pending').length,
    sent: queue.filter(q => q.status === 'sent').length,
    failed: queue.filter(q => q.status === 'failed').length,
  });
});

export default router;
