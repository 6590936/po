import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Tag, Space, Typography, Tooltip, message } from 'antd';
import { PhoneOutlined, BulbOutlined, TeamOutlined, TrophyOutlined } from '@ant-design/icons';
import { salesAPI } from '../../api';
import { MATERIAL_CATEGORIES } from './constants.jsx';

const { Text } = Typography;

function SalesDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try { const res = await salesAPI.getSalesDashboard(); setData(res); }
    catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  if (loading || !data) return <Card loading={loading} />;

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}><Card><Statistic title="今日通话" value={data.todayCalls} suffix="通" prefix={<PhoneOutlined />} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="今日反馈" value={data.todayFeedbacks} suffix="条" prefix={<BulbOutlined />} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="在训新人" value={data.activeTrainees} suffix="人" prefix={<TeamOutlined />} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="已完成培训" value={data.completedTrainees} suffix="人" prefix={<TrophyOutlined />} /></Card></Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card title="热门话术 Top 5" size="small" style={{ marginBottom: 16 }}>
            {data.topScripts?.length > 0 ? data.topScripts.map((s, i) => (
              <div key={s.id} style={{ padding: '8px 0', borderBottom: i < data.topScripts.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                <Space>
                  <Tag color={i === 0 ? 'gold' : i === 1 ? 'silver' : 'default'}>{i + 1}</Tag>
                  <Text>{s.title}</Text>
                  <Tag color="blue">{s.scene_name}</Tag>
                  <Text type="secondary">使用 {s.usage_count} 次</Text>
                </Space>
              </div>
            )) : <Text type="secondary">暂无数据</Text>}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="热门资料 Top 5" size="small" style={{ marginBottom: 16 }}>
            {data.topMaterials?.length > 0 ? data.topMaterials.map((m, i) => (
              <div key={m.id} style={{ padding: '8px 0', borderBottom: i < data.topMaterials.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                <Space>
                  <Tag color={i === 0 ? 'gold' : 'default'}>{i + 1}</Tag>
                  <Text>{m.title}</Text>
                  <Tag>{MATERIAL_CATEGORIES.find(c => c.value === m.category)?.label}</Tag>
                  <Text type="secondary">浏览 {m.view_count} 次</Text>
                </Space>
              </div>
            )) : <Text type="secondary">暂无数据</Text>}
          </Card>
        </Col>
      </Row>

      <Card title="本周通话趋势" size="small" style={{ marginBottom: 16 }}>
        {data.weeklyCalls?.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
            {data.weeklyCalls.map((d, i) => (
              <Tooltip key={i} title={`${d.day}: ${d.cnt} 通`}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Text style={{ fontSize: 11 }}>{d.cnt}</Text>
                  <div style={{ width: '100%', maxWidth: 40, height: Math.max(d.cnt * 8, 4), background: '#1890ff', borderRadius: '4px 4px 0 0', minHeight: 4 }} />
                  <Text style={{ fontSize: 10, marginTop: 4 }}>{d.day?.slice(5)}</Text>
                </div>
              </Tooltip>
            ))}
          </div>
        ) : <Text type="secondary">暂无数据</Text>}
      </Card>

      <Card title="常见问题汇总" size="small">
        {data.commonProblems?.length > 0 ? data.commonProblems.map((p, i) => (
          <Tag key={i} style={{ marginBottom: 8 }}>{p.slice(0, 60)}{p.length > 60 ? '...' : ''}</Tag>
        )) : <Text type="secondary">暂无数据</Text>}
      </Card>
    </div>
  );
}

export default SalesDashboard;