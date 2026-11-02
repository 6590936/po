// 云无云接口路由
import express from 'express';
import bcrypt from 'bcryptjs';
import { authenticateToken } from './auth.js';
import { testConnection, setToken, cntProfitTotal, query, syncOrders, syncCustomers, syncOrderSettlements } from '../yunwuyun.js';
import { getDb } from '../database.js';

const router = express.Router();

router.use(authenticateToken);

function isSales(req) {
  const perms = req.user.permissions || [];
  return req.user.role !== 'admin' && !perms.includes('data:all');
}

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
        ar_settled_amt, ar_unsettled_amt, ap_settled_amt, ap_unsettled_amt, ar_amt_cy, ap_amt_cy, settled_at,
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
        @ar_settled_amt, @ar_unsettled_amt, @ap_settled_amt, @ap_unsettled_amt, @ar_amt_cy, @ap_amt_cy, @settled_at,
        @synced_at
      )
    `);

    const settleResult = await syncOrderSettlements();
    const settleMap = settleResult.data || new Map();
    const settleAt = new Date().toISOString();

    const syncAll = db.transaction(() => {
      for (const row of result.data) {
        const s = settleMap.get(row.job_id) || {};
        upsert.run({
          ...row,
          ar_settled_amt: s.ar_settled || 0,
          ar_unsettled_amt: s.ar_unsettled || 0,
          ap_settled_amt: s.ap_settled || 0,
          ap_unsettled_amt: s.ap_unsettled || 0,
          ar_amt_cy: s.ar_amt_cy || 0,
          ap_amt_cy: s.ap_amt_cy || 0,
          settled_at: settleResult.success ? settleAt : null,
        });
      }
    });
    syncAll();

    res.json({
      success: true,
      data: {
        totalSynced: result.totalSynced,
        total: result.total,
        settleFetched: settleResult.totalFetched || 0,
        settleOrders: settleMap.size,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 同步订单核销金额（已收/未收、已付/未付）
router.post('/sync-settlements', async (req, res) => {
  try {
    const settleResult = await syncOrderSettlements();
    if (!settleResult.success) {
      return res.json({ success: false, error: '核销数据拉取失败' });
    }

    const db = getDb();
    const settleAt = new Date().toISOString();
    const update = db.prepare(`
      UPDATE yunwuyun_orders
      SET ar_settled_amt = ?, ar_unsettled_amt = ?, ap_settled_amt = ?, ap_unsettled_amt = ?,
          ar_amt_cy = ?, ap_amt_cy = ?, settled_at = ?
      WHERE job_id = ?
    `);

    let updated = 0;
    const runAll = db.transaction(() => {
      for (const [jobId, s] of settleResult.data) {
        const info = update.run(
          s.ar_settled || 0, s.ar_unsettled || 0, s.ap_settled || 0, s.ap_unsettled || 0,
          s.ar_amt_cy || 0, s.ap_amt_cy || 0, settleAt, jobId
        );
        if (info.changes) updated++;
      }
    });
    runAll();

    res.json({
      success: true,
      data: { totalFetched: settleResult.totalFetched, settleOrders: settleResult.data.size, updated },
    });
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
    // 使用 ON CONFLICT 局部更新：只覆盖 FMS 同步字段，保留客户登录账号/密码、费用模版、营业执照等本系统维护字段
    const upsert = db.prepare(`
      INSERT INTO yunwuyun_customers (
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
      ON CONFLICT(client_id) DO UPDATE SET
        client_code = excluded.client_code,
        client_name = excluded.client_name,
        client_name_eng = excluded.client_name_eng,
        client_abbr = excluded.client_abbr,
        client_type = excluded.client_type,
        client_class = excluded.client_class,
        client_class_eng = excluded.client_class_eng,
        client_property = excluded.client_property,
        client_same_industry = excluded.client_same_industry,
        country_id = excluded.country_id,
        country_code = excluded.country_code,
        country_name = excluded.country_name,
        country_name_eng = excluded.country_name_eng,
        province_state = excluded.province_state,
        client_addr = excluded.client_addr,
        addr_postcode = excluded.addr_postcode,
        mobile_no = excluded.mobile_no,
        office_tel = excluded.office_tel,
        uni_credit_code = excluded.uni_credit_code,
        contact_name = excluded.contact_name,
        sales_name = excluded.sales_name,
        op_name = excluded.op_name,
        cs_name = excluded.cs_name,
        staff_name_biz = excluded.staff_name_biz,
        insert_time = excluded.insert_time,
        update_time = excluded.update_time,
        inserted_by = excluded.inserted_by,
        updated_by = excluded.updated_by,
        inuse = excluded.inuse,
        catalog_name = excluded.catalog_name,
        catalog_name_eng = excluded.catalog_name_eng,
        org_code = excluded.org_code,
        org_name = excluded.org_name,
        org_name_eng = excluded.org_name_eng,
        client_source_name = excluded.client_source_name,
        client_source_name_eng = excluded.client_source_name_eng,
        settler_type = excluded.settler_type,
        csm_staff = excluded.csm_staff,
        synced_at = excluded.synced_at
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

    if (isSales(req)) {
      where += ' AND o.client_id IN (SELECT client_id FROM yunwuyun_customers WHERE sales_name = ?)';
      params.push(req.user.name);
    }

    if (search) {
      where += ' AND (job_no LIKE ? OR client_name LIKE ? OR client_code LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status) {
      where += ' AND order_status = ?';
      params.push(parseInt(status));
    }

    const total = db.prepare(`SELECT COUNT(*) as cnt FROM yunwuyun_orders o WHERE ${where}`).get(...params).cnt;
    const rows = db.prepare(`
      SELECT o.*, t.success AS has_tracking, t.status AS tracking_status, t.status_label AS tracking_status_label,
        COALESCE((SELECT SUM(p.amount) FROM client_payments p WHERE p.job_id = o.job_id), 0) AS local_paid
      FROM yunwuyun_orders o
      LEFT JOIN order_tracking t ON o.job_id = t.job_id
      WHERE ${where}
      ORDER BY o.job_date DESC LIMIT ? OFFSET ?
    `).all(...params, size, offset);

    const list = rows.map((r) => {
      let bookingAgent = '';
      try {
        const aheads = JSON.parse(r.booking_aheads || '[]');
        if (Array.isArray(aheads) && aheads.length) {
          bookingAgent = aheads.map((a) => a.clientNameBookingAhead || a.clientNameEngBookingAhead || '').filter(Boolean).join('、');
        }
      } catch (_) {}
      const arAmtCy = Number(r.ar_amt_cy) || Number(r.ar_amt) || 0;
      const fmsSettled = Number(r.ar_settled_amt) || 0;
      const localPaid = Number(r.local_paid) || 0;
      const paidAmt = fmsSettled > 0 ? fmsSettled : localPaid;
      const fmsUnsettled = Number(r.ar_unsettled_amt) || 0;
      const unpaidAmt = fmsUnsettled > 0 ? fmsUnsettled : Math.max(0, arAmtCy - paidAmt);
      return {
        ...r,
        booking_agent_name: bookingAgent,
        ar_amt_cy: arAmtCy,
        paid_amt: paidAmt,
        unpaid_amt: unpaidAmt,
      };
    });

    const summaryRow = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN o.close_status = 20 THEN 0 ELSE COALESCE(o.ar_amt_cy, o.ar_amt, 0) END), 0) AS ar_amt_cy,
        COALESCE(SUM(CASE WHEN o.close_status = 20 THEN 0 ELSE COALESCE(o.ap_amt_cy, o.ap_amt, 0) END), 0) AS ap_amt_cy,
        COALESCE(SUM(CASE WHEN o.close_status = 20 THEN 0 ELSE o.gr_oss END), 0) AS gr_oss,
        COALESCE(SUM(CASE WHEN o.close_status = 20 THEN 0
          ELSE CASE WHEN o.ar_settled_amt > 0 THEN o.ar_settled_amt
                    ELSE COALESCE((SELECT SUM(p.amount) FROM client_payments p WHERE p.job_id = o.job_id), 0) END END), 0) AS paid_amt,
        COALESCE(SUM(CASE WHEN o.close_status = 20 THEN 0
          ELSE CASE WHEN o.ar_unsettled_amt > 0 THEN o.ar_unsettled_amt
                    ELSE MAX(0, COALESCE(o.ar_amt_cy, o.ar_amt, 0)
                      - CASE WHEN o.ar_settled_amt > 0 THEN o.ar_settled_amt
                             ELSE COALESCE((SELECT SUM(p.amount) FROM client_payments p WHERE p.job_id = o.job_id), 0) END) END END), 0) AS unpaid_amt,
        COALESCE(SUM(o.pieces), 0) AS pieces,
        COALESCE(SUM(o.goods_cbm), 0) AS goods_cbm,
        COALESCE(SUM(o.gross_kgs), 0) AS gross_kgs
      FROM yunwuyun_orders o
      WHERE ${where}
    `).get(...params);

    const summary = {
      ar_amt_cy: Number(summaryRow.ar_amt_cy) || 0,
      ap_amt_cy: Number(summaryRow.ap_amt_cy) || 0,
      gr_oss: Number(summaryRow.gr_oss) || 0,
      paid_amt: Number(summaryRow.paid_amt) || 0,
      unpaid_amt: Number(summaryRow.unpaid_amt) || 0,
      pieces: Number(summaryRow.pieces) || 0,
      goods_cbm: Number(summaryRow.goods_cbm) || 0,
      gross_kgs: Number(summaryRow.gross_kgs) || 0,
    };

    res.json({ success: true, data: { list, total, page, size, summary } });
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

    if (isSales(req)) {
      where += ' AND sales_name = ?';
      params.push(req.user.name);
    }

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
    const rows = db.prepare(`SELECT c.*, ft.name AS fee_template_name FROM yunwuyun_customers c LEFT JOIN fee_templates ft ON c.fee_template_id = ft.id WHERE ${where} ORDER BY c.client_name LIMIT ? OFFSET ?`).all(...params, size, offset);
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
    const CLOSED = '(close_status IS NULL OR close_status <> 20)';
    let orderCount, customerCount, totals, statusCounts, paidTotal, unsettledTotal;
    if (isSales(req)) {
      const clientIds = db.prepare('SELECT client_id FROM yunwuyun_customers WHERE sales_name = ?').all(req.user.name).map(r => r.client_id);
      customerCount = clientIds.length;
      if (clientIds.length) {
        const placeholders = clientIds.map(() => '?').join(',');
        orderCount = db.prepare(`SELECT COUNT(*) as cnt FROM yunwuyun_orders WHERE client_id IN (${placeholders})`).get(...clientIds).cnt;
        totals = db.prepare(`SELECT SUM(ar_amt) as total_ar, SUM(ap_amt) as total_ap, SUM(gr_oss) as total_profit, SUM(ar_amt_cy) as total_ar_cy, SUM(ap_amt_cy) as total_ap_cy, SUM(ar_settled_amt) as total_settled, SUM(ar_unsettled_amt) as total_unsettled FROM yunwuyun_orders WHERE client_id IN (${placeholders}) AND ${CLOSED}`).get(...clientIds);
        statusCounts = db.prepare(`SELECT order_status, COUNT(*) as cnt FROM yunwuyun_orders WHERE client_id IN (${placeholders}) GROUP BY order_status`).all(...clientIds);
        paidTotal = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM client_payments WHERE client_id IN (${placeholders})`).get(...clientIds).total;
      } else {
        orderCount = 0;
        totals = { total_ar: 0, total_ap: 0, total_profit: 0, total_settled: 0, total_unsettled: 0 };
        statusCounts = [];
        paidTotal = 0;
      }
    } else {
      orderCount = db.prepare('SELECT COUNT(*) as cnt FROM yunwuyun_orders').get().cnt;
      customerCount = db.prepare('SELECT COUNT(*) as cnt FROM yunwuyun_customers').get().cnt;
      totals = db.prepare(`SELECT SUM(ar_amt) as total_ar, SUM(ap_amt) as total_ap, SUM(gr_oss) as total_profit, SUM(ar_amt_cy) as total_ar_cy, SUM(ap_amt_cy) as total_ap_cy, SUM(ar_settled_amt) as total_settled, SUM(ar_unsettled_amt) as total_unsettled FROM yunwuyun_orders WHERE ${CLOSED}`).get();
      statusCounts = db.prepare('SELECT order_status, COUNT(*) as cnt FROM yunwuyun_orders GROUP BY order_status').all();
      paidTotal = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM client_payments').get().total;
    }
    const totalAR = totals.total_ar || 0;
    const totalArCy = totals.total_ar_cy || totalAR;
    const fmsSettled = totals.total_settled || 0;
    unsettledTotal = totals.total_unsettled || 0;
    const totalPaid = fmsSettled > 0 ? fmsSettled : (paidTotal || 0);
    const totalUnpaid = unsettledTotal > 0 ? unsettledTotal : Math.max(0, totalArCy - totalPaid);
    res.json({
      success: true,
      data: {
        orderCount,
        customerCount,
        totalAR: totalArCy,
        totalAP: totals.total_ap_cy || totals.total_ap || 0,
        totalProfit: totals.total_profit || 0,
        totalPaid,
        totalUnpaid,
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

// 客户回款记录 —— 列表
router.get('/payments', async (req, res) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const size = parseInt(req.query.size) || 20;
    const offset = (page - 1) * size;
    const clientId = req.query.client_id ? parseInt(req.query.client_id) : null;
    const jobId = req.query.job_id ? parseInt(req.query.job_id) : null;

    const conds = [];
    const params = [];
    if (clientId) { conds.push('p.client_id = ?'); params.push(clientId); }
    if (jobId) { conds.push('p.job_id = ?'); params.push(jobId); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const total = db.prepare(`SELECT COUNT(*) as cnt FROM client_payments p ${where}`).get(...params).cnt;
    const rows = db.prepare(`
      SELECT p.*, c.client_name, c.client_abbr, c.client_code,
             o.job_no, o.ar_amt
      FROM client_payments p
      LEFT JOIN yunwuyun_customers c ON p.client_id = c.client_id
      LEFT JOIN yunwuyun_orders o ON p.job_id = o.job_id
      ${where}
      ORDER BY p.paid_at DESC, p.id DESC
      LIMIT ? OFFSET ?
    `).all(...params, size, offset);

    res.json({ success: true, data: { list: rows, total, page, size } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 客户回款汇总（应收 / 已收 / 未收）
router.get('/payments/summary', async (req, res) => {
  try {
    const db = getDb();
    const clientId = req.query.client_id ? parseInt(req.query.client_id) : null;
    if (!clientId) return res.status(400).json({ success: false, error: '缺少 client_id' });

    const totalAR = db.prepare(
      "SELECT COALESCE(SUM(ar_amt_cy), 0) as total_cy, COALESCE(SUM(ar_amt), 0) as total FROM yunwuyun_orders WHERE client_id = ? AND (close_status IS NULL OR close_status <> 20)"
    ).get(clientId);
    const arCy = Number(totalAR.total_cy) || Number(totalAR.total);
    const fmsSettled = db.prepare(
      "SELECT COALESCE(SUM(ar_settled_amt), 0) as total FROM yunwuyun_orders WHERE client_id = ? AND (close_status IS NULL OR close_status <> 20)"
    ).get(clientId).total;
    const fmsUnsettled = db.prepare(
      "SELECT COALESCE(SUM(ar_unsettled_amt), 0) as total FROM yunwuyun_orders WHERE client_id = ? AND (close_status IS NULL OR close_status <> 20)"
    ).get(clientId).total;
    const localPaid = db.prepare(
      'SELECT COALESCE(SUM(amount), 0) as total FROM client_payments WHERE client_id = ?'
    ).get(clientId).total;
    const totalPaid = Number(fmsSettled) > 0 ? Number(fmsSettled) : Number(localPaid);
    const totalUnpaid = Number(fmsUnsettled) > 0 ? Number(fmsUnsettled) : Math.max(0, arCy - totalPaid);

    const orders = db.prepare(`
      SELECT o.job_id, o.job_no, o.job_date, o.ar_amt, o.ar_amt_cy, o.ar_settled_amt, o.ar_unsettled_amt,
        COALESCE((SELECT SUM(p.amount) FROM client_payments p WHERE p.job_id = o.job_id), 0) AS local_paid
      FROM yunwuyun_orders o
      WHERE o.client_id = ? AND (o.close_status IS NULL OR o.close_status <> 20)
      ORDER BY o.job_date DESC
    `).all(clientId).map((r) => {
      const arCy = Number(r.ar_amt_cy) || Number(r.ar_amt) || 0;
      const fmsPaid = Number(r.ar_settled_amt) || 0;
      const paid = fmsPaid > 0 ? fmsPaid : Number(r.local_paid || 0);
      const unpaid = Number(r.ar_unsettled_amt) > 0
        ? Number(r.ar_unsettled_amt)
        : Math.max(0, arCy - paid);
      return { ...r, ar_amt_cy: arCy, paid_amt: paid, unpaid_amt: unpaid };
    });

    res.json({
      success: true,
      data: {
        totalAR: arCy,
        totalPaid,
        totalUnpaid,
        orders,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 新增回款记录
router.post('/payments', async (req, res) => {
  try {
    const db = getDb();
    const { client_id, job_id, amount, currency, paid_at, remark } = req.body || {};
    if (!client_id) return res.status(400).json({ success: false, error: '缺少客户' });
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      return res.status(400).json({ success: false, error: '回款金额必须大于 0' });
    }

    const client = db.prepare('SELECT client_id FROM yunwuyun_customers WHERE client_id = ?').get(client_id);
    if (!client) return res.status(404).json({ success: false, error: '客户不存在' });

    if (job_id) {
      const order = db.prepare('SELECT job_id, client_id FROM yunwuyun_orders WHERE job_id = ?').get(job_id);
      if (!order) return res.status(404).json({ success: false, error: '订单不存在' });
      if (order.client_id !== Number(client_id)) {
        return res.status(400).json({ success: false, error: '该订单不属于此客户' });
      }
    }

    const info = db.prepare(`
      INSERT INTO client_payments (client_id, job_id, amount, currency, paid_at, remark, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      Number(client_id),
      job_id ? Number(job_id) : null,
      num,
      currency || 'CNY',
      paid_at || new Date().toISOString().slice(0, 10),
      remark || '',
      req.user?.id ?? null,
      new Date().toISOString()
    );

    res.json({ success: true, data: { id: info.lastInsertRowid } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 修改回款记录
router.put('/payments/:id', async (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM client_payments WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: '回款记录不存在' });

    const { amount, currency, paid_at, remark, job_id } = req.body || {};
    const num = amount == null ? existing.amount : Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      return res.status(400).json({ success: false, error: '回款金额必须大于 0' });
    }

    db.prepare(`
      UPDATE client_payments SET amount = ?, currency = ?, paid_at = ?, remark = ?, job_id = ? WHERE id = ?
    `).run(
      num,
      currency ?? existing.currency,
      paid_at ?? existing.paid_at,
      remark ?? existing.remark,
      job_id === undefined ? existing.job_id : (job_id ? Number(job_id) : null),
      req.params.id
    );

    res.json({ success: true, data: { id: Number(req.params.id) } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 删除回款记录
router.delete('/payments/:id', async (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM client_payments WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: '回款记录不存在' });
    db.prepare('DELETE FROM client_payments WHERE id = ?').run(req.params.id);
    res.json({ success: true, data: { id: Number(req.params.id) } });
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
      'client_source_name','client_source_name_eng','settler_type','csm_staff',
      'wechat_id'];
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

// 分配销售员
router.put('/customers/:id/assign-sales', async (req, res) => {
  try {
    const { sales_name } = req.body;
    if (!sales_name && sales_name !== '') {
      return res.json({ success: false, error: '请提供销售员名称' });
    }
    const db = getDb();
    const existing = db.prepare('SELECT * FROM yunwuyun_customers WHERE client_id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: '客户不存在' });
    db.prepare('UPDATE yunwuyun_customers SET sales_name = ? WHERE client_id = ?').run(sales_name, req.params.id);
    res.json({ success: true, data: { sales_name } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 批量分配销售员
router.post('/customers/batch-assign-sales', async (req, res) => {
  try {
    const { client_ids, sales_name } = req.body;
    if (!client_ids || !client_ids.length) {
      return res.json({ success: false, error: '请选择至少一个客户' });
    }
    if (!sales_name && sales_name !== '') {
      return res.json({ success: false, error: '请提供销售员名称' });
    }
    const db = getDb();
    const placeholders = client_ids.map(() => '?').join(',');
    const result = db.prepare(`UPDATE yunwuyun_customers SET sales_name = ? WHERE client_id IN (${placeholders})`).run(sales_name, ...client_ids);
    res.json({ success: true, data: { updated: result.changes } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 绑定费用模版
router.put('/customers/:id/fee-template', async (req, res) => {
  try {
    const { template_id } = req.body;
    const db = getDb();
    const existing = db.prepare('SELECT * FROM yunwuyun_customers WHERE client_id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: '客户不存在' });
    if (template_id) {
      const tpl = db.prepare('SELECT id, name FROM fee_templates WHERE id = ?').get(template_id);
      if (!tpl) return res.status(404).json({ success: false, error: '模版不存在' });
      db.prepare('UPDATE yunwuyun_customers SET fee_template_id = ? WHERE client_id = ?').run(template_id, req.params.id);
      res.json({ success: true, data: { fee_template_id: template_id, fee_template_name: tpl.name } });
    } else {
      db.prepare('UPDATE yunwuyun_customers SET fee_template_id = NULL WHERE client_id = ?').run(req.params.id);
      res.json({ success: true, data: { fee_template_id: null, fee_template_name: null } });
    }
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
    const loginUrl = process.env.CLIENT_URL || 'http://localhost:5173/client/login';
    res.json({ success: true, data: { message: '客户登录已开通', login_url: loginUrl } });
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