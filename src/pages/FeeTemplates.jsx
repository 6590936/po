// 费用模版管理
import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Space, Tag, message, Modal, Form, Input,
  Select, Popconfirm, Typography, Row, Col,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  ReloadOutlined, StarOutlined, EyeOutlined, CopyOutlined,
} from '@ant-design/icons';
import { feeTemplateAPI } from '../api';

const { Title, Text } = Typography;

function FeeTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [form] = Form.useForm();

  const fetchList = async () => {
    setLoading(true);
    try {
      const data = await feeTemplateAPI.getList();
      setTemplates(data || []);
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchList(); }, []);

  const handleCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ items: [] });
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      name: record.name,
      items: (record.items || []).map(it => ({
        ...it,
        key: it.id || `new_${Math.random().toString(36).slice(2, 8)}`,
      })),
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await feeTemplateAPI.delete(id);
      message.success('已删除');
      fetchList();
    } catch {
      message.error('删除失败');
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (editing) {
        await feeTemplateAPI.update(editing.id, values);
      } else {
        await feeTemplateAPI.create(values);
      }
      message.success(editing ? '已更新' : '已创建');
      setModalVisible(false);
      fetchList();
    } catch (err) {
      if (err?.errorFields) return;
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (record) => {
    try {
      await feeTemplateAPI.setDefault(record.id);
      message.success(`"${record.name}" 已设为默认模版`);
      fetchList();
    } catch {
      message.error('设置失败');
    }
  };

  const handlePreview = (record) => {
    setPreviewData(record);
    setPreviewVisible(true);
  };

  const handleCopy = async (record) => {
    try {
      await feeTemplateAPI.copy(record.id);
      message.success('已复制');
      fetchList();
    } catch {
      message.error('复制失败');
    }
  };

  const columns = [
    {
      title: '模版名称', dataIndex: 'name', key: 'name', width: 200,
      render: (v, r) => (
        <Space>
          <Text strong>{v}</Text>
          {r.is_default ? <Tag color="gold">默认</Tag> : null}
        </Space>
      ),
    },
    {
      title: '费项数', dataIndex: 'items', key: 'items', width: 80,
      render: (items) => items?.length || 0,
    },
    {
      title: '费项预览', key: 'preview', ellipsis: true,
      render: (_, r) => {
        const names = (r.items || []).slice(0, 4).map(it => it.item_name).join('、');
        return <Text type="secondary">{names || '—'}</Text>;
      },
    },
    { title: '操作', key: 'action', width: 320, fixed: 'right',
      render: (_, r) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handlePreview(r)}>预览</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>编辑</Button>
          <Button type="link" size="small" icon={<CopyOutlined />} onClick={() => handleCopy(r)}>复制</Button>
          {!r.is_default && (
            <Button type="link" size="small" icon={<StarOutlined />} onClick={() => handleSetDefault(r)}>设为默认</Button>
          )}
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>费用模版管理</Title>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchList}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建模版</Button>
          </Space>
        </Col>
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={templates}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="small"
        />
      </Card>

      <Modal
        title={editing ? '编辑模版' : '新建模版'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSave}
        confirmLoading={saving}
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="模版名称" rules={[{ required: true, message: '请输入模版名称' }]}>
            <Input placeholder="如：标准报价模版、VIP客户模版" />
          </Form.Item>
          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                <div style={{ marginBottom: 8 }}>
                  <Text strong>费用明细</Text>
                  <Button type="dashed" size="small" icon={<PlusOutlined />} style={{ marginLeft: 12 }}
                    onClick={() => add({ item_name: '', standard: '按每柜计费', amount_value: '', currency: 'USD', note: '', category: 'fee', amount_type: 'fixed' })}
                    htmlType="button">
                    添加费项
                  </Button>
                </div>
                {fields.map(({ key, name, ...rest }) => (
                  <Card key={key} size="small" style={{ marginBottom: 8 }}
                    extra={<Button type="link" size="small" danger htmlType="button" onClick={() => remove(name)}>删除</Button>}>
                    <Row gutter={8}>
                      <Col span={5}>
                        <Form.Item {...rest} name={[name, 'item_name']} label="费用名称" rules={[{ required: true }]}>
                          <Input placeholder="如：基础海运费" />
                        </Form.Item>
                      </Col>
                      <Col span={3}>
                        <Form.Item {...rest} name={[name, 'category']} label="类型">
                          <Select options={[{ label: '费用项', value: 'fee' }, { label: '备注项', value: 'note' }]} />
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item {...rest} name={[name, 'standard']} label="计费标准">
                          <Input placeholder="按每柜计费" />
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item {...rest} name={[name, 'amount_value']} label="金额">
                          <Input placeholder="2000" />
                        </Form.Item>
                      </Col>
                      <Col span={2}>
                        <Form.Item {...rest} name={[name, 'currency']} label="币种">
                          <Select options={[
                            { label: 'USD', value: 'USD' },
                            { label: 'RMB', value: 'RMB' },
                          ]} />
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item {...rest} name={[name, 'amount_type']} label="计费方式">
                          <Select options={[
                            { label: '固定金额', value: 'fixed' },
                            { label: '随运价变动', value: 'freight' },
                          ]} />
                        </Form.Item>
                      </Col>
                      <Col span={2}>
                        <Form.Item {...rest} name={[name, 'note']} label="备注">
                          <Input placeholder="说明" />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>
                ))}
              </>
            )}
          </Form.List>
        </Form>
      </Modal>

      <Modal
        title={previewData?.name || '模版预览'}
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={null}
        width={720}
      >
        {previewData?.items?.length > 0 ? (
          <>
            <Table
              dataSource={previewData.items}
              rowKey={(_, i) => i}
              pagination={false}
              size="small"
              columns={[
                { title: '序号', width: 50, render: (_, __, i) => i + 1 },
                { title: '费用名称', dataIndex: 'item_name', width: 150 },
                { title: '类型', dataIndex: 'category', width: 70, render: v => v === 'note' ? <Tag color="blue">备注</Tag> : <Tag color="green">费用</Tag> },
                { title: '计费方式', dataIndex: 'amount_type', width: 90, render: v => v === 'freight' ? <Tag color="orange">随运价</Tag> : <Tag>固定</Tag> },
                { title: '计费标准', dataIndex: 'standard', width: 120 },
                { title: '金额', dataIndex: 'amount_value', width: 80 },
                { title: '币种', dataIndex: 'currency', width: 60 },
                { title: '备注', dataIndex: 'note', ellipsis: true },
              ]}
            />
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Text type="secondary">共 {previewData.items.length} 项</Text>
            </div>
          </>
        ) : (
          <Text type="secondary">暂无费用明细</Text>
        )}
      </Modal>
    </div>
  );
}

export default FeeTemplates;