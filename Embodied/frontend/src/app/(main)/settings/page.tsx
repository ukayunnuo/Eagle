'use client';

import { useState } from 'react';
import {
  Card,
  Form,
  Select,
  Slider,
  Button,
  Typography,
  Space,
  message,
  Modal,
  Divider,
  Input,
} from 'antd';
import {
  SaveOutlined,
  UndoOutlined,
  ExclamationCircleOutlined,
  LockOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useSettingsStore } from '@/stores/settingsStore';
import { useUserStore } from '@/stores/userStore';
import { useRouter } from 'next/navigation';

const { Title, Text } = Typography;

const MODEL_OPTIONS = [
  { value: 'nvidia/LocateAnything-3B', label: 'LocateAnything-3B' },
];

const DEVICE_OPTIONS = [
  { value: 'cuda', label: 'CUDA (GPU)' },
  { value: 'cpu', label: 'CPU' },
];

const DTYPE_OPTIONS = [
  { value: 'bfloat16', label: 'bfloat16' },
  { value: 'float16', label: 'float16' },
  { value: 'float32', label: 'float32' },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useUserStore();
  const settings = useSettingsStore();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const values = await form.validateFields();
      settings.updateSettings(values);
      message.success('设置已保存');
    } catch (error) {
      message.error('保存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    Modal.confirm({
      title: '确定要重置设置吗？',
      icon: <ExclamationCircleOutlined />,
      content: '这将恢复所有设置到默认值',
      onOk: () => {
        settings.resetSettings();
        form.resetFields();
        message.success('设置已重置');
      },
    });
  };

  const handleChangePassword = () => {
    // TODO: 实现修改密码功能
    message.info('修改密码功能待实现');
  };

  const handleDeleteAccount = () => {
    Modal.confirm({
      title: '确定要注销账号吗？',
      icon: <ExclamationCircleOutlined />,
      content: '此操作不可撤销，所有数据将被删除',
      okText: '确定注销',
      okType: 'danger',
      onOk: () => {
        // TODO: 实现注销账号功能
        message.info('注销账号功能待实现');
      },
    });
  };

  const handleDeleteAllTasks = () => {
    Modal.confirm({
      title: '确定要删除所有任务吗？',
      icon: <ExclamationCircleOutlined />,
      content: '此操作不可撤销',
      okText: '确定删除',
      okType: 'danger',
      onOk: () => {
        // TODO: 实现删除所有任务功能
        message.info('删除所有任务功能待实现');
      },
    });
  };

  return (
    <div>
      <Title level={2} style={{ color: '#F8FAFC', marginBottom: 24 }}>
        用户设置
      </Title>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        {/* 左侧设置 */}
        <div style={{ flex: '2', minWidth: '400px' }}>
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            {/* 基本信息 */}
            <Card
              title={<Text style={{ color: '#F8FAFC' }}>👤 基本信息</Text>}
              style={{
                background: '#1E293B',
                border: '1px solid #334155',
                borderRadius: 12,
              }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text style={{ color: '#94A3B8' }}>用户名</Text>
                  <Text style={{ color: '#F8FAFC' }}>{user?.username || '-'}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text style={{ color: '#94A3B8' }}>注册时间</Text>
                  <Text style={{ color: '#F8FAFC' }}>
                    {user?.created_at ? new Date(user.created_at).toLocaleString('zh-CN') : '-'}
                  </Text>
                </div>
                <Button
                  icon={<LockOutlined />}
                  onClick={handleChangePassword}
                  style={{ marginTop: '16px' }}
                >
                  修改密码
                </Button>
              </Space>
            </Card>

            {/* 推理默认参数 */}
            <Card
              title={<Text style={{ color: '#F8FAFC' }}>⚙️ 推理默认参数</Text>}
              style={{
                background: '#1E293B',
                border: '1px solid #334155',
                borderRadius: 12,
              }}
            >
              <Form
                form={form}
                layout="vertical"
                initialValues={{
                  defaultModel: settings.defaultModel,
                  defaultDevice: settings.defaultDevice,
                  defaultDtype: settings.defaultDtype,
                  defaultMaxImageEdge: settings.defaultMaxImageEdge,
                }}
              >
                <Form.Item
                  name="defaultModel"
                  label={<Text style={{ color: '#94A3B8' }}>默认模型</Text>}
                >
                  <Select options={MODEL_OPTIONS} />
                </Form.Item>

                <Form.Item
                  name="defaultDevice"
                  label={<Text style={{ color: '#94A3B8' }}>默认设备</Text>}
                >
                  <Select options={DEVICE_OPTIONS} />
                </Form.Item>

                <Form.Item
                  name="defaultDtype"
                  label={<Text style={{ color: '#94A3B8' }}>默认精度</Text>}
                >
                  <Select options={DTYPE_OPTIONS} />
                </Form.Item>

                <Form.Item
                  name="defaultMaxImageEdge"
                  label={<Text style={{ color: '#94A3B8' }}>默认最大图片边长</Text>}
                >
                  <Slider min={128} max={2048} step={64} />
                </Form.Item>

                <Space>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={handleSave}
                    loading={loading}
                  >
                    保存设置
                  </Button>
                  <Button
                    icon={<UndoOutlined />}
                    onClick={handleReset}
                  >
                    重置默认
                  </Button>
                </Space>
              </Form>
            </Card>
          </Space>
        </div>

        {/* 右侧危险操作 */}
        <div style={{ flex: '1', minWidth: '300px' }}>
          <Card
            title={<Text style={{ color: '#EF4444' }}>⚠️ 危险操作</Text>}
            style={{
              background: '#1E293B',
              border: '1px solid #7F1D1D',
              borderRadius: 12,
            }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <Text style={{ color: '#94A3B8', display: 'block', marginBottom: '8px' }}>
                  删除所有任务
                </Text>
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={handleDeleteAllTasks}
                  block
                >
                  删除所有任务
                </Button>
              </div>

              <Divider style={{ borderColor: '#334155' }} />

              <div>
                <Text style={{ color: '#94A3B8', display: 'block', marginBottom: '8px' }}>
                  注销账号
                </Text>
                <Text style={{ color: '#64748B', fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                  此操作不可撤销，所有数据将被永久删除
                </Text>
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={handleDeleteAccount}
                  block
                >
                  注销账号
                </Button>
              </div>
            </Space>
          </Card>
        </div>
      </div>
    </div>
  );
}
