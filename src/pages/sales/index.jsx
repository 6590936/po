import React, { useState } from 'react';
import { Tabs, Typography } from 'antd';
import { BookOutlined, TrophyOutlined, UserOutlined, PhoneOutlined, BulbOutlined, EyeOutlined } from '@ant-design/icons';
import useAuthStore from '../../store/authStore';
import MaterialsTab from './MaterialsTab';
import ScriptsTab from './ScriptsTab';
import OnboardingTab from './OnboardingTab';
import CallsTab from './CallsTab';
import FeedbackTab from './FeedbackTab';
import SalesDashboard from './SalesDashboard';

const { Title } = Typography;

function SalesManagement() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user.role === 'admin' || user.role === 'manager';
  const [activeTab, setActiveTab] = useState('materials');

  return (
    <div>
      <Title level={3} style={{ marginBottom: 16 }}>销售管理中心</Title>
      <Tabs activeKey={activeTab} onChange={setActiveTab} type="card" items={[
        { key: 'materials', label: <span><BookOutlined /> 培训资料库</span>, children: <MaterialsTab isAdmin={isAdmin} /> },
        { key: 'scripts', label: <span><TrophyOutlined /> 话术库</span>, children: <ScriptsTab isAdmin={isAdmin} /> },
        { key: 'onboarding', label: <span><UserOutlined /> 新人培训</span>, children: <OnboardingTab isAdmin={isAdmin} /> },
        { key: 'calls', label: <span><PhoneOutlined /> 通话反馈</span>, children: <CallsTab isAdmin={isAdmin} /> },
        { key: 'feedback', label: <span><BulbOutlined /> 反馈总结</span>, children: <FeedbackTab isAdmin={isAdmin} /> },
        { key: 'dashboard', label: <span><EyeOutlined /> 数据看板</span>, children: <SalesDashboard /> },
      ]} />
    </div>
  );
}

export default SalesManagement;