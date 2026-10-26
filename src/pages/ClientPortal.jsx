// 客户端门户 - 查看订单、统计、企业资料
import React, { useState, useEffect } from 'react';
import {
  Layout, Card, Table, Row, Col, Statistic, Input, Space, Button, Tag, Typography, message,
  Drawer, Modal, Tabs, Form, Upload, Image, Divider, DatePicker, Descriptions,
  Select, Spin, Tooltip, Alert,
} from 'antd';
import {
  LogoutOutlined, DashboardOutlined, FileTextOutlined,
  SearchOutlined, EyeOutlined, GlobalOutlined,
  UploadOutlined, UserOutlined, SaveOutlined, ReloadOutlined,
  DollarOutlined, DownloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

const BASE = '/api';

function ClientPortal() {
  const navigate = useNavigate();
  const [clientInfo, setClientInfo] = useState(null);
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailOrder, setDetailOrder] = useState(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('shipping-rates');
  const [licensePreview, setLicensePreview] = useState(null);
  const [form] = Form.useForm();

  const [rates, setRates] = useState([]);
  const [rateLoading, setRateLoading] = useState(false);
  const [rateError, setRateError] = useState('');
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [filterPol, setFilterPol] = useState('');
  const [filterPod, setFilterPod] = useState('');
  const [filterType, setFilterType] = useState('');
  const [polOptions, setPolOptions] = useState([]);
  const [podOptions, setPodOptions] = useState([]);
  const [typeOptions, setTypeOptions] = useState([]);
  const [activePolTab, setActivePolTab] = useState('');

  const token = localStorage.getItem('client_token');

  const fetchWithAuth = async (url, options = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${token}` },
    });
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('client_token');
      localStorage.removeItem('client_info');
      message.error('登录已过期，请重新登录');
      navigate('/client/login');
      return null;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      message.error(err.error || '请求失败');
      return null;
    }
    return res.json();
  };

  useEffect(() => {
    if (!token) {
      navigate('/client/login');
      return;
    }
    const info = localStorage.getItem('client_info');
    if (info) setClientInfo(JSON.parse(info));

    fetchStats();
    fetchOrders();
    fetchProfile();
  }, []);

  useEffect(() => {
    if (activeTab === 'shipping-rates') {
      fetchRateFilters();
      fetchShippingRates();
    }
  }, [activeTab]);

  const fetchProfile = async () => {
    const data = await fetchWithAuth(`${BASE}/client/me`);
    if (data) {
      setProfile(data);
      setLicensePreview(data.business_license || null);
      form.setFieldsValue({
        ...data,
        establish_date: data.establish_date ? dayjs(data.establish_date) : null,
      });
    }
  };

  const fetchStats = async () => {
    const data = await fetchWithAuth(`${BASE}/client/stats`);
    if (data) setStats(data);
  };

  const fetchOrders = async (page = 1, size = 20) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, size, search });
      const data = await fetchWithAuth(`${BASE}/client/orders?${params}`);
      if (data) {
        setOrders(data.data);
        setPagination({ current: data.page, pageSize: data.size, total: data.total });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchOrders(1, pagination.pageSize);
  };

  const handleTableChange = (pag) => {
    fetchOrders(pag.current, pag.pageSize);
  };

  const handlePreviewQuotation = async (batchId, itemId) => {
    try {
      setPreviewLoading(true);
      setPreviewData(null);
      setPreviewVisible(true);
      const result = await fetchWithAuth(`${BASE}/client/shipping-rates/batches/${batchId}/quotation-preview?item_id=${itemId}`);
      if (result?.data) setPreviewData(result.data);
      else { message.error('数据格式错误'); setPreviewVisible(false); }
    } catch (err) {
      message.error(err.message || '预览失败');
      setPreviewVisible(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownloadExcel = async (batchId, itemId) => {
    try {
      message.loading({ content: '正在生成报价单...', key: 'quotation-dl', duration: 0 });
      const resp = await fetch(`${BASE}/client/shipping-rates/batches/${batchId}/quotation?item_id=${itemId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const json = await resp.json();
        throw new Error(json.error || '生成失败');
      }
      const blob = await resp.blob();
      if (blob.size === 0) throw new Error('生成的文件为空');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `报价单_${previewData?.carrier || '报价'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      message.success({ content: '报价单已下载', key: 'quotation-dl', duration: 2 });
    } catch (err) {
      message.error({ content: err.message || '下载失败', key: 'quotation-dl', duration: 3 });
    }
  };

  const showDetail = async (record) => {
    const data = await fetchWithAuth(`${BASE}/client/orders/${record.job_id}`);
    if (data) {
      setDetailOrder(data);
      setDetailVisible(true);
    }
  };

  const fetchRateFilters = async () => {
    const data = await fetchWithAuth(`${BASE}/client/shipping-rates/filters`);
    if (data) {
      setPolOptions((data.pols || []).map(v => ({ label: v, value: v })));
      setPodOptions((data.pods || []).map(v => ({ label: v, value: v })));
      setTypeOptions((data.container_types || []).map(v => ({ label: v, value: v })));
    }
  };

  const fetchShippingRates = async () => {
    setRateLoading(true);
    setRateError('');
    try {
      const params = new URLSearchParams();
      if (filterPol) params.set('pol', filterPol);
      if (filterPod) params.set('pod', filterPod);
      if (filterType) params.set('container_type', filterType);
      const data = await fetchWithAuth(`${BASE}/client/shipping-rates?${params}`);
      if (data) {
        setRates(data.data || []);
      }
    } catch (err) {
      setRateError('加载失败：' + (err.message || '网络异常'));
    } finally {
      setRateLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('client_token');
    localStorage.removeItem('client_info');
    navigate('/client/login');
  };

  // 上传营业执照（base64）
  const handleLicenseUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result;
      setLicensePreview(base64);
      form.setFieldsValue({ business_license: base64 });
      message.success('营业执照已选择');
    };
    reader.readAsDataURL(file);
    return false;
  };

  // 保存企业资料
  const handleSaveProfile = async () => {
    try {
      const values = await form.validateFields();
      setProfileSaving(true);
      const payload = {
        ...values,
        establish_date: values.establish_date ? values.establish_date.format('YYYY-MM-DD') : null,
      };
      const data = await fetchWithAuth(`${BASE}/client/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (data) {
        message.success('企业资料保存成功');
        fetchProfile();
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error('保存失败');
    } finally {
      setProfileSaving(false);
    }
  };

  const orderColumns = [
    { title: '工作号', dataIndex: 'job_no', key: 'job_no', width: 130, fixed: 'left' },
    { title: '日期', dataIndex: 'job_date', key: 'job_date', width: 100, render: (v) => v?.slice(0, 10) },
    { title: 'SO号', dataIndex: 'so_no', key: 'so_no', width: 120 },
    { title: '船公司', dataIndex: 'carrier_name', key: 'carrier_name', width: 100 },
    { title: '船名/航次', key: 'vessel_voyage', width: 150,
      render: (_, r) => `${r.vessel || '-'} / ${r.voyage || '-'}` },
    { title: 'ETD', dataIndex: 'etd', key: 'etd', width: 100, render: (v) => v?.slice(0, 10) },
    { title: 'ETA', dataIndex: 'eta', key: 'eta', width: 100, render: (v) => v?.slice(0, 10) },
    { title: '目的国', dataIndex: 'dest_country', key: 'dest_country', width: 100 },
    { title: '提单号', dataIndex: 'bl_no_domestic', key: 'bl_no_domestic', width: 130 },
    { title: '品名', dataIndex: 'goods_name', key: 'goods_name', width: 150, ellipsis: true },
    { title: '件数', dataIndex: 'pieces', key: 'pieces', width: 70 },
    { title: '方数', dataIndex: 'goods_cbm', key: 'goods_cbm', width: 80, render: (v) => v?.toFixed(2) },
    { title: '毛重', dataIndex: 'gross_kgs', key: 'gross_kgs', width: 80, render: (v) => v?.toFixed(2) },
    {
      title: '状态', dataIndex: 'order_status', key: 'order_status', width: 80,
      render: (v) => {
        const map = { '已完成': 'green', '进行中': 'blue', '已取消': 'red' };
        return <Tag color={map[v] || 'default'}>{v || '-'}</Tag>;
      },
    },
    { title: '操作', key: 'action', width: 60, fixed: 'right',
      render: (_, record) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => showDetail(record)}>详情</Button>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'shipping-rates',
      label: <span><GlobalOutlined />海运报价</span>,
      children: (
        <Spin spinning={rateLoading} size="large">
          {rateError ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Alert type="error" message={rateError} showIcon style={{ marginBottom: 12 }} />
              <Button type="primary" icon={<ReloadOutlined />} onClick={() => fetchShippingRates()}>重试</Button>
            </div>
          ) : (
            <Card>
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={6}>
                  <Select placeholder="起运港" allowClear style={{ width: '100%' }}
                    value={filterPol || undefined}
                    onChange={v => setFilterPol(v || '')}
                    options={polOptions} />
                </Col>
                <Col span={6}>
                  <Select placeholder="目的港" allowClear style={{ width: '100%' }}
                    value={filterPod || undefined}
                    onChange={v => setFilterPod(v || '')}
                    options={podOptions} />
                </Col>
                <Col span={6}>
                  <Select placeholder="箱型" allowClear style={{ width: '100%' }}
                    value={filterType || undefined}
                    onChange={v => setFilterType(v || '')}
                    options={typeOptions} />
                </Col>
                <Col span={6}>
                  <Button icon={<ReloadOutlined />} onClick={fetchShippingRates}>刷新</Button>
                </Col>
              </Row>

              {rates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
                  <GlobalOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                  <div>暂无有效报价数据</div>
                </div>
              ) : (
                (() => {
                  const polMap = {};
                  rates.forEach(b => {
                    if (!polMap[b.pol]) polMap[b.pol] = [];
                    polMap[b.pol].push(b);
                  });
                  const pols = Object.keys(polMap);
                  const currentPol = activePolTab && pols.includes(activePolTab) ? activePolTab : pols[0] || '';
                  const items = currentPol ? (polMap[currentPol] || []) : [];
                  const podMap = {};
                  items.forEach(b => {
                    if (!podMap[b.pod]) podMap[b.pod] = [];
                    podMap[b.pod].push(b);
                  });

                  return (
                    <>
                      <Tabs
                        activeKey={currentPol}
                        onChange={setActivePolTab}
                        type="card"
                        size="small"
                        style={{ marginBottom: 12 }}
                        items={pols.map(pol => ({
                          key: pol,
                          label: <Space size={4}><Tag color="blue" style={{ margin: 0 }}>{pol}</Tag><Text type="secondary" style={{ fontSize: 12 }}>{polMap[pol].length}港</Text></Space>,
                        }))}
                      />
                      {Object.entries(podMap).map(([pod, batches]) => (
                        <Card
                          key={pod}
                          size="small"
                          style={{ marginBottom: 12 }}
                          title={
                            <Space size={8} wrap>
                              <Tag color="green" style={{ fontSize: 14, padding: '2px 10px' }}>{pod}</Tag>
                              {[...new Set(batches.map(b => b.container_type))].map(ct => (
                                <Tag key={ct}>{ct}</Tag>
                              ))}
                              <Text type="secondary" style={{ fontSize: 12 }}>{batches.length} 个批次</Text>
                            </Space>
                          }
                        >
                          <Table
                            dataSource={batches.flatMap(b => (b.items || []).map(item => ({
                              ...item, _containerType: b.container_type, _validFrom: b.valid_from, _validTo: b.valid_to, _notes: b.notes, _batchId: b.id,
                            })))}
                            rowKey={(r) => `${r.batch_id}_${r.id}`}
                            pagination={false}
                            size="small"
                            columns={[
                              { title: '船公司', dataIndex: 'carrier_name', width: 100, render: v => <Tag color="blue">{v}</Tag> },
                              { title: '箱型', dataIndex: '_containerType', width: 70, render: v => <Tag>{v}</Tag> },
                              { title: '船名航次', dataIndex: 'vessel_voyage', width: 170 },
                              { title: '海运费(USD)', dataIndex: 'freight_rate', width: 120, align: 'right', render: v => v ? <Text strong style={{ color: '#cf1322' }}>$ {v.toLocaleString()}</Text> : '-' },
                              { title: '航程', dataIndex: 'transit_days', width: 70, render: v => v ? <Tag color="purple">{v}天</Tag> : '-' },
                              { title: '备注', dataIndex: 'remarks', width: 100, render: v => v ? <Tag color="orange">{v}</Tag> : '-' },
                              { title: '操作', key: 'act', width: 80, render: (_, r) => <Button type="link" size="small" icon={<DollarOutlined />} onClick={() => handlePreviewQuotation(r._batchId, r.id)}>报价单</Button> },
                            ]}
                          />
                        </Card>
                      ))}
                    </>
                  );
                })()
              )}
            </Card>
          )}
        </Spin>
      ),
    },
    {
      key: 'orders',
      label: <span><DashboardOutlined />我的订单</span>,
      children: (
        <>
          {stats && (
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={6}>
                <Card><Statistic title="总订单数" value={stats.totalOrders} prefix={<FileTextOutlined />} /></Card>
              </Col>
              <Col span={6}>
                <Card><Statistic title="总件数" value={stats.totalPieces} suffix="件" /></Card>
              </Col>
              <Col span={6}>
                <Card><Statistic title="总方数" value={stats.totalVolume?.toFixed(2)} suffix="CBM" /></Card>
              </Col>
              <Col span={6}>
                <Card><Statistic title="总毛重" value={stats.totalGrossKgs?.toFixed(2)} suffix="KGS" /></Card>
              </Col>
            </Row>
          )}
          <Card
            title={<Space><DashboardOutlined /><span>订单列表</span></Space>}
            extra={
              <Input.Search
                placeholder="搜索工作号/SO号/提单号..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onSearch={handleSearch}
                style={{ width: 260 }}
                enterButton={<SearchOutlined />}
              />
            }
          >
            <Table
              columns={orderColumns}
              dataSource={orders}
              rowKey="job_id"
              loading={loading}
              pagination={{ ...pagination, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
              onChange={handleTableChange}
              scroll={{ x: 1400 }}
              size="small"
            />
          </Card>
        </>
      ),
    },
    {
      key: 'profile',
      label: <span><UserOutlined />企业资料</span>,
      children: (
        <Card
          title={<Space><UserOutlined /><span>企业资料</span></Space>}
          extra={
            <Button type="primary" icon={<SaveOutlined />} loading={profileSaving} onClick={handleSaveProfile}>
              保存资料
            </Button>
          }
        >
          <Form form={form} layout="vertical">
            <Title level={5}>营业执照</Title>
            <Row gutter={24}>
              <Col span={8}>
                <Form.Item name="business_license" label="营业执照图片">
                  <Upload
                    beforeUpload={handleLicenseUpload}
                    showUploadList={false}
                    accept="image/*"
                    maxCount={1}
                  >
                    {licensePreview ? (
                      <Image
                        src={licensePreview}
                        style={{ width: 200, height: 140, objectFit: 'contain', border: '1px dashed #d9d9d9', borderRadius: 4, cursor: 'pointer' }}
                        preview={{ mask: '点击更换' }}
                      />
                    ) : (
                      <div style={{
                        width: 200, height: 140, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        border: '1px dashed #d9d9d9', borderRadius: 4, cursor: 'pointer',
                        background: '#fafafa',
                      }}>
                        <UploadOutlined style={{ fontSize: 24, color: '#999' }} />
                        <Text type="secondary" style={{ marginTop: 8 }}>点击上传</Text>
                      </div>
                    )}
                  </Upload>
                </Form.Item>
              </Col>
              <Col span={16}>
                <Form.Item name="business_license_no" label="统一社会信用代码">
                  <Input placeholder="18位统一社会信用代码" maxLength={18} />
                </Form.Item>
                <Form.Item name="company_type" label="公司类型">
                  <Input placeholder="如：有限责任公司、股份有限公司" />
                </Form.Item>
              </Col>
            </Row>

            <Divider />
            <Title level={5}>工商信息</Title>
            <Row gutter={24}>
              <Col span={8}>
                <Form.Item name="legal_person" label="法人代表">
                  <Input placeholder="法人代表姓名" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="registered_capital" label="注册资本">
                  <Input placeholder="如：100万元" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="establish_date" label="成立日期">
                  <DatePicker style={{ width: '100%' }} placeholder="选择成立日期" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={24}>
              <Col span={12}>
                <Form.Item name="tax_no" label="税号">
                  <Input placeholder="税务登记号" />
                </Form.Item>
              </Col>
            </Row>

            <Divider />
            <Title level={5}>联系信息</Title>
            <Row gutter={24}>
              <Col span={8}>
                <Form.Item name="contact_name" label="联系人">
                  <Input placeholder="联系人姓名" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="contact_phone" label="联系电话">
                  <Input placeholder="联系电话" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="contact_email" label="联系邮箱">
                  <Input placeholder="联系邮箱" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={24}>
              <Col span={8}>
                <Form.Item name="mobile_no" label="手机号">
                  <Input placeholder="手机号" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="office_tel" label="办公电话">
                  <Input placeholder="办公电话" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={24}>
              <Col span={24}>
                <Form.Item name="client_addr" label="公司地址">
                  <Input.TextArea rows={2} placeholder="公司详细地址" />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Card>
      ),
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{
        background: 'linear-gradient(135deg, #1B4F72, #2E86C1)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 56,
      }}>
        <Space>
          <GlobalOutlined style={{ fontSize: 24, color: '#fff' }} />
          <Title level={4} style={{ color: '#fff', margin: 0 }}>美鸥物流 · 客户平台</Title>
        </Space>
        <Space>
          {clientInfo && (
            <Text style={{ color: 'rgba(255,255,255,0.85)' }}>
              欢迎，{clientInfo.client_name} ({clientInfo.login_account || clientInfo.client_code})
            </Text>
          )}
          <Button ghost icon={<LogoutOutlined />} onClick={handleLogout}>退出</Button>
        </Space>
      </Header>

      <Content style={{ padding: 24, background: '#f0f2f5' }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} size="large" />
      </Content>

      {/* 订单详情抽屉 */}
      <Drawer
        title="订单详情"
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={640}
      >
        {detailOrder && (
          <Descriptions column={2} bordered size="small" labelStyle={{ fontWeight: 'bold' }}>
            <Descriptions.Item label="工作号">{detailOrder.job_no}</Descriptions.Item>
            <Descriptions.Item label="日期">{detailOrder.job_date?.slice(0, 10)}</Descriptions.Item>
            <Descriptions.Item label="SO号">{detailOrder.so_no}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={detailOrder.order_status === '已完成' ? 'green' : 'blue'}>{detailOrder.order_status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="船公司">{detailOrder.carrier_name}</Descriptions.Item>
            <Descriptions.Item label="船名">{detailOrder.vessel}</Descriptions.Item>
            <Descriptions.Item label="航次">{detailOrder.voyage}</Descriptions.Item>
            <Descriptions.Item label="ETD">{detailOrder.etd?.slice(0, 10)}</Descriptions.Item>
            <Descriptions.Item label="ETA">{detailOrder.eta?.slice(0, 10)}</Descriptions.Item>
            <Descriptions.Item label="ATD">{detailOrder.atd?.slice(0, 10)}</Descriptions.Item>
            <Descriptions.Item label="装运类型">{detailOrder.transport_type}</Descriptions.Item>
            <Descriptions.Item label="装载类型">{detailOrder.loadtype}</Descriptions.Item>
            <Descriptions.Item label="交货国">{detailOrder.delivery_country}</Descriptions.Item>
            <Descriptions.Item label="目的国">{detailOrder.dest_country}</Descriptions.Item>
            <Descriptions.Item label="提单号">{detailOrder.bl_no_domestic}</Descriptions.Item>
            <Descriptions.Item label="海外提单">{detailOrder.bl_no_overseas}</Descriptions.Item>
            <Descriptions.Item label="品名">{detailOrder.goods_name}</Descriptions.Item>
            <Descriptions.Item label="件数">{detailOrder.pieces}</Descriptions.Item>
            <Descriptions.Item label="方数">{detailOrder.goods_cbm?.toFixed(2)}</Descriptions.Item>
            <Descriptions.Item label="毛重">{detailOrder.gross_kgs?.toFixed(2)}</Descriptions.Item>
            <Descriptions.Item label="箱数">{detailOrder.cnt_nos}</Descriptions.Item>
            <Descriptions.Item label="计费类型">{detailOrder.charging_type}</Descriptions.Item>
            <Descriptions.Item label="AR金额">{detailOrder.ar_amt?.toFixed(2)}</Descriptions.Item>
            <Descriptions.Item label="AP金额">{detailOrder.ap_amt?.toFixed(2)}</Descriptions.Item>
            <Descriptions.Item label="运费吨">{detailOrder.freighttons?.toFixed(2)}</Descriptions.Item>
            <Descriptions.Item label="关账状态">{detailOrder.close_status}</Descriptions.Item>
            <Descriptions.Item label="同步时间">{detailOrder.synced_at?.slice(0, 16)}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      <Modal
        title={previewData ? `${previewData.carrier} - ${previewData.pol} → ${previewData.pod} (${previewData.ct}) 报价单预览` : '报价单预览'}
        open={previewVisible}
        onCancel={() => { setPreviewVisible(false); setPreviewData(null); }}
        width={1100}
        footer={[
          <Button key="close" onClick={() => { setPreviewVisible(false); setPreviewData(null); }}>关闭</Button>,
          <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={() => {
            if (previewData) handleDownloadExcel(previewData._batchId, previewData._itemId);
          }}>下载 Excel</Button>,
        ]}
      >
        {previewLoading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
        ) : previewData ? (
          <div style={{ background: '#fff' }}>
            <div style={{ marginBottom: 16, padding: '12px 20px', background: '#1F4E79', color: '#fff', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong style={{ fontSize: 15, color: '#fff' }}>费用明细</Text>
              <Text style={{ color: '#FFD700', fontSize: 12 }}>说明：报价根据实际询价，关根据客户的产品名最终确认</Text>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24, fontSize: 13 }}>
              <thead>
                <tr>
                  {['费用项目', '计费标准', '费用金额', '备注'].map(h => (
                    <th key={h} style={{ border: '1px solid #d9d9d9', padding: '10px 12px', background: '#1F4E79', color: '#fff', fontWeight: 'bold', textAlign: 'center' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.items.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ border: '1px solid #e8e8e8', padding: '8px 12px', fontWeight: idx === 0 ? 'bold' : 'normal', background: idx === 0 ? '#f0f7ff' : (idx === previewData.items.length - 1 ? '#fffbe6' : '#fff') }}>{item.name}</td>
                    <td style={{ border: '1px solid #e8e8e8', padding: '8px 12px', textAlign: 'center' }}>{item.standard}</td>
                    <td style={{ border: '1px solid #e8e8e8', padding: '8px 12px', textAlign: 'center', color: '#cf1322', fontWeight: 'bold' }}>{item.amount}</td>
                    <td style={{ border: '1px solid #e8e8e8', padding: '8px 12px', fontSize: 12, lineHeight: 1.6, color: '#666' }}>{item.note}</td>
                  </tr>
                ))}
                <tr style={{ background: '#fffbe6' }}>
                  <td style={{ border: '1px solid #faad14', padding: '10px 12px', fontWeight: 'bold' }}>合计费用</td>
                  <td style={{ border: '1px solid #faad14', padding: '10px 12px', textAlign: 'center', fontWeight: 'bold' }}>一票总计</td>
                  <td colSpan="2" style={{ border: '1px solid #faad14', padding: '10px 12px', fontWeight: 'bold', color: '#cf1322', fontSize: 14 }}>
                    USD {previewData.total.usd.toLocaleString()} + RMB {previewData.total.rmb.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ marginBottom: 12, padding: '10px 20px', background: '#5B9BD5', color: '#fff', borderRadius: 6, fontWeight: 'bold', fontSize: 14, textAlign: 'center' }}>
              尾程派送注意事项
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['费用项目', '免费期', '超期标准', '备注'].map(h => (
                    <th key={h} style={{ border: '1px solid #d9d9d9', padding: '8px 12px', background: '#5B9BD5', color: '#fff', fontWeight: 'bold', textAlign: 'center', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.notes.map((note, idx) => (
                  <tr key={idx}>
                    <td style={{ border: '1px solid #e8e8e8', padding: '8px 12px' }}>{note.name}</td>
                    <td style={{ border: '1px solid #e8e8e8', padding: '8px 12px', textAlign: 'center' }}>{note.free}</td>
                    <td style={{ border: '1px solid #e8e8e8', padding: '8px 12px', textAlign: 'center', color: '#1890ff' }}>{note.fee}</td>
                    <td style={{ border: '1px solid #e8e8e8', padding: '8px 12px', fontSize: 12, color: '#666', lineHeight: 1.5 }}>{note.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Modal>
    </Layout>
  );
}

export default ClientPortal;