import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Space,
  Switch,
  Table,
  Tag,
  message,
} from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { createSpecGroup, deleteSpecGroup, listSpecGroups, updateSpecGroup } from '../../../services/menu';
import { ApiError } from '../../../services/request';
import { fenToYuan, yuanToFen } from '../../../utils/format';
import type { SpecGroupInfo } from '../../../types';

interface OptionFormValue {
  id?: string;
  name: string;
  priceDeltaYuan: number;
}

interface SpecGroupFormValues {
  name: string;
  type: 'single' | 'multi';
  required: boolean;
  options: OptionFormValue[];
}

/** 规格组管理（specs/03-api.md §5.3，F-08）：杯型/甜度/冰度/加料 */
export default function SpecGroupsPage() {
  const [rows, setRows] = useState<SpecGroupInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<SpecGroupInfo | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<SpecGroupFormValues>();

  const showError = (e: unknown) =>
    message.error(e instanceof ApiError ? e.message : '操作失败，请稍后重试');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listSpecGroups());
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openEditor = (row: SpecGroupInfo | null) => {
    setEditing(row);
    setEditorOpen(true);
    form.setFieldsValue(
      row
        ? {
            name: row.name,
            type: row.type,
            required: row.required,
            options: row.options.map((o) => ({ id: o.id, name: o.name, priceDeltaYuan: fenToYuan(o.priceDelta) })),
          }
        : { name: '', type: 'single', required: true, options: [{ name: '', priceDeltaYuan: 0 }] },
    );
  };

  const closeEditor = () => {
    setEditing(null);
    setEditorOpen(false);
  };

  const onSubmit = async () => {
    let values: SpecGroupFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const payload = {
      name: values.name,
      type: values.type,
      required: values.required,
      options: values.options.map((o, i) => ({
        id: o.id,
        name: o.name,
        priceDelta: yuanToFen(o.priceDeltaYuan ?? 0),
        sort: i,
      })),
    };
    setSaving(true);
    try {
      if (editing) {
        await updateSpecGroup(editing.id, payload);
        message.success('规格组已更新');
      } else {
        await createSpecGroup(payload);
        message.success('规格组已新增');
      }
      closeEditor();
      await load();
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (row: SpecGroupInfo) => {
    try {
      await deleteSpecGroup(row.id);
      message.success('规格组已删除');
      await load();
    } catch (e) {
      showError(e);
    }
  };

  const columns: ColumnsType<SpecGroupInfo> = [
    { title: '名称', dataIndex: 'name', width: 140 },
    {
      title: '选择方式',
      dataIndex: 'type',
      width: 100,
      render: (type: string) => <Tag>{type === 'single' ? '单选' : '多选'}</Tag>,
    },
    {
      title: '必选',
      dataIndex: 'required',
      width: 80,
      render: (required: boolean) => (required ? '是' : '否'),
    },
    {
      title: '选项',
      dataIndex: 'options',
      render: (_, row) =>
        row.options.map((o) => (
          <Tag key={o.id}>
            {o.name}
            {o.priceDelta ? ` +${fenToYuan(o.priceDelta)}元` : ''}
          </Tag>
        )),
    },
    {
      title: '操作',
      width: 160,
      render: (_, row) => (
        <Space>
          <Button size="small" onClick={() => openEditor(row)}>
            编辑
          </Button>
          <Popconfirm
            title="删除规格组"
            description="绑定该规格组的商品将无法使用其选项"
            okText="删除"
            okButtonProps={{ danger: true }}
            onConfirm={() => void onDelete(row)}
          >
            <Button size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="规格组管理"
      extra={
        <Button type="primary" onClick={() => openEditor(null)}>
          新增规格组
        </Button>
      }
    >
      <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={false} />

      <Modal
        title={editing ? '编辑规格组' : '新增规格组'}
        open={editorOpen}
        onCancel={closeEditor}
        onOk={() => void onSubmit()}
        confirmLoading={saving}
        okText="保存"
        width={560}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入规格组名称' }]}>
            <Input maxLength={20} placeholder="杯型" />
          </Form.Item>
          <Form.Item label="选择方式" name="type">
            <Radio.Group>
              <Radio value="single">单选</Radio>
              <Radio value="multi">多选</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item label="必选" name="required" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.List name="options">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                    <Form.Item {...restField} name={[name, 'id']} hidden>
                      <Input />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'name']}
                      rules={[{ required: true, message: '请输入选项名称' }]}
                      style={{ marginBottom: 0 }}
                    >
                      <Input maxLength={20} placeholder="大杯" style={{ width: 180 }} />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'priceDeltaYuan']} style={{ marginBottom: 0 }}>
                      <InputNumber precision={2} step={0.5} placeholder="加价" prefix="+¥" style={{ width: 140 }} />
                    </Form.Item>
                    <Button
                      size="small"
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      disabled={fields.length <= 1}
                      onClick={() => remove(name)}
                    />
                  </Space>
                ))}
                <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ name: '', priceDeltaYuan: 0 })}>
                  添加选项
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </Card>
  );
}
