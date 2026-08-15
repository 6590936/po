// 跟进提醒页面
import React, { useState, useEffect } from 'react';
import { Card, List, Tag, Typography, Space, Badge, Button, Empty, Spin, message, Row, Col, Alert } from 'antd';
import {
  BellOutlined, WarningOutlined, ClockCircleOutlined,
  PhoneOutlined, ArrowRightOutlined, SwapOutlined,
  ArrowUpOutlined, ArrowDownOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { customerAPI } from '../api';
import { getGradeColor, getStatusText, getStatusColor } from '../utils/constants';
import useAuthStore from '../store/authStore';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

function Reminders() {
  const user = useAuthStore((s) => s.user);
  const [overdueCustomers, setOverdueCustomers] = useState([]);
  const [todayCustomers, setTodayCustomers] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    fetchReminders();
  }, []);

  const fetchReminders = async () => {
    setLoading(true);
    try {
      const [overdue, today, suggestionsData] = await Promise.all([
        customerAPI.getOverdue(),
        customerAPI.getToday(),
        customerAPI.getGradeSuggestions(),
      ]);
      setOverdueCustomers(overdue);
      setTodayCustomers(today);
      setSuggestions(suggestionsData);
    } catch (err) {
      message.error('加载提醒数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleGradeAdjust = async (customerId, newGrade, suggestion) => {
    try {
      if (suggestion === 'upgrade_status') {
        await customerAPI.update(customerId, { status: 'contacted' });
        message.success('状态已更新为"已触达"');
      } else if (suggestion === 'downgrade_status') {
        await customerAPI.update(customerId, { status: 'potential' });
        message.success('状态已降级为"潜在客户"');
      } else if (suggestion === 'downgrade_grade') {
        await customerAPI.update(customerId, { grade: 'D', grade_reason: '系统建议：超2个月无互动' });
        message.success('等级已降为D级');
      } else {
        navigate(`/customers/${customerId}`);
        return;
      }
      fetchReminders();
    } catch (err) {
      message.error('操作失败：' + (err.message || ''));
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;
  }

  // 分类建议
  const urgentFollowups = suggestions.filter(s => s.suggestion === 'urgent_followup');
  const followupReminders = suggestions.filter(s => s.suggestion === 'followup_reminder');
  const upgradeSuggestions = suggestions.filter(s => s.suggestion === 'upgrade_status');
  const downgradeSuggestions = suggestions.filter(s => s.suggestion === 'downgrade_status' || s.suggestion === 'downgrade_grade');

  const renderCustomerItem = (item, isOverdue) => (
    <List.Item
      style={{
        padding: '16px',
        background: isOverdue ? '#fff2f0' : '#fffbe6',
        borderRadius: 8,
        marginBottom: 8,
        cursor: 'pointer',
      }}
      onClick={() => navigate(`/customers/${item.id}`)}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Space size="middle" wrap>
            <Text strong style={{ fontSize: 16 }}>{item.company_name}</Text>
            <Tag color={getGradeColor(item.grade)} style={{ fontWeight: 'bold' }}>{item.grade}级</Tag>
            <Tag color={getStatusColor(item.status)}>{getStatusText(item.status)}</Tag>
          </Space>
          {isOverdue && (
            <Badge
              count={
                <Space>
                  <WarningOutlined style={{ color: '#ff4d4f' }} />
                  <Text strong style={{ color: '#ff4d4f' }}>
                    超期 {item.overdue_days} 天
                  </Text>
                </Space>
              }
            />
          )}
        </div>
        
        <Space wrap style={{ marginBottom: 4 }}>
          {item.contact_name && <Text type="secondary">{item.contact_name}</Text>}
          {item.phone && <Text type="secondary"><PhoneOutlined /> {item.phone}</Text>}
          {item.owner_name && <Text type="secondary">销售: {item.owner_name}</Text>}
        </Space>

        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <ClockCircleOutlined /> 计划跟进时间：
            <span style={{ color: isOverdue ? '#ff4d4f' : '#faad14', fontWeight: 500 }}>
              {dayjs(item.next_followup_at).format('YYYY-MM-DD')}
            </span>
          </Text>
        </div>
      </div>
    </List.Item>
  );

  return (
    <div>
      <Title level={4} style={{ marginBottom: 20 }}>
        <BellOutlined /> 跟进提醒
      </Title>

      {/* 功能3：等级调整建议 */}
      {(upgradeSuggestions.length > 0 || downgradeSuggestions.length > 0) && (
        <Card
          title={<><SwapOutlined style={{ color: '#722ed1' }} /> 等级调整建议</>}
          style={{ marginBottom: 20, borderLeft: '3px solid #722ed1' }}
        >
          <Row gutter={[16, 16]}>
            {/* 建议升级 */}
            {upgradeSuggestions.length > 0 && (
              <Col xs={24} md={12}>
                <div style={{ marginBottom: 12 }}>
                  <Tag color="green" style={{ fontSize: 13, padding: '4px 12px' }}>
                    <ArrowUpOutlined /> 建议升级 ({upgradeSuggestions.length})
                  </Tag>
                </div>
                {upgradeSuggestions.map((s, idx) => (
                  <div key={idx} style={{
                    padding: '12px',
                    background: '#f6ffed',
                    borderRadius: 8,
                    marginBottom: 8,
                    border: '1px solid #b7eb8f',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <Text strong>{s.company_name}</Text>
                        <Tag color={getStatusColor(s.current_status)} style={{ marginLeft: 8 }}>
                          {getStatusText(s.current_status)}
                        </Tag>
                      </div>
                      <Space>
                        <Button
                          type="primary"
                          size="small"
                          icon={<ArrowUpOutlined />}
                          onClick={() => handleGradeAdjust(s.customer_id, null, s.suggestion)}
                        >
                          一键升级
                        </Button>
                        <Button
                          size="small"
                          onClick={() => navigate(`/customers/${s.customer_id}`)}
                        >
                          详情
                        </Button>
                      </Space>
                    </div>
                    <div style={{ fontSize: 12, color: '#52c41a', marginTop: 4 }}>
                      💡 {s.reason}
                    </div>
                  </div>
                ))}
              </Col>
            )}

            {/* 建议降级 */}
            {downgradeSuggestions.length > 0 && (
              <Col xs={24} md={12}>
                <div style={{ marginBottom: 12 }}>
                  <Tag color="red" style={{ fontSize: 13, padding: '4px 12px' }}>
                    <ArrowDownOutlined /> 建议降级 ({downgradeSuggestions.length})
                  </Tag>
                </div>
                {downgradeSuggestions.map((s, idx) => (
                  <div key={idx} style={{
                    padding: '12px',
                    background: '#fff2f0',
                    borderRadius: 8,
                    marginBottom: 8,
                    border: '1px solid #ffccc7',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <Text strong>{s.company_name}</Text>
                        <Tag color={getGradeColor(s.current_grade)} style={{ marginLeft: 8 }}>
                          {s.current_grade}级
                        </Tag>
                      </div>
                      <Space>
                        <Button
                          danger
                          size="small"
                          icon={<ArrowDownOutlined />}
                          onClick={() => handleGradeAdjust(s.customer_id, null, s.suggestion)}
                        >
                          一键降级
                        </Button>
                        <Button
                          size="small"
                          onClick={() => navigate(`/customers/${s.customer_id}`)}
                        >
                          详情
                        </Button>
                      </Space>
                    </div>
                    <div style={{ fontSize: 12, color: '#ff4d4f', marginTop: 4 }}>
                      ⚠️ {s.reason}
                    </div>
                  </div>
                ))}
              </Col>
            )}
          </Row>
        </Card>
      )}

      {/* 功能3：紧急跟进提醒 */}
      {urgentFollowups.length > 0 && (
        <Card
          title={
            <Space>
              <ThunderboltOutlined style={{ color: '#ff4d4f' }} />
              <span>紧急跟进提醒</span>
              <Badge count={urgentFollowups.length} style={{ backgroundColor: '#ff4d4f' }} />
            </Space>
          }
          style={{ marginBottom: 20, borderLeft: '3px solid #ff4d4f' }}
        >
          {urgentFollowups.map((s, idx) => (
            <div key={idx} style={{
              padding: '12px',
              background: '#fff2f0',
              borderRadius: 8,
              marginBottom: 8,
              cursor: 'pointer',
              border: '1px solid #ffccc7',
            }} onClick={() => navigate(`/customers/${s.customer_id}`)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <Text strong>{s.company_name}</Text>
                  <Tag color="red">{s.current_grade}级</Tag>
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>{s.reason}</Text>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* 超期未跟进 */}
      <Card
        title={
          <Space>
            <WarningOutlined style={{ color: '#ff4d4f' }} />
            <span>超期未跟进</span>
            <Badge count={overdueCustomers.length} style={{ backgroundColor: '#ff4d4f' }} />
          </Space>
        }
        style={{ marginBottom: 20, borderLeft: '3px solid #ff4d4f' }}
      >
        {overdueCustomers.length > 0 ? (
          <List
            dataSource={overdueCustomers}
            renderItem={(item) => renderCustomerItem(item, true)}
          />
        ) : (
          <Empty description="🎉 没有超期未跟进的客户" />
        )}
      </Card>

      {/* 今日待跟进 */}
      <Card
        title={
          <Space>
            <ClockCircleOutlined style={{ color: '#faad14' }} />
            <span>今日待跟进</span>
            <Badge count={todayCustomers.length} style={{ backgroundColor: '#faad14' }} />
          </Space>
        }
        style={{ borderLeft: '3px solid #faad14' }}
      >
        {todayCustomers.length > 0 ? (
          <List
            dataSource={todayCustomers}
            renderItem={(item) => renderCustomerItem(item, false)}
          />
        ) : (
          <Empty description="今日无待跟进客户" />
        )}
      </Card>

      {/* 跟进频率说明 */}
      <Card title="客户跟进频率标准" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {[
            { grade: 'A', color: '#ff4d4f', desc: '每天跟进，24小时未跟进提醒', rule: '24小时' },
            { grade: 'B', color: '#faad14', desc: '每周2-3次，3天未跟进提醒', rule: '3天' },
            { grade: 'C', color: '#2E86C1', desc: '每周1次，7天未跟进提醒', rule: '7天' },
            { grade: 'D', color: '#8c8c8c', desc: '每月1-2次，30天未跟进提醒', rule: '30天' },
          ].map(item => (
            <div
              key={item.grade}
              style={{
                padding: '16px 24px',
                background: '#f6f8fa',
                borderRadius: 8,
                borderLeft: `4px solid ${item.color}`,
                minWidth: 200,
              }}
            >
              <Tag color={item.color} style={{ fontWeight: 'bold', fontSize: 14, marginBottom: 8 }}>
                {item.grade}级客户
              </Tag>
              <div style={{ fontSize: 14, marginBottom: 4 }}>{item.desc}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>提醒阈值：{item.rule}</Text>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default Reminders;