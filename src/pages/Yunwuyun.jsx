// FMS数据同步展示页面 - 完整CRUD + 详情
import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Card, Input, Button, Tag, Space, Tabs, Typography,
  Row, Col, Statistic, message, Tooltip, Select, Drawer, Modal, Form,
  InputNumber, DatePicker, Popconfirm, Descriptions, Divider, Checkbox, Popover,
} from 'antd';
import {
  SearchOutlined, SyncOutlined, ReloadOutlined,
  DollarOutlined, FileTextOutlined, TeamOutlined, TrophyOutlined,
  PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, SettingOutlined,
} from '@ant-design/icons';
import { yunwuyunAPI } from '../api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

const ORDER_STATUS_MAP = {
  10: { text: '未提交', color: 'default' },
  20: { text: '已提交', color: 'blue' },
  30: { text: '已审核', color: 'cyan' },
  40: { text: '已放舱', color: 'geekblue' },
  50: { text: '已装柜', color: 'purple' },
  60: { text: '已发运', color: 'orange' },
  70: { text: '在途', color: 'gold' },
  80: { text: '已到港', color: 'green' },
  90: { text: '已完成', color: 'success' },
  100: { text: '已关闭', color: 'default' },
};

const CLOSE_STATUS_MAP = {
  10: { text: '未关闭', color: 'green' },
  20: { text: '已关闭', color: 'default' },
};

