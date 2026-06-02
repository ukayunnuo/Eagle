import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getModelInfo, imageInference } from "../api/inference";
import { Upload, Play, Download } from "lucide-react";
import type { ImageInferenceResult } from "../api/types";

const TASKS = [
  { value: "detect", label: "目标检测" },
  { value: "ground_multi", label: "短语定位" },
  { value: "detect_text", label: "文本检测" },
  { value: "point", label: "点定位" },
  { value: "ground_gui", label: "GUI 定位" },
  { value: "chat", label: "图像对话" },
];

export default function InferencePage() {
  const model = useQuery({ queryKey: ["model"], queryFn: getModelInfo });

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

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  function handleFile(f: File) {
    setFile(f);
    setResult(null);
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }

  async function handleSubmit() {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const res = await imageInference(file, {
        task,
        phrase,
        categories,
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

  const supportedTasks = model.data?.supported_tasks || TASKS.map((t) => t.value);

  return (
    <div className="space-y-6 max-w-6xl">
      <h2 className="text-2xl font-bold">推理工作台</h2>

      <div className="grid grid-cols-2 gap-6">
        {/* 左侧：上传 + 参数 */}
        <div className="space-y-4">
          {/* 上传区域 */}
          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-slate-700 hover:border-green-500 rounded-xl p-8 text-center cursor-pointer transition-colors"
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            {preview ? (
              <img src={preview} alt="预览" className="max-h-48 mx-auto rounded-lg" />
            ) : (
              <div className="space-y-2">
                <Upload className="mx-auto text-slate-500" size={32} />
                <p className="text-slate-400 text-sm">拖拽或点击上传图片</p>
              </div>
            )}
          </div>

          {/* 参数面板 */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">任务类型</label>
              <select
                value={task}
                onChange={(e) => setTask(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100"
              >
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
                <input
                  value={task === "detect" ? categories : phrase}
                  onChange={(e) => (task === "detect" ? setCategories : setPhrase)(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100"
                />
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-slate-500 mb-1">max_edge</label>
                <input
                  type="number"
                  value={maxImageEdge}
                  onChange={(e) => setMaxImageEdge(+e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">max_tokens</label>
                <input
                  type="number"
                  value={maxNewTokens}
                  onChange={(e) => setMaxNewTokens(+e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">temperature</label>
                <input
                  type="number"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(+e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-100"
                />
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!file || loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
            >
              <Play size={16} />
              {loading ? "推理中..." : "开始推理"}
            </button>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        {/* 右侧：结果 */}
        <div className="space-y-4">
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl min-h-[300px]">
            <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              标注结果
            </h3>
            {result ? (
              <div className="space-y-3">
                <img
                  src={result.annotated_image_url}
                  alt="标注结果"
                  className="w-full rounded-lg"
                />
                <div className="p-3 bg-slate-800 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">模型输出</p>
                  <pre className="text-xs text-slate-300 whitespace-pre-wrap break-all font-mono">
                    {result.answer}
                  </pre>
                </div>
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
                <a
                  href={result.annotated_image_url}
                  download
                  className="inline-flex items-center gap-1 px-3 py-1.5 border border-green-500 text-green-400 rounded-lg text-sm hover:bg-green-500/10 transition-colors"
                >
                  <Download size={14} /> 下载标注图
                </a>
              </div>
            ) : (
              <p className="text-slate-600 text-sm text-center mt-20">上传图片并点击推理查看结果</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
