import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { createPrinter, deletePrinter, listPrinters } from '../../../services/printer';
import { ApiError } from '../../../services/request';
import { formatTime } from '../../../utils/format';
import type { PrinterInfo, PrinterType } from '../../../types';

const TYPE_OPTIONS: { label: string; value: PrinterType }[] = [
  { label: '飞鹅 feie', value: 'feie' },
  { label: '芯烨 xprinter', value: 'xprinter' },
  { label: '商米 sunmi', value: 'sunmi' },
];

interface FormValues {
  name: string;
  type: PrinterType;
  sn: string;
}

/** 打印机配置（specs/03-api.md §8.1-§8.2） */
export default function PrinterPage() {
  const [rows, setRows] = useState<PrinterInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<FormValues>();

  const showError = (e: unknown) =>
    message.error(e instanceof ApiError ? e.message : '操作失败，请稍后重试');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listPrinters());
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onSubmit = async () => {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    setSaving(true);
    try {
      await createPrinter(values);
      message.success('打印机已添加');
      setAddOpen(false);
      form.resetFields();
      await load();
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (row: PrinterInfo) => {
    try {
      await deletePrinter(row.id);
      message.success('打印机已删除');
      await load();
    } catch (e) {
      showError(e);
    }
  };

  const columns: ColumnsType<PrinterInfo> = [
    { title: '名称', dataIndex: 'name' },
    { title: '厂商', dataIndex: 'type', width: 110 },
    { title: '序列号', dataIndex: 'sn' },
    {
      title: '在线状态',
      dataIndex: 'online',
      width: 110,
      render: (online: boolean) => (online ? <Tag color="green">在线</Tag> : <Tag color="red">离线</Tag>),
    },
    { title: '添加时间', dataIndex: 'createdAt', width: 180, render: (value: string) => formatTime(value) },
    {
      title: '操作',
      width: 100,
      render: (_, row) => (
        <Popconfirm
          title="删除打印机"
          description="删除后该门店将无法出票"
          okText="删除"
          okButtonProps={{ danger: true }}
          onConfirm={() => void onDelete(row)}
        >
          <Button size="small" danger>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Card
      title="打印机配置"
      extra={
        <Space>
          <Button onClick={() => void load()}>刷新状态</Button>
          <Button type="primary" onClick={() => setAddOpen(true)}>
            添加打印机
          </Button>
        </Space>
      }
    >
      <Alert
        style={{ marginBottom: 16 }}
        type="info"
        showIcon
        message="未配置打印机时，订单详情中的「打印小票」会提示 4001（打印机离线）。"
      />
      <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={false} />

      <Modal
        title="添加打印机"
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        onOk={() => void onSubmit()}
        confirmLoading={saving}
        okText="添加"
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入打印机名称' }]}>
            <Input maxLength={50} placeholder="前台打印机" />
          </Form.Item>
          <Form.Item label="厂商类型" name="type" rules={[{ required: true, message: '请选择厂商类型' }]}>
            <Select options={TYPE_OPTIONS} placeholder="feie" />
          </Form.Item>
          <Form.Item label="设备序列号" name="sn" rules={[{ required: true, message: '请输入设备序列号' }]}>
            <Input maxLength={100} placeholder="打印机背面 SN" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
