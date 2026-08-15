// 数据看板页面
import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Select, Tag, Table, Typography, Spin, Progress, Space, message } from 'antd';
import {
  TeamOutlined, PhoneOutlined, CheckCircleOutlined, BellOutlined,
  ArrowUpOutlined, ArrowDownOutlined, TrophyOutlined, WarningOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { dashboardAPI } from '../api';
import { getStatusText, getStatusColor, getGradeColor } from '../utils/constants';
import useAuthStore from '../store/authStore';

const { Title, Text } = Typography;

function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState(null);
  const [kpiData, setKpiData] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');

  useEffect(() => {
    fetchData();
    fetchKPI();
    fetchDiagnostics();
  }, [period]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await dashboardAPI.getData(period);
      setData(result);
    } catch (err) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchKPI = async () => {
    try {
      const result = await dashboardAPI.getKPI();
      setKpiData(result);
    } catch {}
  };

  const fetchDiagnostics = async () => {
    try {
      const result = await dashboardAPI.getDiagnostics();
      setDiagnostics(result);
    } catch {}
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;
  }

  // 漏斗图配置
  const funnelOption = {
    title: { text: '转化漏斗', left: 'center', textStyle: { fontSize: 14, color: '#333' } },
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({c}家)',
    },
    series: [{
      type: 'funnel',
      left: '10%',
      width: '80%',
      sort: 'none',
      gap: 2,
      label: {
        show: true,
        position: 'inside',
        formatter: (params) => `${params.name}\n${params.value}家`,
        fontSize: 12,
      },
      data: data.funnel.map((item, index) => ({
        value: item.count,
        name: item.stage,
        itemStyle: {
          color: ['#8c8c8c', '#2E86C1', '#52c41a', '#faad14', '#722ed1', '#1B4F72'][index],
        },
      })),
    }],
  };

  const gradeOption = {
    title: { text: '客户等级分布', left: 'center', textStyle: { fontSize: 14, color: '#333' } },
    tooltip: { trigger: 'item', formatter: '{b}: {c}家 ({d}%)' },
    legend: { bottom: 0 },
    series: [{
      type: 'pie',
      radius: ['40%', '65%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { show: true, formatter: '{b}: {c}家' },
      data: data.gradeCounts.map(item => ({
        value: item.count,
        name: `${item.grade}级`,
        itemStyle: { color: getGradeColor(item.grade) },
      })),
    }],
  };

  const typeOption = {
    title: { text: '客户类型分布', left: 'center', textStyle: { fontSize: 14, color: '#333' } },
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [{
      type: 'pie',
      radius: '60%',
      data: data.typeCounts.map(item => ({
        value: item.count,
        name: item.customer_type,
      })),
    }],
  };

  const methodOption = {
    title: { text: '跟进方式分布', left: 'center', textStyle: { fontSize: 14, color: '#333' } },
    tooltip: { trigger: 'item' },
    xAxis: {
      type: 'category',
      data: data.methodCounts.map(item => {
        const map = { phone: '电话', wechat: '微信', email: '邮件', meeting: '面谈' };
        return map[item.method] || item.method;
      }),
    },
    yAxis: { type: 'value' },
    series: [{
      type: 'bar',
      data: data.methodCounts.map(item => item.count),
      itemStyle: {
        color: '#2E86C1',
        borderRadius: [4, 4, 0, 0],
      },
      barWidth: '40%',
    }],
  };

  const rankingColumns = [
    { title: '排名', key: 'rank', render: (_, __, i) => i + 1, width: 60 },
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '客户数', dataIndex: 'customer_count', key: 'customer_count' },
    { title: '跟进次数', dataIndex: 'followup_count', key: 'followup_count' },
    { title: '成交数', dataIndex: 'deal_count', key: 'deal_count',
      render: (val) => <Tag color={val > 0 ? 'green' : 'default'}>{val}</Tag>,
    },
  ];

  const periodOptions = [
    { value: 'today', label: '今日' },
    { value: 'week', label: '本周' },
    { value: 'month', label: '本月' },
    { value: 'all', label: '全部' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>数据看板</Title>
        <Select
          value={period}
          onChange={setPeriod}
          options={periodOptions}
          style={{ width: 120 }}
        />
      </div>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="客户总数"
              value={data.totalCustomers}
              prefix={<TeamOutlined style={{ color: '#1B4F72' }} />}
              valueStyle={{ color: '#1B4F72' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="跟进次数"
              value={data.totalFollowups}
              prefix={<PhoneOutlined style={{ color: '#2E86C1' }} />}
              valueStyle={{ color: '#2E86C1' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="待跟进"
              value={data.pendingFollowups}
              prefix={<BellOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: data.pendingFollowups > 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="成交客户"
              value={data.funnel.find(f => f.key === 'deal')?.count || 0}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 功能2：KPI月度看板 */}
      {kpiData && (
        <Card
          title={<><TrophyOutlined style={{ color: '#faad14' }} /> 月度KPI看板 ({kpiData.month})</>}
          style={{ marginBottom: 24 }}
          extra={<span style={{ color: '#999', fontSize: 12 }}>工作日: {kpiData.working_days}天</span>}
        >
          <Row gutter={[16, 16]}>
            {kpiData.kpi_items.map((item, idx) => (
              <Col xs={12} sm={12} md={6} key={idx}>
                <div style={{ padding: 12, background: '#f6f8fa', borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text strong style={{ fontSize: 13 }}>{item.name}</Text>
                    <Tag color={item.achieved ? 'green' : 'orange'} style={{ margin: 0 }}>
                      {item.achieved ? '达标' : '未达标'}
                    </Tag>
                  </div>
                  <Progress
                    percent={item.progress}
                    status={item.achieved ? 'success' : 'active'}
                    size="small"
                    strokeColor={item.achieved ? '#52c41a' : '#1B4F72'}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text style={{ fontSize: 11, color: '#666' }}>
                      实际: <Text strong>{item.actual}{item.unit}</Text>
                    </Text>
                    <Text style={{ fontSize: 11, color: '#999' }}>
                      目标: {item.target}{item.unit}
                    </Text>
                  </div>
                </div>
              </Col>
            ))}
          </Row>

          {/* 团队KPI对比（管理员） */}
          {user.role === 'admin' && kpiData.team_kpi && kpiData.team_kpi.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Text strong>团队KPI对比</Text>
              <Table
                style={{ marginTop: 8 }}
                dataSource={kpiData.team_kpi}
                rowKey="user_id"
                size="small"
                pagination={false}
                columns={[
                  { title: '姓名', dataIndex: 'name', key: 'name' },
                  { title: '新客户', dataIndex: 'new_customers', key: 'new_customers' },
                  { title: '报价数', dataIndex: 'quotes', key: 'quotes' },
                  { title: '成交数', dataIndex: 'deals', key: 'deals' },
                  { title: '日均电话', dataIndex: 'avg_daily_calls', key: 'avg_daily_calls',
                    render: (v) => <Tag color={v >= 20 ? 'green' : v >= 10 ? 'orange' : 'red'}>{v}</Tag> },
                ]}
              />
            </div>
          )}
        </Card>
      )}

      {/* 转化率指标 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={24}>
          <Card title="转化漏斗指标" size="small">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {data.funnel.slice(1).map((item, index) => (
                <div
                  key={item.key}
                  style={{
                    padding: '12px 20px',
                    background: '#f6f8fa',
                    borderRadius: 8,
                    textAlign: 'center',
                    minWidth: 140,
                  }}
                >
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                    {data.funnel[index].stage} → {item.stage}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1B4F72' }}>
                    {item.conversionRate}%
                  </div>
                  <div style={{ fontSize: 12, color: '#999' }}>
                    {data.funnel[index].count} → {item.count}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 功能6：漏斗异常诊断 */}
      {diagnostics && diagnostics.length > 0 && (
        <Card
          title={<><WarningOutlined style={{ color: '#faad14' }} /> 漏斗异常诊断</>}
          style={{ marginBottom: 24 }}
        >
          <Row gutter={[16, 16]}>
            {diagnostics.map((item, idx) => (
              <Col xs={24} sm={12} md={8} key={idx}>
                <div style={{
                  padding: 16,
                  borderRadius: 8,
                  border: `2px solid ${item.status === 'green' ? '#52c41a' : item.status === 'yellow' ? '#faad14' : '#ff4d4f'}`,
                  background: item.status === 'green' ? '#f6ffed' : item.status === 'yellow' ? '#fffbe6' : '#fff2f0',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text strong>{item.from_label} → {item.to_label}</Text>
                    <Tag color={item.status === 'green' ? 'green' : item.status === 'yellow' ? 'orange' : 'red'}>
                      {item.status === 'green' ? '达标' : item.status === 'yellow' ? '接近' : '未达标'}
                    </Tag>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text>实际: <Text strong>{item.actual_rate}%</Text></Text>
                    <Text type="secondary">目标: {item.target_rate}%</Text>
                  </div>
                  <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                    {item.status !== 'green' ? (
                      <span>💡 建议：{item.suggestion}</span>
                    ) : (
                      <span>✅ {item.suggestion}</span>
                    )}
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {/* 图表区域 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card>
            <ReactECharts option={funnelOption} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card>
            <ReactECharts option={gradeOption} style={{ height: 300 }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card>
            <ReactECharts option={typeOption} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card>
            <ReactECharts option={methodOption} style={{ height: 300 }} />
          </Card>
        </Col>
      </Row>

      {/* 团队排名（管理员可见） */}
      {user.role === 'admin' && data.teamRanking.length > 0 && (
        <Card title="团队排名" style={{ marginBottom: 24 }}>
          <Table
            columns={rankingColumns}
            dataSource={data.teamRanking}
            rowKey="user_id"
            pagination={false}
            size="small"
          />
        </Card>
      )}
    </div>
  );
}

export default Dashboard;