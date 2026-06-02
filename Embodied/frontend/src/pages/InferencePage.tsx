import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getModelInfo, imageInference, videoInference } from "../api/inference";
import { getTask } from "../api/tasks";
import { Upload, Play, Download, Image, Video, Loader2 } from "lucide-react";
import type { ImageInferenceResult, ModelInfo, TaskStatus } from "../api/types";

const TASKS = [
  { value: "detect", label: "目标检测" },
  { value: "ground_multi", label: "短语定位" },
  { value: "detect_text", label: "文本检测" },
  { value: "point", label: "点定位" },
  { value: "ground_gui", label: "GUI 定位" },
  { value: "chat", label: "图像对话" },
];

type Tab = "image" | "video";

export default function InferencePage() {
  const model = useQuery({ queryKey: ["model"], queryFn: getModelInfo });
  const [tab, setTab] = useState<Tab>("image");

  return (
    <div className="space-y-6 max-w-6xl">
      <h2 className="text-2xl font-bold">推理工作台</h2>

      {/* 标签切换 */}
      <div className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl w-fit">
        {([
          { key: "image" as Tab, icon: Image, label: "图片推理" },
          { key: "video" as Tab, icon: Video, label: "视频推理" },
        ]).map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key
                ? "bg-green-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {tab === "image" ? (
        <ImageInferencePanel model={model.data} />
      ) : (
        <VideoInferencePanel model={model.data} />
      )}
    </div>
  );
}

/* ==================== 图片推理 ==================== */

