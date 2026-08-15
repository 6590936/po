// 管理员页面 - 用户管理 + 角色管理
import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, message,
  Typography, Space, Tag, Popconfirm, Tooltip, Tabs, Checkbox,
} from 'antd';
import {
  PlusOutlined, UserOutlined, TeamOutlined, DeleteOutlined,
  LockOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons';
import { authAPI, customerAPI, roleAPI } from '../api';
import useAuthStore from '../store/authStore';

const { Title } = Typography;

function Admin() {
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState('users');

  // 只有管理员能访问
  if (user.role !== 'admin') {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Title level={4} type="danger">无权访问此页面</Title>
      </div>
    );
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 20 }}>系统管理</Title>
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        { key: 'users', label: <><TeamOutlined /> 用户管理</>, children: <UserManagement /> },
        { key: 'roles', label: <><SafetyCertificateOutlined /> 角色管理</>, children: <RoleManagement /> },
      ]} />
    </div>
  );
}

// ===== 用户管理组件 =====
function UserManagement() {
  const user = useAuthStore((s) => s.user);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const [form] = Form.useForm();
  const [resetForm] = Form.useForm();

  useEffect(() => { fetchUsers(); fetchRoles(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try { setUsers(await authAPI.getUsers()); } catch {}
    finally { setLoading(false); }
  };

  const fetchRoles = async () => {
    try { setRoles(await roleAPI.getRoles()); } catch {}
  };

  const handleCreateUser = async () => {
    try {
      const values = await form.validateFields();
      await authAPI.createUser(values);
      message.success('用户创建成功');
      setModalVisible(false);
      form.resetFields();
      fetchUsers();
    } catch (err) {
      if (err.message) message.error(err.message);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    try {
      await authAPI.deleteUser(userId);
      message.success(`用户「${userName}」已删除`);
      fetchUsers();
    } catch (err) {
      message.error(err.message || '删除失败');
    }
  };

  const handleResetPassword = async () => {
    try {
      const values = await resetForm.validateFields();
      await authAPI.resetPassword(resetUser.id, values.newPassword);
      message.success(`用户「${resetUser.name}」密码已重置`);
      setResetModalVisible(false);
      resetForm.resetFields();
      setResetUser(null);
    } catch (err) {
      if (err.message) message.error(err.message);
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '用户名', dataIndex: 'username', key: 'username' },
    { title: '姓名', dataIndex: 'name', key: 'name',
      render: (name) => <Space><UserOutlined />{name}</Space>,
    },
    { title: '角色', dataIndex: 'role', key: 'role',
      render: (role) => <Tag color={role === 'admin' ? '#1B4F72' : '#2E86C1'}>{role}</Tag>,
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at',
      render: (time) => time ? new Date(time).toLocaleString('zh-CN') : '-',
    },
    { title: '操作', key: 'action', width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="重置密码">
            <Button type="link" size="small" icon={<LockOutlined />}
              onClick={() => { setResetUser(record); resetForm.resetFields(); setResetModalVisible(true); }} />
          </Tooltip>
          {record.id !== user.id && (
            <Popconfirm title="确认删除该用户？" description="删除后该用户将无法登录"
              onConfirm={() => handleDeleteUser(record.id, record.name)}
              okText="确认删除" cancelText="取消" okButtonProps={{ danger: true }}>
              <Tooltip title="删除">
                <Button type="link" size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card title={<Space><TeamOutlined /><span>用户管理</span></Space>}
        extra={<Button type="primary" icon={<PlusOutlined />}
          onClick={() => { form.resetFields(); setModalVisible(true); }}>创建用户</Button>}>
        <Table columns={columns} dataSource={users} rowKey="id" loading={loading} pagination={false} size="middle" />
      </Card>

      <Modal title="创建用户" open={modalVisible} onOk={handleCreateUser}
        onCancel={() => setModalVisible(false)} okText="创建" cancelText="取消" destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input placeholder="请输入用户名（登录用）" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="请输入姓名（显示用）" />
          </Form.Item>
          <Form.Item name="role" label="角色" initialValue="sales" rules={[{ required: true }]}>
            <Select>
              {roles.map(r => <Select.Option key={r.id} value={r.name}>{r.name} - {r.description}</Select.Option>)}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`重置密码 - ${resetUser?.name || ''}`} open={resetModalVisible} onOk={handleResetPassword}
        onCancel={() => { setResetModalVisible(false); resetForm.resetFields(); setResetUser(null); }}
        okText="确认重置" cancelText="取消" destroyOnHidden>
        <Form form={resetForm} layout="vertical">
          <Form.Item name="newPassword" label="新密码" rules={[
            { required: true, message: '请输入新密码' },
            { min: 4, message: '密码长度至少4位' },
          ]}>
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// ===== 角色管理组件 =====
function RoleManagement() {
  const [roles, setRoles] = useState([]);
  const [allMenus, setAllMenus] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rolesRes, menusRes, permsRes] = await Promise.all([
        roleAPI.getRoles(), roleAPI.getMenus(), roleAPI.getPermissions(),
      ]);
      setRoles(rolesRes);
      setAllMenus(menusRes);
      setAllPermissions(permsRes);
    } catch {}
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditingRole(null);
    form.resetFields();
    form.setFieldsValue({ menus: [], permissions: [] });
    setModalVisible(true);
  };

  const openEdit = (role) => {
    setEditingRole(role);
    form.setFieldsValue({
      name: role.name,
      description: role.description,
      menus: role.menus || [],
      permissions: role.permissions || [],
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        name: values.name,
        description: values.description,
        menus: values.menus || [],
        permissions: values.permissions || [],
      };
      if (editingRole) {
        await roleAPI.updateRole(editingRole.id, data);
        message.success('角色更新成功');
      } else {
        await roleAPI.createRole(data);
        message.success('角色创建成功');
      }
      setModalVisible(false);
      fetchData();
    } catch (err) {
      if (err.message) message.error(err.message);
    }
  };

  const handleDelete = async (role) => {
    try {
      await roleAPI.deleteRole(role.id);
      message.success(`角色「${role.name}」已删除`);
      fetchData();
    } catch (err) {
      message.error(err.message || '删除失败');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '角色名称', dataIndex: 'name', key: 'name',
      render: (name, record) => (
        <Space>
          <Tag color={record.is_system ? '#1B4F72' : '#2E86C1'}>{name}</Tag>
          {record.is_system ? <Tag color="orange">系统内置</Tag> : null}
        </Space>
      ),
    },
    { title: '描述', dataIndex: 'description', key: 'description' },
    { title: '菜单权限', dataIndex: 'menus', key: 'menus',
      render: (menus) => (
        <Space wrap size={[0, 4]}>
          {menus?.map(m => {
            const menu = allMenus.find(x => x.key === m);
            return <Tag key={m} color="blue">{menu?.label || m}</Tag>;
          })}
        </Space>
      ),
    },
    { title: '数据权限', dataIndex: 'permissions', key: 'permissions',
      render: (perms) => (
        <Space wrap size={[0, 4]}>
          {perms?.map(p => {
            const perm = allPermissions.find(x => x.key === p);
            return <Tag key={p} color="green">{perm?.label || p}</Tag>;
          })}
        </Space>
      ),
    },
    { title: '操作', key: 'action', width: 140,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => openEdit(record)}>编辑</Button>
          {!record.is_system && (
            <Popconfirm title="确认删除该角色？" description="删除后该角色下的用户将无法获得对应权限"
              onConfirm={() => handleDelete(record)} okText="确认删除" cancelText="取消" okButtonProps={{ danger: true }}>
              <Button type="link" size="small" danger>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card title={<Space><SafetyCertificateOutlined /><span>角色管理</span></Space>}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>创建角色</Button>}>
        <Table columns={columns} dataSource={roles} rowKey="id" loading={loading} pagination={false} size="middle" />
      </Card>

      <Modal
        title={editingRole ? `编辑角色 - ${editingRole.name}` : '创建角色'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={600}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="角色名称" rules={[{ required: true, message: '请输入角色名称' }]}>
            <Input placeholder="如：销售主管、客服、财务" disabled={editingRole?.is_system} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="角色职责说明" />
          </Form.Item>
          <Form.Item name="menus" label="菜单权限">
            <Checkbox.Group>
              <Space direction="vertical">
                {allMenus.map(m => (
                  <Checkbox key={m.key} value={m.key}>{m.label}</Checkbox>
                ))}
              </Space>
            </Checkbox.Group>
          </Form.Item>
          <Form.Item name="permissions" label="数据权限">
            <Checkbox.Group>
              <Space direction="vertical">
                {allPermissions.map(p => (
                  <Checkbox key={p.key} value={p.key}>{p.label}</Checkbox>
                ))}
              </Space>
            </Checkbox.Group>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default Admin;