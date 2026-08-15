// 每日活动记录页面
import React, { useState, useEffect } from 'react';
import { Card, Row, Col, InputNumber, Form, Button, Table, Typography, Space, Select, Tag, message, Spin, Collapse } from 'antd';
import {
  PhoneOutlined, MessageOutlined, MailOutlined, TeamOutlined,
  FileTextOutlined, SaveOutlined, BarChartOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { activityAPI } from '../api';
import useAuthStore from '../store/authStore';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// SOP基准线
const SOP_BENCHMARK = {
  calls: 20,
  wechat_adds: 10,
  emails: 5,
  effective_comms: 5,
  quotes_sent: 2,
  crm_updates: 5,
};

const SOP_LABELS = {
  calls: { label: '电话', icon: <PhoneOutlined />, color: '#2E86C1' },
  wechat_adds: { label: '微信添加', icon: <MessageOutlined />, color: '#52c41a' },
  emails: { label: '邮件', icon: <MailOutlined />, color: '#faad14' },
  effective_comms: { label: '有效沟通', icon: <TeamOutlined />, color: '#722ed1' },
  quotes_sent: { label: '报价', icon: <FileTextOutlined />, color: '#ff4d4f' },
  crm_updates: { label: 'CRM更新', icon: <SaveOutlined />, color: '#1B4F72' },
};

function DailyReport() {
  const user = useAuthStore((s) => s.user);
  const [form] = Form.useForm();
  const [todayData, setTodayData] = useState(null);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [period, setPeriod] = useState('week');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [today, statsData, rangeData] = await Promise.all([
        activityAPI.getToday(),
        activityAPI.getStats('week'),
        activityAPI.getRange(
          dayjs().subtract(13, 'day').format('YYYY-MM-DD'),
          dayjs().format('YYYY-MM-DD')
        ),
      ]);
      setTodayData(today);
      setStats(statsData);
      setHistory(rangeData);

      form.setFieldsValue({
        calls: today.calls || 0,
        wechat_adds: today.wechat_adds || 0,
        emails: today.emails || 0,
        effective_comms: today.effective_comms || 0,
        quotes_sent: today.quotes_sent || 0,
        crm_updates: today.crm_updates || 0,
      });
    } catch (err) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = form.getFieldsValue();
      await activityAPI.saveToday(values);
      message.success('保存成功！');
      fetchAll();
    } catch (err) {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handlePeriodChange = async (val) => {
    setPeriod(val);
    try {
      const data = await activityAPI.getStats(val);
      setStats(data);
    } catch (err) {
      message.error('加载统计失败');
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;
  }

  // 柱状图对比配置
  const chartFields = Object.keys(SOP_BENCHMARK);
  const actualValues = chartFields.map(f => form.getFieldValue(f) || todayData?.[f] || 0);
  const benchmarkValues = chartFields.map(f => SOP_BENCHMARK[f]);

  const barOption = {
    title: { text: `今日活动 vs SOP基准线`, left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    legend: { data: ['实际值', 'SOP基准线'], bottom: 0 },
    grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      data: chartFields.map(f => SOP_LABELS[f].label),
      axisLabel: { fontSize: 11 },
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: '实际值',
        type: 'bar',
        data: actualValues,
        itemStyle: { color: '#2E86C1', borderRadius: [4, 4, 0, 0] },
        barWidth: '30%',
      },
      {
        name: 'SOP基准线',
        type: 'bar',
        data: benchmarkValues,
        itemStyle: { color: '#e0e0e0', borderRadius: [4, 4, 0, 0] },
        barWidth: '30%',
      },
    ],
  };

  // 趋势图
  const trendOption = {
    title: { text: '近14天活动趋势', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    legend: { data: ['电话', '微信', '有效沟通', '报价'], bottom: 0, type: 'scroll' },
    grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      data: [...history].reverse().map(h => dayjs(h.date).format('MM-DD')),
    },
    yAxis: { type: 'value' },
    series: [
      { name: '电话', type: 'line', data: [...history].reverse().map(h => h.calls || 0), smooth: true, itemStyle: { color: '#2E86C1' } },
      { name: '微信', type: 'line', data: [...history].reverse().map(h => h.wechat_adds || 0), smooth: true, itemStyle: { color: '#52c41a' } },
      { name: '有效沟通', type: 'line', data: [...history].reverse().map(h => h.effective_comms || 0), smooth: true, itemStyle: { color: '#722ed1' } },
      { name: '报价', type: 'line', data: [...history].reverse().map(h => h.quotes_sent || 0), smooth: true, itemStyle: { color: '#ff4d4f' } },
    ],
  };

  const historyColumns = [
    { title: '日期', dataIndex: 'date', key: 'date', width: 110,
      render: (d) => dayjs(d).format('MM-DD') + ' ' + ['日','一','二','三','四','五','六'][dayjs(d).day()] },
    { title: '电话', dataIndex: 'calls', key: 'calls', width: 70, render: (v) => v >= SOP_BENCHMARK.calls ? <Tag color="green">{v}</Tag> : <Tag color="red">{v}</Tag> },
    { title: '微信', dataIndex: 'wechat_adds', key: 'wechat_adds', width: 70, render: (v) => v >= SOP_BENCHMARK.wechat_adds ? <Tag color="green">{v}</Tag> : <Tag color="red">{v}</Tag> },
    { title: '邮件', dataIndex: 'emails', key: 'emails', width: 70, render: (v) => v >= SOP_BENCHMARK.emails ? <Tag color="green">{v}</Tag> : <Tag color="red">{v}</Tag> },
    { title: '有效沟通', dataIndex: 'effective_comms', key: 'effective_comms', width: 90, render: (v) => v >= SOP_BENCHMARK.effective_comms ? <Tag color="green">{v}</Tag> : <Tag color="red">{v}</Tag> },
    { title: '报价', dataIndex: 'quotes_sent', key: 'quotes_sent', width: 70, render: (v) => v >= SOP_BENCHMARK.quotes_sent ? <Tag color="green">{v}</Tag> : <Tag color="red">{v}</Tag> },
    { title: 'CRM更新', dataIndex: 'crm_updates', key: 'crm_updates', width: 90, render: (v) => v >= SOP_BENCHMARK.crm_updates ? <Tag color="green">{v}</Tag> : <Tag color="red">{v}</Tag> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
        <Title level={4} style={{ margin: 0 }}>📊 每日活动记录</Title>
        <Select value={period} onChange={handlePeriodChange} style={{ width: 120 }}
          options={[{ value: 'week', label: '本周' }, { value: 'month', label: '本月' }]} />
      </div>

      {/* 今日数据录入 */}
      <Card title={`今日数据录入 (${dayjs().format('YYYY-MM-DD')})`} style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical">
          <Row gutter={[12, 12]}>
            {chartFields.map(field => (
              <Col xs={12} sm={8} md={4} key={field}>
                <Form.Item name={field} label={
                  <Space size={4}>
                    {SOP_LABELS[field].icon}
                    <span>{SOP_LABELS[field].label}</span>
                  </Space>
                } style={{ marginBottom: 8 }}>
                  <InputNumber
                    min={0}
                    style={{ width: '100%' }}
                    placeholder={`目标:${SOP_BENCHMARK[field]}`}
                  />
                </Form.Item>
                <div style={{ textAlign: 'center', fontSize: 11, color: '#999', marginTop: -8, marginBottom: 8 }}>
                  SOP目标: {SOP_BENCHMARK[field]}
                </div>
              </Col>
            ))}
          </Row>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving} block>
            保存今日数据
          </Button>
        </Form>
      </Card>

      {/* 统计概览 */}
      {stats && (
        <Card title={`${period === 'week' ? '本周' : '本月'}统计汇总`} style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]}>
            {chartFields.map(field => {
              const avgKey = field === 'calls' ? 'avg_calls' : field === 'wechat_adds' ? 'avg_wechat'
                : field === 'emails' ? 'avg_emails' : field === 'effective_comms' ? 'avg_effective_comms'
                : field === 'quotes_sent' ? 'avg_quotes' : 'avg_crm_updates';
              const avg = stats[avgKey] || 0;
              const target = SOP_BENCHMARK[field];
              const pct = Math.min(100, Math.round(avg / target * 100));
              const color = pct >= 100 ? '#52c41a' : pct >= 70 ? '#faad14' : '#ff4d4f';
              return (
                <Col xs={12} sm={8} md={4} key={field}>
                  <div style={{ textAlign: 'center', padding: 12, background: '#f6f8fa', borderRadius: 8 }}>
                    <div style={{ fontSize: 20, fontWeight: 'bold', color }}>{avg}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>日均{SOP_LABELS[field].label}</div>
                    <div style={{ fontSize: 11, color: '#999' }}>目标: {target}</div>
                    <div style={{ fontSize: 11, color, fontWeight: 500 }}>{pct}%</div>
                  </div>
                </Col>
              );
            })}
          </Row>
        </Card>
      )}

      {/* 图表区域 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={12}>
          <Card>
            <ReactECharts option={barOption} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card>
            <ReactECharts option={trendOption} style={{ height: 300 }} />
          </Card>
        </Col>
      </Row>

      {/* 历史记录表格 */}
      <Card title="最近14天记录">
        <Table
          columns={historyColumns}
          dataSource={history}
          rowKey="date"
          pagination={false}
          size="small"
          scroll={{ x: 600 }}
        />
      </Card>
    </div>
  );
}

export default DailyReport;