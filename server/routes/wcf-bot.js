/**
 * WCF Bot API — 供 WeChatFerry 桥接服务调用的内部接口
 * 鉴权：bot key（与现有 RPA bot 共用密钥列表）
 * 按客户隔离：通过 wechat_id 绑定，客户只能查自己的订单
 */
import express from 'express';
import { getDb } from '../database.js';

const router = express.Router();

const BOT_KEYS = ['meiou-nuanbao-2026', 'meiou-rpa-2024'];

function authenticateBot(req, res, next) {
  const key = req.headers['x-bot-key'] || req.query.token || req.query.key;
  if (!BOT_KEYS.includes(key)) {
    return res.status(401).json({ error: '机器人密钥错误' });
  }
  next();
}

router.use(authenticateBot);

// 格式化日期
function fmtDate(d) {
  if (!d) return '—';
  if (typeof d === 'string' && d.length >= 10) return d.slice(0, 10);
  try { return new Date(d).toISOString().slice(0, 10); } catch { return '—'; }
}

// 状态映射
function statusText(code) {
  const map = {
    10: '草稿', 20: '待确认', 30: '已确认', 40: '装柜中',
    50: '进行中', 60: '已到港', 70: '已完成', 80: '已取消',
  };
  return map[code] || (code != null ? `状态${code}` : '—');
}

/**
 * GET /api/bot/wcf/profile
 * 查询 wechat_id 绑定的客户信息
 */
router.get('/profile', (req, res) => {
  const wechatId = req.query.wechat_id || '';
  if (!wechatId) {
    return res.json({ success: false, error: '缺少 wechat_id 参数' });
  }
  const db = getDb();
  const customer = db.prepare(
    'SELECT client_id, client_code, client_name, client_abbr, client_class, sales_name, contact_name, country_name FROM yunwuyun_customers WHERE wechat_id = ?'
  ).get(wechatId);

  if (!customer) {
    return res.json({ success: false, error: '该微信号未绑定任何客户，请联系管理员绑定' });
  }
  res.json({ success: true, data: customer });
});

/**
 * POST /api/bot/wcf/chat
 * 核心对话接口
 * Body: { wechat_id, message }
 * 返回: { reply: "..." }
 */
