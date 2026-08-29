// 云无云接口路由
import express from 'express';
import bcrypt from 'bcryptjs';
import { authenticateToken } from './auth.js';
import { testConnection, setToken, cntProfitTotal, query, syncOrders, syncCustomers } from '../yunwuyun.js';
import { getDb } from '../database.js';

const router = express.Router();

router.use(authenticateToken);

// 测试连接
router.get('/test', async (req, res) => {
  try {
    const result = await testConnection();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 手动更新 token
router.post('/set-token', async (req, res) => {
  try {
    setToken(req.body.token);
    res.json({ success: true, data: { message: 'Token已更新' } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 同步订单
router.post('/sync-orders', async (req, res) => {
  try {
    const result = await syncOrders();
    if (!result.success) {
      return res.json({ success: false, error: '同步失败' });
    }

    const db = getDb();
    const upsert = db.prepare(`
      INSERT OR REPLACE INTO yunwuyun_orders (
        job_id, job_no, job_type, job_date, order_status, close_status,
        client_id, client_name, client_name_eng, client_code, client_abbr,
        carrier_name, vessel, voyage, etd, eta, atd,
        so_no, bl_no_domestic, bl_no_overseas, carrier_jobno,
        ar_amt, ap_amt, gr_oss, freighttons, client_quote_freighttons,
        transport_type, loadtype, stow_type, collect_type, charging_type,
        delivery_country, dest_country, warehouse_code,
        supply_channel_code, supply_channel_name, channel_receive_code, channel_receive_name,
        cnt_nos, charging_codes, goods_name, goods_value,
        pieces, gross_kgs, goods_cbm, net_kgs,
        client_total_volume, client_total_pieces, client_total_weight, client_billing_weight,
        box_total_qty, box_total_weight, box_total_volume,
        estimate_quantity_total, goods_cycode, base_cy_code,
        order_status_map, booking_aheads, inserted_by, job_remarks,
        order_change_type, delivery_fee_cc, client_settler_type,
        ar_count, ap_count, latest_problem_count, comment_count,
        synced_at
      ) VALUES (
        @job_id, @job_no, @job_type, @job_date, @order_status, @close_status,
        @client_id, @client_name, @client_name_eng, @client_code, @client_abbr,
        @carrier_name, @vessel, @voyage, @etd, @eta, @atd,
        @so_no, @bl_no_domestic, @bl_no_overseas, @carrier_jobno,
        @ar_amt, @ap_amt, @gr_oss, @freighttons, @client_quote_freighttons,
        @transport_type, @loadtype, @stow_type, @collect_type, @charging_type,
        @delivery_country, @dest_country, @warehouse_code,
        @supply_channel_code, @supply_channel_name, @channel_receive_code, @channel_receive_name,
        @cnt_nos, @charging_codes, @goods_name, @goods_value,
        @pieces, @gross_kgs, @goods_cbm, @net_kgs,
        @client_total_volume, @client_total_pieces, @client_total_weight, @client_billing_weight,
        @box_total_qty, @box_total_weight, @box_total_volume,
        @estimate_quantity_total, @goods_cycode, @base_cy_code,
        @order_status_map, @booking_aheads, @inserted_by, @job_remarks,
        @order_change_type, @delivery_fee_cc, @client_settler_type,
        @ar_count, @ap_count, @latest_problem_count, @comment_count,
        @synced_at
      )
    `);

    const syncAll = db.transaction(() => {
      for (const row of result.data) {
        upsert.run(row);
      }
    });
    syncAll();

    res.json({ success: true, data: { totalSynced: result.totalSynced, total: result.total } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 同步客户
router.post('/sync-customers', async (req, res) => {
  try {
    const result = await syncCustomers();
    if (!result.success) {
      return res.json({ success: false, error: '同步失败' });
    }

    const db = getDb();
    const upsert = db.prepare(`
      INSERT OR REPLACE INTO yunwuyun_customers (
        client_id, client_code, client_name, client_name_eng, client_abbr,
        client_type, client_class, client_class_eng, client_property, client_same_industry,
        country_id, country_code, country_name, country_name_eng,
        province_state, client_addr, addr_postcode, mobile_no, office_tel, uni_credit_code,
        contact_name, sales_name, op_name, cs_name, staff_name_biz,
        insert_time, update_time, inserted_by, updated_by,
        inuse, catalog_name, catalog_name_eng,
        org_code, org_name, org_name_eng,
        client_source_name, client_source_name_eng, settler_type, csm_staff,
        synced_at
      ) VALUES (
        @client_id, @client_code, @client_name, @client_name_eng, @client_abbr,
        @client_type, @client_class, @client_class_eng, @client_property, @client_same_industry,
        @country_id, @country_code, @country_name, @country_name_eng,
        @province_state, @client_addr, @addr_postcode, @mobile_no, @office_tel, @uni_credit_code,
        @contact_name, @sales_name, @op_name, @cs_name, @staff_name_biz,
        @insert_time, @update_time, @inserted_by, @updated_by,
        @inuse, @catalog_name, @catalog_name_eng,
        @org_code, @org_name, @org_name_eng,
        @client_source_name, @client_source_name_eng, @settler_type, @csm_staff,
        @synced_at
      )
    `);

    const syncAll = db.transaction(() => {
      for (const row of result.data) {
        upsert.run(row);
      }
    });
    syncAll();

    res.json({ success: true, data: { totalSynced: result.totalSynced, total: result.total } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 获取已同步的订单
router.get('/orders', async (req, res) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const size = parseInt(req.query.size) || 20;
    const offset = (page - 1) * size;
    const search = req.query.search || '';
    const status = req.query.status || '';

    let where = '1=1';
    const params = [];
    if (search) {
      where += ' AND (job_no LIKE ? OR client_name LIKE ? OR client_code LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status) {
      where += ' AND order_status = ?';
      params.push(parseInt(status));
    }

    const total = db.prepare(`SELECT COUNT(*) as cnt FROM yunwuyun_orders WHERE ${where}`).get(...params).cnt;
    const rows = db.prepare(`
      SELECT o.*, t.success AS has_tracking, t.status AS tracking_status, t.status_label AS tracking_status_label
      FROM yunwuyun_orders o
      LEFT JOIN order_tracking t ON o.job_id = t.job_id
      WHERE ${where}
      ORDER BY o.job_date DESC LIMIT ? OFFSET ?
    `).all(...params, size, offset);
    res.json({ success: true, data: { list: rows, total, page, size } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 获取已同步的客户
router.get('/customers', async (req, res) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const size = parseInt(req.query.size) || 20;
    const offset = (page - 1) * size;
    const search = req.query.search || '';
    const inuse = req.query.inuse || '';

    let where = '1=1';
    const params = [];
    if (search) {
      where += ` AND (
        client_name LIKE ? OR client_code LIKE ? OR client_abbr LIKE ?
        OR client_type LIKE ? OR client_class LIKE ? OR sales_name LIKE ?
        OR country_name LIKE ? OR contact_name LIKE ? OR org_name LIKE ?
        OR client_name_eng LIKE ?
      )`;
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s, s, s, s, s);
    }
    if (inuse) {
      where += ' AND inuse = ?';
      params.push(parseInt(inuse));
    }

    const total = db.prepare(`SELECT COUNT(*) as cnt FROM yunwuyun_customers WHERE ${where}`).get(...params).cnt;
    const rows = db.prepare(`SELECT * FROM yunwuyun_customers WHERE ${where} ORDER BY client_name LIMIT ? OFFSET ?`).all(...params, size, offset);
    res.json({ success: true, data: { list: rows, total, page, size } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 获取客户筛选选项（动态从数据库取）
router.get('/customers/filters', async (req, res) => {
  try {
    const db = getDb();
    const clientTypes = db.prepare(
      'SELECT DISTINCT client_type FROM yunwuyun_customers WHERE client_type IS NOT NULL AND client_type != \'\' ORDER BY client_type'
    ).all().map(r => r.client_type);
    const clientClasses = db.prepare(
      'SELECT DISTINCT client_class FROM yunwuyun_customers WHERE client_class IS NOT NULL AND client_class != \'\' ORDER BY client_class'
    ).all().map(r => r.client_class);
    const salesNames = db.prepare(
      'SELECT DISTINCT sales_name FROM yunwuyun_customers WHERE sales_name IS NOT NULL AND sales_name != \'\' ORDER BY sales_name'
    ).all().map(r => r.sales_name);
    const countryNames = db.prepare(
      'SELECT DISTINCT country_name FROM yunwuyun_customers WHERE country_name IS NOT NULL AND country_name != \'\' ORDER BY country_name'
    ).all().map(r => r.country_name);
    res.json({ success: true, data: { clientTypes, clientClasses, salesNames, countryNames } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 统计数据
router.get('/stats', async (req, res) => {
  try {
    const db = getDb();
    const orderCount = db.prepare('SELECT COUNT(*) as cnt FROM yunwuyun_orders').get().cnt;
    const customerCount = db.prepare('SELECT COUNT(*) as cnt FROM yunwuyun_customers').get().cnt;
    const totals = db.prepare('SELECT SUM(ar_amt) as total_ar, SUM(ap_amt) as total_ap, SUM(gr_oss) as total_profit FROM yunwuyun_orders').get();
    const statusCounts = db.prepare('SELECT order_status, COUNT(*) as cnt FROM yunwuyun_orders GROUP BY order_status').all();
    res.json({
      success: true,
      data: {
        orderCount,
        customerCount,
        totalAR: totals.total_ar || 0,
        totalAP: totals.total_ap || 0,
        totalProfit: totals.total_profit || 0,
        statusCounts,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 利润汇总
router.post('/profit', async (req, res) => {
  try {
    const data = await cntProfitTotal(req.body);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 通用查询代理
router.all('/proxy/*', async (req, res) => {
  try {
    const apiPath = req.params[0];
    const data = await query(apiPath, {
      method: req.method,
      body: req.body,
      params: req.query,
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 订单详情
router.get('/orders/:id', async (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM yunwuyun_orders WHERE job_id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: '订单不存在' });
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 更新订单
router.put('/orders/:id', async (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM yunwuyun_orders WHERE job_id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: '订单不存在' });

    const allowed = ['job_no','job_type','job_date','order_status','close_status','client_name','client_name_eng',
      'client_code','client_abbr','carrier_name','vessel','voyage','etd','eta','atd','so_no','bl_no_domestic',
      'bl_no_overseas','carrier_jobno','ar_amt','ap_amt','gr_oss','freighttons','client_quote_freighttons',
      'transport_type','loadtype','stow_type','collect_type','charging_type','delivery_country','dest_country',
      'warehouse_code','supply_channel_code','supply_channel_name','channel_receive_code','channel_receive_name',
      'cnt_nos','charging_codes','goods_name','goods_value','pieces','gross_kgs','goods_cbm','net_kgs',
      'client_total_volume','client_total_pieces','client_total_weight','client_billing_weight',
      'box_total_qty','box_total_weight','box_total_volume','estimate_quantity_total','goods_cycode','base_cy_code',
      'inserted_by','job_remarks','order_change_type','delivery_fee_cc','client_settler_type',
      'ar_count','ap_count','latest_problem_count','comment_count','client_id'];
    const sets = [];
    const vals = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        sets.push(`${key} = ?`);
        vals.push(req.body[key]);
      }
    }
    if (sets.length === 0) return res.json({ success: false, error: '无更新字段' });
    vals.push(req.params.id);
    db.prepare(`UPDATE yunwuyun_orders SET ${sets.join(', ')} WHERE job_id = ?`).run(...vals);
    res.json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 删除订单
router.delete('/orders/:id', async (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM yunwuyun_orders WHERE job_id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: '订单不存在' });
    db.prepare('DELETE FROM yunwuyun_orders WHERE job_id = ?').run(req.params.id);
    res.json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 新增订单
router.post('/orders', async (req, res) => {
  try {
    const db = getDb();
    const { job_no } = req.body;
    if (!job_no) return res.json({ success: false, error: '工作单号必填' });
    const exists = db.prepare('SELECT job_id FROM yunwuyun_orders WHERE job_no = ?').get(job_no);
    if (exists) return res.json({ success: false, error: '工作单号已存在' });

    const now = new Date().toISOString();
    const fields = ['job_no','job_type','job_date','order_status','close_status','client_id','client_name',
      'client_name_eng','client_code','client_abbr','carrier_name','vessel','voyage','etd','eta','atd',
      'so_no','bl_no_domestic','bl_no_overseas','carrier_jobno','ar_amt','ap_amt','gr_oss','freighttons',
      'client_quote_freighttons','transport_type','loadtype','stow_type','collect_type','charging_type',
      'delivery_country','dest_country','warehouse_code','supply_channel_code','supply_channel_name',
      'channel_receive_code','channel_receive_name','cnt_nos','charging_codes','goods_name','goods_value',
      'pieces','gross_kgs','goods_cbm','net_kgs','client_total_volume','client_total_pieces',
      'client_total_weight','client_billing_weight','box_total_qty','box_total_weight','box_total_volume',
      'estimate_quantity_total','goods_cycode','base_cy_code','inserted_by','job_remarks','order_change_type',
      'delivery_fee_cc','client_settler_type','ar_count','ap_count','latest_problem_count','comment_count',
      'synced_at'];
    const vals = [job_no];
    const placeholders = ['?'];
    for (const f of fields.slice(1)) {
      if (req.body[f] !== undefined) {
        placeholders.push('?');
        vals.push(req.body[f]);
      } else {
        placeholders.push('?');
        vals.push(null);
      }
    }
    placeholders.push('?');
    vals.push(now);
    fields.push('synced_at');

    // 生成唯一ID
    const maxId = db.prepare('SELECT MAX(job_id) as mx FROM yunwuyun_orders').get()?.mx || 0;
    const newId = Math.max(maxId + 1, Date.now());
    db.prepare(`INSERT INTO yunwuyun_orders (job_id, ${fields.join(', ')}) VALUES (?, ${placeholders.join(', ')})`)
      .run(newId, ...vals);
    res.json({ success: true, data: { job_id: newId } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 客户详情
router.get('/customers/:id', async (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM yunwuyun_customers WHERE client_id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: '客户不存在' });
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 更新客户
router.put('/customers/:id', async (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM yunwuyun_customers WHERE client_id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: '客户不存在' });

    const allowed = ['client_code','client_name','client_name_eng','client_abbr','client_type','client_class',
      'client_class_eng','client_property','client_same_industry','country_id','country_code','country_name',
      'country_name_eng','province_state','client_addr','addr_postcode','mobile_no','office_tel','uni_credit_code',
      'contact_name','sales_name','op_name','cs_name','staff_name_biz','insert_time','update_time','inserted_by',
      'updated_by','inuse','catalog_name','catalog_name_eng','org_code','org_name','org_name_eng',
      'client_source_name','client_source_name_eng','settler_type','csm_staff'];
    const sets = [];
    const vals = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        sets.push(`${key} = ?`);
        vals.push(req.body[key]);
      }
    }
    if (sets.length === 0) return res.json({ success: false, error: '无更新字段' });
    vals.push(req.params.id);
    db.prepare(`UPDATE yunwuyun_customers SET ${sets.join(', ')} WHERE client_id = ?`).run(...vals);
    res.json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 删除客户
router.delete('/customers/:id', async (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM yunwuyun_customers WHERE client_id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: '客户不存在' });
    db.prepare('DELETE FROM yunwuyun_customers WHERE client_id = ?').run(req.params.id);
    res.json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 新增客户
router.post('/customers', async (req, res) => {
  try {
    const db = getDb();
    const { client_code, client_name } = req.body;
    if (!client_code || !client_name) return res.json({ success: false, error: '客户编码和名称必填' });
    const exists = db.prepare('SELECT client_id FROM yunwuyun_customers WHERE client_code = ?').get(client_code);
    if (exists) return res.json({ success: false, error: '客户编码已存在' });

    const now = new Date().toISOString();
    const fields = ['client_code','client_name','client_name_eng','client_abbr','client_type','client_class',
      'client_class_eng','client_property','client_same_industry','country_id','country_code','country_name',
      'country_name_eng','province_state','client_addr','addr_postcode','mobile_no','office_tel','uni_credit_code',
      'contact_name','sales_name','op_name','cs_name','staff_name_biz','insert_time','update_time','inserted_by',
      'updated_by','inuse','catalog_name','catalog_name_eng','org_code','org_name','org_name_eng',
      'client_source_name','client_source_name_eng','settler_type','csm_staff','synced_at'];
    const vals = [client_code, client_name];
    const placeholders = ['?', '?'];
    for (const f of fields.slice(2)) {
      if (req.body[f] !== undefined) {
        placeholders.push('?');
        vals.push(req.body[f]);
      } else {
        placeholders.push('?');
        vals.push(null);
      }
    }
    placeholders.push('?');
    vals.push(now);
    fields.push('synced_at');

    const maxId = db.prepare('SELECT MAX(client_id) as mx FROM yunwuyun_customers').get()?.mx || 0;
    const newId = Math.max(maxId + 1, Date.now());
    db.prepare(`INSERT INTO yunwuyun_customers (client_id, ${fields.join(', ')}) VALUES (?, ${placeholders.join(', ')})`)
      .run(newId, ...vals);
    res.json({ success: true, data: { client_id: newId } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== 客户账号管理（开通/关闭登录、重置密码） =====

// 开通客户登录
router.put('/customers/:id/enable-login', async (req, res) => {
  try {
    const db = getDb();
    const { login_account, password } = req.body;
    if (!login_account) {
      return res.json({ success: false, error: '请输入登录账号' });
    }
    if (!password || password.length < 4) {
      return res.json({ success: false, error: '密码长度至少4位' });
    }
    // 检查 login_account 是否已被其他客户使用
    const dup = db.prepare(
      'SELECT client_id FROM yunwuyun_customers WHERE login_account = ? AND client_id != ?'
    ).get(login_account, parseInt(req.params.id));
    if (dup) {
      return res.json({ success: false, error: '该登录账号已被其他客户使用' });
    }
    const hashed = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE yunwuyun_customers SET login_enabled = 1, login_account = ?, login_password = ? WHERE client_id = ?')
      .run(login_account, hashed, parseInt(req.params.id));
    res.json({ success: true, data: { message: '客户登录已开通' } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 关闭客户登录
router.put('/customers/:id/disable-login', async (req, res) => {
  try {
    const db = getDb();
    db.prepare('UPDATE yunwuyun_customers SET login_enabled = 0, login_account = NULL, login_password = NULL WHERE client_id = ?')
      .run(parseInt(req.params.id));
    res.json({ success: true, data: { message: '客户登录已关闭' } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 重置客户密码
router.put('/customers/:id/reset-password', async (req, res) => {
  try {
    const db = getDb();
    const { password } = req.body;
    if (!password || password.length < 4) {
      return res.json({ success: false, error: '密码长度至少4位' });
    }
    const customer = db.prepare('SELECT login_enabled FROM yunwuyun_customers WHERE client_id = ?')
      .get(parseInt(req.params.id));
    if (!customer) return res.json({ success: false, error: '客户不存在' });
    if (!customer.login_enabled) return res.json({ success: false, error: '该客户尚未开通登录' });

    const hashed = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE yunwuyun_customers SET login_password = ? WHERE client_id = ?')
      .run(hashed, parseInt(req.params.id));
    res.json({ success: true, data: { message: '密码重置成功' } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;