'use client';

import { useState } from 'react';
import { Card, Form, Select, Input, Slider, Button, Space, Typography, Switch, InputNumber, message } from 'antd';
import { VideoCameraOutlined } from '@ant-design/icons';
import DragUpload from '@/components/ui/DragUpload';
import ProgressCard from '@/components/ui/ProgressCard';
import { useInferenceStore } from '@/stores/inferenceStore';
import { TaskParams } from '@/types/inference';

const { Text } = Typography;

const TASK_OPTIONS = [
  { value: 'ground_multi', label: '短语定位 (ground_multi)' },
  { value: 'detect', label: '目标检测 (detect)' },
  { value: 'detect_text', label: '文本检测 (detect_text)' },
];

const MODE_OPTIONS = [
  { value: 'hybrid', label: 'Hybrid (自动切换)' },
  { value: 'fast', label: 'Fast (单步解码)' },
  { value: 'slow', label: 'Slow (自回归)' },
];

export default function VideoInference() {
  const [file, setFile] = useState<File | null>(null);
  const [form] = Form.useForm();
  const { submitVideoTask, isProcessing, result, error, progress, currentTask } = useInferenceStore();

  const handleSubmit = async () => {
    if (!file) {
      message.error('请先上传视频');
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
      every_n_frames: values.every_n_frames,
      max_frames: values.max_frames,
      reuse_last: values.reuse_last,
    };

    await submitVideoTask(file, params);
  };

  const handleDownload = () => {
    if (result?.annotated_image_url) {
      const link = document.createElement('a');
      link.href = result.annotated_image_url;
      link.download = 'annotated_video.mp4';
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
              accept={['.mp4', '.mov', '.avi', '.mkv', '.webm']}
              maxSize={500}
              onFileSelect={setFile}
              description="支持 MP4 / MOV / AVI / MKV / WebM 格式，最大 500MB"
            />

            <Form form={form} layout="vertical" initialValues={{
              task: 'ground_multi',
              phrase: '猫',
              generation_mode: 'hybrid',
              max_new_tokens: 64,
              max_image_edge: 384,
              temperature: 0.7,
              every_n_frames: 10,
              max_frames: 0,
              reuse_last: true,
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
                <Slider min={1} max={512} step={1} />
              </Form.Item>

              <Form.Item name="max_image_edge" label={<Text style={{ color: '#94A3B8' }}>max_image_edge</Text>}>
                <Slider min={128} max={1280} step={64} />
              </Form.Item>

              <Form.Item name="temperature" label={<Text style={{ color: '#94A3B8' }}>temperature</Text>}>
                <Slider min={0} max={1.5} step={0.05} />
              </Form.Item>

              <Form.Item name="every_n_frames" label={<Text style={{ color: '#94A3B8' }}>采样间隔帧数</Text>}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item name="max_frames" label={<Text style={{ color: '#94A3B8' }}>最大处理帧数 (0=全部)</Text>}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item name="reuse_last" label={<Text style={{ color: '#94A3B8' }}>未推理帧复用上一帧结果</Text>}>
                <Switch />
              </Form.Item>
            </Form>

            <Button
              type="primary"
              icon={<VideoCameraOutlined />}
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
                message={currentTask?.progress ? `处理帧: ${currentTask.progress.current_frame}/${currentTask.progress.total_frames}` : undefined}
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
            <Card
              title={<Text style={{ color: '#F8FAFC' }}>🎬 视频结果</Text>}
              style={{
                background: '#1E293B',
                border: '1px solid #334155',
                borderRadius: 12,
              }}
            >
              <video
                src={result.annotated_image_url}
                controls
                style={{
                  width: '100%',
                  borderRadius: '8px',
                }}
              />
              <Button
                type="primary"
                icon={<VideoCameraOutlined />}
                onClick={handleDownload}
                block
                style={{ marginTop: '16px' }}
              >
                下载视频
              </Button>
            </Card>

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
                    maxHeight: '200px',
                    overflowY: 'auto',
                  }}>
                    {result.answer}
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
              <VideoCameraOutlined style={{ fontSize: '48px', color: '#334155', marginBottom: '16px' }} />
              <Text style={{ color: '#64748B', display: 'block' }}>
                上传视频并点击"开始推理"查看结果
              </Text>
              <Text style={{ color: '#475569', display: 'block', marginTop: '8px', fontSize: '12px' }}>
                视频推理可能需要较长时间，请耐心等待
              </Text>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
