"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Camera,
  Video,
  Mic,
  Hand,
  RefreshCw,
  MapPin,
  Clock,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Play,
  Square,
} from "lucide-react";
import {
  capturePhoto,
  startRecording,
  stopRecording,
  getGeolocation,
  blobToDataURL,
  createAudioVisualizer,
  clearSignature,
  signatureToDataURL,
  getSupportedMimeType,
  GeoLocation,
} from "@/lib/media/capture";

interface MediaCapturePreviewProps {
  type: "photo" | "video" | "audio" | "signature";
  options?: {
    geolocation?: boolean;
    timestamp?: boolean;
  };
  onCapture: (dataUrl: string, metadata?: CaptureMetadata) => void;
  capturedUrl?: string;
}

interface CaptureMetadata {
  geolocation?: GeoLocation;
  timestamp?: string;
  mimeType?: string;
  size?: number;
}

type CaptureMode = "idle" | "preview" | "recording" | "captured";

const mediaTypeLabels: Record<string, string> = {
  photo: "Photo",
  video: "Vidéo",
  audio: "Audio",
  signature: "Signature",
};

interface PointerCoords {
  x: number;
  y: number;
}

export function MediaCapturePreview({
  type,
  options = {},
  onCapture,
  capturedUrl,
}: MediaCapturePreviewProps) {
  const [mode, setMode] = useState<CaptureMode>(capturedUrl ? "captured" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [geo, setGeo] = useState<GeoLocation | null>(null);
  const [timestamp, setTimestamp] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const audioCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>(0);
  const stopVisualizerRef = useRef<(() => void) | null>(null);
  const signatureState = useRef({ isDrawing: false, lastX: 0, lastY: 0 });

  const isSupported =
    typeof navigator !== "undefined" &&
    (type === "signature" ||
      (type === "photo" && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) ||
      (type === "video" && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) ||
      (type === "audio" &&
        !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) &&
        typeof AudioContext !== "undefined"));

  const cleanup = useCallback(() => {
    if (stopVisualizerRef.current) {
      stopVisualizerRef.current();
      stopVisualizerRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = 0;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      cleanup();
      const stream = await navigator.mediaDevices!.getUserMedia({
        video: type === "photo" ? { facingMode: "environment" } : true,
        audio: type === "video" || type === "audio",
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setMode("preview");
    } catch (err) {
      setError("Impossible d'accéder à la caméra / micro.");
      console.error(err);
    }
  }, [type, cleanup]);

  const handleCapturePhoto = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      const geoData = options.geolocation ? await getGeolocation() : undefined;
      setGeo(geoData || null);
      const now = new Date();
      setTimestamp(now.toISOString());
      const dataUrl = capturePhoto(videoRef.current);
      onCapture(dataUrl, {
        geolocation: geoData,
        timestamp: now.toISOString(),
        mimeType: "image/jpeg",
      });
      cleanup();
      setMode("captured");
    } catch (err) {
      setError("Erreur lors de la capture photo.");
      console.error(err);
    }
  }, [options.geolocation, onCapture, cleanup]);

  const handleStartRecording = useCallback(async () => {
    if (!streamRef.current && videoRef.current?.srcObject instanceof MediaStream) {
      streamRef.current = videoRef.current.srcObject;
    }
    if (!streamRef.current) {
      await startCamera();
      return;
    }
    try {
      setError(null);
      const mimeType = getSupportedMimeType([
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
        "video/mp4",
      ]);
      const recorder = startRecording(streamRef.current, mimeType);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorderRef.current = recorder;
      recorder.start(100);
      setMode("recording");
    } catch (err) {
      setError("Impossible de démarrer l'enregistrement.");
      console.error(err);
    }
  }, [startCamera]);

  const handleStopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current) return;
    try {
      const blob = await stopRecording(mediaRecorderRef.current);
      const geoData = options.geolocation ? await getGeolocation() : undefined;
      setGeo(geoData || null);
      const now = new Date();
      setTimestamp(now.toISOString());
      const dataUrl = await blobToDataURL(blob);
      onCapture(dataUrl, {
        geolocation: geoData,
        timestamp: now.toISOString(),
        mimeType: blob.type,
        size: blob.size,
      });
      cleanup();
      setMode("captured");
    } catch (err) {
      setError("Erreur lors de l'arrêt de l'enregistrement.");
      console.error(err);
    }
  }, [options.geolocation, onCapture, cleanup]);

  const handleStartAudio = useCallback(async () => {
    try {
      setError(null);
      cleanup();
      const stream = await navigator.mediaDevices!.getUserMedia({ audio: true });
      streamRef.current = stream;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      if (audioCanvasRef.current) {
        stopVisualizerRef.current = createAudioVisualizer(
          audioContext,
          analyser,
          audioCanvasRef.current
        );
      }
      setMode("preview");
    } catch (err) {
      setError("Impossible d'accéder au microphone.");
      console.error(err);
    }
  }, [cleanup]);

  const handleCaptureAudio = useCallback(async () => {
    if (!streamRef.current) return;
    try {
      const mimeType = getSupportedMimeType([
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ]);
      const recorder = startRecording(streamRef.current, mimeType);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorderRef.current = recorder;
      recorder.start(100);
      setMode("recording");
    } catch (err) {
      setError("Impossible de démarrer l'enregistrement audio.");
      console.error(err);
    }
  }, []);

  const handleStopAudio = useCallback(async () => {
    if (!mediaRecorderRef.current) return;
    try {
      const blob = await stopRecording(mediaRecorderRef.current);
      const geoData = options.geolocation ? await getGeolocation() : undefined;
      setGeo(geoData || null);
      const now = new Date();
      setTimestamp(now.toISOString());
      const dataUrl = await blobToDataURL(blob);
      onCapture(dataUrl, {
        geolocation: geoData,
        timestamp: now.toISOString(),
        mimeType: blob.type,
        size: blob.size,
      });
      cleanup();
      setMode("captured");
    } catch (err) {
      setError("Erreur lors de l'enregistrement audio.");
      console.error(err);
    }
  }, [options.geolocation, onCapture, cleanup]);

  const getCanvasCoords = useCallback(
    (canvas: HTMLCanvasElement, clientX: number, clientY: number): PointerCoords => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    },
    []
  );

  const handleSignatureMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = signatureCanvasRef.current;
      if (!canvas) return;
      const coords = getCanvasCoords(canvas, e.nativeEvent.clientX, e.nativeEvent.clientY);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
      signatureState.current = { isDrawing: true, lastX: coords.x, lastY: coords.y };
    },
    [getCanvasCoords]
  );

  const handleSignatureMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = signatureCanvasRef.current;
      if (!canvas || !signatureState.current.isDrawing) return;
      const coords = getCanvasCoords(canvas, e.nativeEvent.clientX, e.nativeEvent.clientY);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
      signatureState.current.lastX = coords.x;
      signatureState.current.lastY = coords.y;
    },
    [getCanvasCoords]
  );

  const handleSignatureMouseUp = useCallback(() => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx && signatureState.current.isDrawing) {
      ctx.closePath();
    }
    signatureState.current = { ...signatureState.current, isDrawing: false };
  }, []);

  const handleSignatureTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      const canvas = signatureCanvasRef.current;
      if (!canvas) return;
      const touch = e.touches[0];
      if (!touch) return;
      const coords = getCanvasCoords(canvas, touch.clientX, touch.clientY);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
      signatureState.current = { isDrawing: true, lastX: coords.x, lastY: coords.y };
    },
    [getCanvasCoords]
  );

  const handleSignatureTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      const canvas = signatureCanvasRef.current;
      if (!canvas || !signatureState.current.isDrawing) return;
      const touch = e.touches[0];
      if (!touch) return;
      const coords = getCanvasCoords(canvas, touch.clientX, touch.clientY);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
      signatureState.current.lastX = coords.x;
      signatureState.current.lastY = coords.y;
    },
    [getCanvasCoords]
  );

  const handleSignatureTouchEnd = useCallback(() => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx && signatureState.current.isDrawing) {
      ctx.closePath();
    }
    signatureState.current = { ...signatureState.current, isDrawing: false };
  }, []);

  const handleSaveSignature = useCallback(async () => {
    if (!signatureCanvasRef.current) return;
    try {
      const geoData = options.geolocation ? await getGeolocation() : undefined;
      setGeo(geoData || null);
      const now = new Date();
      setTimestamp(now.toISOString());
      const dataUrl = signatureToDataURL(signatureCanvasRef.current);
      onCapture(dataUrl, {
        geolocation: geoData,
        timestamp: now.toISOString(),
        mimeType: "image/png",
      });
      cleanup();
      setMode("captured");
    } catch (err) {
      setError("Erreur lors de la sauvegarde de la signature.");
      console.error(err);
    }
  }, [options.geolocation, onCapture, cleanup]);

  const handleClearSignature = useCallback(() => {
    if (signatureCanvasRef.current) {
      clearSignature(signatureCanvasRef.current);
    }
  }, []);

  const handleRetake = useCallback(() => {
    cleanup();
    setMode("idle");
    setGeo(null);
    setTimestamp(null);
    setError(null);
  }, [cleanup]);

  useEffect(() => {
    if (mode === "preview" && type === "audio" && audioCanvasRef.current && audioContextRef.current) {
      stopVisualizerRef.current = createAudioVisualizer(
        audioContextRef.current,
        analyserRef.current!,
        audioCanvasRef.current
      );
    }
  }, [mode, type]);

  const showFallback = !isSupported;

  if (showFallback) {
    return (
      <Card className="p-3 border-dashed">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>
            Capture {mediaTypeLabels[type]} non supportée par ce navigateur.
          </span>
        </div>
      </Card>
    );
  }

  if (mode === "captured" && capturedUrl) {
    return (
      <Card className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-medium">Capturé</span>
            {options.timestamp && timestamp && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Clock className="h-3 w-3" />
                {new Date(timestamp).toLocaleString("fr-FR")}
              </Badge>
            )}
            {options.geolocation && geo && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <MapPin className="h-3 w-3" />
                {geo.lat.toFixed(4)}, {geo.lng.toFixed(4)}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleRetake}
            className="h-6 w-6"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
        <div className="rounded-lg border border-border overflow-hidden bg-muted/30">
          {type === "signature" ? (
            <img
              src={capturedUrl}
              alt="Signature"
              className="w-full h-32 object-contain bg-white"
            />
          ) : type === "photo" ? (
            <img
              src={capturedUrl}
              alt="Photo"
              className="w-full h-40 object-cover"
            />
          ) : type === "video" || type === "audio" ? (
            <video
              src={capturedUrl}
              controls
              className="w-full h-40 object-cover"
            />
          ) : null}
        </div>
      </Card>
    );
  }

  if (type === "photo") {
    return (
      <Card className="p-3 space-y-3">
        {error && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>{error}</span>
          </div>
        )}
        <div className="relative aspect-video rounded-lg overflow-hidden bg-muted/30">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex items-center gap-2">
          {mode === "idle" ? (
            <Button
              size="sm"
              onClick={startCamera}
              className="gap-1.5 flex-1"
            >
              <Camera className="h-3.5 w-3.5" />
              Démarrer la caméra
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                onClick={handleCapturePhoto}
                className="gap-1.5 flex-1"
              >
                <Camera className="h-3.5 w-3.5" />
                Capturer
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetake}
                className="gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Annuler
              </Button>
            </>
          )}
        </div>
      </Card>
    );
  }

  if (type === "video") {
    return (
      <Card className="p-3 space-y-3">
        {error && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>{error}</span>
          </div>
        )}
        <div className="relative aspect-video rounded-lg overflow-hidden bg-muted/30">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {mode === "recording" && (
            <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-500/90 backdrop-blur-sm">
              <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
              <span className="text-[10px] font-bold text-white">REC</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {mode === "idle" ? (
            <Button
              size="sm"
              onClick={startCamera}
              className="gap-1.5 flex-1"
            >
              <Video className="h-3.5 w-3.5" />
              Démarrer la caméra
            </Button>
          ) : mode === "preview" ? (
            <>
              <Button
                size="sm"
                onClick={handleStartRecording}
                className="gap-1.5 flex-1"
              >
                <Play className="h-3.5 w-3.5" />
                Enregistrer
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetake}
                className="gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Annuler
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleStopRecording}
              className="gap-1.5 flex-1"
            >
              <Square className="h-3.5 w-3.5" />
              Arrêter
            </Button>
          )}
        </div>
      </Card>
    );
  }

  if (type === "audio") {
    return (
      <Card className="p-3 space-y-3">
        {error && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>{error}</span>
          </div>
        )}
        <div className="rounded-lg overflow-hidden bg-muted/30">
          <canvas
            ref={audioCanvasRef}
            width={400}
            height={80}
            className="w-full h-20"
          />
        </div>
        <div className="flex items-center gap-2">
          {mode === "idle" ? (
            <Button
              size="sm"
              onClick={handleStartAudio}
              className="gap-1.5 flex-1"
            >
              <Mic className="h-3.5 w-3.5" />
              Démarrer le micro
            </Button>
          ) : mode === "preview" ? (
            <>
              <Button
                size="sm"
                onClick={handleCaptureAudio}
                className="gap-1.5 flex-1"
              >
                <Play className="h-3.5 w-3.5" />
                Enregistrer
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetake}
                className="gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Annuler
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleStopAudio}
              className="gap-1.5 flex-1"
            >
              <Square className="h-3.5 w-3.5" />
              Arrêter
            </Button>
          )}
        </div>
      </Card>
    );
  }

  if (type === "signature") {
    return (
      <Card className="p-3 space-y-3">
        {error && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>{error}</span>
          </div>
        )}
        <div className="rounded-lg overflow-hidden border border-border bg-white">
          <canvas
            ref={signatureCanvasRef}
            className="w-full h-40 cursor-crosshair touch-none"
            onMouseDown={handleSignatureMouseDown}
            onMouseMove={handleSignatureMouseMove}
            onMouseUp={handleSignatureMouseUp}
            onMouseLeave={handleSignatureMouseUp}
            onTouchStart={handleSignatureTouchStart}
            onTouchMove={handleSignatureTouchMove}
            onTouchEnd={handleSignatureTouchEnd}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleClearSignature}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Effacer
          </Button>
          <Button
            size="sm"
            onClick={handleSaveSignature}
            className="gap-1.5 flex-1"
          >
            <Hand className="h-3.5 w-3.5" />
            Valider la signature
          </Button>
        </div>
      </Card>
    );
  }

  return null;
}