function formatMoney(val) {
  if (val == null || val === 0) return '-';
  return val.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(val) {
  if (!val) return '-';
  return dayjs(val).format('YYYY-MM-DD HH:mm');
}

function Yunwuyun() {
  const [activeTab, setActiveTab] = useState('orders');
  const [syncing, setSyncing] = useState(false);

  const [stats, setStats] = useState({
    orderCount: 0, customerCount: 0, totalAR: 0, totalAP: 0, totalProfit: 0,
  });

  // 订单
  const [orders, setOrders] = useState([]);
  const [orderTotal, setOrderTotal] = useState(0);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderParams, setOrderParams] = useState({ page: 1, pageSize: 20, search: '', status: '' });

  // 客户
  const [customers, setCustomers] = useState([]);
  const [custTotal, setCustTotal] = useState(0);
  const [custLoading, setCustLoading] = useState(false);
  const [custParams, setCustParams] = useState({
    page: 1, pageSize: 20, search: '', inuse: '',
  });

  // 客户账号管理
  const [accountModal, setAccountModal] = useState({ visible: false, customer: null, mode: '' });
  const [accountName, setAccountName] = useState('');
  const [accountPwd, setAccountPwd] = useState('');
  const [accountLoading, setAccountLoading] = useState(false);

  // 详情抽屉
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [detailType, setDetailType] = useState('order');

  // 编辑弹窗
  const [editVisible, setEditVisible] = useState(false);
  const [editData, setEditData] = useState(null);
  const [editType, setEditType] = useState('order');
  const [editLoading, setEditLoading] = useState(false);
  const [form] = Form.useForm();

  // 列设置
  const [colSettingVisible, setColSettingVisible] = useState(false);
  const [orderVisibleCols, setOrderVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem('yunwuyun_order_cols');
      return saved ? JSON.parse(saved) : null;
    } catch (_) {
      return null;
    }
  });

  const fetchStats = useCallback(async () => {
    try {
      const res = await yunwuyunAPI.getStats();
      if (res.success) {
        setStats({
          orderCount: res.orderCount || 0,
          customerCount: res.customerCount || 0,
          totalAR: res.totalAR || 0,
          totalAP: res.totalAP || 0,
          totalProfit: res.totalProfit || 0,
        });
      }
    } catch (_) {}
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const fetchOrders = useCallback(async () => {
    setOrderLoading(true);
    try {
      const res = await yunwuyunAPI.getOrders(orderParams);
      setOrders(res.data || []);
      setOrderTotal(res.total || 0);
    } catch (err) {
      message.error('获取订单失败: ' + err.message);
    } finally {
      setOrderLoading(false);
    }
  }, [orderParams]);

  const fetchCustomers = useCallback(async () => {
    setCustLoading(true);
    try {
      const res = await yunwuyunAPI.getCustomers({
        page: custParams.page,
        size: custParams.pageSize,
        search: custParams.search,
        inuse: custParams.inuse,
      });
      setCustomers(res.data || []);
      setCustTotal(res.total || 0);
    } catch (err) {
      message.error('获取客户失败: ' + err.message);
    } finally {
      setCustLoading(false);
    }
  }, [custParams]);

  useEffect(() => {
    if (activeTab === 'orders') fetchOrders();
    else fetchCustomers();
  }, [activeTab, fetchOrders, fetchCustomers]);

  const handleSync = async (type) => {
    setSyncing(true);
    try {
      const fn = type === 'orders' ? yunwuyunAPI.syncOrders : yunwuyunAPI.syncCustomers;
      const res = await fn();
      if (res.success) {
        message.success(`同步完成: ${res.totalSynced || res.total} 条`);
        fetchStats();
        if (type === 'orders') fetchOrders();
        else fetchCustomers();
      } else {
        message.error(res.error || '同步失败');
      }
    } catch (err) {
      message.error('同步失败: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  // 查看详情
  const handleViewDetail = async (type, id) => {
    try {
      const fn = type === 'order' ? yunwuyunAPI.getOrderDetail : yunwuyunAPI.getCustomerDetail;
      const res = await fn(id);
      if (res.success) {
        setDetailType(type);
        setDetailData(res.data);
        setDetailVisible(true);
      } else {
        message.error(res.error || '获取详情失败');
      }
    } catch (err) {
      message.error('获取详情失败: ' + err.message);
    }
  };

  // 打开编辑
  const handleOpenEdit = (type, record) => {
    setEditType(type);
    setEditData(record);
    const values = { ...record };
    if (values.job_date) values.job_date = dayjs(values.job_date);
    if (values.etd) values.etd = dayjs(values.etd);
    if (values.eta) values.eta = dayjs(values.eta);
    form.setFieldsValue(values);
    setEditVisible(true);
  };

  // 打开新增
  const handleOpenAdd = (type) => {
    setEditType(type);
    setEditData(null);
    form.resetFields();
    setEditVisible(true);
  };

  // 保存
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setEditLoading(true);

      const data = { ...values };
      if (data.job_date) data.job_date = dayjs(data.job_date).format('YYYY-MM-DD HH:mm:ss');
      if (data.etd) data.etd = dayjs(data.etd).format('YYYY-MM-DD HH:mm:ss');
      if (data.eta) data.eta = dayjs(data.eta).format('YYYY-MM-DD HH:mm:ss');

      if (editType === 'order') {
        if (editData) {
          await yunwuyunAPI.updateOrder(editData.job_id, data);
          message.success('订单更新成功');
        } else {
          await yunwuyunAPI.createOrder(data);
          message.success('订单创建成功');
        }
        fetchOrders();
      } else {
        if (editData) {
          await yunwuyunAPI.updateCustomer(editData.client_id, data);
          message.success('客户更新成功');
        } else {
          await yunwuyunAPI.createCustomer(data);
          message.success('客户创建成功');
        }
        fetchCustomers();
      }
      setEditVisible(false);
      fetchStats();
    } catch (err) {
      if (err?.errorFields) return;
      message.error('操作失败: ' + (err.message || ''));
    } finally {
      setEditLoading(false);
    }
  };

  // 删除
  const handleAccountAction = (customer, mode) => {
    setAccountModal({ visible: true, customer, mode });
    setAccountName(customer.login_account || customer.client_code || '');
    setAccountPwd('');
  };

  const handleAccountSubmit = async () => {
    if (accountModal.mode === 'enable') {
      if (!accountName || !accountName.trim()) {
        message.warning('请输入登录账号');
        return;
      }
      if (!accountPwd || accountPwd.length < 4) {
        message.warning('密码长度至少4位');
        return;
      }
    }
    if (accountModal.mode === 'reset') {
      if (!accountPwd || accountPwd.length < 4) {
        message.warning('密码长度至少4位');
        return;
      }
    }
    setAccountLoading(true);
    try {
      const id = accountModal.customer.client_id;
      let res;
      if (accountModal.mode === 'enable') {
        res = await yunwuyunAPI.enableLogin(id, accountName.trim(), accountPwd);
      } else if (accountModal.mode === 'disable') {
        res = await yunwuyunAPI.disableLogin(id);
      } else {
        res = await yunwuyunAPI.resetCustomerPassword(id, accountPwd);
      }
      if (res.success) {
        message.success(res.message);
        setAccountModal({ visible: false, customer: null, mode: '' });
        fetchCustomers();
      } else {
        message.error(res.error || '操作失败');
      }
    } catch (err) {
      message.error('操作失败: ' + err.message);
    } finally {
      setAccountLoading(false);
    }
  };

  const handleDelete = async (type, id) => {
    try {
      const fn = type === 'order' ? yunwuyunAPI.deleteOrder : yunwuyunAPI.deleteCustomer;
      const res = await fn(id);
      if (res.success) {
        message.success('删除成功');
        if (type === 'order') fetchOrders();
        else fetchCustomers();
        fetchStats();
      } else {
        message.error(res.error || '删除失败');
      }
    } catch (err) {
      message.error('删除失败: ' + err.message);
    }
  };

  const ALL_ORDER_COLUMNS = [
    { key: 'job_no', title: '工作单号', dataIndex: 'job_no', width: 140, fixed: 'left',
      render: (t) => <Text strong>{t}</Text> },
    { key: 'so_no', title: '订舱号', dataIndex: 'so_no', width: 130,
      render: (t) => t || '-' },
    { key: 'client_name', title: '客户', dataIndex: 'client_name', width: 120,
      render: (t, r) => <Tooltip title={r.client_code}>{t}</Tooltip> },
    { key: 'job_type', title: '业务类型', dataIndex: 'job_type', width: 80 },
    { key: 'transport_type', title: '运输方式', dataIndex: 'transport_type', width: 80,
      render: (t) => t || '-' },
    { key: 'loadtype', title: '装柜方式', dataIndex: 'loadtype', width: 80,
      render: (t) => t || '-' },
    { key: 'vessel', title: '船名', dataIndex: 'vessel', width: 150, ellipsis: true },
    { key: 'voyage', title: '航次', dataIndex: 'voyage', width: 80 },
    { key: 'etd', title: 'ETD', dataIndex: 'etd', width: 110,
      render: (t) => t ? dayjs(t).format('YYYY-MM-DD') : '-' },
    { key: 'eta', title: 'ETA', dataIndex: 'eta', width: 110,
      render: (t) => t ? dayjs(t).format('YYYY-MM-DD') : '-' },
    { key: 'cnt_nos', title: '柜号', dataIndex: 'cnt_nos', width: 120, ellipsis: true,
      render: (t) => t || '-' },
    { key: 'goods_name', title: '品名', dataIndex: 'goods_name', width: 120, ellipsis: true,
      render: (t) => t || '-' },
    { key: 'pieces', title: '件数', dataIndex: 'pieces', width: 80, align: 'right',
      render: (v) => v != null ? v : '-' },
    { key: 'goods_cbm', title: '体积(CBM)', dataIndex: 'goods_cbm', width: 100, align: 'right',
      render: (v) => v != null ? v.toFixed(3) : '-' },
    { key: 'gross_kgs', title: '毛重(KGS)', dataIndex: 'gross_kgs', width: 100, align: 'right',
      render: (v) => v != null ? v.toFixed(3) : '-' },
    { key: 'ar_amt', title: '应收(AR)', dataIndex: 'ar_amt', width: 110, align: 'right',
      render: (v) => <Text style={{ color: v > 0 ? '#1677ff' : '#999' }}>{formatMoney(v)}</Text> },
    { key: 'ap_amt', title: '应付(AP)', dataIndex: 'ap_amt', width: 110, align: 'right',
      render: (v) => <Text style={{ color: v > 0 ? '#ff4d4f' : '#999' }}>{formatMoney(v)}</Text> },
    { key: 'gr_oss', title: '毛利', dataIndex: 'gr_oss', width: 110, align: 'right',
      render: (v) => {
        const color = v > 0 ? '#52c41a' : v < 0 ? '#ff4d4f' : '#999';
        return <Text style={{ color }}>{formatMoney(v)}</Text>;
      }},
    { key: 'order_status', title: '订单状态', dataIndex: 'order_status', width: 90,
      render: (v) => {
        const info = ORDER_STATUS_MAP[v] || { text: v, color: 'default' };
        return <Tag color={info.color}>{info.text}</Tag>;
      }},
    { key: 'close_status', title: '关闭状态', dataIndex: 'close_status', width: 80,
      render: (v) => {
        const info = CLOSE_STATUS_MAP[v] || { text: v, color: 'default' };
        return <Tag color={info.color}>{info.text}</Tag>;
      }},
    { key: 'bl_no_domestic', title: '国内提单号', dataIndex: 'bl_no_domestic', width: 130,
      render: (t) => t || '-' },
    { key: 'delivery_country', title: '送货国家', dataIndex: 'delivery_country', width: 100,
      render: (t) => t || '-' },
    { key: 'dest_country', title: '目的国家', dataIndex: 'dest_country', width: 100,
      render: (t) => t || '-' },
    { key: 'inserted_by', title: '创建人', dataIndex: 'inserted_by', width: 100 },
    { key: 'job_date', title: '创建日期', dataIndex: 'job_date', width: 110,
      render: (t) => t ? dayjs(t).format('YYYY-MM-DD') : '-' },
    { key: 'action', title: '操作', width: 180, fixed: 'right',
      render: (_, r) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />}
            onClick={() => handleViewDetail('order', r.job_id)}>详情</Button>
          <Button type="link" size="small" icon={<EditOutlined />}
            onClick={() => handleOpenEdit('order', r)}>编辑</Button>
          <Popconfirm title="确认删除此订单？" onConfirm={() => handleDelete('order', r.job_id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const DEFAULT_ORDER_COL_KEYS = ALL_ORDER_COLUMNS.map(c => c.key);

  const orderColumns = (() => {
    const keys = orderVisibleCols || DEFAULT_ORDER_COL_KEYS;
    const map = Object.fromEntries(ALL_ORDER_COLUMNS.map(c => [c.key, c]));
    return keys.map(k => map[k]).filter(Boolean);
  })();

  const saveOrderCols = (keys) => {
    setOrderVisibleCols(keys);
    localStorage.setItem('yunwuyun_order_cols', JSON.stringify(keys));
  };

  const moveCol = (from, to) => {
    const keys = [...(orderVisibleCols || DEFAULT_ORDER_COL_KEYS)];
    const [item] = keys.splice(from, 1);
    keys.splice(to, 0, item);
    saveOrderCols(keys);
  };

  const toggleCol = (key, checked) => {
    const keys = orderVisibleCols || DEFAULT_ORDER_COL_KEYS;
    if (checked) {
      if (!keys.includes(key)) {
        saveOrderCols([...keys, key]);
      }
    } else {
      saveOrderCols(keys.filter(k => k !== key));
    }
  };

  const customerColumns = [
    { title: '客户编码', dataIndex: 'client_code', key: 'client_code', width: 120,
      render: (t) => <Text strong>{t}</Text> },
    { title: '客户名称', dataIndex: 'client_name', key: 'client_name', width: 180 },
    { title: '简称', dataIndex: 'client_abbr', key: 'client_abbr', width: 100 },
    { title: '英文名', dataIndex: 'client_name_eng', key: 'client_name_eng', width: 180, ellipsis: true },
    { title: '客户类型', dataIndex: 'client_type', key: 'client_type', width: 100,
      render: (t) => t || '-' },
    { title: '分类', dataIndex: 'client_class', key: 'client_class', width: 100,
      render: (t) => t || '-' },
    { title: '销售', dataIndex: 'sales_name', key: 'sales_name', width: 100 },
    { title: '操作员', dataIndex: 'op_name', key: 'op_name', width: 100 },
    { title: '客服', dataIndex: 'cs_name', key: 'cs_name', width: 100 },
    { title: '所属组织', dataIndex: 'org_name', key: 'org_name', width: 180, ellipsis: true },
    { title: '国家', dataIndex: 'country_name', key: 'country_name', width: 100 },
    { title: '客户端', dataIndex: 'login_enabled', key: 'login_enabled', width: 80,
      render: (v) => v ? <Tag color="green">已开通</Tag> : <Tag color="default">未开通</Tag> },
    { title: '操作', key: 'action', width: 260, fixed: 'right',
      render: (_, r) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />}
            onClick={() => handleViewDetail('customer', r.client_id)}>详情</Button>
          <Button type="link" size="small" icon={<EditOutlined />}
            onClick={() => handleOpenEdit('customer', r)}>编辑</Button>
          {r.login_enabled ? (
            <>
              <Button type="link" size="small"
                onClick={() => handleAccountAction(r, 'reset')}>重置密码</Button>
              <Button type="link" size="small" danger
                onClick={() => handleAccountAction(r, 'disable')}>关闭登录</Button>
            </>
          ) : (
            <Button type="link" size="small" style={{ color: '#52c41a' }}
              onClick={() => handleAccountAction(r, 'enable')}>开通登录</Button>
          )}
          <Popconfirm title="确认删除此客户？" onConfirm={() => handleDelete('customer', r.client_id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>FMS数据同步</Title>
        </Col>
        <Col>
          <Space>
            <Button
              icon={<SyncOutlined spin={syncing} />}
              onClick={() => handleSync(activeTab === 'orders' ? 'orders' : 'customers')}
              loading={syncing}
            >
              同步{activeTab === 'orders' ? '订单' : '客户'}
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                fetchStats();
                activeTab === 'orders' ? fetchOrders() : fetchCustomers();
              }}
            >
              刷新
            </Button>
          </Space>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="订单总数" value={stats.orderCount} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="客户总数" value={stats.customerCount} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="应收合计(AR)"
              value={stats.totalAR}
              precision={2}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="毛利合计"
              value={stats.totalProfit}
              precision={2}
              prefix={<TrophyOutlined />}
              valueStyle={{ color: stats.totalProfit >= 0 ? '#52c41a' : '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
          {
            key: 'orders',
            label: `订单管理 (${orderTotal})`,
            children: (
              <div>
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col flex="auto">
                    <Space>
                      <Input.Search
                        placeholder="搜索工作单号 / 客户名称 / 客户编码"
                        allowClear
                        onSearch={(v) => setOrderParams((p) => ({ ...p, search: v, page: 1 }))}
                        style={{ width: 350 }}
                      />
                      <Select
                        placeholder="订单状态"
                        allowClear
                        style={{ width: 130 }}
                        onChange={(v) => setOrderParams((p) => ({ ...p, status: v || '', page: 1 }))}
                        options={Object.entries(ORDER_STATUS_MAP).map(([k, v]) => ({
                          value: k, label: v.text,
                        }))}
                      />
                    </Space>
                  </Col>
                  <Col>
                    <Space>
                      <Button type="primary" icon={<PlusOutlined />}
                        onClick={() => handleOpenAdd('order')}>新增订单</Button>
                      <Popover
                        trigger="click"
                        open={colSettingVisible}
                        onOpenChange={setColSettingVisible}
                        title="列设置"
                        content={
                          <div style={{ width: 260, maxHeight: 400, overflowY: 'auto' }}>
                            {ALL_ORDER_COLUMNS.map((col, idx) => {
                              const keys = orderVisibleCols || DEFAULT_ORDER_COL_KEYS;
                              const visible = keys.includes(col.key);
                              const vi = keys.indexOf(col.key);
                              const isFirst = vi === 0;
                              const isLast = vi === keys.length - 1;
                              return (
                                <div key={col.key} style={{
                                  display: 'flex', alignItems: 'center', padding: '4px 0',
                                  borderBottom: '1px solid #f0f0f0',
                                }}>
                                  <Checkbox
                                    checked={visible}
                                    onChange={(e) => toggleCol(col.key, e.target.checked)}
                                    style={{ flex: 1 }}
                                  >
                                    {col.title}
                                  </Checkbox>
                                  {visible && (
                                    <Space size={0}>
                                      <Button
                                        type="text" size="small"
                                        disabled={isFirst}
                                        onClick={() => moveCol(vi, vi - 1)}
                                        style={{ fontSize: 12 }}
                                      >↑</Button>
                                      <Button
                                        type="text" size="small"
                                        disabled={isLast}
                                        onClick={() => moveCol(vi, vi + 1)}
                                        style={{ fontSize: 12 }}
                                      >↓</Button>
                                    </Space>
                                  )}
                                </div>
                              );
                            })}
                            <div style={{ marginTop: 8, textAlign: 'right' }}>
                              <Button size="small"
                                onClick={() => { saveOrderCols(DEFAULT_ORDER_COL_KEYS); setColSettingVisible(false); }}>
                                恢复默认
                              </Button>
                            </div>
                          </div>
                        }
                      >
                        <Button icon={<SettingOutlined />}>列设置</Button>
                      </Popover>
                    </Space>
                  </Col>
                </Row>
                <Table
                  columns={orderColumns}
                  dataSource={orders}
                  rowKey="job_id"
                  loading={orderLoading}
                  scroll={{ x: 3200 }}
                  pagination={{
                    current: orderParams.page,
                    pageSize: orderParams.pageSize,
                    total: orderTotal,
                    showSizeChanger: true,
                    showTotal: (t) => `共 ${t} 条`,
                    onChange: (p, s) => setOrderParams((prev) => ({ ...prev, page: p, pageSize: s })),
                  }}
                />
              </div>
            ),
          },
          {
            key: 'customers',
            label: `客户管理 (${custTotal})`,
            children: (
              <div>
                <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
                  <Col flex="auto">
                    <Space wrap>
                      <Input.Search
                        placeholder="输入文字搜索（客户名称/编码/分类/类型/销售/国家/联系人等）"
                        allowClear
                        onSearch={(v) => setCustParams((p) => ({ ...p, search: v, page: 1 }))}
                        style={{ width: 420 }}
                      />
                      <Select
                        placeholder="状态"
                        allowClear
                        style={{ width: 100 }}
                        value={custParams.inuse || undefined}
                        onChange={(v) => setCustParams((p) => ({ ...p, inuse: v || '', page: 1 }))}
                        options={[
                          { value: '1', label: '启用' },
                          { value: '0', label: '停用' },
                        ]}
                      />
                    </Space>
                  </Col>
                  <Col>
                    <Button type="primary" icon={<PlusOutlined />}
                      onClick={() => handleOpenAdd('customer')}>新增客户</Button>
                  </Col>
                </Row>
                <Table
                  columns={customerColumns}
                  dataSource={customers}
                  rowKey="client_id"
                  loading={custLoading}
                  scroll={{ x: 1800 }}
                  pagination={{
                    current: custParams.page,
                    pageSize: custParams.pageSize,
                    total: custTotal,
                    showSizeChanger: true,
                    showTotal: (t) => `共 ${t} 条`,
                    onChange: (p, s) => setCustParams((prev) => ({ ...prev, page: p, pageSize: s })),
                  }}
                />
              </div>
            ),
          },
        ]} />
      </Card>

      {/* 详情抽屉 */}
      <Drawer
        title={detailType === 'order' ? '订单详情' : '客户详情'}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={720}
        extra={
          detailData && (
            <Space>
              <Button type="primary" icon={<EditOutlined />}
                onClick={() => { setDetailVisible(false); handleOpenEdit(detailType, detailData); }}>
                编辑
              </Button>
              <Popconfirm
                title={`确认删除此${detailType === 'order' ? '订单' : '客户'}？`}
                onConfirm={() => {
                  handleDelete(detailType, detailData[detailType === 'order' ? 'job_id' : 'client_id']);
                  setDetailVisible(false);
                }}>
                <Button danger icon={<DeleteOutlined />}>删除</Button>
              </Popconfirm>
            </Space>
          )
        }
      >
        {detailData && detailType === 'order' && (
          <>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="工作单号" span={2}>
                <Text strong>{detailData.job_no}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="业务类型">{detailData.job_type}</Descriptions.Item>
              <Descriptions.Item label="运输方式">{detailData.transport_type || '-'}</Descriptions.Item>
              <Descriptions.Item label="客户名称">{detailData.client_name}</Descriptions.Item>
              <Descriptions.Item label="客户编码">{detailData.client_code}</Descriptions.Item>
              <Descriptions.Item label="客户简称">{detailData.client_abbr}</Descriptions.Item>
              <Descriptions.Item label="英文名">{detailData.client_name_eng || '-'}</Descriptions.Item>
              <Descriptions.Item label="船名">{detailData.vessel || '-'}</Descriptions.Item>
              <Descriptions.Item label="航次">{detailData.voyage || '-'}</Descriptions.Item>
              <Descriptions.Item label="ETD">{formatDate(detailData.etd)}</Descriptions.Item>
              <Descriptions.Item label="ETA">{formatDate(detailData.eta)}</Descriptions.Item>
              <Descriptions.Item label="ATD">{formatDate(detailData.atd)}</Descriptions.Item>
              <Descriptions.Item label="订舱号">{detailData.so_no || '-'}</Descriptions.Item>
              <Descriptions.Item label="国内提单号">{detailData.bl_no_domestic || '-'}</Descriptions.Item>
              <Descriptions.Item label="海外提单号">{detailData.bl_no_overseas || '-'}</Descriptions.Item>
              <Descriptions.Item label="船东单号">{detailData.carrier_jobno || '-'}</Descriptions.Item>
              <Descriptions.Item label="装柜方式">{detailData.loadtype || '-'}</Descriptions.Item>
              <Descriptions.Item label="stowType">{detailData.stow_type ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="collectType">{detailData.collect_type ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="费用类型">{detailData.charging_type || '-'}</Descriptions.Item>
              <Descriptions.Item label="deliveryFeeCC">{detailData.delivery_fee_cc ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="送货国家">{detailData.delivery_country || '-'}</Descriptions.Item>
              <Descriptions.Item label="目的国家">{detailData.dest_country || '-'}</Descriptions.Item>
              <Descriptions.Item label="仓库编码">{detailData.warehouse_code || '-'}</Descriptions.Item>
              <Descriptions.Item label="supplyChannel">{detailData.supply_channel_code || '-'}</Descriptions.Item>
              <Descriptions.Item label="supplyChannelName">{detailData.supply_channel_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="收货渠道">{detailData.channel_receive_code || '-'}</Descriptions.Item>
              <Descriptions.Item label="收货渠道名称">{detailData.channel_receive_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="柜号">{detailData.cnt_nos || '-'}</Descriptions.Item>
              <Descriptions.Item label="费用代码">{detailData.charging_codes || '-'}</Descriptions.Item>
              <Descriptions.Item label="品名">{detailData.goods_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="货值">{detailData.goods_value || '-'}</Descriptions.Item>
              <Descriptions.Item label="件数">{detailData.pieces ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="毛重(KGS)">{detailData.gross_kgs ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="体积(CBM)">{detailData.goods_cbm ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="净重(KGS)">{detailData.net_kgs ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="客户体积">{detailData.client_total_volume ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="客户件数">{detailData.client_total_pieces ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="客户重量">{detailData.client_total_weight ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="客户计费重">{detailData.client_billing_weight ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="箱数">{detailData.box_total_qty ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="箱重">{detailData.box_total_weight ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="箱体积">{detailData.box_total_volume ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="预计数量">{detailData.estimate_quantity_total ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="goodsCycode">{detailData.goods_cycode || '-'}</Descriptions.Item>
              <Descriptions.Item label="baseCyCode">{detailData.base_cy_code || '-'}</Descriptions.Item>
              <Descriptions.Item label="freighttons">{detailData.freighttons ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="clientQuoteFreighttons">{detailData.client_quote_freighttons ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="订单变更">{detailData.order_change_type ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="settlerType">{detailData.client_settler_type ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>{detailData.job_remarks || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建人">{detailData.inserted_by || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建日期">{formatDate(detailData.job_date)}</Descriptions.Item>
            </Descriptions>

            <Divider>财务信息</Divider>
            <Descriptions column={3} size="small" bordered>
              <Descriptions.Item label="应收(AR)">
                <Text style={{ color: detailData.ar_amt > 0 ? '#1677ff' : '#999' }}>
                  {formatMoney(detailData.ar_amt)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="应付(AP)">
                <Text style={{ color: detailData.ap_amt > 0 ? '#ff4d4f' : '#999' }}>
                  {formatMoney(detailData.ap_amt)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="毛利">
                <Text style={{ color: detailData.gr_oss > 0 ? '#52c41a' : detailData.gr_oss < 0 ? '#ff4d4f' : '#999' }}>
                  {formatMoney(detailData.gr_oss)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="AR数">{detailData.ar_count ?? 0}</Descriptions.Item>
              <Descriptions.Item label="AP数">{detailData.ap_count ?? 0}</Descriptions.Item>
              <Descriptions.Item label="问题数">{detailData.latest_problem_count ?? 0}</Descriptions.Item>
              <Descriptions.Item label="评论数">{detailData.comment_count ?? 0}</Descriptions.Item>
              <Descriptions.Item label="订单状态">
                <Tag color={(ORDER_STATUS_MAP[detailData.order_status] || {}).color || 'default'}>
                  {(ORDER_STATUS_MAP[detailData.order_status] || {}).text || detailData.order_status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="关闭状态">
                <Tag color={(CLOSE_STATUS_MAP[detailData.close_status] || {}).color || 'default'}>
                  {(CLOSE_STATUS_MAP[detailData.close_status] || {}).text || detailData.close_status}
                </Tag>
              </Descriptions.Item>
            </Descriptions>
          </>
        )}

        {detailData && detailType === 'customer' && (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="客户编码" span={2}>
              <Text strong>{detailData.client_code}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="客户名称">{detailData.client_name}</Descriptions.Item>
            <Descriptions.Item label="简称">{detailData.client_abbr || '-'}</Descriptions.Item>
            <Descriptions.Item label="英文名" span={2}>{detailData.client_name_eng || '-'}</Descriptions.Item>
            <Descriptions.Item label="客户类型">{detailData.client_type || '-'}</Descriptions.Item>
            <Descriptions.Item label="分类">{detailData.client_class || '-'}</Descriptions.Item>
            <Descriptions.Item label="英文分类">{detailData.client_class_eng || '-'}</Descriptions.Item>
            <Descriptions.Item label="客户属性">{detailData.client_property ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="同行业">{detailData.client_same_industry ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="settlerType">{detailData.settler_type ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="国家">{detailData.country_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="国家编码">{detailData.country_code || '-'}</Descriptions.Item>
            <Descriptions.Item label="省份">{detailData.province_state || '-'}</Descriptions.Item>
            <Descriptions.Item label="地址" span={2}>{detailData.client_addr || '-'}</Descriptions.Item>
            <Descriptions.Item label="邮编">{detailData.addr_postcode || '-'}</Descriptions.Item>
            <Descriptions.Item label="手机">{detailData.mobile_no || '-'}</Descriptions.Item>
            <Descriptions.Item label="电话">{detailData.office_tel || '-'}</Descriptions.Item>
            <Descriptions.Item label="统一社会信用代码">{detailData.uni_credit_code || '-'}</Descriptions.Item>
            <Descriptions.Item label="联系人">{detailData.contact_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="销售">{detailData.sales_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="操作员">{detailData.op_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="客服">{detailData.cs_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="CSM">{detailData.csm_staff || '-'}</Descriptions.Item>
            <Descriptions.Item label="业务人员">{detailData.staff_name_biz || '-'}</Descriptions.Item>
            <Descriptions.Item label="所属组织" span={2}>{detailData.org_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="组织编码">{detailData.org_code || '-'}</Descriptions.Item>
            <Descriptions.Item label="组织英文名">{detailData.org_name_eng || '-'}</Descriptions.Item>
            <Descriptions.Item label="catalog">{detailData.catalog_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="catalogEng">{detailData.catalog_name_eng || '-'}</Descriptions.Item>
            <Descriptions.Item label="客户来源">{detailData.client_source_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="来源英文">{detailData.client_source_name_eng || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">{detailData.inuse === 1 ? '启用' : '停用'}</Descriptions.Item>
            <Descriptions.Item label="创建人">{detailData.inserted_by || '-'}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{formatDate(detailData.insert_time)}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{formatDate(detailData.update_time)}</Descriptions.Item>
            <Descriptions.Item label="更新人">{detailData.updated_by || '-'}</Descriptions.Item>
            <Descriptions.Item label="最后同步" span={2}>{formatDate(detailData.synced_at)}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      {/* 编辑/新增弹窗 */}
      <Modal
        title={editData ? (editType === 'order' ? '编辑订单' : '编辑客户') : (editType === 'order' ? '新增订单' : '新增客户')}
        open={editVisible}
        onCancel={() => setEditVisible(false)}
        onOk={handleSave}
        confirmLoading={editLoading}
        width={800}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {editType === 'order' ? (
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="job_no" label="工作单号" rules={[{ required: true, message: '请输入工作单号' }]}>
                  <Input disabled={!!editData} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="job_type" label="业务类型">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="client_name" label="客户名称">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="client_code" label="客户编码">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="order_status" label="订单状态">
                  <Select options={Object.entries(ORDER_STATUS_MAP).map(([k, v]) => ({ value: Number(k), label: v.text }))} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="close_status" label="关闭状态">
                  <Select options={Object.entries(CLOSE_STATUS_MAP).map(([k, v]) => ({ value: Number(k), label: v.text }))} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="transport_type" label="运输方式">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="vessel" label="船名">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="voyage" label="航次">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="loadtype" label="装柜方式">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="etd" label="ETD">
                  <DatePicker showTime style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="eta" label="ETA">
                  <DatePicker showTime style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="ar_amt" label="应收(AR)">
                  <InputNumber style={{ width: '100%' }} precision={2} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="ap_amt" label="应付(AP)">
                  <InputNumber style={{ width: '100%' }} precision={2} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="gr_oss" label="毛利">
                  <InputNumber style={{ width: '100%' }} precision={2} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="freighttons" label="freighttons">
                  <InputNumber style={{ width: '100%' }} precision={6} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="goods_value" label="货值">
                  <InputNumber style={{ width: '100%' }} precision={2} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="pieces" label="件数">
                  <InputNumber style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="gross_kgs" label="毛重(KGS)">
                  <InputNumber style={{ width: '100%' }} precision={3} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="goods_cbm" label="体积(CBM)">
                  <InputNumber style={{ width: '100%' }} precision={3} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="net_kgs" label="净重(KGS)">
                  <InputNumber style={{ width: '100%' }} precision={3} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="so_no" label="订舱号">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="carrier_jobno" label="船东单号">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="bl_no_domestic" label="国内提单号">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="bl_no_overseas" label="海外提单号">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="cnt_nos" label="柜号">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="goods_name" label="品名">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="delivery_country" label="送货国家">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="dest_country" label="目的国家">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="warehouse_code" label="仓库编码">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="supply_channel_code" label="supplyChannel">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="channel_receive_code" label="收货渠道">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item name="job_remarks" label="备注">
                  <TextArea rows={2} />
                </Form.Item>
              </Col>
            </Row>
          ) : (
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="client_code" label="客户编码" rules={[{ required: true, message: '请输入客户编码' }]}>
                  <Input disabled={!!editData} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="client_name" label="客户名称" rules={[{ required: true, message: '请输入客户名称' }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="client_abbr" label="简称">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="client_name_eng" label="英文名">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="client_type" label="客户类型">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="client_class" label="分类">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="inuse" label="状态">
                  <Select options={[{ value: 1, label: '启用' }, { value: 0, label: '停用' }]} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="sales_name" label="销售">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="op_name" label="操作">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="cs_name" label="客服">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="csm_staff" label="CSM">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="contact_name" label="联系人">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="mobile_no" label="手机">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="office_tel" label="电话">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="country_name" label="国家">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="province_state" label="省份">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item name="client_addr" label="地址">
                  <TextArea rows={2} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="org_name" label="所属组织">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="client_source_name" label="客户来源">
                  <Input />
                </Form.Item>
              </Col>
            </Row>
          )}
        </Form>
      </Modal>

      {/* 客户账号管理弹窗 */}
      <Modal
        title={
          accountModal.mode === 'enable' ? '开通客户端登录' :
          accountModal.mode === 'reset' ? '重置客户密码' : '关闭客户端登录'
        }
        open={accountModal.visible}
        onOk={accountModal.mode === 'disable' ? handleAccountSubmit : handleAccountSubmit}
        onCancel={() => setAccountModal({ visible: false, customer: null, mode: '' })}
        confirmLoading={accountLoading}
        okText="确认"
        cancelText="取消"
        destroyOnClose
      >
        {accountModal.mode === 'disable' ? (
          <p>确认关闭客户 <strong>{accountModal.customer?.client_name}</strong> 的客户端登录权限？</p>
        ) : (
          <>
            <p style={{ marginBottom: 12 }}>
              客户：<strong>{accountModal.customer?.client_name}</strong>（{accountModal.customer?.client_code}）
            </p>
            <Form layout="vertical">
              {accountModal.mode === 'enable' && (
                <Form.Item label="登录账号" required>
                  <Input
                    placeholder="客户登录时使用的账号"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                  />
                </Form.Item>
              )}
              <Form.Item label={accountModal.mode === 'enable' ? '设置密码' : '新密码'} required>
                <Input.Password
                  placeholder="请输入至少4位密码"
                  value={accountPwd}
                  onChange={(e) => setAccountPwd(e.target.value)}
                  minLength={4}
                />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </div>
  );
}

export default Yunwuyun;