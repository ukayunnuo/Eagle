'use client';

import { Layout } from 'antd';

const { Content } = Layout;

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Layout style={{ minHeight: '100vh', background: '#0F172A' }}>
      <Content
        style={{
          width: '100%',
          minHeight: '100vh',
        }}
      >
        {children}
      </Content>
    </Layout>
  );
}
