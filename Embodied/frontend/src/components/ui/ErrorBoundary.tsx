'use client';

import { Component, ErrorInfo, ReactNode } from 'react';
import { Button, Result, Typography } from 'antd';

const { Text } = Typography;

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            background: '#0F172A',
            padding: '24px',
          }}
        >
          <Result
            status="error"
            title={<Text style={{ color: '#F8FAFC', fontSize: '24px' }}>出现错误</Text>}
            subTitle={
              <Text style={{ color: '#94A3B8' }}>
                {this.state.error?.message || '发生了未知错误'}
              </Text>
            }
            extra={[
              <Button
                type="primary"
                key="retry"
                onClick={() => this.setState({ hasError: false, error: null })}
              >
                重试
              </Button>,
              <Button
                key="home"
                onClick={() => window.location.href = '/dashboard'}
              >
                返回首页
              </Button>,
            ]}
          />
        </div>
      );
    }

    return this.props.children;
  }
}
