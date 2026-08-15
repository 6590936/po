// 客户端登录页面
import React, { useState } from 'react';
import { Card, Form, Input, Button, message, Typography } from 'antd';
import { LoginOutlined, GlobalOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const BASE = '/api';

function ClientLogin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleLogin = async (values) => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/client/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        message.error(data.error || '登录失败');
        return;
      }
      localStorage.setItem('client_token', data.token);
      localStorage.setItem('client_info', JSON.stringify(data.client));
      message.success('登录成功');
      navigate('/client/portal');
    } catch (err) {
      message.error('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'linear-gradient(135deg, #1B4F72 0%, #2E86C1 100%)',
    }}>
      <Card style={{ width: 400, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <GlobalOutlined style={{ fontSize: 48, color: '#1B4F72' }} />
          <Title level={3} style={{ marginTop: 8 }}>美鸥物流 · 客户平台</Title>
          <Text type="secondary">请输入您的登录账号和密码</Text>
        </div>
        <Form onFinish={handleLogin} layout="vertical" size="large">
          <Form.Item
            name="account"
            label="登录账号"
            rules={[{ required: true, message: '请输入登录账号' }]}
          >
            <Input placeholder="请输入登录账号" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading} icon={<LoginOutlined />}>
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

export default ClientLogin;