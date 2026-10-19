import { useState } from 'react';
import { Button, Card, Form, Input, Typography } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { adminLogin } from '../../services/auth';
import { ApiError } from '../../services/request';

interface FormValues {
  username: string;
  password: string;
}

/** 商家后台登录（specs/03-api.md §2.2，默认账号见 server/prisma/seed.ts） */
export default function LoginPage() {
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const navigate = useNavigate();

  const onFinish = async (values: FormValues) => {
    setSubmitting(true);
    setErrMsg('');
    try {
      await adminLogin(values.username, values.password);
      navigate('/', { replace: true });
    } catch (e: any) {
      setErrMsg(e instanceof ApiError ? e.message : '登录失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <Card title="商家后台登录" style={{ width: 360 }}>
        <Form onFinish={onFinish} layout="vertical" requiredMark={false}>
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="admin" autoComplete="username" />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </Form.Item>
          {errMsg ? (
            <Form.Item>
              <Typography.Text type="danger">{errMsg}</Typography.Text>
            </Form.Item>
          ) : null}
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={submitting}>
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