function ImageInferencePanel({ model }: { model: ModelInfo | undefined }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [task, setTask] = useState("ground_multi");
  const [phrase, setPhrase] = useState("猫");
  const [categories, setCategories] = useState("person");
  const [maxImageEdge, setMaxImageEdge] = useState(768);
  const [maxNewTokens, setMaxNewTokens] = useState(128);
  const [temperature, setTemperature] = useState(0.7);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImageInferenceResult | null>(null);
  const [error, setError] = useState("");

  const supportedTasks = model?.supported_tasks || TASKS.map((t) => t.value);

  function handleFile(f: File) {
    setFile(f);
    setResult(null);
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  async function handleSubmit() {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const res = await imageInference(file, {
        task, phrase, categories,
        generation_mode: "hybrid",
        max_new_tokens: maxNewTokens,
        max_image_edge: maxImageEdge,
        temperature,
      });
      setResult(res);
    } catch {
      setError("推理失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="space-y-4">
        <UploadZone
          accept="image/*"
          label="拖拽或点击上传图片"
          preview={preview}
          previewType="image"
          onDrop={onDrop}
          onFile={handleFile}
        />
        <ParamsPanel
          task={task} setTask={setTask}
          phrase={phrase} setPhrase={setPhrase}
          categories={categories} setCategories={setCategories}
          maxImageEdge={maxImageEdge} setMaxImageEdge={setMaxImageEdge}
          maxNewTokens={maxNewTokens} setMaxNewTokens={setMaxNewTokens}
          temperature={temperature} setTemperature={setTemperature}
          supportedTasks={supportedTasks}
          submitLabel={loading ? "推理中..." : "开始推理"}
          submitIcon={loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          onSubmit={handleSubmit}
          submitDisabled={!file || loading}
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>

      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl min-h-[300px]">
        <ResultHeader label="标注结果" />
        {result ? (
          <div className="space-y-3">
            <img src={result.annotated_image_url} alt="标注结果" className="w-full rounded-lg" />
            <CodeBlock title="模型输出" content={result.answer} />
            {result.boxes.length > 0 && (
              <div className="p-3 bg-slate-800 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">检测框 ({result.boxes.length})</p>
                <div className="space-y-1">
                  {result.boxes.map((b, i) => (
                    <div key={i} className="text-xs text-slate-300 font-mono">
                      {b.label}: ({Math.round(b.x1)}, {Math.round(b.y1)}) → ({Math.round(b.x2)}, {Math.round(b.y2)})
                    </div>
                  ))}
                </div>
              </div>
            )}
            <DownloadButton href={result.annotated_image_url} label="下载标注图" />
          </div>
        ) : (
          <EmptyResult text="上传图片并点击推理查看结果" />
        )}
      </div>
    </div>
  );
}

/* ==================== 视频推理 ==================== */

function VideoInferencePanel({ model }: { model: ModelInfo | undefined }) {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [task, setTask] = useState("ground_multi");
  const [phrase, setPhrase] = useState("猫");
  const [categories, setCategories] = useState("person");
  const [maxImageEdge, setMaxImageEdge] = useState(384);
  const [maxNewTokens, setMaxNewTokens] = useState(64);
  const [temperature, setTemperature] = useState(0.7);
  const [everyNFrames, setEveryNFrames] = useState(10);
  const [maxFrames, setMaxFrames] = useState(0);
  const [reuseLast, setReuseLast] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [, setTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null);
  const [error, setError] = useState("");

  const supportedTasks = model?.supported_tasks || TASKS.map((t) => t.value);

  function handleFile(f: File) {
    setFile(f);
    setTaskId(null);
    setTaskStatus(null);
    setError("");
    setVideoUrl(URL.createObjectURL(f));
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  async function handleSubmit() {
    if (!file) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await videoInference(file, {
        task, phrase, categories,
        generation_mode: "hybrid",
        max_new_tokens: maxNewTokens,
        max_image_edge: maxImageEdge,
        temperature,
        every_n_frames: everyNFrames,
        max_frames: maxFrames,
        reuse_last: reuseLast,
      });
      setTaskId(res.task_id);
      // 开始轮询
      pollTask(res.task_id);
    } catch {
      setError("提交失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function pollTask(id: string) {
    const poll = async () => {
      try {
        const status = await getTask(id);
        setTaskStatus(status);
        if (status.status === "processing" || status.status === "pending") {
          setTimeout(poll, 2000);
        }
      } catch {
        // 忽略轮询错误
      }
    };
    poll();
  }

  const isRunning = taskStatus?.status === "processing" || taskStatus?.status === "pending";

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="space-y-4">
        <UploadZone
          accept="video/mp4,video/mov,video/avi,video/mkv,video/webm"
          label="拖拽或点击上传视频"
          preview={videoUrl}
          previewType="video"
          onDrop={onDrop}
          onFile={handleFile}
        />
        <ParamsPanel
          task={task} setTask={setTask}
          phrase={phrase} setPhrase={setPhrase}
          categories={categories} setCategories={setCategories}
          maxImageEdge={maxImageEdge} setMaxImageEdge={setMaxImageEdge}
          maxNewTokens={maxNewTokens} setMaxNewTokens={setMaxNewTokens}
          temperature={temperature} setTemperature={setTemperature}
          supportedTasks={supportedTasks}
          submitLabel={submitting ? "提交中..." : isRunning ? "处理中..." : "开始视频标注"}
          submitIcon={submitting || isRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          onSubmit={handleSubmit}
          submitDisabled={!file || submitting || isRunning}
          extraParams={
            <>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">采样间隔帧</label>
                  <input type="number" value={everyNFrames} min={1}
                    onChange={(e) => setEveryNFrames(+e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-100" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">最大帧数</label>
                  <input type="number" value={maxFrames} min={0}
                    onChange={(e) => setMaxFrames(+e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-100" />
                  <p className="text-[10px] text-slate-600 mt-0.5">0 = 全部</p>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={reuseLast}
                      onChange={(e) => setReuseLast(e.target.checked)}
                      className="rounded" />
                    复用上一帧
                  </label>
                </div>
              </div>
            </>
          }
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>

      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl min-h-[300px]">
        <ResultHeader label="视频标注结果" />
        {taskStatus ? (
          <div className="space-y-3">
            {/* 进度条 */}
            {isRunning && taskStatus.progress && (
              <div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${taskStatus.progress.total_frames
                        ? (taskStatus.progress.current_frame! / taskStatus.progress.total_frames) * 100
                        : 0}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  处理帧 {taskStatus.progress.current_frame || 0} / {taskStatus.progress.total_frames || "?"}
                </p>
              </div>
            )}

            {/* 排队中 */}
            {taskStatus.status === "pending" && (
              <div className="flex items-center gap-2 text-blue-400 text-sm">
                <Loader2 size={14} className="animate-spin" />
                排队中...
              </div>
            )}

            {/* 完成 */}
            {taskStatus.status === "completed" && taskStatus.result && (
              <>
                {taskStatus.result.output_video_url && (
                  <video
                    src={taskStatus.result.output_video_url}
                    controls
                    className="w-full rounded-lg"
                  />
                )}
                {taskStatus.result.processed_frames && (
                  <p className="text-xs text-slate-500">
                    处理帧数: {taskStatus.result.processed_frames}
                  </p>
                )}
                {taskStatus.result.output_video_url && (
                  <DownloadButton href={taskStatus.result.output_video_url} label="下载标注视频" />
                )}
                {taskStatus.result.output_json_url && (
                  <DownloadButton href={taskStatus.result.output_json_url} label="下载 JSON" />
                )}
              </>
            )}

            {/* 失败 */}
            {taskStatus.status === "failed" && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm">任务失败</p>
                {taskStatus.error && (
                  <pre className="text-xs text-red-300 mt-1 whitespace-pre-wrap font-mono">{taskStatus.error}</pre>
                )}
              </div>
            )}

            {/* 已取消 */}
            {taskStatus.status === "cancelled" && (
              <p className="text-slate-500 text-sm">任务已取消</p>
            )}
          </div>
        ) : (
          <EmptyResult text="上传视频并点击提交开始标注" />
        )}
      </div>
    </div>
  );
}

/* ==================== 共享组件 ==================== */

function UploadZone({
  accept, label, preview, previewType, onDrop, onFile,
}: {
  accept: string;
  label: string;
  preview: string | null;
  previewType: "image" | "video";
  onDrop: (e: React.DragEvent) => void;
  onFile: (f: File) => void;
}) {
  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      className="border-2 border-dashed border-slate-700 hover:border-green-500 rounded-xl p-8 text-center cursor-pointer transition-colors"
      onClick={() => document.getElementById(`file-input-${previewType}`)?.click()}
    >
      <input
        id={`file-input-${previewType}`}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      {preview ? (
        previewType === "video" ? (
          <video src={preview} className="max-h-48 mx-auto rounded-lg" muted />
        ) : (
          <img src={preview} alt="预览" className="max-h-48 mx-auto rounded-lg" />
        )
      ) : (
        <div className="space-y-2">
          <Upload className="mx-auto text-slate-500" size={32} />
          <p className="text-slate-400 text-sm">{label}</p>
        </div>
      )}
    </div>
  );
}

function ParamsPanel({
  task, setTask, phrase, setPhrase, categories, setCategories,
  maxImageEdge, setMaxImageEdge, maxNewTokens, setMaxNewTokens,
  temperature, setTemperature, supportedTasks,
  submitLabel, submitIcon, onSubmit, submitDisabled,
  extraParams,
}: {
  task: string; setTask: (v: string) => void;
  phrase: string; setPhrase: (v: string) => void;
  categories: string; setCategories: (v: string) => void;
  maxImageEdge: number; setMaxImageEdge: (v: number) => void;
  maxNewTokens: number; setMaxNewTokens: (v: number) => void;
  temperature: number; setTemperature: (v: number) => void;
  supportedTasks: string[];
  submitLabel: string; submitIcon: React.ReactNode;
  onSubmit: () => void; submitDisabled: boolean;
  extraParams?: React.ReactNode;
}) {
  return (
    <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
      <div>
        <label className="block text-xs text-slate-500 mb-1">任务类型</label>
        <select value={task} onChange={(e) => setTask(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100">
          {TASKS.filter((t) => supportedTasks.includes(t.value)).map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      {(task === "ground_multi" || task === "detect") && (
        <div>
          <label className="block text-xs text-slate-500 mb-1">
            {task === "detect" ? "检测类别" : "描述短语"}
          </label>
          <input value={task === "detect" ? categories : phrase}
            onChange={(e) => (task === "detect" ? setCategories : setPhrase)(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100" />
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs text-slate-500 mb-1">max_edge</label>
          <input type="number" value={maxImageEdge}
            onChange={(e) => setMaxImageEdge(+e.target.value)}
            className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-100" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">max_tokens</label>
          <input type="number" value={maxNewTokens}
            onChange={(e) => setMaxNewTokens(+e.target.value)}
            className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-100" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">temperature</label>
          <input type="number" step="0.1" value={temperature}
            onChange={(e) => setTemperature(+e.target.value)}
            className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-100" />
        </div>
      </div>

      {extraParams}

      <button onClick={onSubmit} disabled={submitDisabled}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors">
        {submitIcon}
        {submitLabel}
      </button>
    </div>
  );
}

function ResultHeader({ label }: { label: string }) {
  return (
    <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-green-400" />
      {label}
    </h3>
  );
}

function EmptyResult({ text }: { text: string }) {
  return <p className="text-slate-600 text-sm text-center mt-20">{text}</p>;
}

function CodeBlock({ title, content }: { title: string; content: string }) {
  return (
    <div className="p-3 bg-slate-800 rounded-lg">
      <p className="text-xs text-slate-500 mb-1">{title}</p>
      <pre className="text-xs text-slate-300 whitespace-pre-wrap break-all font-mono">{content}</pre>
    </div>
  );
}

function DownloadButton({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} download
      className="inline-flex items-center gap-1 px-3 py-1.5 border border-green-500 text-green-400 rounded-lg text-sm hover:bg-green-500/10 transition-colors">
      <Download size={14} /> {label}
    </a>
  );
}