router.post('/chat', (req, res) => {
  const { wechat_id = '', message = '' } = req.body;
  const raw = (typeof message === 'string' ? message : '').trim();

  if (!wechat_id) {
    return res.json({ reply: '系统错误：缺少微信ID' });
  }

  const db = getDb();

  // 查找绑定的客户
  const customer = db.prepare(
    'SELECT client_id, client_code, client_name, client_abbr, client_class, sales_name FROM yunwuyun_customers WHERE wechat_id = ?'
  ).get(wechat_id);

  if (!customer) {
    if (/^(帮助|help|菜单|指令|你好|hi|hello|在吗)$/i.test(raw)) {
      // 未绑定客户仍然可以看帮助
      return res.json({
        reply: '你好！我是美鸥物流助手暖宝🐧\n你尚未绑定客户账号，请联系管理员将你的微信号绑定到客户。\n绑定后可使用以下指令：\n\n📋 指令列表\n━━━━━━━━━━━━━━━\n🔍 查单 单号\n🚢 我的单\n📊 统计\n❓ 帮助',
      });
    }
    return res.json({ reply: '你尚未绑定客户账号，请联系管理员将你的微信号绑定到客户后方可查询。' });
  }

  // 解析指令
  const msg = raw;

  // ===== 帮助 =====
  if (/^(帮助|help|菜单|指令|你好|hi|hello|在吗)$/i.test(msg)) {
    return res.json({
      reply: [
        `👋 你好 ${customer.client_abbr || customer.client_name}！我是美鸥物流助手暖宝🐧`,
        '',
        '📋 指令列表',
        '━━━━━━━━━━━━━━━',
        '🔍 查单 <单号> — 查询单票订单详情',
        '   例：查单 MEIOU20260801001',
        '   例：查单 SO123456',
        '',
        '🚢 我的单 — 查看你在途订单',
        '📊 统计 — 查看你的订单统计',
        '❓ 帮助 — 查看指令列表',
      ].join('\n'),
    });
  }

  // ===== 查单 <单号> =====
  const orderMatch = msg.match(/^(?:订单|运单|货单|查单|查询订单|查订单)\s*(.+)$/i);
  if (orderMatch) {
    const keyword = orderMatch[1].trim().replace(/['";\\]/g, '');
    const kw = `%${keyword}%`;
    // 只查本客户的订单
    const order = db.prepare(`
      SELECT * FROM yunwuyun_orders
      WHERE client_id = ?
        AND (job_no LIKE ? OR so_no LIKE ?
           OR bl_no_domestic LIKE ? OR bl_no_overseas LIKE ?
           OR carrier_jobno LIKE ?)
      ORDER BY job_date DESC LIMIT 1
    `).get(customer.client_id, kw, kw, kw, kw, kw);

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
      `类型：${order.job_type || '—'} | 运输：${order.transport_type || '—'}`,
      `船名航次：${(order.vessel || '—') + (order.voyage ? ' ' + order.voyage : '')}`,
      `起运/目的：${order.delivery_country || '—'} → ${order.dest_country || '—'}`,
      `货物：${order.goods_name || '—'} | ${order.pieces || 0}件 / ${order.goods_cbm || 0}CBM / ${order.gross_kgs || 0}KG`,
      `箱量：${order.cnt_nos || 0} | 状态：${statusText(order.order_status)}${order.close_status ? '（' + order.close_status + '）' : ''}`,
      `ETD：${fmtDate(order.etd)} | ETA：${fmtDate(order.eta)}`,
      order.atd ? `ATD：${fmtDate(order.atd)}` : '',
      order.job_remarks ? `备注：${order.job_remarks}` : '',
    ].filter(Boolean);
    return res.json({ reply: lines.join('\n') });
  }

  // ===== 我的单（在途订单）=====
  if (/^(在途|进行中|我的单|当前订单|在运|最近订单)$/i.test(msg)) {
    const rows = db.prepare(`
      SELECT job_no, vessel, voyage, etd, eta, dest_country, order_status, client_name, job_date
      FROM yunwuyun_orders
      WHERE client_id = ? AND order_status NOT IN (70, 80)
      ORDER BY job_date DESC LIMIT 10
    `).all(customer.client_id);

    if (rows.length === 0) {
      return res.json({ reply: '📋 当前没有在途订单。' });
    }

    const lines = [
      `🚢 ${customer.client_abbr || customer.client_name} 在途订单（${rows.length}条）`,
      '━━━━━━━━━━━━━━━',
    ];
    rows.forEach((o, i) => {
      lines.push(
        `${i + 1}. ${o.job_no || '—'}`,
        `   ${o.vessel || '—'} ${o.voyage || ''} | ETA ${fmtDate(o.eta)} | ${statusText(o.order_status)}`,
      );
    });
    return res.json({ reply: lines.join('\n') });
  }

  // ===== 统计 =====
  if (/^(统计|数据|概况|我的数据)$/i.test(msg)) {
    const total = db.prepare(
      'SELECT COUNT(*) as cnt FROM yunwuyun_orders WHERE client_id = ?'
    ).get(customer.client_id).cnt;
    const inTransit = db.prepare(
      'SELECT COUNT(*) as cnt FROM yunwuyun_orders WHERE client_id = ? AND order_status NOT IN (70, 80)'
    ).get(customer.client_id).cnt;
    const sumCBM = db.prepare(
      'SELECT COALESCE(SUM(goods_cbm),0) as s FROM yunwuyun_orders WHERE client_id = ?'
    ).get(customer.client_id).s;
    const sumAR = db.prepare(
      'SELECT COALESCE(SUM(ar_amt),0) as s FROM yunwuyun_orders WHERE client_id = ?'
    ).get(customer.client_id).s;
    const recent = db.prepare(
      'SELECT job_no, job_date, order_status FROM yunwuyun_orders WHERE client_id = ? ORDER BY job_date DESC LIMIT 5'
    ).all(customer.client_id);

    const lines = [
      `📊 ${customer.client_abbr || customer.client_name} 订单统计`,
      '━━━━━━━━━━━━━━━',
      `总订单：${total} 单`,
      `在途：${inTransit} 单`,
      `累计体积：${Number(sumCBM).toFixed(2)} CBM`,
      `应收金额：${Number(sumAR).toFixed(2)}`,
      '',
      '最近订单：',
      ...recent.map((r, i) => `  ${i + 1}. ${r.job_no}（${r.job_date ? r.job_date.slice(0, 10) : '—'}）${statusText(r.order_status)}`),
    ];
    return res.json({ reply: lines.join('\n') });
  }

  // 未匹配
  return res.json({
    reply: `抱歉，我没有理解「${msg}」。\n发送「帮助」查看指令列表。`,
  });
});

export default router;