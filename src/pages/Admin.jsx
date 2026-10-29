// 管理员页面 - 用户管理 + 角色管理
import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, message,
  Typography, Space, Tag, Popconfirm, Tooltip, Tabs, Checkbox,
} from 'antd';
import {
  PlusOutlined, UserOutlined, TeamOutlined, DeleteOutlined,
  LockOutlined, SafetyCertificateOutlined, BankOutlined,
  StopOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { authAPI, customerAPI, roleAPI, tenantAPI } from '../api';
import useAuthStore from '../store/authStore';

const { Title } = Typography;

function Admin() {
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState('users');

  // 只有角色拥有"平台管理"菜单权限的才能访问
  if (!user.menus?.includes('/admin')) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Title level={4} type="danger">无权访问此页面</Title>
      </div>
    );
  }

  const isPlatformAdmin = !user.tenant_id && user.permissions?.includes('system:platform');

  return (
    <div>
      <Title level={4} style={{ marginBottom: 20 }}>系统管理</Title>
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        isPlatformAdmin ? { key: 'tenants', label: <><BankOutlined /> 主体管理</>, children: <TenantManagement /> } : null,
        { key: 'users', label: <><TeamOutlined /> 用户管理</>, children: <UserManagement /> },
        { key: 'roles', label: <><SafetyCertificateOutlined /> 角色管理</>, children: <RoleManagement isPlatform={isPlatformAdmin} /> },
      ].filter(Boolean)} />
    </div>
  );
}

