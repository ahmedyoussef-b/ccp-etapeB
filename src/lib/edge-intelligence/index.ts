/**
 * Edge Intelligence Service
 * Traitement local des flux médias dans le navigateur via WebAssembly/WebGL.
 * Utilise l'API native MediaStream et des heuristiques locales pour la détection d'anomalies.
 */

export interface EdgeAnalysisResult {
  hasAnomaly: boolean;
  confidence: number;
  labels: string[];
  timestamp: string;
  deviceId?: string;
}

export interface EdgeDetectionOptions {
  deviceId?: string;
  sampleIntervalMs?: number;
  anomalyThreshold?: number;
}

type AnalysisCallback = (result: EdgeAnalysisResult) => void;

export class EdgeIntelligenceService {
  private static instance: EdgeIntelligenceService | null = null;
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private intervalId: number | null = null;
  private callbacks: Set<AnalysisCallback> = new Set();
  private options: Required<EdgeDetectionOptions> = {
    deviceId: "camera-main",
    sampleIntervalMs: 3000,
    anomalyThreshold: 0.6,
  };

  private constructor() {}

  static getInstance(): EdgeIntelligenceService {
    if (!EdgeIntelligenceService.instance) {
      EdgeIntelligenceService.instance = new EdgeIntelligenceService();
    }
    return EdgeIntelligenceService.instance;
  }

  async startCamera(deviceId?: string): Promise<MediaStream> {
    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
        audio: false,
      };
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.stream;
    } catch {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      return this.stream;
    }
  }

  attachVideo(videoElement: HTMLVideoElement) {
    this.videoElement = videoElement;
    if (this.stream) {
      videoElement.srcObject = this.stream;
      videoElement.play().catch(() => {});
    }
  }

  startAnalysis(options: EdgeDetectionOptions = {}): void {
    this.options = { ...this.options, ...options };
    this.stopAnalysis();

    if (!this.canvas) {
      this.canvas = document.createElement("canvas");
      this.ctx = this.canvas.getContext("2d", { willReadFrequently: true }) ?? null;
    }

    this.intervalId = window.setInterval(() => this.analyzeFrame(), this.options.sampleIntervalMs);
  }

  stopAnalysis(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  onAnalysis(callback: AnalysisCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  async analyzeFrame(): Promise<EdgeAnalysisResult> {
    if (!this.videoElement || !this.canvas || !this.ctx) {
      return this.emptyResult();
    }

    try {
      this.canvas.width = this.videoElement.videoWidth || 320;
      this.canvas.height = this.videoElement.videoHeight || 240;
      this.ctx.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height);
      const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      const result = this.computeLocalHeuristics(imageData);
      this.notify(result);
      return result;
    } catch {
      return this.emptyResult();
    }
  }

  private computeLocalHeuristics(imageData: ImageData): EdgeAnalysisResult {
    const data = imageData.data;
    let totalBrightness = 0;
    let maxBrightness = 0;
    let minBrightness = 255;
    const pixelCount = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const brightness = (r + g + b) / 3;
      totalBrightness += brightness;
      if (brightness > maxBrightness) maxBrightness = brightness;
      if (brightness < minBrightness) minBrightness = brightness;
    }

    const avgBrightness = totalBrightness / pixelCount;
    const contrast = maxBrightness - minBrightness;
    const labels: string[] = [];
    let confidence = 0.5;

    if (avgBrightness < 30) {
      labels.push("dark_scene");
      confidence += 0.2;
    } else if (avgBrightness > 220) {
      labels.push("overexposed");
      confidence += 0.2;
    } else {
      labels.push("normal_lighting");
      confidence += 0.1;
    }

    if (contrast > 150) {
      labels.push("high_contrast");
      confidence += 0.15;
    }

    if (avgBrightness > 80 && avgBrightness < 200 && contrast < 60) {
      labels.push("uniform_scene");
    }

    const motionVariance = this.estimateMotionVariance(data);
    if (motionVariance > 30) {
      labels.push("motion_detected");
      confidence += 0.2;
    }

    const hasAnomaly = confidence >= this.options.anomalyThreshold;
    return {
      hasAnomaly,
      confidence: Math.min(confidence, 0.99),
      labels,
      timestamp: new Date().toISOString(),
      deviceId: this.options.deviceId,
    };
  }

  private motionBuffer: Uint8ClampedArray | null = null;

  private estimateMotionVariance(currentData: Uint8ClampedArray): number {
    if (!this.motionBuffer || this.motionBuffer.length !== currentData.length) {
      this.motionBuffer = new Uint8ClampedArray(currentData);
      return 0;
    }

    let diffSum = 0;
    const len = Math.min(this.motionBuffer.length, currentData.length);
    for (let i = 0; i < len; i += 16) {
      const diff = Math.abs(currentData[i] - this.motionBuffer[i]);
      diffSum += diff;
    }
    const avgDiff = diffSum / (len / 16);

    for (let i = 0; i < currentData.length; i++) {
      this.motionBuffer[i] = currentData[i];
    }

    return avgDiff;
  }

  private notify(result: EdgeAnalysisResult) {
    for (const callback of this.callbacks) {
      try {
        callback(result);
      } catch {
        // ignore callback errors
      }
    }
  }

  private emptyResult(): EdgeAnalysisResult {
    return {
      hasAnomaly: false,
      confidence: 0,
      labels: [],
      timestamp: new Date().toISOString(),
      deviceId: this.options.deviceId,
    };
  }

  stop(): void {
    this.stopAnalysis();
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
    this.motionBuffer = null;
  }
}

export const edgeIntelligence = EdgeIntelligenceService.getInstance();
