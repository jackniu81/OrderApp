import { useEffect, useState } from 'react';
import { Button, Card, Form, Input, Switch, Typography, message } from 'antd';
import { getMerchant, updateMerchant } from '../../../services/merchant';
import { ApiError } from '../../../services/request';
import { getSession } from '../../../utils/session';
import type { MerchantInfo } from '../../../types';

/** 营业设置（specs/03-api.md §3.3，F-09） */
export default function BusinessPage() {
  const [form] = Form.useForm<MerchantInfo>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        form.setFieldsValue(await getMerchant());
      } catch (e) {
        message.error(e instanceof ApiError ? e.message : '加载门店信息失败');
      } finally {
        setLoading(false);
      }
    })();
  }, [form]);

  const onSubmit = async (values: MerchantInfo) => {
    setSaving(true);
    try {
      // 接口不接受 id 字段（白名单校验），门店由 token 决定
      const { id: _id, ...patch } = values;
      await updateMerchant(patch);
      message.success('设置已保存');
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="营业设置">
      <Typography.Paragraph type="secondary">
        门店 ID：{getSession()?.merchantId ?? '-'}（打烊后顾客端进店将提示暂停营业）
      </Typography.Paragraph>
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => void onSubmit(values)}
        style={{ maxWidth: 480 }}
      >
        <Form.Item label="门店名称" name="name" rules={[{ required: true, message: '请输入门店名称' }]}>
          <Input maxLength={100} />
        </Form.Item>
        <Form.Item label="营业时间" name="businessHours" tooltip="仅展示用文本">
          <Input placeholder="09:00-22:00" maxLength={50} />
        </Form.Item>
        <Form.Item label="联系电话" name="phone">
          <Input maxLength={30} />
        </Form.Item>
        <Form.Item label="地址" name="address">
          <Input maxLength={200} />
        </Form.Item>
        <Form.Item label="Logo URL" name="logo">
          <Input placeholder="https://cdn.example.com/logo.png" />
        </Form.Item>
        <Form.Item label="门店公告" name="notice" tooltip="顾客端进店时展示">
          <Input.TextArea rows={3} maxLength={200} showCount />
        </Form.Item>
        <Form.Item label="营业中" name="isOpen" valuePropName="checked" tooltip="关闭即打烊">
          <Switch checkedChildren="营业" unCheckedChildren="打烊" />
        </Form.Item>
        <Form.Item
          label="到店支付"
          name="payOnSiteEnabled"
          valuePropName="checked"
          tooltip="微信支付不可用时的兜底开关"
        >
          <Switch />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={saving} disabled={loading}>
            保存
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}
