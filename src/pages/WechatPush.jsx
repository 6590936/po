// 企业微信推送管理（自建应用）
import React, { useState, useEffect } from 'react';
import {
  Card, Table, Row, Col, Form, Input, Button, Space, Tag, Typography, message,
  Modal, Select, Tabs, Spin,
} from 'antd';
import {
  SendOutlined, SettingOutlined, RobotOutlined, WechatOutlined,
  HistoryOutlined, LinkOutlined, ApiOutlined, ReloadOutlined, SaveOutlined,
  CheckCircleOutlined, SearchOutlined,
} from '@ant-design/icons';
import { wechatAPI, yunwuyunAPI } from '../api';

const { Title, Text, Paragraph } = Typography;

function WechatPush() {
  const [activeTab, setActiveTab] = useState('config');
  const [aiConfig, setAiConfig] = useState({});
  const [configLoading, setConfigLoading] = useState(false);
  const [form] = Form.useForm();

  // 客户列表（用于 chatid 配置）
  const [customers, setCustomers] = useState([]);
  const [custLoading, setCustLoading] = useState(false);

  // 推送
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [pushing, setPushing] = useState(false);

  // 日志
  const [logs, setLogs] = useState([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logLoading, setLogLoading] = useState(false);
  const [logPage, setLogPage] = useState(1);

  // 群聊配置弹窗
  const [chatidModal, setChatidModal] = useState({ visible: false, customer: null });
  const [chatidForm] = Form.useForm();

  // 群聊列表
  const [groupChats, setGroupChats] = useState([]);
  const [chatFetching, setChatFetching] = useState(false);

  // RPA队列
  const [rpaQueue, setRpaQueue] = useState([]);
  const [rpaTotal, setRpaTotal] = useState(0);
  const [rpaPending, setRpaPending] = useState(0);
  const [rpaLoading, setRpaLoading] = useState(false);

  useEffect(() => {
    fetchConfig();
    fetchCustomers();
  }, []);

  const fetchConfig = async () => {
    setConfigLoading(true);
    try {
      const res = await wechatAPI.getConfig();
      setAiConfig(res);
      form.setFieldsValue(res);
    } catch (err) {
      message.error('加载配置失败');
    } finally {
      setConfigLoading(false);
    }
  };

  const fetchCustomers = async () => {
    setCustLoading(true);
    try {
      const res = await yunwuyunAPI.getCustomers({ page: 1, pageSize: 500 });
      setCustomers(res.data || []);
    } catch {} finally {
      setCustLoading(false);
    }
  };

  const fetchOrders = async (clientId) => {
    if (!clientId) { setOrders([]); return; }
    setOrderLoading(true);
    try {
      const res = await yunwuyunAPI.getOrders({ client_id: clientId, page: 1, pageSize: 50 });
      setOrders(res.data || []);
    } catch {} finally {
      setOrderLoading(false);
    }
  };

  const fetchLogs = async (page = 1) => {
    setLogLoading(true);
    try {
      const res = await wechatAPI.getLogs({ page, pageSize: 20 });
      setLogs(res.data || []);
      setLogTotal(res.total || 0);
      setLogPage(page);
    } catch {} finally {
      setLogLoading(false);
    }
  };

  const fetchGroupChats = async () => {
    setChatFetching(true);
    try {
      const res = await wechatAPI.getGroupChats();
      if (res.success) {
        setGroupChats(res.data || []);
        message.success(`拉取到 ${res.data?.length || 0} 个客户群`);
      } else {
        message.error(res.error || '拉取失败');
      }
    } catch (err) {
      message.error('拉取群聊列表失败');
    } finally {
      setChatFetching(false);
    }
  };

  const fetchRpaQueue = async () => {
    setRpaLoading(true);
    try {
      const res = await wechatAPI.getRpaQueue();
      setRpaQueue(res.data || []);
      setRpaTotal(res.total || 0);
      setRpaPending(res.pending || 0);
    } catch {} finally {
      setRpaLoading(false);
    }
  };

  const handleSaveConfig = async (values) => {
    try {
      await wechatAPI.saveConfig(values);
      message.success('配置保存成功');
      fetchConfig();
    } catch (err) {
      message.error('保存失败');
    }
  };

  const handleTestConnection = async () => {
    try {
      const res = await wechatAPI.testConnection();
      if (res.success) message.success(res.message);
      else message.error(res.error);
    } catch (err) {
      message.error('连接测试失败');
    }
  };

  const handleTestSend = async (chatid) => {
    if (!chatid) {
      message.warning('请先填写群聊 chatid');
      return;
    }
    try {
      const res = await wechatAPI.testSend(chatid);
      if (res.success) message.success(res.message);
      else message.error(res.error);
    } catch (err) {
      message.error('测试发送失败');
    }
  };

  const handleSaveChatid = async () => {
    try {
      const values = await chatidForm.validateFields();
      await wechatAPI.saveCustomerChatid(chatidModal.customer.client_id, values);
      message.success('群聊配置保存成功');
      setChatidModal({ visible: false, customer: null });
      fetchCustomers();
    } catch (err) {
      if (err.errorFields) return;
      message.error('保存失败');
    }
  };

  const handlePush = async () => {
    if (!selectedClient) { message.warning('请选择客户'); return; }
    if (selectedOrders.length === 0) { message.warning('请选择要推送的订单'); return; }

    const customer = customers.find(c => c.client_id === selectedClient);
    if (!customer?.wechat_webhook && !customer?.wechat_group_name && !customer?.wechat_chatid) {
      message.warning('该客户未配置推送通道，请先在「客户群聊配置」中设置 Webhook 或群名称');
      return;
    }

    setPushing(true);
    try {
      const res = await wechatAPI.pushOrders({
        client_id: selectedClient,
        order_ids: selectedOrders,
      });
      if (res.success) {
        message.success(res.message);
        setSelectedOrders([]);
      } else {
        message.error(res.error);
      }
    } catch (err) {
      message.error('推送失败');
    } finally {
      setPushing(false);
    }
  };

  const customerColumns = [
    { title: '客户编码', dataIndex: 'client_code', width: 120 },
    { title: '客户名称', dataIndex: 'client_name', width: 180 },
    { title: 'Webhook', dataIndex: 'wechat_webhook', width: 80,
      render: (v) => v ? <Tag color="blue">内部群</Tag> : <Tag color="default">-</Tag> },
    { title: 'RPA群名', dataIndex: 'wechat_group_name', width: 120, render: (v) => v || <Text type="secondary">-</Text> },
    { title: '推送通道', key: 'channel', width: 100,
      render: (_, r) => {
        const has = (r.wechat_webhook ? 1 : 0) + (r.wechat_group_name || r.wechat_chatid ? 1 : 0);
        return <Tag color={has > 0 ? 'green' : 'default'}>{has > 0 ? `${has}个通道` : '未配置'}</Tag>;
      } },
    { title: '操作', key: 'action', width: 200,
      render: (_, r) => (
        <Space size="small">
          <Button type="link" size="small" icon={<SettingOutlined />}
            onClick={() => {
              chatidForm.setFieldsValue({
                wechat_webhook: r.wechat_webhook || '',
                wechat_chatid: r.wechat_chatid || '',
                wechat_group_name: r.wechat_group_name || '',
              });
              setChatidModal({ visible: true, customer: r });
            }}>
            配置群聊
          </Button>
          {r.wechat_chatid && (
            <Button type="link" size="small" icon={<SendOutlined />}
              onClick={() => handleTestSend(r.wechat_chatid)}>测试</Button>
          )}
        </Space>
      ),
    },
  ];

  const orderColumns = [
    { title: '工作号', dataIndex: 'job_no', width: 130 },
    { title: '日期', dataIndex: 'job_date', width: 100, render: (v) => v?.slice(0, 10) },
    { title: '船名/航次', width: 150, render: (_, r) => `${r.vessel || '-'}/${r.voyage || '-'}` },
    { title: 'ETD', dataIndex: 'etd', width: 100, render: (v) => v?.slice(0, 10) },
    { title: '目的国', dataIndex: 'dest_country', width: 100 },
    { title: '状态', dataIndex: 'order_status', width: 80,
      render: (v) => <Tag color={v === '已完成' ? 'green' : 'blue'}>{v || '-'}</Tag> },
  ];

  const logColumns = [
    { title: 'ID', dataIndex: 'id', width: 50 },
    { title: '客户', dataIndex: 'client_name', width: 120 },
    { title: '工作号', dataIndex: 'order_no', width: 120 },
    { title: '类型', dataIndex: 'push_type', width: 100 },
    { title: '内容', dataIndex: 'content', width: 300, ellipsis: true },
    { title: '状态', dataIndex: 'status', width: 80,
      render: (v) => <Tag color={v === 'success' ? 'green' : 'red'}>{v === 'success' ? '成功' : '失败'}</Tag> },
    { title: '错误', dataIndex: 'error_msg', width: 150, ellipsis: true, render: (v) => v || '-' },
    { title: '时间', dataIndex: 'created_at', width: 150, render: (v) => v?.slice(0, 19).replace('T', ' ') },
  ];

  const groupChatColumns = [
    { title: '群名称', dataIndex: 'name', width: 200 },
    { title: 'ChatID', dataIndex: 'chat_id', width: 250, ellipsis: true },
    { title: '成员数', dataIndex: 'member_count', width: 80 },
    { title: '群主', dataIndex: 'owner', width: 120 },
    { title: '创建时间', dataIndex: 'create_time', width: 120, render: (v) => v ? new Date(v * 1000).toLocaleString('zh-CN') : '-' },
  ];

  const tabItems = [
    {
      key: 'config',
      label: <span><ApiOutlined />企业微信配置</span>,
      children: (
        <Card title={<Space><WechatOutlined /><span>企业微信自建应用 + AI 配置</span></Space>} loading={configLoading}>
          <Paragraph type="secondary">
            配置企业微信自建应用的 corpid、agentid、secret，以及 AI 大模型（可选）用于自动生成推送消息。
          </Paragraph>
          <Form form={form} onFinish={handleSaveConfig} layout="vertical" style={{ maxWidth: 600 }}>
            <Title level={5}>企业微信配置</Title>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="corpid" label="企业ID（corpid）" rules={[{ required: true, message: '请输入 corpid' }]}>
                  <Input placeholder="wwxxxxxxxxxxxx" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="agentid" label="应用 AgentId">
                  <Input placeholder="1000002" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="secret" label="应用 Secret" rules={[{ required: true, message: '请输入 secret' }]}>
              <Input.Password placeholder="企业微信应用 secret" />
            </Form.Item>
            <Space style={{ marginBottom: 24 }}>
              <Button icon={<CheckCircleOutlined />} onClick={handleTestConnection}>测试连接</Button>
              <Text type="secondary">保存配置后点击测试，验证 corpid 和 secret 是否有效</Text>
            </Space>

            <Title level={5}>客户群回调配置（接收群消息）</Title>
            <Paragraph type="secondary">
              在企微管理后台「客户联系 → 客户群 → API → 接收消息」中配置回调URL：
              <Text code copyable style={{ display: 'block', marginTop: 4 }}>
                http://你的服务器IP:3001/api/wechat/callback
              </Text>
              然后将下面生成的 Token 和 EncodingAESKey 填入企微后台。
            </Paragraph>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="wework_callback_token" label="回调 Token">
                  <Input placeholder="自定义一个Token，如：meiou2024" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="wework_callback_aeskey" label="EncodingAESKey">
                  <Input placeholder="企微后台自动生成或自定义43位" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="bot_name" label="机器人名称">
              <Input placeholder="机器人暖宝" />
            </Form.Item>

            <Title level={5}>AI 大模型配置（可选）</Title>
            <Form.Item name="ai_endpoint" label="API 地址">
              <Input placeholder="https://api.deepseek.com/v1/chat/completions" />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="ai_key" label="API Key">
                  <Input.Password placeholder="sk-xxxxxxxx" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="ai_model" label="模型名称">
                  <Input placeholder="deepseek-chat" />
                </Form.Item>
              </Col>
            </Row>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>保存配置</Button>
          </Form>
        </Card>
      ),
    },
    {
      key: 'chatid',
      label: <span><LinkOutlined />客户群聊配置</span>,
      children: (
        <Card
          title={<Space><WechatOutlined /><span>客户企业微信群聊配置</span></Space>}
          extra={
            <Space>
              <Button icon={<SearchOutlined />} onClick={fetchGroupChats} loading={chatFetching}>
                拉取企业微信群聊列表
              </Button>
              <Button icon={<ReloadOutlined />} onClick={fetchCustomers}>刷新</Button>
            </Space>
          }
        >
          <Paragraph type="secondary">
            为每个客户绑定对应的企业微信客户群。点击「拉取企业微信群聊列表」获取所有客户群的 chatid，
            然后在配置弹窗中选择或填入对应的 chatid。
          </Paragraph>

          {groupChats.length > 0 && (
            <Card title="企业微信客户群列表" size="small" style={{ marginBottom: 16 }}>
              <Table
                columns={groupChatColumns}
                dataSource={groupChats}
                rowKey="chat_id"
                size="small"
                pagination={{ pageSize: 10 }}
              />
            </Card>
          )}

          <Table
            columns={customerColumns}
            dataSource={customers}
            rowKey="client_id"
            loading={custLoading}
            pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 个客户` }}
            size="small"
          />
        </Card>
      ),
    },
    {
      key: 'push',
      label: <span><SendOutlined />推送订单</span>,
      children: (
        <Card title={<Space><SendOutlined /><span>推送订单到企业微信群</span></Space>}>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}>
              <Select
                showSearch
                placeholder="选择客户"
                style={{ width: '100%' }}
                filterOption={(input, option) => option.label.toLowerCase().includes(input.toLowerCase())}
                value={selectedClient}
                onChange={(v) => { setSelectedClient(v); setSelectedOrders([]); fetchOrders(v); }}
                allowClear
                options={customers.filter(c => c.wechat_webhook || c.wechat_group_name || c.wechat_chatid).map(c => ({
                  value: c.client_id,
                  label: `${c.client_name} (${c.client_code}) ${c.wechat_group_name ? `→ ${c.wechat_group_name}` : c.wechat_webhook ? '→ 内部群' : ''}`,
                }))}
              />
            </Col>
            <Col span={16}>
              <Space>
                <Button type="primary" icon={<SendOutlined />} onClick={handlePush} loading={pushing}
                  disabled={!selectedClient || selectedOrders.length === 0}>
                  推送选中订单 ({selectedOrders.length})
                </Button>
                <Text type="secondary">
                  {selectedClient ? '点击订单行选中，支持多选后批量推送' : '请先选择客户'}
                </Text>
              </Space>
            </Col>
          </Row>
          <Table
            columns={orderColumns}
            dataSource={orders}
            rowKey="job_id"
            loading={orderLoading}
            rowSelection={{
              selectedRowKeys: selectedOrders,
              onChange: setSelectedOrders,
            }}
            pagination={{ pageSize: 20 }}
            size="small"
          />
        </Card>
      ),
    },
    {
      key: 'logs',
      label: <span><HistoryOutlined />推送日志</span>,
      children: (
        <Card
          title={<Space><HistoryOutlined /><span>推送日志</span></Space>}
          extra={<Button icon={<ReloadOutlined />} onClick={() => fetchLogs(logPage)}>刷新</Button>}
        >
          <Table
            columns={logColumns}
            dataSource={logs}
            rowKey="id"
            loading={logLoading}
            pagination={{ current: logPage, total: logTotal, pageSize: 20, onChange: fetchLogs, showTotal: (t) => `共 ${t} 条` }}
            size="small"
            scroll={{ x: 1000 }}
          />
        </Card>
      ),
    },
    {
      key: 'rpa',
      label: <span><RobotOutlined />RPA队列</span>,
      children: (
        <Card
          title={<Space><RobotOutlined /><span>RPA消息队列</span></Space>}
          extra={
            <Space>
              <Tag color="blue">待发送：{rpaPending} 条</Tag>
              <Tag>总计：{rpaTotal} 条</Tag>
              <Button icon={<ReloadOutlined />} onClick={fetchRpaQueue} loading={rpaLoading}>刷新</Button>
            </Space>
          }
        >
          <Paragraph type="secondary">
            影刀RPA或其他自动化工具轮询此队列，读取待发送消息后自动发到企业微信群。
            API地址：<Text code copyable>GET /wechat/rpa/pending?token=meiou-rpa-2024</Text>
          </Paragraph>
          <Table
            columns={[
              { title: 'ID', dataIndex: 'id', width: 50 },
              { title: '客户', dataIndex: 'client_name', width: 120 },
              { title: '目标群', dataIndex: 'group_name', width: 150 },
              { title: '订单ID', dataIndex: 'order_ids', width: 100, ellipsis: true },
              { title: '内容', dataIndex: 'content', width: 300, ellipsis: true },
              { title: '状态', dataIndex: 'status', width: 80,
                render: (v) => {
                  const map = { pending: 'orange', sent: 'green', failed: 'red' };
                  return <Tag color={map[v] || 'default'}>{v === 'pending' ? '待发送' : v === 'sent' ? '已发送' : '失败'}</Tag>;
                } },
              { title: '错误', dataIndex: 'error_msg', width: 120, ellipsis: true, render: (v) => v || '-' },
              { title: '创建时间', dataIndex: 'created_at', width: 150, render: (v) => v?.slice(0, 19).replace('T', ' ') },
              { title: '发送时间', dataIndex: 'sent_at', width: 150, render: (v) => v ? v.slice(0, 19).replace('T', ' ') : '-' },
            ]}
            dataSource={rpaQueue}
            rowKey="id"
            loading={rpaLoading}
            pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
            size="small"
            scroll={{ x: 1000 }}
          />
        </Card>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 16 }}>
        <Space><WechatOutlined /><span>企业微信推送管理</span></Space>
      </Title>
      <Tabs
        activeKey={activeTab}
        onChange={(key) => { setActiveTab(key); if (key === 'logs') fetchLogs(); if (key === 'rpa') fetchRpaQueue(); }}
        items={tabItems}
        size="large"
      />

      {/* 群聊配置弹窗 */}
      <Modal
        title={`配置群聊 - ${chatidModal.customer?.client_name || ''}`}
        open={chatidModal.visible}
        onOk={handleSaveChatid}
        onCancel={() => setChatidModal({ visible: false, customer: null })}
        okText="保存"
        cancelText="取消"
        width={600}
        destroyOnHidden
      >
        <Form form={chatidForm} layout="vertical">
          <Form.Item name="wechat_group_name" label="群聊名称（RPA用）" extra="用于RPA识别目标群，如：XX客户对接群">
            <Input placeholder="如：XX客户对接群" />
          </Form.Item>
          <Form.Item name="wechat_webhook" label="Webhook地址（内部群用）" extra="仅内部群可用，配置后直接推送，无需RPA">
            <Input.TextArea rows={3} placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..." />
          </Form.Item>
          <Form.Item name="wechat_chatid" label="群聊 ChatID（可选）">
            <Input placeholder="wrxxxxxxxxxxxxxx" />
          </Form.Item>
        </Form>
        <Space>
          <Button
            onClick={() => {
              const chatid = chatidForm.getFieldValue('wechat_chatid');
              handleTestSend(chatid);
            }}
          >
            测试 ChatID
          </Button>
          <Button
            onClick={() => {
              const webhook = chatidForm.getFieldValue('wechat_webhook');
              if (!webhook) { message.warning('请先填写 Webhook 地址'); return; }
              fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ msgtype: 'text', text: { content: '【美鸥物流】测试消息：Webhook 配置成功！' } }) })
                .then(r => r.json()).then(d => {
                  if (d.errcode === 0) message.success('Webhook 测试成功');
                  else message.error('Webhook 测试失败: ' + d.errmsg);
                }).catch(() => message.error('请求失败'));
            }}
          >
            测试 Webhook
          </Button>
        </Space>
      </Modal>
    </div>
  );
}

export default WechatPush;