// 客户端门户路由（客户登录、查看订单）
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import XLSX from 'xlsx';
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

// 客户海运报价筛选下拉（只读）
router.get('/shipping-rates/filters', authenticateClient, (req, res) => {
  try {
    const db = getDb();
    const pols = db.prepare("SELECT DISTINCT pol FROM shipping_rate_batches WHERE status='active' AND valid_from <= date('now','localtime') AND valid_to >= date('now','localtime') ORDER BY pol").all();
    const pods = db.prepare("SELECT DISTINCT pod FROM shipping_rate_batches WHERE status='active' AND valid_from <= date('now','localtime') AND valid_to >= date('now','localtime') ORDER BY pod").all();
    const types = db.prepare("SELECT DISTINCT container_type FROM shipping_rate_batches WHERE status='active' AND valid_from <= date('now','localtime') AND valid_to >= date('now','localtime') ORDER BY container_type").all();
    res.json({ success: true, data: { pols: pols.map(r => r.pol), pods: pods.map(r => r.pod), container_types: types.map(r => r.container_type) } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 客户报价单预览
router.get('/shipping-rates/batches/:id/quotation-preview', authenticateClient, (req, res) => {
  try {
    const db = getDb();
    const batch = db.prepare('SELECT * FROM shipping_rate_batches WHERE id = ?').get(req.params.id);
    if (!batch) return res.status(404).json({ success: false, error: '批次不存在' });

    var itemId = req.query.item_id;
    var item;
    if (itemId) {
      item = db.prepare('SELECT * FROM shipping_rate_items WHERE id = ? AND batch_id = ?').get(itemId, req.params.id);
      if (!item) return res.status(404).json({ success: false, error: '报价明细不存在' });
    } else {
      var items = db.prepare('SELECT * FROM shipping_rate_items WHERE batch_id = ? ORDER BY freight_rate ASC, sort_order, id').all(req.params.id);
      if (items.length === 0) return res.status(400).json({ success: false, error: '该批次无报价明细' });
      item = items[0];
    }

    var pol = batch.pol || '';
    var pod = batch.pod || '';
    var ct = batch.container_type || '';
    var carrier = item.carrier_name || '';
    var freight = item.freight_rate || 0;

    // 取客户绑定的费用模板
    var customer = db.prepare('SELECT fee_template_id FROM yunwuyun_customers WHERE client_id = ?').get(req.client.client_id);
    var templateId = customer?.fee_template_id;

    // 没绑定则用系统默认模板
    if (!templateId) {
      var defaultTpl = db.prepare('SELECT id FROM fee_templates WHERE is_default = 1 LIMIT 1').get();
      templateId = defaultTpl?.id;
    }

    var templateItems = [];
    if (templateId) {
      var rawItems = db.prepare('SELECT * FROM fee_template_items WHERE template_id = ? AND category = ? ORDER BY sort_order, id').all(templateId, 'fee');
      templateItems = rawItems.map(function(ti) {
        var amtParts = ti.amount_value ? ti.amount_value.split('|') : ['', ''];
        var label = amtParts[0] || '';
        var note = amtParts[1] || ti.note || '';
        return {
          name: ti.item_name,
          standard: ti.standard || '按每柜计费',
          amount: (ti.currency || 'USD') + ' ' + (label || '0') + (ti.standard ? ' /' + ti.standard.replace('按每', '') : ''),
          note: note,
          currency: ti.currency || 'USD',
          amount_type: ti.amount_type || 'fixed',
        };
      });

      // 如果没有 fee 类型的项，或 templateItems 为空，用全量
      if (!templateItems.length) {
        rawItems = db.prepare('SELECT * FROM fee_template_items WHERE template_id = ? ORDER BY sort_order, id').all(templateId);
        templateItems = rawItems.map(function(ti) {
          var amtParts = ti.amount_value ? ti.amount_value.split('|') : ['', ''];
          return {
            name: ti.item_name,
            standard: ti.standard || '按每柜计费',
            amount: (ti.currency || 'USD') + ' ' + (amtParts[0] || '0'),
            note: amtParts[1] || ti.note || '',
            currency: ti.currency || 'USD',
            amount_type: ti.amount_type || 'fixed',
          };
        });
      }

      var noteItems = db.prepare('SELECT * FROM fee_template_items WHERE template_id = ? AND category = ? ORDER BY sort_order, id').all(templateId, 'note');
      var templateNotes = noteItems.map(function(ti) {
        var amtParts = ti.amount_value ? ti.amount_value.split('|') : ['', ''];
        return {
          name: ti.item_name,
          free: amtParts[0] || ti.standard || '—',
          fee: amtParts[1] || ti.amount_value || '—',
          note: ti.note || '',
        };
      });

      // 动态替换 freight 类型费项的实际运价和港口
      templateItems = templateItems.map(function(ti) {
        var isFreight = ti.amount_type === 'freight' || (ti.name && (ti.name.includes('海运费') || ti.name.includes('运价')));
        if (isFreight) {
          return {
            name: ti.name + '（' + pol + '-->' + pod + '）',
            standard: ti.standard,
            amount: (ti.currency || 'USD') + ' ' + freight + ' /柜（含AMS+换单费）',
            note: '主运输核心费用\n根据当日实际价格',
            currency: ti.currency || 'USD',
            amount_type: 'freight',
          };
        }
        return ti;
      });
    }

    // 没有任何模板项则用原硬编码兜底
    if (!templateItems.length) {
      templateItems = [
        { name: '基础海运费（' + pol + '-->' + pod + '）', standard: '按每柜计费', amount: 'USD ' + freight + ' /柜（含AMS+换单费）', note: '主运输核心费用\n根据当日实际价格', currency: 'USD', amount_type: 'freight' },
        { name: '港口本地杂费（THC+DOC+EBS等）', standard: '按每柜计费', amount: 'RMB 2500 /柜', note: '预提费（提前用箱）等', currency: 'RMB', amount_type: 'fixed' },
        { name: '关税', standard: '按每柜计费', amount: 'USD 2000 /柜', note: '必缴费用', currency: 'USD', amount_type: 'fixed' },
        { name: '清关手续费', standard: '按每柜计费', amount: 'USD 220 /柜', note: '必缴费用', currency: 'USD', amount_type: 'fixed' },
        { name: '报关费', standard: '按每柜计费', amount: 'RMB 350 /票', note: '常规普货报关', currency: 'RMB', amount_type: 'fixed' },
        { name: '拖车提柜费（工厂->码头）', standard: '按每柜计费', amount: 'RMB 2600 /柜', note: '如需自提可不收取', currency: 'RMB', amount_type: 'fixed' },
        { name: '尾程派送', standard: '按每柜计费', amount: 'USD 800 /柜', note: '如需自提可不收取', currency: 'USD', amount_type: 'fixed' },
        { name: '查验风险金', standard: '按每柜计费', amount: 'USD 0 /柜', note: '加收100USD抵扣1000', currency: 'USD', amount_type: 'fixed' },
      ];
    }
    if (!templateNotes || !templateNotes.length) {
      templateNotes = [
        { name: '车架费', free: '3天', fee: '约45USD/天', note: '自柜子抵达仓库完成卸柜起计算，至空柜归还船公司为止' },
        { name: '预提费', free: '—', fee: '约200USD/次', note: '双方确认送仓时间后，若车队已完成港口提柜，因海外仓侧原因无法接收柜子入仓，将产生额外预提费用' },
        { name: '夜存费', free: '—', fee: '约50USD/天', note: '柜子从港口提柜出来后，未能直接送仓，需在堆场/车场临时过夜暂存' },
        { name: '改地址/改派送方式', free: '需提前7天', fee: '可能产生约100USD改单费', note: '客户变更需提前沟通' },
      ];
    }

    var usdTotal = 0;
    var rmbTotal = 0;
    templateItems.forEach(function(ti) {
      var amt = ti.amount || '';
      var numMatch = amt.match(/([\d,]+)/);
      if (numMatch) {
        var num = parseFloat(numMatch[1].replace(/,/g, '')) || 0;
        if (amt.toUpperCase().includes('USD') || ti.currency === 'USD') usdTotal += num;
        else rmbTotal += num;
      }
    });

    res.json({ success: true, data: {
      _batchId: req.params.id, _itemId: itemId || '', _templateId: String(templateId || ''),
      pol, pod, ct, carrier, vessel: item.vessel_voyage || '', freight,
      items: templateItems, total: { usd: usdTotal, rmb: rmbTotal }, notes: templateNotes,
    }});
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 客户报价单 Excel 下载
router.get('/shipping-rates/batches/:id/quotation', authenticateClient, (req, res) => {
  try {
    const db = getDb();
    const batch = db.prepare('SELECT * FROM shipping_rate_batches WHERE id = ?').get(req.params.id);
    if (!batch) return res.status(404).json({ success: false, error: '批次不存在' });

    var itemId = req.query.item_id;
    var item;
    if (itemId) {
      item = db.prepare('SELECT * FROM shipping_rate_items WHERE id = ? AND batch_id = ?').get(itemId, req.params.id);
      if (!item) return res.status(404).json({ success: false, error: '报价明细不存在' });
    } else {
      var items = db.prepare('SELECT * FROM shipping_rate_items WHERE batch_id = ? ORDER BY freight_rate ASC, sort_order, id').all(req.params.id);
      if (items.length === 0) return res.status(400).json({ success: false, error: '该批次无报价明细' });
      item = items[0];
    }

    var pol = batch.pol || '';
    var pod = batch.pod || '';
    var ct = batch.container_type || '';
    var carrier = item.carrier_name || '';
    var freight = item.freight_rate || 0;

    // 取客户绑定的费用模板
    var customer = db.prepare('SELECT fee_template_id FROM yunwuyun_customers WHERE client_id = ?').get(req.client.client_id);
    var templateId = customer?.fee_template_id;
    if (!templateId) {
      var defaultTpl = db.prepare('SELECT id FROM fee_templates WHERE is_default = 1 LIMIT 1').get();
      templateId = defaultTpl?.id;
    }

    var feeItems = [];
    if (templateId) {
      feeItems = db.prepare('SELECT * FROM fee_template_items WHERE template_id = ? AND category = ? ORDER BY sort_order, id').all(templateId, 'fee');
      if (!feeItems.length) feeItems = db.prepare('SELECT * FROM fee_template_items WHERE template_id = ? ORDER BY sort_order, id').all(templateId);
    }

    // 构建费用明细行
    var aoa = [[''], ['费用项目', '计费标准', '费用金额', '备注']];
    var usdSum = freight;
    var rmbSum = 0;
    if (feeItems.length) {
      feeItems.forEach(function(fi) {
        var itemName = fi.item_name;
        var amountStr, note;
        var isFreight = (fi.amount_type || 'fixed') === 'freight' || (fi.item_name && (fi.item_name.includes('海运费') || fi.item_name.includes('运价')));
        if (isFreight) {
          itemName = fi.item_name + '（' + pol + '-->' + pod + '）';
          amountStr = (fi.currency || 'USD') + ' ' + freight + ' /柜（含AMS+换单费）';
          note = '主运输核心费用\n根据当日实际价格';
        } else {
          var amtParts = fi.amount_value ? fi.amount_value.split('|') : ['', ''];
          amountStr = (fi.currency || 'USD') + ' ' + (amtParts[0] || '0');
          note = amtParts[1] || fi.note || '';
          var numMatch = amountStr.match(/([\d,]+)/);
          if (numMatch) {
            var num = parseFloat(numMatch[1].replace(/,/g, '')) || 0;
            if (fi.currency === 'USD' || (fi.currency || 'USD').toUpperCase() === 'USD') usdSum += num;
            else rmbSum += num;
          }
        }
        aoa.push([itemName, fi.standard || '按每柜计费', amountStr, note]);
      });
    } else {
      aoa.push(
        ['基础海运费（' + pol + '-->' + pod + '）', '按每柜计费', 'USD ' + freight + ' /柜（含AMS+换单费）', '主运输核心费用\n根据当日实际价格'],
        ['港口本地杂费（THC+DOC+EBS等）', '按每柜计费', 'RMB 2500 /柜', '预提费（提前用箱）\n过夜费（装柜要过晚上12点）等'],
        ['关税', '按每柜计费', 'USD 2000 /柜', '必缴费用'],
        ['清关手续费', '按每柜计费', 'USD 220 /柜', '必缴费用'],
        ['报关费', '按每柜计费', 'RMB 350 /票', '常规普货报关'],
        ['拖车提柜费（工厂->码头）', '按每柜计费', 'RMB 2600 /柜', '如需自提可不收取'],
        ['尾程派送', '按每柜计费', 'USD 800 /柜', '如需自提可不收取'],
        ['查验风险金', '按每柜计费', 'USD 0 /柜', '加收100USD抵扣1000']
      );
      usdSum += 2000 + 220 + 800;
      rmbSum += 2500 + 350 + 2600;
    }
    aoa.push(['合计费用', '一票总计', 'USD ' + usdSum + ' + RMB ' + rmbSum, '']);

    var noteItems = templateId ? db.prepare('SELECT * FROM fee_template_items WHERE template_id = ? AND category = ? ORDER BY sort_order, id').all(templateId, 'note') : [];
    if (noteItems.length) {
      aoa.push([''], ['尾程派送注意事项']);
      aoa.push(['费用项目', '免费期', '超期标准', '备注']);
      noteItems.forEach(function(ni) {
        var amtParts = ni.amount_value ? ni.amount_value.split('|') : ['', ''];
        aoa.push([ni.item_name, amtParts[0] || ni.standard || '—', amtParts[1] || ni.amount_value || '—', ni.note || '']);
      });
    } else {
      aoa.push([''], ['尾程派送注意事项']);
      aoa.push(['费用项目', '免费期', '超期标准', '备注']);
      aoa.push(['车架费', '3天', '约45USD/天', '自柜子抵达仓库完成卸柜起计算，至空柜归还船公司为止']);
      aoa.push(['预提费', '—', '约200USD/次', '双方确认送仓时间后，若车队已完成港口提柜，因海外仓侧原因无法接收柜子入仓']);
      aoa.push(['夜存费', '—', '约50USD/天', '柜子从港口提柜出来后，未能直接送仓，需在堆场/车场临时过夜暂存']);
      aoa.push(['改地址/改派送方式', '需提前7天', '可能产生约100USD改单费', '客户变更需提前沟通']);
    }

    var headerStyle = { font: { bold: true, sz: 12, color: { rgb: 'FFFFFF' }, name: '微软雅黑' }, fill: { fgColor: { rgb: '1F4E79' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: { top: { style: 'thin', color: { rgb: '000000' } }, bottom: { style: 'thin', color: { rgb: '000000' } }, left: { style: 'thin', color: { rgb: '000000' } }, right: { style: 'thin', color: { rgb: '000000' } } } };
    var sectionStyle = { font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' }, name: '微软雅黑' }, fill: { fgColor: { rgb: '5B9BD5' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: { top: { style: 'thin', color: { rgb: '000000' } }, bottom: { style: 'thin', color: { rgb: '000000' } }, left: { style: 'thin', color: { rgb: '000000' } }, right: { style: 'thin', color: { rgb: '000000' } } } };
    var totalStyle = { font: { bold: true, sz: 11, name: '微软雅黑' }, fill: { fgColor: { rgb: 'FFF2CC' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: { top: { style: 'thin', color: { rgb: '000000' } }, bottom: { style: 'thin', color: { rgb: '000000' } }, left: { style: 'thin', color: { rgb: '000000' } }, right: { style: 'thin', color: { rgb: '000000' } } } };
    var cellStyle = { font: { sz: 10, name: '微软雅黑' }, alignment: { vertical: 'center', wrapText: true }, border: { top: { style: 'thin', color: { rgb: 'D9D9D9' } }, bottom: { style: 'thin', color: { rgb: 'D9D9D9' } }, left: { style: 'thin', color: { rgb: 'D9D9D9' } }, right: { style: 'thin', color: { rgb: 'D9D9D9' } } } };

    var ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 32 }, { wch: 14 }, { wch: 28 }, { wch: 60 }];

    var feeEndRow = aoa.length - noteItems.length - 3;

    var setCellStyle = function(cell, style) { if (cell) cell.s = style; };
    for (var ci = 0; ci <= 3; ci++) setCellStyle(ws[XLSX.utils.encode_cell({ r: 1, c: ci })], headerStyle);

    if (noteItems.length) {
      var noteHeaderRow = feeEndRow + 1;
      for (ci = 0; ci <= 3; ci++) setCellStyle(ws[XLSX.utils.encode_cell({ r: noteHeaderRow + 1, c: ci })], sectionStyle);
    }

    setCellStyle(ws[XLSX.utils.encode_cell({ r: feeEndRow, c: 0 })], totalStyle);
    setCellStyle(ws[XLSX.utils.encode_cell({ r: feeEndRow, c: 1 })], totalStyle);
    setCellStyle(ws[XLSX.utils.encode_cell({ r: feeEndRow, c: 2 })], totalStyle);
    setCellStyle(ws[XLSX.utils.encode_cell({ r: feeEndRow, c: 3 })], totalStyle);

    for (var row = 2; row < feeEndRow; row++) for (var col = 0; col <= 3; col++) setCellStyle(ws[XLSX.utils.encode_cell({ r: row, c: col })], cellStyle);

    if (noteItems.length) {
      var noteHeaderRow = feeEndRow + 1;
      for (row = noteHeaderRow + 2; row < aoa.length; row++) for (var col2 = 0; col2 <= 3; col2++) setCellStyle(ws[XLSX.utils.encode_cell({ r: row, c: col2 })], cellStyle);
    }

    ws['!merges'] = [
      { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
    ];
    if (noteItems.length) {
      var noteHeaderRow = feeEndRow + 1;
      ws['!merges'].push({ s: { r: noteHeaderRow + 1, c: 0 }, e: { r: noteHeaderRow + 1, c: 3 } });
    }

    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '报价单');
    var buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    var filename = encodeURIComponent('报价_' + carrier + '_' + pol + '-' + pod + '_' + ct + '.xlsx');
    res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''" + filename);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 客户海运报价（只读，不含成本）
router.get('/shipping-rates', authenticateClient, (req, res) => {
  try {
    const db = getDb();
    const pol = req.query.pol || '';
    const pod = req.query.pod || '';
    const container_type = req.query.container_type || '';

    let where = "WHERE b.status = 'active' AND b.valid_from <= date('now','localtime') AND b.valid_to >= date('now','localtime')";
    const params = [];
    if (pol) { where += ' AND b.pol = ?'; params.push(pol); }
    if (pod) { where += ' AND b.pod = ?'; params.push(pod); }
    if (container_type) { where += ' AND b.container_type = ?'; params.push(container_type); }

    const batches = db.prepare(
      'SELECT b.*, u.name as created_by_name ' +
      'FROM shipping_rate_batches b ' +
      'LEFT JOIN users u ON b.created_by = u.id ' +
      where +
      ' ORDER BY b.valid_from DESC'
    ).all(...params);

    const getItems = db.prepare(
      'SELECT id, batch_id, carrier_name, vessel_voyage, freight_rate, transit_days, remarks, sort_order FROM shipping_rate_items WHERE batch_id = ? ORDER BY sort_order, id'
    );

    const result = batches.map(b => ({
      ...b,
      items: getItems.all(b.id),
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
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