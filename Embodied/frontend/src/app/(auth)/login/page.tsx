'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AimOutlined,
  ApiOutlined,
  EyeOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Button, Card, Form, Input, message, Space, Typography } from 'antd';
import { useUserStore } from '@/stores/userStore';

const { Text, Title } = Typography;

const highlights = [
  { icon: <AimOutlined />, label: '精准定位', value: 'Box / Point' },
  { icon: <ApiOutlined />, label: '任务流转', value: 'Async Jobs' },
  { icon: <SafetyCertificateOutlined />, label: '安全访问', value: 'JWT Auth' },
];

export default function LoginPage() {
  const router = useRouter();
  const [form] = Form.useForm<{ username: string; password: string }>();
  const { login } = useUserStore();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.username.trim(), values.password);
      message.success('登录成功');
      router.push('/dashboard');
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: string } } };
      message.error(axiosError.response?.data?.detail || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = () => {
    form.setFieldsValue({ username: 'admin123', password: 'admin123' });
  };

  return (
    <main className="auth-login-page">
      <div className="auth-login-bg auth-login-bg-primary" />
      <div className="auth-login-bg auth-login-bg-secondary" />
      <div className="auth-login-grid" aria-hidden="true" />

      <section className="auth-login-shell">
        <aside className="auth-login-hero" aria-label="LocateAnything 产品介绍">
          <div className="auth-brand-row">
            <div className="auth-brand-mark">
              <ThunderboltOutlined />
            </div>
            <div>
              <Text className="auth-eyebrow">Visual Grounding AI</Text>
              <Title level={1} className="auth-brand-title">
                <span>Locate</span>Anything
              </Title>
            </div>
          </div>

          <div className="auth-hero-copy">
            <Text className="auth-kicker">AI 推理工作台</Text>
            <Title level={2} className="auth-hero-title">
              用更清晰的界面完成图像定位、检测与批量推理。
            </Title>
            <Text className="auth-hero-text">
              面向视觉定位任务的统一入口：上传图像或视频，管理异步任务，并在结果页查看标注与推理输出。
            </Text>
          </div>

          <div className="auth-highlight-list">
            {highlights.map((item) => (
              <div className="auth-highlight-card" key={item.label}>
                <span className="auth-highlight-icon">{item.icon}</span>
                <div>
                  <Text className="auth-highlight-label">{item.label}</Text>
                  <Text className="auth-highlight-value">{item.value}</Text>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <Card className="auth-login-card" styles={{ body: { padding: 0 } }}>
          <div className="auth-card-header">
            <div className="auth-card-logo">
              <EyeOutlined />
            </div>
            <div>
              <Title level={3} className="auth-card-title">
                欢迎回来
              </Title>
              <Text className="auth-card-subtitle">登录后进入推理工作台</Text>
            </div>
          </div>

          <Form
            form={form}
            name="login"
            onFinish={handleSubmit}
            autoComplete="off"
            size="large"
            layout="vertical"
            requiredMark={false}
            className="auth-login-form"
          >
            <Form.Item
              label="用户名"
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="请输入用户名"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </Form.Item>

            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" />
            </Form.Item>

            <div className="auth-demo-row">
              <Text>测试账号：admin123 / admin123</Text>
              <Button type="link" size="small" onClick={fillDemoAccount}>
                一键填入
              </Button>
            </div>

            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              className="auth-submit-button"
            >
              登录
            </Button>
          </Form>

          <div className="auth-register-row">
            <Space size={6} wrap>
              <Text>还没有账号？</Text>
              <Link href="/register">立即注册</Link>
            </Space>
          </div>
        </Card>
      </section>
    </main>
  );
}
