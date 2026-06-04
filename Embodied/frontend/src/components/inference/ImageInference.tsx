'use client';

import { useState } from 'react';
import { Card, Form, Select, Input, Slider, Button, Space, Typography, message } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import DragUpload from '@/components/ui/DragUpload';
import ProgressCard from '@/components/ui/ProgressCard';
import ResultViewer from '@/components/ui/ResultViewer';
import { useInferenceStore } from '@/stores/inferenceStore';
import { TaskParams } from '@/types/inference';

const { Text } = Typography;

const TASK_OPTIONS = [
  { value: 'ground_multi', label: '短语定位 (ground_multi)' },
  { value: 'detect', label: '目标检测 (detect)' },
  { value: 'detect_text', label: '文本检测 (detect_text)' },
  { value: 'point', label: '点定位 (point)' },
  { value: 'ground_gui', label: 'GUI定位 (ground_gui)' },
];

const MODE_OPTIONS = [
  { value: 'hybrid', label: 'Hybrid (自动切换)' },
  { value: 'fast', label: 'Fast (单步解码)' },
  { value: 'slow', label: 'Slow (自回归)' },
];

interface ImageInferenceProps {
  defaultModel?: string;
  defaultDevice?: string;
}

export default function ImageInference({ defaultModel, defaultDevice }: ImageInferenceProps) {
  const [file, setFile] = useState<File | null>(null);
  const [form] = Form.useForm();
  const { submitImageTask, isProcessing, result, error, progress, currentTask, clearResult, clearError } =
    useInferenceStore();

  const handleSubmit = async () => {
    if (!file) {
      message.error('请先上传图片');
      return;
    }

    const values = await form.validateFields();
    const params: TaskParams = {
      task: values.task,
      phrase: values.phrase,
      generation_mode: values.generation_mode,
      max_new_tokens: values.max_new_tokens,
      max_image_edge: values.max_image_edge,
      temperature: values.temperature,
    };

    await submitImageTask(file, params);
  };

  const handleDownload = () => {
    if (result?.annotated_image_url) {
      const link = document.createElement('a');
      link.href = result.annotated_image_url;
      link.download = 'annotated_image.jpg';
      link.click();
    }
  };

  return (
    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
      {/* 左侧配置面板 */}
      <div style={{ flex: '1', minWidth: '300px' }}>
        <Card
          title={<Text style={{ color: '#F8FAFC' }}>📤 上传与配置</Text>}
          style={{
            background: '#1E293B',
            border: '1px solid #334155',
            borderRadius: 12,
          }}
        >
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <DragUpload
              accept={['.jpg', '.jpeg', '.png', '.bmp', '.webp']}
              maxSize={20}
              onFileSelect={setFile}
              description="支持 JPG / PNG / BMP / WebP 格式，最大 20MB"
            />

            <Form form={form} layout="vertical" initialValues={{
              task: 'ground_multi',
              phrase: '猫',
              generation_mode: 'hybrid',
              max_new_tokens: 128,
              max_image_edge: 768,
              temperature: 0.7,
            }}>
              <Form.Item name="task" label={<Text style={{ color: '#94A3B8' }}>任务类型</Text>}>
                <Select options={TASK_OPTIONS} />
              </Form.Item>

              <Form.Item name="phrase" label={<Text style={{ color: '#94A3B8' }}>描述短语</Text>}>
                <Input placeholder="请输入描述短语" />
              </Form.Item>

              <Form.Item name="generation_mode" label={<Text style={{ color: '#94A3B8' }}>生成模式</Text>}>
                <Select options={MODE_OPTIONS} />
              </Form.Item>

              <Form.Item name="max_new_tokens" label={<Text style={{ color: '#94A3B8' }}>max_new_tokens</Text>}>
                <Slider min={1} max={2048} step={1} />
              </Form.Item>

              <Form.Item name="max_image_edge" label={<Text style={{ color: '#94A3B8' }}>max_image_edge</Text>}>
                <Slider min={128} max={2048} step={64} />
              </Form.Item>

              <Form.Item name="temperature" label={<Text style={{ color: '#94A3B8' }}>temperature</Text>}>
                <Slider min={0} max={1.5} step={0.05} />
              </Form.Item>
            </Form>

            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleSubmit}
              loading={isProcessing}
              block
              size="large"
              style={{ height: 48 }}
            >
              {isProcessing ? '推理中...' : '▶ 开始推理'}
            </Button>

            {/* 进度显示 */}
            {isProcessing && (
              <ProgressCard
                status={currentTask?.status || 'processing'}
                progress={progress}
                taskId={currentTask?.task_id}
              />
            )}

            {/* 错误显示 */}
            {error && (
              <ProgressCard
                status="failed"
                message={error}
              />
            )}
          </Space>
        </Card>
      </div>

      {/* 右侧结果展示 */}
      <div style={{ flex: '1', minWidth: '300px' }}>
        {result ? (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <ResultViewer
              imageUrl={result.annotated_image_url}
              boxes={result.boxes}
              onDownload={handleDownload}
            />

            <Card
              title={<Text style={{ color: '#F8FAFC' }}>📊 推理详情</Text>}
              style={{
                background: '#1E293B',
                border: '1px solid #334155',
                borderRadius: 12,
              }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text style={{ color: '#94A3B8' }}>模型输出：</Text>
                  <div style={{
                    background: '#0F172A',
                    padding: '12px',
                    borderRadius: '8px',
                    marginTop: '8px',
                    fontFamily: "var(--font-fira-code), monospace",
                    fontSize: '12px',
                    color: '#22C55E',
                    overflowX: 'auto',
                  }}>
                    {result.answer}
                  </div>
                </div>

                <div>
                  <Text style={{ color: '#94A3B8' }}>统计信息：</Text>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                    <Space>
                      <Text style={{ color: '#64748B' }}>解码模式：</Text>
                      <Text style={{ color: '#F8FAFC' }}>{result.stats.decode_mode}</Text>
                    </Space>
                    <Space>
                      <Text style={{ color: '#64748B' }}>Token数：</Text>
                      <Text style={{ color: '#F8FAFC' }}>{result.stats.tokens}</Text>
                    </Space>
                    <Space>
                      <Text style={{ color: '#64748B' }}>耗时：</Text>
                      <Text style={{ color: '#F8FAFC' }}>{result.stats.time_ms.toFixed(1)}ms</Text>
                    </Space>
                  </div>
                </div>
              </Space>
            </Card>
          </Space>
        ) : (
          <Card
            style={{
              background: '#1E293B',
              border: '1px solid #334155',
              borderRadius: 12,
              height: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <div style={{ textAlign: 'center', padding: '60px' }}>
              <PlayCircleOutlined style={{ fontSize: '48px', color: '#334155', marginBottom: '16px' }} />
              <Text style={{ color: '#64748B', display: 'block' }}>
                上传图片并点击"开始推理"查看结果
              </Text>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
