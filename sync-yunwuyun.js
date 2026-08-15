// 同步云无云数据到本地数据库
import { syncOrders, syncCustomers } from './server/yunwuyun.js';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'data', 'meiou-crm.db');

const log = [];
const logFn = (msg) => { console.log(msg); log.push(msg); };

function ensureTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS yunwuyun_orders (
      job_id INTEGER PRIMARY KEY,
      job_no TEXT, job_type TEXT, job_date TEXT,
      order_status INTEGER, close_status INTEGER,
      client_id INTEGER, client_name TEXT, client_name_eng TEXT,
      client_code TEXT, client_abbr TEXT,
      carrier_name TEXT, vessel TEXT, voyage TEXT,
      etd TEXT, eta TEXT, atd TEXT,
      so_no TEXT, bl_no_domestic TEXT, bl_no_overseas TEXT, carrier_jobno TEXT,
      ar_amt REAL DEFAULT 0, ap_amt REAL DEFAULT 0, gr_oss REAL DEFAULT 0,
      freighttons REAL DEFAULT 0, client_quote_freighttons REAL DEFAULT 0,
      transport_type TEXT, loadtype TEXT, stow_type INTEGER, collect_type INTEGER,
      charging_type TEXT, delivery_country TEXT, dest_country TEXT,
      warehouse_code TEXT, supply_channel_code TEXT, supply_channel_name TEXT,
      channel_receive_code TEXT, channel_receive_name TEXT,
      cnt_nos TEXT, charging_codes TEXT, goods_name TEXT, goods_value REAL DEFAULT 0,
      pieces INTEGER DEFAULT 0, gross_kgs REAL DEFAULT 0, goods_cbm REAL DEFAULT 0,
      net_kgs REAL DEFAULT 0, client_total_volume REAL DEFAULT 0,
      client_total_pieces INTEGER DEFAULT 0, client_total_weight REAL DEFAULT 0,
      client_billing_weight REAL DEFAULT 0, box_total_qty INTEGER DEFAULT 0,
      box_total_weight REAL DEFAULT 0, box_total_volume REAL DEFAULT 0,
      estimate_quantity_total INTEGER DEFAULT 0, goods_cycode TEXT, base_cy_code TEXT,
      order_status_map TEXT, booking_aheads TEXT, inserted_by TEXT, job_remarks TEXT,
      order_change_type INTEGER, delivery_fee_cc INTEGER, client_settler_type INTEGER,
      ar_count INTEGER DEFAULT 0, ap_count INTEGER DEFAULT 0,
      latest_problem_count INTEGER DEFAULT 0, comment_count INTEGER DEFAULT 0,
      synced_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS yunwuyun_customers (
      client_id INTEGER PRIMARY KEY,
      client_code TEXT, client_name TEXT, client_name_eng TEXT, client_abbr TEXT,
      client_type TEXT, client_class TEXT, client_class_eng TEXT,
      client_property INTEGER, client_same_industry INTEGER,
      country_id INTEGER, country_code TEXT, country_name TEXT, country_name_eng TEXT,
      province_state TEXT, client_addr TEXT, addr_postcode TEXT,
      mobile_no TEXT, office_tel TEXT, uni_credit_code TEXT,
      contact_name TEXT, sales_name TEXT, op_name TEXT, cs_name TEXT, staff_name_biz TEXT,
      insert_time TEXT, update_time TEXT, inserted_by TEXT, updated_by TEXT,
      inuse INTEGER DEFAULT 1, catalog_name TEXT, catalog_name_eng TEXT,
      org_code TEXT, org_name TEXT, org_name_eng TEXT,
      client_source_name TEXT, client_source_name_eng TEXT,
      settler_type INTEGER, csm_staff TEXT,
      synced_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_yy_orders_client ON yunwuyun_orders(client_id);
    CREATE INDEX IF NOT EXISTS idx_yy_orders_job_date ON yunwuyun_orders(job_date);
    CREATE INDEX IF NOT EXISTS idx_yy_orders_status ON yunwuyun_orders(order_status);
    CREATE INDEX IF NOT EXISTS idx_yy_customers_code ON yunwuyun_customers(client_code);
  `);
}

async function run() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = OFF');
  ensureTables(db);

  logFn('=== 开始同步云无云数据 ===\n');

  // 1. 同步订单
  logFn('📦 开始同步订单...');
  try {
    const orderResult = await syncOrders((p) => {
      logFn(`  订单: 第${p.page}页, 已同步 ${p.synced}/${p.total}`);
    });

    if (orderResult.success && orderResult.data.length > 0) {
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
        for (const row of orderResult.data) {
          upsert.run(row);
        }
      });
      syncAll();

      logFn(`✅ 订单同步完成: ${orderResult.totalSynced} 条`);
    } else {
      logFn('⚠️ 订单同步: 无数据');
    }
  } catch (err) {
    logFn(`❌ 订单同步失败: ${err.message}`);
  }

  // 2. 同步客户
  logFn('\n👥 开始同步客户...');
  try {
    const custResult = await syncCustomers((p) => {
      logFn(`  客户: 第${p.page}页, 已同步 ${p.synced}/${p.total}`);
    });

    if (custResult.success && custResult.data.length > 0) {
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
        for (const row of custResult.data) {
          upsert.run(row);
        }
      });
      syncAll();

      logFn(`✅ 客户同步完成: ${custResult.totalSynced} 条`);
    } else {
      logFn('⚠️ 客户同步: 无数据');
    }
  } catch (err) {
    logFn(`❌ 客户同步失败: ${err.message}`);
  }

  logFn('\n🎉 全部同步完成！');

  db.close();

  // 写入日志文件
  fs.writeFileSync(path.join(__dirname, 'sync-result.log'), log.join('\n'), 'utf-8');
  logFn('📝 日志已保存到 sync-result.log');
}

run().catch(err => {
  const msg = '同步出错: ' + (err.stack || err.message);
  console.error(msg);
  log.push(msg);
  try {
    fs.writeFileSync(path.join(__dirname, 'sync-result.log'), log.join('\n'), 'utf-8');
  } catch (_) {}
});