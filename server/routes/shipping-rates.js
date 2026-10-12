import express from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import { authenticateToken } from './auth.js';
import { getDb } from '../database.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(authenticateToken);

// ==================== 订舱口/服务商 ====================

router.get('/suppliers', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM shipping_rate_suppliers ORDER BY name').all();
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/suppliers', (req, res) => {
  try {
    const db = getDb();
    const { name, contact_person, contact_phone, remark } = req.body;
    if (!name) return res.status(400).json({ success: false, error: '订舱口名称不能为空' });
    const stmt = db.prepare(
      'INSERT INTO shipping_rate_suppliers (name, contact_person, contact_phone, remark, created_at) VALUES (?, ?, ?, ?, ?)'
    );
    const result = stmt.run(name, contact_person || '', contact_phone || '', remark || '', new Date().toISOString());
    res.json({ success: true, data: { id: result.lastInsertRowid } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/suppliers/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM shipping_rate_suppliers WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== 报价批次 ====================

router.get('/batches', (req, res) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const size = parseInt(req.query.size) || 20;
    const offset = (page - 1) * size;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const pol = req.query.pol || '';
    const pod = req.query.pod || '';

    let where = 'WHERE 1=1';
    const params = [];
    if (search) { where += ' AND (b.pol LIKE ? OR b.pod LIKE ? OR b.container_type LIKE ?)'; params.push('%' + search + '%', '%' + search + '%', '%' + search + '%'); }
    if (status) { where += ' AND b.status = ?'; params.push(status); }
    if (pol) { where += ' AND b.pol = ?'; params.push(pol); }
    if (pod) { where += ' AND b.pod = ?'; params.push(pod); }

    const countRow = db.prepare('SELECT COUNT(*) as cnt FROM shipping_rate_batches b ' + where).get(...params);
    const batches = db.prepare(
      'SELECT b.*, u.name as created_by_name, ' +
      '(SELECT COUNT(*) FROM shipping_rate_items WHERE batch_id = b.id) as item_count ' +
      'FROM shipping_rate_batches b ' +
      'LEFT JOIN users u ON b.created_by = u.id ' +
      where +
      ' ORDER BY b.valid_from DESC, b.created_at DESC LIMIT ? OFFSET ?'
    ).all(...params, size, offset);

    res.json({ success: true, data: { list: batches, total: countRow.cnt, page, size } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/batches/:id', (req, res) => {
  try {
    const db = getDb();
    const batch = db.prepare(
      'SELECT b.*, u.name as created_by_name ' +
      'FROM shipping_rate_batches b ' +
      'LEFT JOIN users u ON b.created_by = u.id ' +
      'WHERE b.id = ?'
    ).get(req.params.id);
    if (!batch) return res.status(404).json({ success: false, error: '批次不存在' });

    const items = db.prepare(
      'SELECT * FROM shipping_rate_items WHERE batch_id = ? ORDER BY sort_order, id'
    ).all(req.params.id);

    res.json({ success: true, data: { ...batch, items } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/batches', (req, res) => {
  try {
    const db = getDb();
    const { pol, pod, container_type, valid_from, valid_to, notes, items } = req.body;
    if (!pol || !pod || !container_type || !valid_from || !valid_to) {
      return res.status(400).json({ success: false, error: '起运港、目的港、箱型、有效期不能为空' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: '请至少添加一条报价明细' });
    }

    const now = new Date().toISOString();
    const created_by = req.user?.id || 1;

    const createBatch = db.transaction(() => {
      const batchResult = db.prepare(
        'INSERT INTO shipping_rate_batches (pol, pod, container_type, valid_from, valid_to, notes, status, created_by, created_at, updated_at) ' +
        "VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)"
      ).run(pol, pod, container_type, valid_from, valid_to, notes || '', created_by, now, now);

      const batchId = batchResult.lastInsertRowid;
      const insertItem = db.prepare(
        'INSERT INTO shipping_rate_items (batch_id, carrier_name, vessel_voyage, freight_rate, transit_days, supplier_name, supplier_contact, remarks, sort_order) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );

      items.forEach((item, idx) => {
        if (item.carrier_name) {
          insertItem.run(batchId, item.carrier_name, item.vessel_voyage || '', item.freight_rate || 0, item.transit_days || '', item.supplier_name || '', item.supplier_contact || '', item.remarks || '', idx);
        }
      });
    });

    createBatch();
    res.json({ success: true, data: { message: '创建成功' } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/batches/:id', (req, res) => {
  try {
    const db = getDb();
    const { pol, pod, container_type, valid_from, valid_to, notes, items } = req.body;
    const batchId = parseInt(req.params.id);

    const existing = db.prepare('SELECT * FROM shipping_rate_batches WHERE id = ?').get(batchId);
    if (!existing) return res.status(404).json({ success: false, error: '批次不存在' });

    const now = new Date().toISOString();

    const updateBatch = db.transaction(() => {
      db.prepare(
        'UPDATE shipping_rate_batches SET pol=?, pod=?, container_type=?, valid_from=?, valid_to=?, notes=?, updated_at=? ' +
        'WHERE id=?'
      ).run(pol, pod, container_type, valid_from, valid_to, notes || '', now, batchId);

      if (items && Array.isArray(items)) {
        db.prepare('DELETE FROM shipping_rate_items WHERE batch_id = ?').run(batchId);
        const insertItem = db.prepare(
          'INSERT INTO shipping_rate_items (batch_id, carrier_name, vessel_voyage, freight_rate, transit_days, supplier_name, supplier_contact, remarks, sort_order) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        items.forEach((item, idx) => {
          if (item.carrier_name) {
            insertItem.run(batchId, item.carrier_name, item.vessel_voyage || '', item.freight_rate || 0, item.transit_days || '', item.supplier_name || '', item.supplier_contact || '', item.remarks || '', idx);
          }
        });
      }
    });

    updateBatch();
    res.json({ success: true, data: { message: '更新成功' } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/batches/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM shipping_rate_batches WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/batches/:id/status', (req, res) => {
  try {
    const db = getDb();
    const { status } = req.body;
    if (!['active', 'expired'].includes(status)) {
      return res.status(400).json({ success: false, error: '状态值无效' });
    }
    db.prepare('UPDATE shipping_rate_batches SET status=?, updated_at=? WHERE id=?')
      .run(status, new Date().toISOString(), req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== 销售看板 - 当前有效报价 ====================

router.get('/active', (req, res) => {
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

    const getItems = db.prepare('SELECT * FROM shipping_rate_items WHERE batch_id = ? ORDER BY sort_order, id');

    const result = batches.map(b => ({
      ...b,
      items: getItems.all(b.id),
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/filters', (req, res) => {
  try {
    const db = getDb();
    const pols = db.prepare("SELECT DISTINCT pol FROM shipping_rate_batches WHERE status='active' ORDER BY pol").all();
    const pods = db.prepare("SELECT DISTINCT pod FROM shipping_rate_batches WHERE status='active' ORDER BY pod").all();
    const types = db.prepare("SELECT DISTINCT container_type FROM shipping_rate_batches WHERE status='active' ORDER BY container_type").all();
    res.json({
      success: true,
      data: {
        pols: pols.map(r => r.pol),
        pods: pods.map(r => r.pod),
        container_types: types.map(r => r.container_type),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== Excel 导入 ====================

router.post('/import', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: '请上传文件' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) return res.status(400).json({ success: false, error: 'Excel文件为空' });

    const firstRow = rows[0];
    const batch = {
      pol: firstRow['起运港'] || firstRow['POL'] || '',
      pod: firstRow['目的港'] || firstRow['POD'] || '',
      container_type: firstRow['箱型'] || firstRow['箱型'] || '40HQ',
      valid_from: firstRow['生效日期'] || firstRow['有效期开始'] || firstRow['FROM'] || '',
      valid_to: firstRow['截止日期'] || firstRow['有效期结束'] || firstRow['TO'] || '',
      notes: firstRow['备注'] || firstRow['REMARK'] || '',
    };

    if (!batch.pol || !batch.pod) {
      return res.status(400).json({ success: false, error: 'Excel缺少起运港/目的港字段，请确保包含"起运港""目的港"列或查看模板' });
    }

    const items = rows.map((r, idx) => ({
      carrier_name: r['船公司'] || r['CARRIER'] || r['船司'] || '',
      vessel_voyage: r['船名航次'] || r['船名/航次'] || r['VESSEL'] || '',
      freight_rate: parseFloat(r['海运费(USD)'] || r['海运费'] || r['FREIGHT'] || 0) || 0,
      transit_days: r['航程天数'] || r['航程'] || r['TRANSIT'] || '',
      supplier_name: r['订舱口'] || r['订舱口/服务商'] || r['SUPPLIER'] || r['联系人公司'] || '',
      supplier_contact: r['联系人'] || r['CONTACT'] || r['联系电话'] || '',
      remarks: r['备注'] || r['REMARKS'] || r['特殊说明'] || '',
      sort_order: idx,
    })).filter(item => item.carrier_name);

    if (items.length === 0) {
      return res.status(400).json({ success: false, error: '未识别到有效的船司报价数据，请检查"船公司"列' });
    }

    const db = getDb();
    const now = new Date().toISOString();
    const created_by = req.user?.id || 1;

    const doImport = db.transaction(() => {
      const batchResult = db.prepare(
        "INSERT INTO shipping_rate_batches (pol, pod, container_type, valid_from, valid_to, notes, status, created_by, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)"
      ).run(batch.pol, batch.pod, batch.container_type, batch.valid_from, batch.valid_to, batch.notes, created_by, now, now);

      const batchId = batchResult.lastInsertRowid;
      const insertItem = db.prepare(
        'INSERT INTO shipping_rate_items (batch_id, carrier_name, vessel_voyage, freight_rate, transit_days, supplier_name, supplier_contact, remarks, sort_order) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );

      items.forEach(item => {
        insertItem.run(batchId, item.carrier_name, item.vessel_voyage, item.freight_rate, item.transit_days, item.supplier_name, item.supplier_contact, item.remarks, item.sort_order);
      });
    });

    doImport();
    res.json({ success: true, data: { batchId: db.prepare('SELECT last_insert_rowid()').get()?.['last_insert_rowid()'], itemCount: items.length, message: '成功导入 ' + items.length + ' 条报价' } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== Excel 导出 ====================

router.get('/batches/:id/export', (req, res) => {
  try {
    const db = getDb();
    const batch = db.prepare('SELECT * FROM shipping_rate_batches WHERE id = ?').get(req.params.id);
    if (!batch) return res.status(404).json({ success: false, error: '批次不存在' });

    const items = db.prepare(
      'SELECT * FROM shipping_rate_items WHERE batch_id = ? ORDER BY sort_order, id'
    ).all(req.params.id);

    const exportData = [
      { '起运港': batch.pol, '目的港': batch.pod, '箱型': batch.container_type, '生效日期': batch.valid_from, '截止日期': batch.valid_to, '备注': batch.notes },
      {},
      { '船公司': '', '船名航次': '', '海运费(USD)': '', '航程天数': '', '订舱口': '', '联系人': '', '备注': '' },
      ...items.map(item => ({
        '船公司': item.carrier_name,
        '船名航次': item.vessel_voyage,
        '海运费(USD)': item.freight_rate,
        '航程天数': item.transit_days || '',
        '订舱口': item.supplier_name,
        '联系人': item.supplier_contact,
        '备注': item.remarks,
      })),
    ];

    const ws = XLSX.utils.json_to_sheet(exportData, { skipHeader: false });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '报价明细');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''" + encodeURIComponent('报价_' + batch.pol + '-' + batch.pod + '_' + batch.container_type + '.xlsx'));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== Excel 模板下载 ====================

router.get('/template', (req, res) => {
  const templateData = [
    { '起运港': '宁波', '目的港': '长滩', '箱型': '40HQ', '生效日期': '2026-10-11', '截止日期': '2026-10-14', '备注': '有效期1-3天，美西+50燃油' },
    { '船公司': 'COSCO', '船名航次': 'GGCL-SOUTH CHINA SEA', '海运费(USD)': 8215, '航程天数': '14+', '订舱口': '聚航', '联系人': '', '备注': '' },
    { '船公司': 'OOCL', '船名航次': 'COSCO SOUTH CHINA SEA/085E', '海运费(USD)': 8950, '航程天数': '14+', '订舱口': '中外运', '联系人': '', '备注': '' },
    { '船公司': 'KMTC', '船名航次': 'KMTC NINGBO/2606E', '海运费(USD)': 7300, '航程天数': '14+', '订舱口': '港通', '联系人': '', '备注': '' },
    { '船公司': 'MSC', '船名航次': 'MSC DARLENE/OG64IN', '海运费(USD)': 7750, '航程天数': '14+', '订舱口': '天津速达', '联系人': '', '备注': '缺40HQ' },
    { '船公司': 'ONE', '船名航次': 'ONE PREMIUM/096E', '海运费(USD)': 7600, '航程天数': '14+', '订舱口': '港通', '联系人': '', '备注': '用柜严重' },
  ];

  const ws = XLSX.utils.json_to_sheet(templateData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '报价模板');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''" + encodeURIComponent('海运费报价导入模板.xlsx'));
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// ==================== 客户报价单 ====================

router.get('/batches/:id/quotation', (req, res) => {
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
      var items = db.prepare(
        'SELECT * FROM shipping_rate_items WHERE batch_id = ? ORDER BY freight_rate ASC, sort_order, id'
      ).all(req.params.id);
      if (items.length === 0) return res.status(400).json({ success: false, error: '该批次无报价明细' });
      item = items[0];
    }

    var today = new Date().toISOString().slice(0, 10);
    var pol = batch.pol || '';
    var pod = batch.pod || '';
    var ct = batch.container_type || '';
    var validFrom = batch.valid_from || today;
    var validTo = batch.valid_to || '';
    var carrier = item.carrier_name || '';
    var vessel = item.vessel_voyage || '';
    var freight = item.freight_rate || 0;

    var headerStyle = { font: { bold: true, sz: 12, color: { rgb: 'FFFFFF' }, name: '微软雅黑' }, fill: { fgColor: { rgb: '1F4E79' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: { top: { style: 'thin', color: { rgb: '000000' } }, bottom: { style: 'thin', color: { rgb: '000000' } }, left: { style: 'thin', color: { rgb: '000000' } }, right: { style: 'thin', color: { rgb: '000000' } } } };
    var sectionStyle = { font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' }, name: '微软雅黑' }, fill: { fgColor: { rgb: '5B9BD5' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: { top: { style: 'thin', color: { rgb: '000000' } }, bottom: { style: 'thin', color: { rgb: '000000' } }, left: { style: 'thin', color: { rgb: '000000' } }, right: { style: 'thin', color: { rgb: '000000' } } } };
    var totalStyle = { font: { bold: true, sz: 11, name: '微软雅黑' }, fill: { fgColor: { rgb: 'FFF2CC' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: { top: { style: 'thin', color: { rgb: '000000' } }, bottom: { style: 'thin', color: { rgb: '000000' } }, left: { style: 'thin', color: { rgb: '000000' } }, right: { style: 'thin', color: { rgb: '000000' } } } };
    var cellStyle = { font: { sz: 10, name: '微软雅黑' }, alignment: { vertical: 'center', wrapText: true }, border: { top: { style: 'thin', color: { rgb: 'D9D9D9' } }, bottom: { style: 'thin', color: { rgb: 'D9D9D9' } }, left: { style: 'thin', color: { rgb: 'D9D9D9' } }, right: { style: 'thin', color: { rgb: 'D9D9D9' } } } };

    var aoa = [];

    aoa.push(['']);
    aoa.push(['费用项目', '计费标准', '费用金额', '备注']);
    aoa.push(['基础海运费（' + pol + '-->' + pod + '）', '按每柜计费', 'USD ' + freight + ' /柜（含AMS+换单费）', '主运输核心费用\n根据当日实际价格']);
    aoa.push(['港口本地杂费（THC+DOC+EBS等）', '按每柜计费', 'RMB 2500 /柜', '预提费（提前用箱）\n过夜费（装柜要过晚上12点）\n待时费（装柜时间超过8小时）\n落箱费（码头没有开港，找堆场存放）\n预进港（码头没有开港，找黄牛放进港口）\n错截费（船司已经截单资料，柜子没装好）+改单费\n加载费（船司甩柜后，加钱找黄牛上船）\n跑空费（通知柜子已卸空，实际车队提空柜时海外仓未卸空）\n滞箱费（柜子在海外仓时间过长，一般为提出后7天）\n车架费用（柜子车架的使用费用，一般免费3天）']);
    aoa.push(['关税', '按每柜计费', 'USD 2000 /柜', '必缴费用']);
    aoa.push(['清关手续费', '按每柜计费', 'USD 220 /柜', '必缴费用']);
    aoa.push(['报关费', '按每柜计费', 'RMB 350 /票', '常规普货报关，不含特殊单证报关']);
    aoa.push(['拖车提柜费（工厂->码头）', '按每柜计费', 'RMB 2600 /柜', '如需自提可不收取，也可根据不同的路程对应收取']);
    aoa.push(['尾程派送', '按每柜计费', 'USD 800 /柜', '如需自提可不收取']);
    aoa.push(['查验风险金', '按每柜计费', 'USD 0 /柜', '加收100USD抵扣1000，依次类推（如遇到查验）']);
    aoa.push(['合计费用', '一票总计', 'USD ' + (freight + 2000 + 220 + 800) + ' + RMB ' + (2500 + 350 + 2600), '']);
    aoa.push(['']);
    aoa.push(['尾程派送注意事项']);
    aoa.push(['费用项目', '免费期', '超期标准', '备注']);
    aoa.push(['车架费', '3天', '约45USD/天', '自柜子抵达仓库完成卸柜起计算，至空柜归还船公司为止']);
    aoa.push(['预提费', '—', '约200USD/次', '双方确认送仓时间后，若车队已完成港口提柜，因海外仓侧原因无法接收柜子入仓，将产生额外预提费用，该费用按实际发生向客户收取']);
    aoa.push(['夜存费', '—', '约50USD/天', '柜子从港口提柜出来后，未能直接送仓，需在堆场/车场临时过夜暂存所产生的费用，按实际发生收取']);
    aoa.push(['改地址/改派送方式', '需提前7天', '可能产生约100USD改单费', '客户变更需提前沟通（如更改地址或者改自提）']);

    var ws = XLSX.utils.aoa_to_sheet(aoa);

    ws['!cols'] = [
      { wch: 32 },
      { wch: 14 },
      { wch: 28 },
      { wch: 60 },
    ];

    ws['!rows'] = [];
    for (var ri = 0; ri < aoa.length; ri++) {
      ws['!rows'][ri] = { hpt: ri === 3 ? 120 : (ri === 12 ? 25 : 22) };
    }

    var setCellStyle = function(cell, style) { if (cell) cell.s = style; };

    for (var ci = 0; ci <= 3; ci++) {
      setCellStyle(ws[XLSX.utils.encode_cell({ r: 1, c: ci })], headerStyle);
    }
    for (ci = 0; ci <= 3; ci++) {
      setCellStyle(ws[XLSX.utils.encode_cell({ r: 12, c: ci })], sectionStyle);
    }
    for (ci = 0; ci <= 3; ci++) {
      setCellStyle(ws[XLSX.utils.encode_cell({ r: 11, c: ci })], totalStyle);
    }

    for (var row = 2; row <= 10; row++) {
      for (var col = 0; col <= 3; col++) {
        setCellStyle(ws[XLSX.utils.encode_cell({ r: row, c: col })], cellStyle);
      }
    }
    for (var row2 = 13; row2 <= 17; row2++) {
      for (var col2 = 0; col2 <= 3; col2++) {
        setCellStyle(ws[XLSX.utils.encode_cell({ r: row2, c: col2 })], cellStyle);
      }
    }

    ws['!merges'] = [
      { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
      { s: { r: 12, c: 0 }, e: { r: 12, c: 3 } },
    ];

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

router.get('/batches/:id/quotation-preview', (req, res) => {
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
      var items = db.prepare(
        'SELECT * FROM shipping_rate_items WHERE batch_id = ? ORDER BY freight_rate ASC, sort_order, id'
      ).all(req.params.id);
      if (items.length === 0) return res.status(400).json({ success: false, error: '该批次无报价明细' });
      item = items[0];
    }

    var pol = batch.pol || '';
    var pod = batch.pod || '';
    var ct = batch.container_type || '';
    var carrier = item.carrier_name || '';
    var freight = item.freight_rate || 0;

    var data = {
      _batchId: req.params.id,
      _itemId: itemId || '',
      pol: pol,
      pod: pod,
      ct: ct,
      carrier: carrier,
      vessel: item.vessel_voyage || '',
      freight: freight,
      items: [
        { name: '基础海运费（' + pol + '-->' + pod + '）', standard: '按每柜计费', amount: 'USD ' + freight + ' /柜（含AMS+换单费）', note: '主运输核心费用\n根据当日实际价格' },
        { name: '港口本地杂费（THC+DOC+EBS等）', standard: '按每柜计费', amount: 'RMB 2500 /柜', note: '预提费（提前用箱）、过夜费（装柜要过晚上12点）、待时费（装柜时间超过8小时）、落箱费（码头没有开港，找堆场存放）、预进港（码头没有开港，找黄牛放进港口）、错截费+改单费、加载费、跑空费、滞箱费、车架费用' },
        { name: '关税', standard: '按每柜计费', amount: 'USD 2000 /柜', note: '必缴费用' },
        { name: '清关手续费', standard: '按每柜计费', amount: 'USD 220 /柜', note: '必缴费用' },
        { name: '报关费', standard: '按每柜计费', amount: 'RMB 350 /票', note: '常规普货报关，不含特殊单证报关' },
        { name: '拖车提柜费（工厂->码头）', standard: '按每柜计费', amount: 'RMB 2600 /柜', note: '如需自提可不收取，也可根据不同的路程对应收取' },
        { name: '尾程派送', standard: '按每柜计费', amount: 'USD 800 /柜', note: '如需自提可不收取' },
        { name: '查验风险金', standard: '按每柜计费', amount: 'USD 0 /柜', note: '加收100USD抵扣1000，依次类推（如遇到查验）' },
      ],
      total: { usd: freight + 2000 + 220 + 800, rmb: 2500 + 350 + 2600, all: freight + 2000 + 220 + 800 + 2500 + 350 + 2600 },
      notes: [
        { name: '车架费', free: '3天', fee: '约45USD/天', note: '自柜子抵达仓库完成卸柜起计算，至空柜归还船公司为止' },
        { name: '预提费', free: '—', fee: '约200USD/次', note: '双方确认送仓时间后，若车队已完成港口提柜，因海外仓侧原因无法接收柜子入仓，将产生额外预提费用，该费用按实际发生向客户收取' },
        { name: '夜存费', free: '—', fee: '约50USD/天', note: '柜子从港口提柜出来后，未能直接送仓，需在堆场/车场临时过夜暂存所产生的费用，按实际发生收取' },
        { name: '改地址/改派送方式', free: '需提前7天', fee: '可能产生约100USD改单费', note: '客户变更需提前沟通（如更改地址或者改自提）' },
      ]
    };

    res.json({ success: true, data: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;