// ===== 用户管理组件 =====
function UserManagement() {
  const user = useAuthStore((s) => s.user);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [resetForm] = Form.useForm();
  const isPlatform = !user.tenant_id && user.permissions?.includes('system:platform');

  useEffect(() => { fetchUsers(); fetchRoles(); fetchTenants(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try { setUsers(await authAPI.getUsers()); } catch {}
    finally { setLoading(false); }
  };

  const fetchRoles = async () => {
    try { setRoles(await roleAPI.getRoles()); } catch {}
  };

  const fetchTenants = async () => {
    if (!isPlatform) return;
    try { setTenants(await tenantAPI.getList()); } catch {}
  };

  const handleTenantChange = async (tenantId) => {
    if (!tenantId) { setRoles([]); form.setFieldsValue({ role_id: undefined }); editForm.setFieldsValue({ role_id: undefined }); return; }
    try { setRoles(await tenantAPI.getRoles(tenantId)); } catch { message.error('加载角色失败'); }
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

  const handleEditUser = async () => {
    try {
      const values = await editForm.validateFields();
      await fetch(`/api/auth/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${useAuthStore.getState().token}` },
        body: JSON.stringify(values),
      });
      message.success('用户更新成功');
      setEditModalVisible(false);
      fetchUsers();
    } catch (err) {
      if (err.message) message.error(err.message);
    }
  };

  const handleToggleStatus = async (userId, currentStatus) => {
    try {
      const action = currentStatus === 'active' ? 'disable' : 'enable';
      await fetch(`/api/auth/users/${userId}/${action}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${useAuthStore.getState().token}` },
      });
      message.success(currentStatus === 'active' ? '用户已停用' : '用户已启用');
      fetchUsers();
    } catch (err) {
      message.error(err.message || '操作失败');
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

  const openEditUser = (record) => {
    setEditingUser(record);
    editForm.setFieldsValue({
      name: record.name,
      tenant_id: record.tenant_id,
      role_id: record.role_id,
      status: record.status,
    });
    if (record.tenant_id) handleTenantChange(record.tenant_id);
    setEditModalVisible(true);
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '用户名', dataIndex: 'username', key: 'username' },
    { title: '姓名', dataIndex: 'name', key: 'name',
      render: (name) => <Space><UserOutlined />{name}</Space>,
    },
    ...(isPlatform ? [
      { title: '所属主体', dataIndex: 'tenant_name', key: 'tenant_name',
        render: (name) => name ? <Tag color="purple">{name}</Tag> : '-',
      },
    ] : []),
    { title: '角色', dataIndex: 'role_name', key: 'role_name',
      render: (role) => <Tag color={role === 'admin' ? '#1B4F72' : '#2E86C1'}>{role || '-'}</Tag>,
    },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (status) => <Tag color={status === 'active' ? 'green' : 'red'}>{status === 'active' ? '正常' : '已停用'}</Tag>,
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at',
      render: (time) => time ? new Date(time).toLocaleString('zh-CN') : '-',
    },
    { title: '操作', key: 'action', width: 200,
      render: (_, record) => (
        <Space>
          <Tooltip title="编辑">
            <Button type="link" size="small" onClick={() => openEditUser(record)}>编辑</Button>
          </Tooltip>
          <Tooltip title="重置密码">
            <Button type="link" size="small" icon={<LockOutlined />}
              onClick={() => { setResetUser(record); resetForm.resetFields(); setResetModalVisible(true); }} />
          </Tooltip>
          <Tooltip title={record.status === 'active' ? '停用' : '启用'}>
            <Button type="link" size="small"
              icon={record.status === 'active' ? <StopOutlined /> : <CheckCircleOutlined />}
              danger={record.status === 'active'}
              onClick={() => handleToggleStatus(record.id, record.status)} />
          </Tooltip>
          {record.id !== user.id && (
            <Popconfirm title="确认删除该用户？" onConfirm={() => handleDeleteUser(record.id, record.name)}
              okText="确认删除" cancelText="取消" okButtonProps={{ danger: true }}>
              <Tooltip title="删除"><Button type="link" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
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
          onClick={() => { form.resetFields(); fetchRoles(); if (!isPlatform) form.setFieldsValue({ tenant_id: user.tenant_id }); setModalVisible(true); }}>创建用户</Button>}>
        <Table columns={columns} dataSource={users} rowKey="id" loading={loading} pagination={false} size="middle" />
      </Card>

      <Modal title="创建用户" open={modalVisible} onOk={handleCreateUser}
        onCancel={() => setModalVisible(false)} okText="创建" cancelText="取消" destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="请输入姓名" />
          </Form.Item>
          {isPlatform && (
            <Form.Item name="tenant_id" label="所属主体" rules={[{ required: true, message: '请选择主体' }]}>
              <Select placeholder="选择公司主体" onChange={handleTenantChange}>
                {tenants.map(t => <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>)}
              </Select>
            </Form.Item>
          )}
          <Form.Item name="role_id" label="角色" rules={[{ required: true }]}>
            <Select placeholder="选择角色">
              {roles.map(r => <Select.Option key={r.id} value={r.id}>{r.name} - {r.description}</Select.Option>)}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`编辑用户 - ${editingUser?.name || ''}`} open={editModalVisible} onOk={handleEditUser}
        onCancel={() => setEditModalVisible(false)} okText="保存" cancelText="取消" destroyOnHidden>
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
            <Input placeholder="请输入姓名" />
          </Form.Item>
          {isPlatform && (
            <Form.Item name="tenant_id" label="所属主体">
              <Select placeholder="选择公司主体" onChange={handleTenantChange} allowClear>
                {tenants.map(t => <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>)}
              </Select>
            </Form.Item>
          )}
          <Form.Item name="role_id" label="角色">
            <Select placeholder="选择角色" allowClear>
              {roles.map(r => <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select>
              <Select.Option value="active">正常</Select.Option>
              <Select.Option value="inactive">停用</Select.Option>
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
function RoleManagement({ isPlatform }) {
  const user = useAuthStore((s) => s.user);
  const [roles, setRoles] = useState([]);
  const [allMenus, setAllMenus] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [tenantsForRole, setTenantsForRole] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => { fetchData(); if (isPlatform) fetchTenants(); }, []);

  const fetchTenants = async () => {
    try { setTenantsForRole(await tenantAPI.getList()); } catch {}
  };

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
    form.setFieldsValue({ menus: [], permissions: [], ...(isPlatform ? {} : { tenant_id: user.tenant_id }) });
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
        tenant_id: values.tenant_id,
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
    ...(isPlatform ? [
      { title: '所属主体', dataIndex: 'tenant_name', key: 'tenant_name',
        render: (name) => name ? <Tag color="purple">{name}</Tag> : '-',
      },
    ] : []),
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
          {isPlatform && !editingRole?.is_system && (
            <Form.Item name="tenant_id" label="所属主体" rules={[{ required: true, message: '请选择主体' }]}>
              <Select placeholder="选择公司主体">
                {tenantsForRole.map(t => <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>)}
              </Select>
            </Form.Item>
          )}
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

// ===== 主体管理组件 =====
function TenantManagement() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => { fetchTenants(); }, []);

  const fetchTenants = async () => {
    setLoading(true);
    try { setTenants(await tenantAPI.getList()); } catch {}
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingTenant) {
        await tenantAPI.update(editingTenant.id, values);
        message.success('主体更新成功');
      } else {
        await tenantAPI.create(values);
        message.success('主体创建成功');
      }
      setModalVisible(false);
      form.resetFields();
      fetchTenants();
    } catch (err) {
      if (err.message) message.error(err.message);
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    try {
      if (currentStatus === 'active') {
        await tenantAPI.disable(id);
        message.success('主体已停用');
      } else {
        await tenantAPI.enable(id);
        message.success('主体已启用');
      }
      fetchTenants();
    } catch (err) {
      message.error(err.message || '操作失败');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '主体名称', dataIndex: 'name', key: 'name',
      render: (name) => <Space><BankOutlined />{name}</Space>,
    },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (status) => <Tag color={status === 'active' ? 'green' : 'red'}>{status === 'active' ? '正常' : '已停用'}</Tag>,
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at',
      render: (time) => time ? new Date(time).toLocaleString('zh-CN') : '-',
    },
    { title: '操作', key: 'action', width: 160,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => {
            setEditingTenant(record);
            form.setFieldsValue({ name: record.name, status: record.status });
            setModalVisible(true);
          }}>编辑</Button>
          <Popconfirm
            title={record.status === 'active' ? '确认停用该主体？停用后该公司所有用户将无法登录' : '确认启用该主体？'}
            onConfirm={() => handleToggleStatus(record.id, record.status)}
            okText="确认" cancelText="取消"
            okButtonProps={{ danger: record.status === 'active' }}>
            <Button type="link" size="small" danger={record.status === 'active'}>
              {record.status === 'active' ? '停用' : '启用'}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card title={<Space><BankOutlined /><span>主体管理</span></Space>}
        extra={<Button type="primary" icon={<PlusOutlined />}
          onClick={() => { setEditingTenant(null); form.resetFields(); setModalVisible(true); }}>创建主体</Button>}>
        <Table columns={columns} dataSource={tenants} rowKey="id" loading={loading} pagination={false} size="middle" />
      </Card>

      <Modal
        title={editingTenant ? `编辑主体 - ${editingTenant.name}` : '创建主体'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="主体名称" rules={[{ required: true, message: '请输入主体名称' }]}>
            <Input placeholder="如：深圳美鸥国际物流、XX货代公司" />
          </Form.Item>
          {editingTenant && (
            <Form.Item name="status" label="状态">
              <Select>
                <Select.Option value="active">正常</Select.Option>
                <Select.Option value="inactive">停用</Select.Option>
              </Select>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
}

export default Admin;