import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Play, Pause, RotateCcw, Upload, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { drawHud } from "@/lib/hud";
import { downloadCsv } from "@/lib/agri";
import type { TrackingState } from "./useTracking";
import { StatCards } from "./StatCards";
import fieldPlot from "@/assets/field-plot.jpg";

interface Props {
  state: TrackingState;
  mode: "camera" | "video";
}

export function MonitorView({ state, mode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camOn, setCamOn] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawHud(ctx, state.visibleTracks, {
      alert: state.counts.alert,
      showTrajectory: state.showTrajectory,
      width: state.width,
      height: state.height,
    });
  }, [state.visibleTracks, state.counts.alert, state.showTrajectory, state.width, state.height]);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    },
    [videoUrl],
  );

  const startCam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamOn(true);
      setCamError(null);
      state.setRunning(true);
    } catch {
      setCamError("Camera unavailable — running on the sample field feed instead.");
      state.setRunning(true);
    }
  };

  const stopCam = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamOn(false);
    state.setRunning(false);
  };

  const onFile = (file?: File) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    state.reset();
    state.setRunning(true);
  };

  return (
    <div className="space-y-4">
      <StatCards {...state.counts} />

      <div className="panel grid-lines relative overflow-hidden">
        <div className="relative mx-auto aspect-[16/9] w-full max-w-[960px]">
          {mode === "camera" && camOn ? (
            <video
              ref={videoRef}
              muted
              playsInline
              className="absolute inset-0 h-full w-full object-cover opacity-90"
            />
          ) : mode === "video" && videoUrl ? (
            <video
              key={videoUrl}
              src={videoUrl}
              autoPlay
              muted
              loop
              playsInline
              className="absolute inset-0 h-full w-full object-cover opacity-90"
            />
          ) : (
            <img
              src={fieldPlot}
              alt="Sample crop field feed"
              width={1200}
              height={800}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover opacity-70"
            />
          )}
          <canvas
            ref={canvasRef}
            width={state.width}
            height={state.height}
            className="absolute inset-0 h-full w-full"
          />
          <div className="absolute top-3 left-3 flex items-center gap-2 rounded bg-background/70 px-2 py-1 text-[11px] tracking-widest uppercase">
            <span
              className={`h-2 w-2 rounded-full ${state.running ? "bg-crop animate-pulse" : "bg-muted-foreground"}`}
            />
            {state.running ? "Tracking" : "Standby"} · frame #{state.frame}
          </div>
        </div>
      </div>

      {camError && <p className="text-pest text-xs">{camError}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {mode === "camera" ? (
          camOn ? (
            <Button variant="secondary" onClick={stopCam}>
              <CameraOff className="mr-2 h-4 w-4" /> Stop camera
            </Button>
          ) : (
            <Button onClick={startCam}>
              <Camera className="mr-2 h-4 w-4" /> Start live monitor
            </Button>
          )
        ) : (
          <label>
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <Button asChild>
              <span>
                <Upload className="mr-2 h-4 w-4" /> Upload field video
              </span>
            </Button>
          </label>
        )}
        <Button variant="secondary" onClick={() => state.setRunning(!state.running)}>
          {state.running ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
          {state.running ? "Pause analysis" : "Resume analysis"}
        </Button>
        <Button variant="outline" onClick={state.reset}>
          <RotateCcw className="mr-2 h-4 w-4" /> Reset session
        </Button>
        <Button
          variant="outline"
          onClick={() => downloadCsv("vectratrack-agriculture.csv", state.rowsRef.current)}
        >
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="panel max-h-52 overflow-y-auto p-4">
        <p className="mb-2 text-xs tracking-widest text-muted-foreground uppercase">Event log</p>
        {state.logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pest density events yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {state.logs.map((l) => (
              <li key={l.id} className={l.level === "warn" ? "text-alert" : "text-crop"}>
                {l.level === "warn" ? "⚠️ " : "✅ "}
                {l.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
