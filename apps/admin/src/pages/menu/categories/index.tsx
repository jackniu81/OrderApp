import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Space, Switch, Table, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { createCategory, deleteCategory, listCategories, updateCategory } from '../../../services/menu';
import { ApiError } from '../../../services/request';
import type { CategoryInfo } from '../../../types';

interface FormValues {
  name: string;
  sort: number;
  visible: boolean;
}

/** 分类管理（specs/03-api.md §5.1，F-08） */
export default function CategoriesPage() {
  const [rows, setRows] = useState<CategoryInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<CategoryInfo | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<FormValues>();

  const showError = (e: unknown) =>
    message.error(e instanceof ApiError ? e.message : '操作失败，请稍后重试');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listCategories());
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openEditor = (row: CategoryInfo | null) => {
    setEditing(row);
    setEditorOpen(true);
    form.setFieldsValue(row ?? { name: '', sort: (rows.length + 1) * 10, visible: true });
  };

  const closeEditor = () => {
    setEditing(null);
    setEditorOpen(false);
  };

  const onSubmit = async () => {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return; // 表单校验失败，AntD 已提示
    }
    setSaving(true);
    try {
      if (editing) {
        await updateCategory(editing.id, values);
        message.success('分类已更新');
      } else {
        await createCategory(values);
        message.success('分类已新增');
      }
      closeEditor();
      await load();
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  const onToggleVisible = async (row: CategoryInfo, visible: boolean) => {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, visible } : r)));
    try {
      await updateCategory(row.id, { visible });
    } catch (e) {
      showError(e);
      void load();
    }
  };

  const onDelete = async (row: CategoryInfo) => {
    try {
      await deleteCategory(row.id);
      message.success('分类已删除');
      await load();
    } catch (e) {
      showError(e);
    }
  };

  const columns: ColumnsType<CategoryInfo> = [
    { title: '分类名称', dataIndex: 'name' },
    { title: '排序', dataIndex: 'sort', width: 90 },
    {
      title: '顾客端可见',
      dataIndex: 'visible',
      width: 120,
      render: (_, row) => <Switch checked={row.visible} onChange={(v) => void onToggleVisible(row, v)} />,
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
            title="删除分类"
            description="分类下若有商品将无法删除"
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
      title="分类管理"
      extra={
        <Button type="primary" onClick={() => openEditor(null)}>
          新增分类
        </Button>
      }
    >
      <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={false} />

      <Modal
        title={editing ? '编辑分类' : '新增分类'}
        open={editorOpen}
        onCancel={closeEditor}
        onOk={() => void onSubmit()}
        confirmLoading={saving}
        okText="保存"
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item label="分类名称" name="name" rules={[{ required: true, message: '请输入分类名称' }]}>
            <Input maxLength={50} placeholder="招牌奶茶" />
          </Form.Item>
          <Form.Item label="排序" name="sort" tooltip="数字越小越靠前">
            <InputNumber min={0} max={9999} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="顾客端可见" name="visible" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
