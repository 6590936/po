import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'meiou-crm.db');
const JSON_DB_PATH = path.join(DATA_DIR, 'meiou-crm.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let db = null;

export function getDb() {
  return db;
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'sales',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      contact_name TEXT,
      position TEXT,
      phone TEXT,
      wechat TEXT,
      email TEXT,
      customer_type TEXT,
      grade TEXT DEFAULT 'D',
      status TEXT DEFAULT 'potential',
      owner_id INTEGER REFERENCES users(id),
      notes TEXT,
      tags TEXT,
      cargo_type TEXT,
      monthly_volume TEXT,
      decision_maker TEXT,
      current_forwarder TEXT,
      pain_points TEXT,
      entry_strategy TEXT,
      last_followup_at TEXT,
      next_followup_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS followups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      followup_date TEXT NOT NULL,
      method TEXT,
      content TEXT NOT NULL,
      next_plan TEXT,
      next_time TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS grade_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      from_grade TEXT NOT NULL,
      to_grade TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      calls INTEGER DEFAULT 0,
      wechat_adds INTEGER DEFAULT 0,
      emails INTEGER DEFAULT 0,
      effective_comms INTEGER DEFAULT 0,
      quotes_sent INTEGER DEFAULT 0,
      crm_updates INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, date)
    );

    CREATE TABLE IF NOT EXISTS quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      route TEXT DEFAULT '',
      container_type TEXT DEFAULT '',
      amount REAL DEFAULT 0,
      currency TEXT DEFAULT 'CNY',
      status TEXT DEFAULT 'pending',
      valid_until TEXT,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      responded_at TEXT
    );

    CREATE TABLE IF NOT EXISTS weekly_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      week_start TEXT NOT NULL,
      week_end TEXT NOT NULL,
      new_customers INTEGER DEFAULT 0,
      effective_comms INTEGER DEFAULT 0,
      quotes_sent INTEGER DEFAULT 0,
      deals INTEGER DEFAULT 0,
      revenue REAL DEFAULT 0,
      top3_customers TEXT DEFAULT '[]',
      problems TEXT DEFAULT '',
      next_week_plan TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, week_start)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id INTEGER,
      details TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_customers_owner ON customers(owner_id);
    CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
    CREATE INDEX IF NOT EXISTS idx_customers_grade ON customers(grade);
    CREATE INDEX IF NOT EXISTS idx_followups_customer ON followups(customer_id);
    CREATE INDEX IF NOT EXISTS idx_followups_user ON followups(user_id);
    CREATE INDEX IF NOT EXISTS idx_followups_date ON followups(followup_date);
    CREATE INDEX IF NOT EXISTS idx_activities_user_date ON daily_activities(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_quotes_customer ON quotes(customer_id);
    CREATE INDEX IF NOT EXISTS idx_quotes_user ON quotes(user_id);
    CREATE INDEX IF NOT EXISTS idx_weekly_reports_user ON weekly_reports(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

    CREATE TABLE IF NOT EXISTS yunwuyun_orders (
      job_id INTEGER PRIMARY KEY,
      job_no TEXT,
      job_type TEXT,
      job_date TEXT,
      order_status INTEGER,
      close_status INTEGER,
      client_id INTEGER,
      client_name TEXT,
      client_name_eng TEXT,
      client_code TEXT,
      client_abbr TEXT,
      carrier_name TEXT,
      vessel TEXT,
      voyage TEXT,
      etd TEXT,
      eta TEXT,
      atd TEXT,
      so_no TEXT,
      bl_no_domestic TEXT,
      bl_no_overseas TEXT,
      carrier_jobno TEXT,
      ar_amt REAL DEFAULT 0,
      ap_amt REAL DEFAULT 0,
      gr_oss REAL DEFAULT 0,
      freighttons REAL DEFAULT 0,
      client_quote_freighttons REAL DEFAULT 0,
      transport_type TEXT,
      loadtype TEXT,
      stow_type INTEGER,
      collect_type INTEGER,
      charging_type TEXT,
      delivery_country TEXT,
      dest_country TEXT,
      warehouse_code TEXT,
      supply_channel_code TEXT,
      supply_channel_name TEXT,
      channel_receive_code TEXT,
      channel_receive_name TEXT,
      cnt_nos TEXT,
      charging_codes TEXT,
      goods_name TEXT,
      goods_value REAL DEFAULT 0,
      pieces INTEGER DEFAULT 0,
      gross_kgs REAL DEFAULT 0,
      goods_cbm REAL DEFAULT 0,
      net_kgs REAL DEFAULT 0,
      client_total_volume REAL DEFAULT 0,
      client_total_pieces INTEGER DEFAULT 0,
      client_total_weight REAL DEFAULT 0,
      client_billing_weight REAL DEFAULT 0,
      box_total_qty INTEGER DEFAULT 0,
      box_total_weight REAL DEFAULT 0,
      box_total_volume REAL DEFAULT 0,
      estimate_quantity_total INTEGER DEFAULT 0,
      goods_cycode TEXT,
      base_cy_code TEXT,
      order_status_map TEXT,
      booking_aheads TEXT,
      inserted_by TEXT,
      job_remarks TEXT,
      order_change_type INTEGER,
      delivery_fee_cc INTEGER,
      client_settler_type INTEGER,
      ar_count INTEGER DEFAULT 0,
      ap_count INTEGER DEFAULT 0,
      latest_problem_count INTEGER DEFAULT 0,
      comment_count INTEGER DEFAULT 0,
      synced_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS yunwuyun_customers (
      client_id INTEGER PRIMARY KEY,
      client_code TEXT,
      client_name TEXT,
      client_name_eng TEXT,
      client_abbr TEXT,
      client_type TEXT,
      client_class TEXT,
      client_class_eng TEXT,
      client_property INTEGER,
      client_same_industry INTEGER,
      country_id INTEGER,
      country_code TEXT,
      country_name TEXT,
      country_name_eng TEXT,
      province_state TEXT,
      client_addr TEXT,
      addr_postcode TEXT,
      mobile_no TEXT,
      office_tel TEXT,
      uni_credit_code TEXT,
      contact_name TEXT,
      sales_name TEXT,
      op_name TEXT,
      cs_name TEXT,
      staff_name_biz TEXT,
      insert_time TEXT,
      update_time TEXT,
      inserted_by TEXT,
      updated_by TEXT,
      inuse INTEGER DEFAULT 1,
      catalog_name TEXT,
      catalog_name_eng TEXT,
      org_code TEXT,
      org_name TEXT,
      org_name_eng TEXT,
      client_source_name TEXT,
      client_source_name_eng TEXT,
      settler_type INTEGER,
      csm_staff TEXT,
      synced_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_yy_orders_client ON yunwuyun_orders(client_id);
    CREATE INDEX IF NOT EXISTS idx_yy_orders_job_date ON yunwuyun_orders(job_date);
    CREATE INDEX IF NOT EXISTS idx_yy_orders_status ON yunwuyun_orders(order_status);
    CREATE INDEX IF NOT EXISTS idx_yy_customers_code ON yunwuyun_customers(client_code);
  `);

  // 迁移：为已有客户表添加登录字段（忽略已存在的列）
  try { db.exec('ALTER TABLE yunwuyun_customers ADD COLUMN login_enabled INTEGER DEFAULT 0'); } catch (_) {}
  try { db.exec('ALTER TABLE yunwuyun_customers ADD COLUMN login_password TEXT'); } catch (_) {}
  try { db.exec('ALTER TABLE yunwuyun_customers ADD COLUMN login_account TEXT'); } catch (_) {}
  try { db.exec('ALTER TABLE yunwuyun_customers ADD COLUMN business_license TEXT'); } catch (_) {}
  try { db.exec('ALTER TABLE yunwuyun_customers ADD COLUMN business_license_no TEXT'); } catch (_) {}
  try { db.exec('ALTER TABLE yunwuyun_customers ADD COLUMN legal_person TEXT'); } catch (_) {}
  try { db.exec('ALTER TABLE yunwuyun_customers ADD COLUMN registered_capital TEXT'); } catch (_) {}
  try { db.exec('ALTER TABLE yunwuyun_customers ADD COLUMN establish_date TEXT'); } catch (_) {}
  try { db.exec('ALTER TABLE yunwuyun_customers ADD COLUMN company_type TEXT'); } catch (_) {}
  try { db.exec('ALTER TABLE yunwuyun_customers ADD COLUMN tax_no TEXT'); } catch (_) {}
  try { db.exec('ALTER TABLE yunwuyun_customers ADD COLUMN contact_email TEXT'); } catch (_) {}
  try { db.exec('ALTER TABLE yunwuyun_customers ADD COLUMN contact_phone TEXT'); } catch (_) {}
  try { db.exec('ALTER TABLE yunwuyun_customers ADD COLUMN wechat_webhook TEXT'); } catch (_) {}
  try { db.exec('ALTER TABLE yunwuyun_customers ADD COLUMN wechat_group_name TEXT'); } catch (_) {}
  try { db.exec('ALTER TABLE yunwuyun_customers ADD COLUMN wechat_chatid TEXT'); } catch (_) {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT DEFAULT '',
      is_system INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS role_menus (
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      menu_key TEXT NOT NULL,
      PRIMARY KEY (role_id, menu_key)
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_key TEXT NOT NULL,
      PRIMARY KEY (role_id, permission_key)
    );

    CREATE TABLE IF NOT EXISTS wechat_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS push_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER,
      client_name TEXT,
      order_id INTEGER,
      order_no TEXT,
      push_type TEXT,
      content TEXT,
      status TEXT DEFAULT 'pending',
      error_msg TEXT,
      created_at TEXT NOT NULL
    );

    -- RPA消息队列：CRM写入，RPA工具轮询消费
    CREATE TABLE IF NOT EXISTS push_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER,
      client_name TEXT,
      group_name TEXT,
      order_ids TEXT,
      content TEXT,
      status TEXT DEFAULT 'pending',
      error_msg TEXT,
      created_at TEXT NOT NULL,
      sent_at TEXT
    );

    -- 轨迹查验模块
    CREATE TABLE IF NOT EXISTS tracking_queries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      tracking_no TEXT NOT NULL,
      carrier_code TEXT,
      carrier_name TEXT,
      latest_status TEXT,
      query_time TEXT NOT NULL,
      success INTEGER DEFAULT 1,
      error_msg TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_tracking_queries_user ON tracking_queries(user_id);
    CREATE INDEX IF NOT EXISTS idx_tracking_queries_no ON tracking_queries(tracking_no);

    -- 订单轨迹表（FMS订单抓取的轨迹数据）
    CREATE TABLE IF NOT EXISTS order_tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      tracking_no TEXT,
      carrier_code TEXT,
      carrier_name TEXT,
      origin TEXT,
      destination TEXT,
      vessel TEXT,
      voyage TEXT,
      container_no TEXT,
      etd TEXT,
      atd TEXT,
      eta TEXT,
      ata TEXT,
      status TEXT,
      status_label TEXT,
      timeline TEXT,
      raw_data TEXT,
      queried_at TEXT,
      success INTEGER DEFAULT 0,
      error_msg TEXT,
      UNIQUE(job_id)
    );
    CREATE INDEX IF NOT EXISTS idx_order_tracking_job ON order_tracking(job_id);
    CREATE INDEX IF NOT EXISTS idx_order_tracking_status ON order_tracking(status);

    -- 销售管理模块
    CREATE TABLE IF NOT EXISTS sales_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      category TEXT NOT NULL DEFAULT 'product',
      file_url TEXT,
      author_id INTEGER REFERENCES users(id),
      status TEXT DEFAULT 'published',
      view_count INTEGER DEFAULT 0,
      is_pinned INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sales_scripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      scene_category TEXT NOT NULL,
      scene_name TEXT NOT NULL,
      script_content TEXT NOT NULL,
      notes TEXT DEFAULT '',
      target_customer_type TEXT DEFAULT '',
      keywords TEXT DEFAULT '',
      file_url TEXT DEFAULT '',
      author_id INTEGER REFERENCES users(id),
      usage_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'published',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS script_favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      script_id INTEGER NOT NULL REFERENCES sales_scripts(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, script_id)
    );

    CREATE TABLE IF NOT EXISTS onboarding_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      duration_days INTEGER DEFAULT 14,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS onboarding_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL REFERENCES onboarding_plans(id) ON DELETE CASCADE,
      day_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      task_type TEXT NOT NULL DEFAULT 'study',
      material_id INTEGER REFERENCES sales_materials(id) ON DELETE SET NULL,
      script_id INTEGER REFERENCES sales_scripts(id) ON DELETE SET NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_onboarding (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      plan_id INTEGER NOT NULL REFERENCES onboarding_plans(id),
      task_id INTEGER NOT NULL REFERENCES onboarding_tasks(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'pending',
      score INTEGER,
      mentor_comment TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, task_id)
    );

    CREATE TABLE IF NOT EXISTS call_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      customer_name TEXT DEFAULT '',
      duration_minutes INTEGER DEFAULT 0,
      scenario_id INTEGER DEFAULT 0,
      script_id INTEGER REFERENCES sales_scripts(id) ON DELETE SET NULL,
      content TEXT DEFAULT '',
      customer_response TEXT DEFAULT '',
      self_review TEXT DEFAULT '',
      next_steps TEXT DEFAULT '',
      file_url TEXT DEFAULT '',
      status TEXT DEFAULT 'draft',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS call_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      call_log_id INTEGER NOT NULL REFERENCES call_logs(id) ON DELETE CASCADE,
      reviewer_id INTEGER NOT NULL REFERENCES users(id),
      comment TEXT NOT NULL,
      rating INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS feedback_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      related_call_ids TEXT DEFAULT '[]',
      lessons_learned TEXT DEFAULT '',
      action_items TEXT DEFAULT '',
      file_url TEXT DEFAULT '',
      status TEXT DEFAULT 'draft',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sales_materials_category ON sales_materials(category);
    CREATE INDEX IF NOT EXISTS idx_sales_scripts_scene ON sales_scripts(scene_category);
    CREATE INDEX IF NOT EXISTS idx_sales_scripts_status ON sales_scripts(status);
    CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_plan ON onboarding_tasks(plan_id);
    CREATE INDEX IF NOT EXISTS idx_user_onboarding_user ON user_onboarding(user_id);
    CREATE INDEX IF NOT EXISTS idx_call_logs_user ON call_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_call_logs_customer ON call_logs(customer_id);
    CREATE INDEX IF NOT EXISTS idx_call_reviews_call ON call_reviews(call_log_id);

    CREATE INDEX IF NOT EXISTS idx_feedback_summaries_user ON feedback_summaries(user_id);
  `);

  try { db.exec('ALTER TABLE sales_scripts ADD COLUMN file_url TEXT DEFAULT ""'); } catch {}
  try { db.exec('ALTER TABLE call_logs ADD COLUMN file_url TEXT DEFAULT ""'); } catch {}
  try { db.exec('ALTER TABLE feedback_summaries ADD COLUMN file_url TEXT DEFAULT ""'); } catch {}
}

function migrateFromJSON() {
  if (!fs.existsSync(JSON_DB_PATH)) return;

  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
  if (userCount.cnt > 0) return;

  console.log('🔄 检测到旧JSON数据，正在迁移到SQLite...');
  try {
    const raw = fs.readFileSync(JSON_DB_PATH, 'utf-8');
    const jsonDb = JSON.parse(raw);

    const insertUser = db.prepare(
      'INSERT INTO users (id, username, password, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const insertCustomer = db.prepare(
      `INSERT INTO customers (id, company_name, contact_name, position, phone, wechat, email, customer_type, grade, status, owner_id, notes, tags, cargo_type, monthly_volume, decision_maker, current_forwarder, pain_points, entry_strategy, last_followup_at, next_followup_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertFollowup = db.prepare(
      'INSERT INTO followups (id, customer_id, user_id, followup_date, method, content, next_plan, next_time, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const insertGradeChange = db.prepare(
      'INSERT INTO grade_changes (id, customer_id, user_id, from_grade, to_grade, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const insertActivity = db.prepare(
      'INSERT OR REPLACE INTO daily_activities (id, user_id, date, calls, wechat_adds, emails, effective_comms, quotes_sent, crm_updates, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const insertQuote = db.prepare(
      'INSERT INTO quotes (id, customer_id, user_id, route, container_type, amount, currency, status, valid_until, notes, created_at, responded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const insertWeekly = db.prepare(
      'INSERT OR REPLACE INTO weekly_reports (id, user_id, week_start, week_end, new_customers, effective_comms, quotes_sent, deals, revenue, top3_customers, problems, next_week_plan, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    const migrateAll = db.transaction(() => {
      if (jsonDb.users) {
        for (const u of jsonDb.users) {
          const hashed = bcrypt.hashSync(u.password || '123456', 10);
          insertUser.run(u.id, u.username, hashed, u.name, u.role || 'sales', u.created_at || new Date().toISOString());
        }
      }

      if (jsonDb.customers) {
        for (const c of jsonDb.customers) {
          insertCustomer.run(
            c.id, c.company_name, c.contact_name || null, c.position || null,
            c.phone || null, c.wechat || null, c.email || null,
            c.customer_type || null, c.grade || 'D', c.status || 'potential',
            c.owner_id || null, c.notes || null, c.tags || null,
            c.cargo_type || null, c.monthly_volume || null, c.decision_maker || null,
            c.current_forwarder || null, c.pain_points || null, c.entry_strategy || null,
            c.last_followup_at || null, c.next_followup_at || null,
            c.created_at || new Date().toISOString(), c.updated_at || new Date().toISOString()
          );
        }
      }

      if (jsonDb.followups) {
        for (const f of jsonDb.followups) {
          insertFollowup.run(f.id, f.customer_id, f.user_id, f.followup_date, f.method || null, f.content, f.next_plan || null, f.next_time || null, f.created_at || new Date().toISOString());
        }
      }

      if (jsonDb.grade_changes) {
        for (const gc of jsonDb.grade_changes) {
          insertGradeChange.run(gc.id, gc.customer_id, gc.user_id, gc.from_grade, gc.to_grade, gc.reason || null, gc.created_at || new Date().toISOString());
        }
      }

      if (jsonDb.daily_activities) {
        for (const a of jsonDb.daily_activities) {
          insertActivity.run(a.id, a.user_id, a.date, a.calls || 0, a.wechat_adds || 0, a.emails || 0, a.effective_comms || 0, a.quotes_sent || 0, a.crm_updates || 0, a.notes || '', a.created_at || new Date().toISOString(), a.updated_at || new Date().toISOString());
        }
      }

      if (jsonDb.quotes) {
        for (const q of jsonDb.quotes) {
          insertQuote.run(q.id, q.customer_id, q.user_id, q.route || '', q.container_type || '', q.amount || 0, q.currency || 'CNY', q.status || 'pending', q.valid_until || null, q.notes || '', q.created_at || new Date().toISOString(), q.responded_at || null);
        }
      }

      if (jsonDb.weekly_reports) {
        for (const w of jsonDb.weekly_reports) {
          insertWeekly.run(w.id, w.user_id, w.week_start, w.week_end, w.new_customers || 0, w.effective_comms || 0, w.quotes_sent || 0, w.deals || 0, w.revenue || 0, JSON.stringify(w.top3_customers || []), w.problems || '', w.next_week_plan || '', w.created_at || new Date().toISOString(), w.updated_at || new Date().toISOString());
        }
      }
    });

    migrateAll();
    console.log(`✅ 数据迁移完成：${jsonDb.users?.length || 0}用户, ${jsonDb.customers?.length || 0}客户`);
    fs.renameSync(JSON_DB_PATH, JSON_DB_PATH + '.backup');
    console.log('📦 旧JSON数据已备份为 meiou-crm.json.backup');
  } catch (err) {
    console.error('❌ 数据迁移失败:', err.message);
  }
}

function initDefaultData() {
  const now = new Date().toISOString();

  // 初始化默认角色
  const roleCount = db.prepare('SELECT COUNT(*) as cnt FROM roles').get();
  if (roleCount.cnt === 0) {
    const insertRole = db.prepare(
      'INSERT INTO roles (name, description, is_system, created_at) VALUES (?, ?, 1, ?)'
    );
    const insertMenu = db.prepare(
      'INSERT OR IGNORE INTO role_menus (role_id, menu_key) VALUES (?, ?)'
    );
    const insertPerm = db.prepare(
      'INSERT OR IGNORE INTO role_permissions (role_id, permission_key) VALUES (?, ?)'
    );

    // 管理员角色 - 所有菜单 + 所有数据权限
    const adminRole = insertRole.run('admin', '系统管理员，拥有所有权限', now);
    const adminMenus = ['/', '/customers', '/reminders', '/daily-report', '/quotes', '/weekly-report', '/yunwuyun', '/tracking', '/sales', '/admin'];
    for (const m of adminMenus) insertMenu.run(adminRole.lastInsertRowid, m);
    insertPerm.run(adminRole.lastInsertRowid, 'data:all');

    // 销售角色 - 部分菜单 + 只看自己数据
    const salesRole = insertRole.run('sales', '销售人员，管理自己的客户和业务', now);
    const salesMenus = ['/', '/customers', '/reminders', '/daily-report', '/quotes', '/weekly-report', '/tracking', '/sales'];
    for (const m of salesMenus) insertMenu.run(salesRole.lastInsertRowid, m);
    insertPerm.run(salesRole.lastInsertRowid, 'data:own');
  }

  // 初始化默认用户
  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
  if (userCount.cnt === 0) {
    const insertUser = db.prepare(
      'INSERT OR IGNORE INTO users (username, password, name, role, created_at) VALUES (?, ?, ?, ?, ?)'
    );
    insertUser.run('admin', bcrypt.hashSync('admin123', 10), '系统管理员', 'admin', now);
    insertUser.run('sales1', bcrypt.hashSync('123456', 10), '张销售', 'sales', now);
  }

  // 迁移：给已有角色补充轨迹查验菜单权限（兼容老数据库）
  try {
    const existingRoles = db.prepare('SELECT id, name FROM roles').all();
    const insertMenu = db.prepare('INSERT OR IGNORE INTO role_menus (role_id, menu_key) VALUES (?, ?)');
    for (const role of existingRoles) {
      // admin 和 sales 角色默认添加轨迹查验菜单
      if (role.name === 'admin' || role.name === 'sales') {
        insertMenu.run(role.id, '/tracking');
      }
    }
  } catch (_) {}
}

export function initDatabase() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  createTables();
  migrateFromJSON();
  initDefaultData();
  console.log('📦 SQLite数据库初始化完成');
}

// ===== 用户操作 =====
export const UserOps = {
  findByCredentials(username, password) {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return null;
    if (!bcrypt.compareSync(password, user.password)) return null;
    return user;
  },
  findById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null;
  },
  findAll() {
    return db.prepare('SELECT id, username, name, role, created_at FROM users ORDER BY id').all();
  },
  create({ username, password, name, role }) {
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) throw new Error('UNIQUE constraint failed: users.username');
    const hashed = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      'INSERT OR IGNORE INTO users (username, password, name, role, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(username, hashed, name, role || 'sales', new Date().toISOString());
    return { id: result.lastInsertRowid };
  },
  delete(id) {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) return false;
    const deleteAll = db.transaction(() => {
      db.prepare('UPDATE customers SET owner_id = NULL WHERE owner_id = ?').run(id);
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
    });
    deleteAll();
    return true;
  },
  resetPassword(id, newPassword) {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) return false;
    const hashed = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, id);
    return true;
  },
};

// ===== 客户操作 =====
export const CustomerOps = {
  findAll({ where = {}, page = 1, pageSize = 20, sortBy = 'updated_at', sortOrder = 'DESC', overdue } = {}) {
    let conditions = [];
    let params = [];

    if (where.owner_id) {
      conditions.push('c.owner_id = ?');
      params.push(where.owner_id);
    }
    if (where.keyword) {
      conditions.push('(c.company_name LIKE ? OR c.contact_name LIKE ? OR c.phone LIKE ? OR c.wechat LIKE ? OR c.tags LIKE ?)');
      const kw = `%${where.keyword}%`;
      params.push(kw, kw, kw, kw, kw);
    }
    if (where.grade) {
      conditions.push('c.grade = ?');
      params.push(where.grade);
    }
    if (where.status) {
      conditions.push('c.status = ?');
      params.push(where.status);
    }
    if (where.customerType) {
      conditions.push('c.customer_type = ?');
      params.push(where.customerType);
    }
    if (overdue) {
      const today = new Date().toISOString().slice(0, 10);
      conditions.push("c.next_followup_at IS NOT NULL AND c.next_followup_at <= ? AND c.status NOT IN ('deal', 'lost')");
      params.push(today);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const validSortFields = ['company_name', 'grade', 'status', 'created_at', 'updated_at', 'last_followup_at', 'next_followup_at'];
    const field = validSortFields.includes(sortBy) ? sortBy : 'updated_at';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM customers c ${whereClause}`).get(...params);
    const total = countRow.cnt;

    const offset = (page - 1) * pageSize;
    const rows = db.prepare(
      `SELECT c.*, u.name as owner_name FROM customers c LEFT JOIN users u ON c.owner_id = u.id ${whereClause} ORDER BY c.${field} ${order} LIMIT ? OFFSET ?`
    ).all(...params, pageSize, offset);

    return { data: rows, total };
  },

  findById(id) {
    const customer = db.prepare('SELECT c.*, u.name as owner_name FROM customers c LEFT JOIN users u ON c.owner_id = u.id WHERE c.id = ?').get(id);
    if (!customer) return null;

    const followups = db.prepare(
      'SELECT f.*, u.name as user_name FROM followups f LEFT JOIN users u ON f.user_id = u.id WHERE f.customer_id = ? ORDER BY f.followup_date DESC'
    ).all(id);

    const gradeChanges = db.prepare(
      'SELECT gc.*, u.name as user_name FROM grade_changes gc LEFT JOIN users u ON gc.user_id = u.id WHERE gc.customer_id = ? ORDER BY gc.created_at DESC'
    ).all(id);

    const quotes = db.prepare(
      'SELECT * FROM quotes WHERE customer_id = ? ORDER BY created_at DESC'
    ).all(id);

    return { ...customer, followups, gradeChanges, quotes };
  },

  create(data) {
    const now = new Date().toISOString();
    const result = db.prepare(
      `INSERT INTO customers (company_name, contact_name, position, phone, wechat, email, customer_type, grade, status, owner_id, notes, tags, cargo_type, monthly_volume, decision_maker, current_forwarder, pain_points, entry_strategy, last_followup_at, next_followup_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      data.company_name, data.contact_name || null, data.position || null,
      data.phone || null, data.wechat || null, data.email || null,
      data.customer_type || null, data.grade || 'D', data.status || 'potential',
      data.owner_id || null, data.notes || null, data.tags || null,
      data.cargo_type || null, data.monthly_volume || null, data.decision_maker || null,
      data.current_forwarder || null, data.pain_points || null, data.entry_strategy || null,
      null, data.next_followup_at || null, now, now
    );
    return { id: result.lastInsertRowid };
  },

  update(id, data) {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!customer) return null;

    const updateAll = db.transaction(() => {
      if (data.grade && data.grade !== customer.grade) {
        db.prepare(
          'INSERT INTO grade_changes (customer_id, user_id, from_grade, to_grade, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(id, data._userId || null, customer.grade, data.grade, data.grade_reason || '手动调整', new Date().toISOString());
      }

      const fields = ['company_name', 'contact_name', 'position', 'phone', 'wechat', 'email',
        'customer_type', 'grade', 'status', 'notes', 'tags', 'next_followup_at', 'last_followup_at',
        'cargo_type', 'monthly_volume', 'decision_maker', 'current_forwarder', 'pain_points', 'entry_strategy'];
      const sets = [];
      const vals = [];
      fields.forEach(f => {
        if (data[f] !== undefined) {
          sets.push(`${f} = ?`);
          vals.push(data[f]);
        }
      });
      if (data.owner_id !== undefined) {
        sets.push('owner_id = ?');
        vals.push(data.owner_id);
      }
      sets.push('updated_at = ?');
      vals.push(new Date().toISOString());
      vals.push(id);

      db.prepare(`UPDATE customers SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    });

    updateAll();
    return { message: '更新成功' };
  },

  addFollowup(customerId, data) {
    const addAll = db.transaction(() => {
      db.prepare(
        'INSERT INTO followups (customer_id, user_id, followup_date, method, content, next_plan, next_time, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(customerId, data.user_id, data.followup_date, data.method || null, data.content, data.next_plan || null, data.next_time || null, new Date().toISOString());

      const now = new Date().toISOString();
      db.prepare(
        'UPDATE customers SET last_followup_at = ?, next_followup_at = ?, updated_at = ? WHERE id = ?'
      ).run(data.followup_date, data.next_time || null, now, customerId);
    });

    addAll();
    return { id: db.prepare('SELECT last_insert_rowid()').get() };
  },

  getOverdue(userId, isAdmin) {
    const today = new Date().toISOString().slice(0, 10);
    let query = `SELECT c.*, u.name as owner_name FROM customers c LEFT JOIN users u ON c.owner_id = u.id WHERE c.next_followup_at IS NOT NULL AND c.next_followup_at <= ? AND c.status NOT IN ('deal', 'lost')`;
    const params = [today];
    if (!isAdmin) {
      query += ' AND c.owner_id = ?';
      params.push(userId);
    }
    query += ' ORDER BY CASE c.grade WHEN \'A\' THEN 1 WHEN \'B\' THEN 2 WHEN \'C\' THEN 3 WHEN \'D\' THEN 4 ELSE 5 END, c.next_followup_at ASC';
    const rows = db.prepare(query).all(...params);
    return rows.map(c => ({
      ...c,
      overdue_days: Math.floor((Date.now() - new Date(c.next_followup_at).getTime()) / 86400000),
    }));
  },

  getToday(userId, isAdmin) {
    const today = new Date().toISOString().slice(0, 10);
    let query = `SELECT c.*, u.name as owner_name FROM customers c LEFT JOIN users u ON c.owner_id = u.id WHERE c.next_followup_at = ? AND c.status NOT IN ('deal', 'lost')`;
    const params = [today];
    if (!isAdmin) {
      query += ' AND c.owner_id = ?';
      params.push(userId);
    }
    query += ' ORDER BY CASE c.grade WHEN \'A\' THEN 1 WHEN \'B\' THEN 2 WHEN \'C\' THEN 3 WHEN \'D\' THEN 4 ELSE 5 END';
    return db.prepare(query).all(...params);
  },

  getGradeSuggestions(userId, isAdmin) {
    const suggestions = [];
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    let query = `SELECT * FROM customers WHERE status NOT IN ('deal', 'lost')`;
    const params = [];
    if (!isAdmin) {
      query += ' AND owner_id = ?';
      params.push(userId);
    }
    const customers = db.prepare(query).all(...params);

    for (const c of customers) {
      const followups = db.prepare(
        'SELECT * FROM followups WHERE customer_id = ? ORDER BY followup_date DESC'
      ).all(c.id);

      const lastFollowup = followups[0];
      const daysSinceLastFollowup = lastFollowup
        ? Math.floor((today - new Date(lastFollowup.followup_date)) / 86400000)
        : 999;

      if (c.grade === 'A' && daysSinceLastFollowup > 1) {
        suggestions.push({
          customer_id: c.id, company_name: c.company_name, current_grade: 'A', current_status: c.status,
          suggestion: 'urgent_followup', reason: `A级客户已${daysSinceLastFollowup}天未跟进，需紧急跟进`,
        });
      }
      if (c.grade === 'B' && daysSinceLastFollowup > 3) {
        suggestions.push({
          customer_id: c.id, company_name: c.company_name, current_grade: 'B', current_status: c.status,
          suggestion: 'followup_reminder', reason: `B级客户已${daysSinceLastFollowup}天未跟进（标准：3天）`,
        });
      }
      if (c.grade === 'C' && daysSinceLastFollowup > 7) {
        suggestions.push({
          customer_id: c.id, company_name: c.company_name, current_grade: 'C', current_status: c.status,
          suggestion: 'followup_reminder', reason: `C级客户已${daysSinceLastFollowup}天未跟进（标准：7天）`,
        });
      }
      if (c.grade === 'D' && daysSinceLastFollowup > 30) {
        suggestions.push({
          customer_id: c.id, company_name: c.company_name, current_grade: 'D', current_status: c.status,
          suggestion: 'followup_reminder', reason: `D级客户已${daysSinceLastFollowup}天未跟进（标准：30天）`,
        });
      }
      if (c.status === 'potential' && followups.length >= 2) {
        const recent2 = followups.slice(0, 2);
        const effectiveComm = recent2.filter(f => f.content && f.content.length > 20);
        if (effectiveComm.length >= 2) {
          suggestions.push({
            customer_id: c.id, company_name: c.company_name, current_grade: c.grade, current_status: c.status,
            suggestion: 'upgrade_status', reason: '连续2次有效跟进，建议升级为"已触达"',
          });
        }
      }
      if (c.status === 'communicated' && followups.length > 0) {
        const lastDate = new Date(followups[0].followup_date);
        const daysSince = Math.floor((today - lastDate) / 86400000);
        if (daysSince > 14) {
          suggestions.push({
            customer_id: c.id, company_name: c.company_name, current_grade: c.grade, current_status: c.status,
            suggestion: 'downgrade_status', reason: `有效沟通客户已${daysSince}天无新跟进，建议降为"潜在客户"`,
          });
        }
      }
      if (c.grade === 'C' && daysSinceLastFollowup > 60) {
        suggestions.push({
          customer_id: c.id, company_name: c.company_name, current_grade: 'C', current_status: c.status,
          suggestion: 'downgrade_grade', reason: `C级客户超${Math.floor(daysSinceLastFollowup / 30)}个月无互动，建议降为D级`,
        });
      }
    }
    return suggestions;
  },

  delete(id) {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!customer) return false;
    const deleteAll = db.transaction(() => {
      db.prepare('DELETE FROM quotes WHERE customer_id = ?').run(id);
      db.prepare('DELETE FROM grade_changes WHERE customer_id = ?').run(id);
      db.prepare('DELETE FROM followups WHERE customer_id = ?').run(id);
      db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    });
    deleteAll();
    return true;
  },

  exportList(userId, isAdmin) {
    let query = 'SELECT c.*, u.name as owner_name FROM customers c LEFT JOIN users u ON c.owner_id = u.id';
    const params = [];
    if (!isAdmin) {
      query += ' WHERE c.owner_id = ?';
      params.push(userId);
    }
    query += ' ORDER BY c.updated_at DESC';
    const rows = db.prepare(query).all(...params);
    const statusMap = { potential: '潜在客户', contacted: '已触达', communicated: '有效沟通', quoting: '报价中', trial: '试单中', deal: '已成交', lost: '已流失' };
    return rows.map(c => ({
      '公司名称': c.company_name,
      '联系人': c.contact_name || '',
      '职位': c.position || '',
      '电话': c.phone || '',
      '微信': c.wechat || '',
      '邮箱': c.email || '',
      '客户类型': c.customer_type || '',
      '等级': c.grade || '',
      '状态': statusMap[c.status] || c.status,
      '标签': c.tags || '',
      '备注': c.notes || '',
      '所属销售': c.owner_name || '',
      '创建时间': c.created_at || '',
      '最后跟进时间': c.last_followup_at || '',
    }));
  },

  exportFollowups(userId, isAdmin) {
    let query = `SELECT f.*, c.company_name as customer_company, c.contact_name as customer_contact, u.name as user_name
                 FROM followups f
                 LEFT JOIN customers c ON f.customer_id = c.id
                 LEFT JOIN users u ON f.user_id = u.id`;
    const params = [];
    if (!isAdmin) {
      query += ' WHERE f.user_id = ?';
      params.push(userId);
    }
    query += ' ORDER BY f.followup_date DESC';
    const rows = db.prepare(query).all(...params);
    const methodMap = { phone: '电话', wechat: '微信', email: '邮件', meeting: '面谈' };
    return rows.map(f => ({
      '客户名称': f.customer_company || '',
      '联系人': f.customer_contact || '',
      '跟进日期': f.followup_date || '',
      '跟进方式': methodMap[f.method] || f.method || '',
      '跟进内容': f.content || '',
      '下一步计划': f.next_plan || '',
      '跟进人': f.user_name || '',
      '创建时间': f.created_at || '',
    }));
  },

  getSalesList() {
    return db.prepare("SELECT id, name FROM users WHERE role IN ('sales', 'admin') ORDER BY id").all();
  },
};

// ===== 每日活动操作 =====
export const DailyActivityOps = {
  createOrUpdate(userId, data) {
    const today = new Date().toISOString().slice(0, 10);
    const existing = db.prepare('SELECT * FROM daily_activities WHERE user_id = ? AND date = ?').get(userId, today);
    const now = new Date().toISOString();

    if (existing) {
      db.prepare(
        `UPDATE daily_activities SET calls = ?, wechat_adds = ?, emails = ?, effective_comms = ?, quotes_sent = ?, crm_updates = ?, notes = ?, updated_at = ? WHERE id = ?`
      ).run(
        data.calls ?? existing.calls, data.wechat_adds ?? existing.wechat_adds,
        data.emails ?? existing.emails, data.effective_comms ?? existing.effective_comms,
        data.quotes_sent ?? existing.quotes_sent, data.crm_updates ?? existing.crm_updates,
        data.notes ?? existing.notes, now, existing.id
      );
      return db.prepare('SELECT * FROM daily_activities WHERE id = ?').get(existing.id);
    } else {
      const result = db.prepare(
        `INSERT INTO daily_activities (user_id, date, calls, wechat_adds, emails, effective_comms, quotes_sent, crm_updates, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(userId, today, data.calls || 0, data.wechat_adds || 0, data.emails || 0, data.effective_comms || 0, data.quotes_sent || 0, data.crm_updates || 0, data.notes || '', now, now);
      return db.prepare('SELECT * FROM daily_activities WHERE id = ?').get(result.lastInsertRowid);
    }
  },

  findByDate(userId, date) {
    return db.prepare('SELECT * FROM daily_activities WHERE user_id = ? AND date = ?').get(userId, date) || null;
  },

  findByRange(userId, isAdmin, start, end) {
    let query = 'SELECT a.*, u.name as user_name FROM daily_activities a LEFT JOIN users u ON a.user_id = u.id WHERE a.date >= ? AND a.date <= ?';
    const params = [start, end];
    if (!isAdmin) {
      query += ' AND a.user_id = ?';
      params.push(userId);
    }
    query += ' ORDER BY a.date DESC';
    return db.prepare(query).all(...params);
  },

  getStats(userId, isAdmin, period) {
    const now = new Date();
    let start;
    if (period === 'week') {
      start = new Date(now);
      start.setDate(start.getDate() - start.getDay() + 1);
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    const startStr = start.toISOString().slice(0, 10);
    const endStr = now.toISOString().slice(0, 10);

    let query = 'SELECT * FROM daily_activities WHERE date >= ? AND date <= ?';
    const params = [startStr, endStr];
    if (!isAdmin) {
      query += ' AND user_id = ?';
      params.push(userId);
    }
    const results = db.prepare(query).all(...params);

    const totals = {
      calls: 0, wechat_adds: 0, emails: 0, effective_comms: 0, quotes_sent: 0, crm_updates: 0, days: results.length,
    };
    results.forEach(a => {
      totals.calls += a.calls || 0;
      totals.wechat_adds += a.wechat_adds || 0;
      totals.emails += a.emails || 0;
      totals.effective_comms += a.effective_comms || 0;
      totals.quotes_sent += a.quotes_sent || 0;
      totals.crm_updates += a.crm_updates || 0;
    });

    const workingDays = Math.max(1, totals.days);
    return {
      ...totals,
      avg_calls: Math.round(totals.calls / workingDays * 10) / 10,
      avg_wechat: Math.round(totals.wechat_adds / workingDays * 10) / 10,
      avg_emails: Math.round(totals.emails / workingDays * 10) / 10,
      avg_effective_comms: Math.round(totals.effective_comms / workingDays * 10) / 10,
      avg_quotes: Math.round(totals.quotes_sent / workingDays * 10) / 10,
      avg_crm_updates: Math.round(totals.crm_updates / workingDays * 10) / 10,
      period,
      start_date: startStr,
      end_date: endStr,
      details: results.sort((a, b) => a.date.localeCompare(b.date)).map(a => ({
        ...a,
        user_name: db.prepare('SELECT name FROM users WHERE id = ?').get(a.user_id)?.name || null,
      })),
    };
  },
};

// ===== 报价操作 =====
export const QuoteOps = {
  create(data) {
    const result = db.prepare(
      `INSERT INTO quotes (customer_id, user_id, route, container_type, amount, currency, status, valid_until, notes, created_at, responded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(data.customer_id, data.user_id, data.route || '', data.container_type || '', data.amount || 0, data.currency || 'CNY', data.status || 'pending', data.valid_until || null, data.notes || '', new Date().toISOString(), null);
    return { id: result.lastInsertRowid };
  },

  findAll({ userId, isAdmin, status, page = 1, pageSize = 20 } = {}) {
    let conditions = [];
    let params = [];
    if (!isAdmin) {
      conditions.push('q.user_id = ?');
      params.push(userId);
    }
    if (status) {
      conditions.push('q.status = ?');
      params.push(status);
    }
    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM quotes q ${whereClause}`).get(...params);
    const total = countRow.cnt;

    const offset = (page - 1) * pageSize;
    const rows = db.prepare(
      `SELECT q.*, c.company_name as customer_name, u.name as user_name,
        CASE WHEN q.responded_at IS NOT NULL THEN ROUND((JULIANDAY(q.responded_at) - JULIANDAY(q.created_at)) * 24 * 10) / 10 ELSE NULL END as response_time_hours
       FROM quotes q
       LEFT JOIN customers c ON q.customer_id = c.id
       LEFT JOIN users u ON q.user_id = u.id
       ${whereClause}
       ORDER BY q.created_at DESC
       LIMIT ? OFFSET ?`
    ).all(...params, pageSize, offset);

    return { data: rows, total, page, pageSize };
  },

  update(id, data) {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(id);
    if (!quote) return null;

    const fields = ['route', 'container_type', 'amount', 'currency', 'status', 'valid_until', 'notes'];
    const sets = [];
    const vals = [];
    fields.forEach(f => {
      if (data[f] !== undefined) {
        sets.push(`${f} = ?`);
        vals.push(data[f]);
      }
    });

    if (['accepted', 'rejected'].includes(data.status) && !quote.responded_at) {
      sets.push('responded_at = ?');
      vals.push(new Date().toISOString());
    }

    vals.push(id);
    db.prepare(`UPDATE quotes SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    return { message: '更新成功' };
  },

  delete(id) {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(id);
    if (!quote) return false;
    db.prepare('DELETE FROM quotes WHERE id = ?').run(id);
    return true;
  },

  getStats(userId, isAdmin) {
    let query = 'SELECT * FROM quotes';
    const params = [];
    if (!isAdmin) {
      query += ' WHERE user_id = ?';
      params.push(userId);
    }
    const quotes = db.prepare(query).all(...params);

    const total = quotes.length;
    const pending = quotes.filter(q => q.status === 'pending').length;
    const accepted = quotes.filter(q => q.status === 'accepted').length;
    const rejected = quotes.filter(q => q.status === 'rejected').length;
    const expired = quotes.filter(q => q.status === 'expired').length;

    const respondedQuotes = quotes.filter(q => q.responded_at);
    const avgResponseTime = respondedQuotes.length > 0
      ? Math.round(respondedQuotes.reduce((sum, q) => {
          return sum + (new Date(q.responded_at) - new Date(q.created_at));
        }, 0) / respondedQuotes.length / 3600000 * 10) / 10
      : 0;

    const within30min = respondedQuotes.filter(q =>
      (new Date(q.responded_at) - new Date(q.created_at)) <= 1800000
    ).length;
    const responseRate = respondedQuotes.length > 0 ? Math.round(within30min / respondedQuotes.length * 100) : 0;

    return { total, pending, accepted, rejected, expired, avgResponseTime, responseRate };
  },
};

// ===== 周报操作 =====
export const WeeklyReportOps = {
  createOrUpdate(userId, data) {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const wsStr = weekStart.toISOString().slice(0, 10);
    const weStr = weekEnd.toISOString().slice(0, 10);
    const nowStr = new Date().toISOString();

    const existing = db.prepare('SELECT * FROM weekly_reports WHERE user_id = ? AND week_start = ?').get(userId, wsStr);

    if (existing) {
      db.prepare(
        `UPDATE weekly_reports SET new_customers = ?, effective_comms = ?, quotes_sent = ?, deals = ?, revenue = ?, top3_customers = ?, problems = ?, next_week_plan = ?, updated_at = ? WHERE id = ?`
      ).run(
        data.new_customers ?? existing.new_customers, data.effective_comms ?? existing.effective_comms,
        data.quotes_sent ?? existing.quotes_sent, data.deals ?? existing.deals,
        data.revenue ?? existing.revenue, JSON.stringify(data.top3_customers ?? JSON.parse(existing.top3_customers || '[]')),
        data.problems ?? existing.problems, data.next_week_plan ?? existing.next_week_plan,
        nowStr, existing.id
      );
      return db.prepare('SELECT * FROM weekly_reports WHERE id = ?').get(existing.id);
    } else {
      const result = db.prepare(
        `INSERT INTO weekly_reports (user_id, week_start, week_end, new_customers, effective_comms, quotes_sent, deals, revenue, top3_customers, problems, next_week_plan, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(userId, wsStr, weStr, data.new_customers || 0, data.effective_comms || 0, data.quotes_sent || 0, data.deals || 0, data.revenue || 0, JSON.stringify(data.top3_customers || []), data.problems || '', data.next_week_plan || '', nowStr, nowStr);
      return db.prepare('SELECT * FROM weekly_reports WHERE id = ?').get(result.lastInsertRowid);
    }
  },

  findAll(userId, isAdmin, page = 1, pageSize = 20) {
    let query = 'SELECT r.*, u.name as user_name FROM weekly_reports r LEFT JOIN users u ON r.user_id = u.id';
    const params = [];
    if (!isAdmin) {
      query += ' WHERE r.user_id = ?';
      params.push(userId);
    }
    const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM (${query})`).get(...params);
    const total = countRow.cnt;

    query += ' ORDER BY r.week_start DESC LIMIT ? OFFSET ?';
    const offset = (page - 1) * pageSize;
    const rows = db.prepare(query).all(...params, pageSize, offset);

    return { data: rows.map(r => ({ ...r, top3_customers: JSON.parse(r.top3_customers || '[]') })), total, page, pageSize };
  },

  getWeekStats(userId, isAdmin) {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1);
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEndStr = now.toISOString().slice(0, 10);

    let actQuery = 'SELECT * FROM daily_activities WHERE date >= ? AND date <= ?';
    const actParams = [weekStartStr, weekEndStr];
    if (!isAdmin) {
      actQuery += ' AND user_id = ?';
      actParams.push(userId);
    }
    const activities = db.prepare(actQuery).all(...actParams);

    const totalCalls = activities.reduce((s, a) => s + (a.calls || 0), 0);
    const totalEffectiveComms = activities.reduce((s, a) => s + (a.effective_comms || 0), 0);
    const totalQuotes = activities.reduce((s, a) => s + (a.quotes_sent || 0), 0);

    let custQuery = 'SELECT * FROM customers';
    const custParams = [];
    if (!isAdmin) {
      custQuery += ' WHERE owner_id = ?';
      custParams.push(userId);
    }
    const customers = db.prepare(custQuery).all(...custParams);

    const weekAgoStr = new Date(now.getTime() - 7 * 86400000).toISOString();
    const newCustomers = customers.filter(c => c.created_at >= weekAgoStr).length;
    const deals = customers.filter(c => c.status === 'deal').length;

    return {
      week_start: weekStartStr, week_end: weekEndStr,
      new_customers: newCustomers, effective_comms: totalEffectiveComms,
      quotes_sent: totalQuotes, total_calls: totalCalls,
      deals, days_recorded: activities.length,
    };
  },
};

// ===== 看板操作 =====
export const DashboardOps = {
  getData(userId, isAdmin, period = 'month') {
    const now = new Date();
    let dateFilter;
    switch (period) {
      case 'today':
        dateFilter = now.toISOString().slice(0, 10);
        break;
      case 'week':
        dateFilter = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
        break;
      case 'month':
        dateFilter = now.toISOString().slice(0, 7);
        break;
      default:
        dateFilter = null;
    }

    let custQuery = 'SELECT * FROM customers';
    const custParams = [];
    if (!isAdmin) {
      custQuery += ' WHERE owner_id = ?';
      custParams.push(userId);
    }
    const customers = db.prepare(custQuery).all(...custParams);
    const totalCustomers = customers.length;

    const statusMap = {};
    customers.forEach(c => { statusMap[c.status] = (statusMap[c.status] || 0) + 1; });
    const statusCounts = Object.entries(statusMap).map(([status, count]) => ({ status, count }));

    const gradeMap = {};
    customers.forEach(c => { gradeMap[c.grade] = (gradeMap[c.grade] || 0) + 1; });
    const gradeCounts = Object.entries(gradeMap).map(([grade, count]) => ({ grade, count })).sort((a, b) => a.grade.localeCompare(b.grade));

    const funnelStages = [
      { stage: '潜在客户', key: 'potential' },
      { stage: '已触达', key: 'contacted' },
      { stage: '有效沟通', key: 'communicated' },
      { stage: '报价中', key: 'quoting' },
      { stage: '试单中', key: 'trial' },
      { stage: '已成交', key: 'deal' },
    ];
    const funnel = funnelStages.map(s => ({ ...s, count: statusMap[s.key] || 0 }));
    for (let i = 1; i < funnel.length; i++) {
      const prev = funnel[i - 1].count;
      funnel[i].conversionRate = prev > 0 ? Math.round((funnel[i].count / prev) * 100) : 0;
    }

    let fuQuery = 'SELECT * FROM followups';
    const fuParams = [];
    if (!isAdmin) {
      fuQuery += ' WHERE user_id = ?';
      fuParams.push(userId);
    }
    let followups = db.prepare(fuQuery).all(...fuParams);
    if (dateFilter) {
      if (period === 'month') {
        followups = followups.filter(f => f.created_at && f.created_at.slice(0, 7) >= dateFilter);
      } else {
        followups = followups.filter(f => f.created_at && f.created_at.slice(0, 10) >= dateFilter);
      }
    }
    const totalFollowups = followups.length;

    const methodMap = {};
    followups.forEach(f => { if (f.method) methodMap[f.method] = (methodMap[f.method] || 0) + 1; });
    const methodCounts = Object.entries(methodMap).map(([method, count]) => ({ method, count }));

    const today = now.toISOString().slice(0, 10);
    const pendingFollowups = customers.filter(c =>
      c.next_followup_at && c.next_followup_at <= today && !['deal', 'lost'].includes(c.status)
    ).length;

    let teamRanking = [];
    if (isAdmin) {
      const allUsers = db.prepare("SELECT * FROM users WHERE role IN ('sales', 'admin')").all();
      teamRanking = allUsers.map(u => {
        const userCustomers = customers.filter(c => c.owner_id === u.id);
        const userFollowups = followups.filter(f => f.user_id === u.id);
        return {
          name: u.name, user_id: u.id,
          customer_count: userCustomers.length,
          deal_count: userCustomers.filter(c => c.status === 'deal').length,
          followup_count: userFollowups.length,
        };
      }).sort((a, b) => b.deal_count - a.deal_count || b.followup_count - a.followup_count);
    }

    const typeMap = {};
    customers.forEach(c => { if (c.customer_type) typeMap[c.customer_type] = (typeMap[c.customer_type] || 0) + 1; });
    const typeCounts = Object.entries(typeMap).map(([customer_type, count]) => ({ customer_type, count }));

    return { totalCustomers, statusCounts, gradeCounts, funnel, totalFollowups, methodCounts, pendingFollowups, teamRanking, typeCounts, period };
  },

  getKPI(userId, isAdmin, month) {
    const now = new Date();
    const targetMonth = month || now.toISOString().slice(0, 7);
    const monthStart = targetMonth + '-01';
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthEnd = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 0);
    const monthEndStr = monthEnd.toISOString().slice(0, 10);

    let workingDays = 0;
    for (let d = new Date(monthStart); d <= new Date(monthEnd); d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) workingDays++;
      if (d > now) break;
    }
    workingDays = Math.max(1, workingDays);

    let custQuery = 'SELECT * FROM customers';
    const custParams = [];
    if (!isAdmin) {
      custQuery += ' WHERE owner_id = ?';
      custParams.push(userId);
    }
    const customers = db.prepare(custQuery).all(...custParams);

    const newCustomers = customers.filter(c => c.created_at && c.created_at.slice(0, 7) === targetMonth).length;
    const dealCustomers = customers.filter(c => c.status === 'deal').length;

    let actQuery = 'SELECT * FROM daily_activities WHERE date >= ? AND date <= ?';
    const actParams = [monthStart, monthEndStr];
    if (!isAdmin) {
      actQuery += ' AND user_id = ?';
      actParams.push(userId);
    }
    const activities = db.prepare(actQuery).all(...actParams);

    const totalQuotes = activities.reduce((s, a) => s + (a.quotes_sent || 0), 0);
    const totalCalls = activities.reduce((s, a) => s + (a.calls || 0), 0);
    const avgDailyCalls = Math.round(totalCalls / workingDays * 10) / 10;
    const totalEffectiveComms = activities.reduce((s, a) => s + (a.effective_comms || 0), 0);
    const effectiveCommRate = totalCalls > 0 ? Math.round(totalEffectiveComms / totalCalls * 100) : 0;

    let fuQuery = 'SELECT * FROM followups WHERE followup_date >= ? AND followup_date <= ?';
    const fuParams = [monthStart, monthEndStr];
    if (!isAdmin) {
      fuQuery += ' AND user_id = ?';
      fuParams.push(userId);
    }
    const monthFollowups = db.prepare(fuQuery).all(...fuParams);
    const totalNeedFollowup = monthFollowups.length;
    let onTimeCount = 0;
    monthFollowups.forEach(f => {
      const customer = customers.find(c => c.id === f.customer_id);
      if (customer && customer.next_followup_at && f.followup_date <= customer.next_followup_at) {
        onTimeCount++;
      } else if (!customer || !customer.next_followup_at) {
        onTimeCount++;
      }
    });
    const followupTimelyRate = totalNeedFollowup > 0 ? Math.round(onTimeCount / totalNeedFollowup * 100) : 100;

    const quoteConversionRate = totalQuotes > 0 ? Math.round(dealCustomers / Math.max(totalQuotes, 1) * 100) : 0;
    const repurchaseRate = dealCustomers > 0 ? Math.round(dealCustomers / Math.max(customers.length, 1) * 100) : 0;

    const kpiItems = [
      { name: '新客户开发', target: 15, actual: newCustomers, unit: '家', desc: '月新增客户数' },
      { name: '报价数', target: 30, actual: totalQuotes, unit: '份', desc: '月发出报价数' },
      { name: '报价转化率', target: 15, actual: quoteConversionRate, unit: '%', desc: '成交数/报价数' },
      { name: '成交客户', target: 3, actual: dealCustomers, unit: '家', desc: '月成交客户数' },
      { name: '客户复购率', target: 60, actual: repurchaseRate, unit: '%', desc: '成交客户/总客户' },
      { name: '日均电话', target: 20, actual: avgDailyCalls, unit: '通', desc: '工作日均电话量' },
      { name: '有效沟通率', target: 30, actual: effectiveCommRate, unit: '%', desc: '有效沟通/电话总量' },
      { name: '跟进及时率', target: 95, actual: followupTimelyRate, unit: '%', desc: '按时跟进/总跟进' },
    ];

    kpiItems.forEach(item => {
      item.achieved = item.actual >= item.target;
      item.progress = item.unit === '%'
        ? Math.min(100, Math.round(item.actual / item.target * 100))
        : Math.min(100, Math.round(item.actual / item.target * 100));
    });

    let teamKPI = [];
    if (isAdmin) {
      const allUsers = db.prepare("SELECT * FROM users WHERE role IN ('sales', 'admin')").all();
      teamKPI = allUsers.map(u => {
        const uActs = db.prepare('SELECT * FROM daily_activities WHERE user_id = ? AND date >= ? AND date <= ?').all(u.id, monthStart, monthEndStr);
        const uCalls = uActs.reduce((s, a) => s + (a.calls || 0), 0);
        const uQuotes = uActs.reduce((s, a) => s + (a.quotes_sent || 0), 0);
        const uCusts = customers.filter(c => c.owner_id === u.id);
        return {
          user_id: u.id, name: u.name,
          new_customers: uCusts.filter(c => c.created_at && c.created_at.slice(0, 7) === targetMonth).length,
          quotes: uQuotes,
          deals: uCusts.filter(c => c.status === 'deal').length,
          avg_daily_calls: Math.round(uCalls / workingDays * 10) / 10,
        };
      });
    }

    return { month: targetMonth, working_days: workingDays, kpi_items: kpiItems, team_kpi: teamKPI };
  },

  getFunnelDiagnostics(userId, isAdmin) {
    let custQuery = 'SELECT * FROM customers';
    const custParams = [];
    if (!isAdmin) {
      custQuery += ' WHERE owner_id = ?';
      custParams.push(userId);
    }
    const customers = db.prepare(custQuery).all(...custParams);

    const statusMap = {};
    customers.forEach(c => { statusMap[c.status] = (statusMap[c.status] || 0) + 1; });

    const stages = [
      { from: 'potential', to: 'contacted', fromLabel: '潜在客户', toLabel: '已触达', target: 50 },
      { from: 'contacted', to: 'communicated', fromLabel: '已触达', toLabel: '有效沟通', target: 50 },
      { from: 'communicated', to: 'quoting', fromLabel: '有效沟通', toLabel: '报价', target: 60 },
      { from: 'quoting', to: 'trial', fromLabel: '报价', toLabel: '试单', target: 30 },
      { from: 'trial', to: 'deal', fromLabel: '试单', toLabel: '成交', target: 50 },
    ];

    const order = ['potential', 'contacted', 'communicated', 'quoting', 'trial', 'deal'];

    const diagnostics = stages.map(s => {
      const fromIdx = order.indexOf(s.from);
      const toIdx = order.indexOf(s.to);
      const afterCount = customers.filter(c => order.indexOf(c.status) >= toIdx).length;
      const baseCount = customers.filter(c => order.indexOf(c.status) >= fromIdx).length;
      const rate = baseCount > 0 ? Math.round(afterCount / baseCount * 100) : 0;
      const status = rate >= s.target ? 'green' : rate >= s.target * 0.7 ? 'yellow' : 'red';

      const suggestions = {
        'potential': '优化名单质量，提高触达话术',
        'contacted': '调整触达时间和话术',
        'communicated': '加强需求挖掘能力',
        'quoting': '优化报价方案和跟进策略',
        'trial': '提升服务质量和客户体验',
      };

      return {
        from_label: s.fromLabel, to_label: s.toLabel,
        target_rate: s.target, actual_rate: rate, status,
        suggestion: rate < s.target ? suggestions[s.from] : '达标',
        from_count: baseCount, to_count: afterCount,
      };
    });

    return diagnostics;
  },
};

// ===== 角色操作 =====
export const RoleOps = {
  findAll() {
    return db.prepare('SELECT * FROM roles ORDER BY id').all();
  },

  findById(id) {
    return db.prepare('SELECT * FROM roles WHERE id = ?').get(id) || null;
  },

  findByName(name) {
    return db.prepare('SELECT * FROM roles WHERE name = ?').get(name) || null;
  },

  create({ name, description }) {
    const existing = db.prepare('SELECT id FROM roles WHERE name = ?').get(name);
    if (existing) throw new Error('UNIQUE constraint failed: roles.name');
    const result = db.prepare(
      'INSERT INTO roles (name, description, is_system, created_at) VALUES (?, ?, 0, ?)'
    ).run(name, description || '', new Date().toISOString());
    return { id: result.lastInsertRowid };
  },

  update(id, { name, description }) {
    const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(id);
    if (!role) return false;
    if (role.is_system) {
      if (name && name !== role.name) throw new Error('系统内置角色不可改名');
    }
    db.prepare('UPDATE roles SET name = ?, description = ? WHERE id = ?')
      .run(name || role.name, description !== undefined ? description : role.description, id);
    return true;
  },

  delete(id) {
    const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(id);
    if (!role) return false;
    if (role.is_system) throw new Error('系统内置角色不可删除');
    const deleteAll = db.transaction(() => {
      db.prepare('DELETE FROM role_menus WHERE role_id = ?').run(id);
      db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(id);
      db.prepare('DELETE FROM roles WHERE id = ?').run(id);
    });
    deleteAll();
    return true;
  },

  getMenus(roleId) {
    return db.prepare('SELECT menu_key FROM role_menus WHERE role_id = ?').all(roleId).map(r => r.menu_key);
  },

  setMenus(roleId, menuKeys) {
    const setAll = db.transaction(() => {
      db.prepare('DELETE FROM role_menus WHERE role_id = ?').run(roleId);
      const insert = db.prepare('INSERT OR IGNORE INTO role_menus (role_id, menu_key) VALUES (?, ?)');
      for (const key of menuKeys) insert.run(roleId, key);
    });
    setAll();
  },

  getPermissions(roleId) {
    return db.prepare('SELECT permission_key FROM role_permissions WHERE role_id = ?').all(roleId).map(r => r.permission_key);
  },

  setPermissions(roleId, permKeys) {
    const setAll = db.transaction(() => {
      db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(roleId);
      const insert = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_key) VALUES (?, ?)');
      for (const key of permKeys) insert.run(roleId, key);
    });
    setAll();
  },

  getUserMenus(roleName) {
    if (roleName === 'admin') {
      return ['/', '/customers', '/reminders', '/daily-report', '/quotes', '/weekly-report', '/yunwuyun', '/tracking', '/wechat', '/sales', '/admin'];
    }
    const role = db.prepare('SELECT id FROM roles WHERE name = ?').get(roleName);
    if (!role) return [];
    return db.prepare('SELECT menu_key FROM role_menus WHERE role_id = ?').all(role.id).map(r => r.menu_key);
  },

  getUserPermissions(roleName) {
    if (roleName === 'admin') {
      return ['data:all'];
    }
    const role = db.prepare('SELECT id FROM roles WHERE name = ?').get(roleName);
    if (!role) return [];
    return db.prepare('SELECT permission_key FROM role_permissions WHERE role_id = ?').all(role.id).map(r => r.permission_key);
  },
};

export default { initDatabase, getDb, UserOps, CustomerOps, DailyActivityOps, QuoteOps, WeeklyReportOps, DashboardOps, RoleOps };