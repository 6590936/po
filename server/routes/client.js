// 客户端门户路由（客户登录、查看订单）
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getDb } from '../database.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'meiou-crm-client-secret-2024';
const TOKEN_EXPIRY = '24h';

// 客户登录
router.post('/login', (req, res) => {
  const { account, password } = req.body;
  if (!account || !password) {
    return res.status(400).json({ error: '请输入账号和密码' });
  }

  const db = getDb();
  // 支持用 login_account 或 client_code 登录
  const customer = db.prepare(
    'SELECT * FROM yunwuyun_customers WHERE login_account = ? OR (login_account IS NULL AND client_code = ?)'
  ).get(account, account);

  if (!customer) {
    return res.status(401).json({ error: '账号不存在' });
  }
  if (!customer.login_enabled) {
    return res.status(403).json({ error: '该账号尚未开通登录，请联系客服' });
  }
  if (!customer.login_password || !bcrypt.compareSync(password, customer.login_password)) {
    return res.status(401).json({ error: '密码错误' });
  }

  const token = jwt.sign(
    {
      client_id: customer.client_id,
      client_code: customer.client_code,
      client_name: customer.client_name,
      login_account: customer.login_account || customer.client_code,
      type: 'client',
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );

  res.json({
    token,
    client: {
      client_id: customer.client_id,
      client_code: customer.client_code,
      client_name: customer.client_name,
      client_name_eng: customer.client_name_eng,
      client_abbr: customer.client_abbr,
      login_account: customer.login_account || customer.client_code,
    },
  });
});

// 客户认证中间件
function authenticateClient(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: '请先登录' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'client') return res.status(403).json({ error: '无效的客户端凭证' });
    req.client = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: '登录已过期，请重新登录' });
  }
}

// 获取当前客户信息
router.get('/me', authenticateClient, (req, res) => {
  const db = getDb();
  const customer = db.prepare(
    `SELECT client_id, client_code, client_name, client_name_eng, client_abbr,
            client_type, client_class, country_name, contact_name, sales_name,
            mobile_no, office_tel, client_addr, login_account,
            business_license, business_license_no, legal_person,
            registered_capital, establish_date, company_type, tax_no,
            contact_email, contact_phone
     FROM yunwuyun_customers WHERE client_id = ?`
  ).get(req.client.client_id);
  if (!customer) return res.status(404).json({ error: '客户不存在' });
  res.json(customer);
});

// 获取客户自己的订单列表
router.get('/orders', authenticateClient, (req, res) => {
  const db = getDb();
  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 20;
  const offset = (page - 1) * size;
  const search = req.query.search || '';

  let where = 'client_id = ?';
  const params = [req.client.client_id];
  if (search) {
    where += ' AND (job_no LIKE ? OR so_no LIKE ? OR bl_no_domestic LIKE ? OR vessel LIKE ? OR goods_name LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s, s);
  }

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM yunwuyun_orders WHERE ${where}`).get(...params).cnt;
  const rows = db.prepare(
    `SELECT job_id, job_no, job_type, job_date, order_status, close_status,
            carrier_name, vessel, voyage, etd, eta, atd,
            so_no, bl_no_domestic, bl_no_overseas,
            transport_type, loadtype, charging_type,
            delivery_country, dest_country, cnt_nos,
            goods_name, pieces, goods_cbm, gross_kgs,
            ar_amt, ap_amt, freighttons,
            synced_at
     FROM yunwuyun_orders WHERE ${where}
     ORDER BY job_date DESC LIMIT ? OFFSET ?`
  ).all(...params, size, offset);

  res.json({ success: true, data: rows, total, page, size });
});

// 获取订单详情
router.get('/orders/:id', authenticateClient, (req, res) => {
  const db = getDb();
  const order = db.prepare(
    'SELECT * FROM yunwuyun_orders WHERE job_id = ? AND client_id = ?'
  ).get(parseInt(req.params.id), req.client.client_id);
  if (!order) return res.status(404).json({ error: '订单不存在' });
  res.json(order);
});

// 获取客户订单统计
router.get('/stats', authenticateClient, (req, res) => {
  const db = getDb();
  const clientId = req.client.client_id;

  const totalOrders = db.prepare(
    'SELECT COUNT(*) as cnt FROM yunwuyun_orders WHERE client_id = ?'
  ).get(clientId).cnt;

  const totalAR = db.prepare(
    'SELECT COALESCE(SUM(ar_amt), 0) as total FROM yunwuyun_orders WHERE client_id = ?'
  ).get(clientId).total;

  const totalAP = db.prepare(
    'SELECT COALESCE(SUM(ap_amt), 0) as total FROM yunwuyun_orders WHERE client_id = ?'
  ).get(clientId).total;

  const totalVolume = db.prepare(
    'SELECT COALESCE(SUM(goods_cbm), 0) as total FROM yunwuyun_orders WHERE client_id = ?'
  ).get(clientId).total;

  const totalPieces = db.prepare(
    'SELECT COALESCE(SUM(pieces), 0) as total FROM yunwuyun_orders WHERE client_id = ?'
  ).get(clientId).total;

  const totalGrossKgs = db.prepare(
    'SELECT COALESCE(SUM(gross_kgs), 0) as total FROM yunwuyun_orders WHERE client_id = ?'
  ).get(clientId).total;

  const recentOrders = db.prepare(
    'SELECT job_id, job_no, job_date, vessel, voyage, etd, eta, delivery_country, dest_country FROM yunwuyun_orders WHERE client_id = ? ORDER BY job_date DESC LIMIT 5'
  ).all(clientId);

  res.json({
    totalOrders, totalAR, totalAP, totalVolume, totalPieces, totalGrossKgs, recentOrders,
  });
});

// 更新客户资料（营业执照、公司信息等）
router.put('/profile', authenticateClient, (req, res) => {
  const db = getDb();
  const allowedFields = [
    'business_license', 'business_license_no', 'legal_person',
    'registered_capital', 'establish_date', 'company_type', 'tax_no',
    'contact_email', 'contact_phone', 'contact_name', 'mobile_no',
    'office_tel', 'client_addr',
  ];
  const updates = [];
  const params = [];
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(req.body[field]);
    }
  }
  if (updates.length === 0) {
    return res.status(400).json({ error: '没有要更新的字段' });
  }
  params.push(req.client.client_id);
  db.prepare(`UPDATE yunwuyun_customers SET ${updates.join(', ')} WHERE client_id = ?`)
    .run(...params);
  res.json({ success: true, message: '资料更新成功' });
});

export default router;
export { authenticateClient };