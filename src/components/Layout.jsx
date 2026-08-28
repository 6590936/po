// 布局组件 - 侧边栏 + 内容区
import React, { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, Button } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  BellOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuOutlined,
  UserOutlined,
  BarChartOutlined,
  FileTextOutlined,
  ScheduleOutlined,
  CloudSyncOutlined,
  WechatOutlined,
  ShopOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';

const { Header, Sider, Content } = Layout;

function LayoutWrapper({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [collapsed, setCollapsed] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '数据看板',
    },
    {
      key: '/customers',
      icon: <TeamOutlined />,
      label: '客户管理',
    },
    {
      key: '/reminders',
      icon: <BellOutlined />,
      label: '跟进提醒',
    },
    {
      key: '/daily-report',
      icon: <BarChartOutlined />,
      label: '每日活动',
    },
    {
      key: '/quotes',
      icon: <FileTextOutlined />,
      label: '报价管理',
    },
    {
      key: '/weekly-report',
      icon: <ScheduleOutlined />,
      label: '周报',
    },
    {
      key: '/yunwuyun',
      icon: <CloudSyncOutlined />,
      label: 'FMS数据同步',
    },
    {
      key: '/tracking',
      icon: <EnvironmentOutlined />,
      label: '轨迹查验',
    },
    {
      key: '/wechat',
      icon: <WechatOutlined />,
      label: '企业微信推送',
    },
    {
      key: '/sales',
      icon: <ShopOutlined />,
      label: '销售管理',
    },
    {
      key: '/admin',
      icon: <SettingOutlined />,
      label: '系统管理',
    },
  ].filter(item => user.menus?.includes(item.key));

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: () => {
        logout();
        navigate('/login');
      },
    },
  ];

  const handleMenuClick = ({ key }) => {
    navigate(key);
    if (isMobile) setDrawerVisible(false);
  };

  const selectedKey = '/' + location.pathname.split('/')[1];

  const siderContent = (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[selectedKey === '//' ? '/' : selectedKey]}
      items={menuItems}
      onClick={handleMenuClick}
      style={{ borderRight: 0 }}
    />
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 桌面端侧边栏 */}
      {!isMobile && (
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          style={{
            background: '#1B4F72',
            boxShadow: '2px 0 8px rgba(0,0,0,0.15)',
          }}
          width={220}
        >
          <div
            style={{
              height: 64,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 'bold',
              fontSize: collapsed ? 14 : 18,
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {collapsed ? 'MO' : '美鸥物流 CRM'}
          </div>
          {siderContent}
        </Sider>
      )}

      {/* 移动端抽屉菜单 */}
      {isMobile && (
        <Drawer
          placement="left"
          onClose={() => setDrawerVisible(false)}
          open={drawerVisible}
          styles={{ body: { padding: 0, background: '#1B4F72' } }}
          width={220}
        >
          <div
            style={{
              height: 64,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 'bold',
              fontSize: 18,
              background: '#1B4F72',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            美鸥物流 CRM
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[selectedKey === '//' ? '/' : selectedKey]}
            items={menuItems}
            onClick={handleMenuClick}
            style={{ borderRight: 0, background: '#1B4F72' }}
          />
        </Drawer>
      )}

      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {isMobile && (
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setDrawerVisible(true)}
                style={{ fontSize: 18 }}
              />
            )}
            {!isMobile && (
              <Button
                type="text"
                icon={collapsed ? <MenuOutlined /> : <MenuOutlined />}
                onClick={() => setCollapsed(!collapsed)}
              />
            )}
          </div>

          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                padding: '4px 12px',
                borderRadius: 6,
              }}
            >
              <Avatar
                style={{ backgroundColor: '#1B4F72' }}
                icon={<UserOutlined />}
              />
              <span style={{ color: '#333' }}>{user.name}</span>
              <span style={{ color: '#999', fontSize: 12 }}>
                ({user.role === 'admin' ? '管理员' : '销售'})
              </span>
            </div>
          </Dropdown>
        </Header>

        <Content
          style={{
            margin: isMobile ? 12 : 24,
            minHeight: 280,
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}

export default LayoutWrapper;