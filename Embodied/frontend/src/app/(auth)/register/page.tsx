'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Form, Input, Button, Typography, message, Space } from 'antd';
import { UserOutlined, LockOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useUserStore } from '@/stores/userStore';
import Link from 'next/link';

const { Title, Text } = Typography;

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useUserStore();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: { username: string; password: string; confirmPassword: string }) => {
    if (values.password !== values.confirmPassword) {
      message.error('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    try {
      await register(values.username, values.password);
      message.success('注册成功');
      router.push('/dashboard');
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: string } } };
      message.error(axiosError.response?.data?.detail || '注册失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #0B1120 0%, #0F172A 50%, #0B1120 100%)',
        padding: '20px',
      }}
    >
      {/* 背景装饰 */}
      <div
        style={{
          position: 'fixed',
          top: '-50%',
          left: '-50%',
          width: '200%',
          height: '200%',
          background: 'radial-gradient(circle at 70% 50%, rgba(34, 197, 94, 0.05) 0%, transparent 50%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              boxShadow: '0 8px 24px rgba(34, 197, 94, 0.3)',
            }}
          >
            <ThunderboltOutlined style={{ fontSize: '28px', color: '#fff' }} />
          </div>
          <Title
            level={2}
            style={{
              color: '#F8FAFC',
              marginBottom: 8,
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            <span style={{ color: '#22C55E' }}>Locate</span>Anything
          </Title>
          <Text style={{ color: '#64748B', fontSize: '14px' }}>
            创建新账号
          </Text>
        </div>

        {/* 注册卡片 */}
        <Card
          style={{
            background: 'rgba(30, 41, 59, 0.8)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(51, 65, 85, 0.5)',
            borderRadius: 20,
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
          }}
          styles={{ body: { padding: '32px' } }}
        >
          <Form
            name="register"
            onFinish={handleSubmit}
            autoComplete="off"
            size="large"
            layout="vertical"
            requiredMark={false}
          >
            <Form.Item
              name="username"
              rules={[
                { required: true, message: '请输入用户名' },
                { min: 3, message: '用户名至少3个字符' },
                { max: 50, message: '用户名最多50个字符' },
              ]}
              style={{ marginBottom: 20 }}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#64748B' }} />}
                placeholder="用户名"
                style={{
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid rgba(51, 65, 85, 0.5)',
                  borderRadius: 12,
                  height: 48,
                  fontSize: '15px',
                }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码至少6个字符' },
              ]}
              style={{ marginBottom: 20 }}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#64748B' }} />}
                placeholder="密码"
                style={{
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid rgba(51, 65, 85, 0.5)',
                  borderRadius: 12,
                  height: 48,
                  fontSize: '15px',
                }}
              />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              rules={[
                { required: true, message: '请确认密码' },
              ]}
              style={{ marginBottom: 24 }}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#64748B' }} />}
                placeholder="确认密码"
                style={{
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid rgba(51, 65, 85, 0.5)',
                  borderRadius: 12,
                  height: 48,
                  fontSize: '15px',
                }}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                style={{
                  height: 48,
                  borderRadius: 12,
                  fontWeight: 600,
                  fontSize: '15px',
                  background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                  border: 'none',
                  boxShadow: '0 4px 14px rgba(34, 197, 94, 0.3)',
                }}
              >
                注册
              </Button>
            </Form.Item>
          </Form>

          <div style={{ textAlign: 'center' }}>
            <Space>
              <Text style={{ color: '#64748B' }}>已有账号？</Text>
              <Link href="/login">
                <Text style={{ color: '#22C55E', fontWeight: 500 }}>立即登录</Text>
              </Link>
            </Space>
          </div>
        </Card>

        {/* 底部信息 */}
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <Text style={{ color: '#475569', fontSize: '12px' }}>
            LocateAnything &copy; {new Date().getFullYear()} · Visual Grounding AI Platform
          </Text>
        </div>
      </div>
    </div>
  );
}
