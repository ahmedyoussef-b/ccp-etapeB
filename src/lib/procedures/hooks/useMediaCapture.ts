"use client";

import { useState, useRef, useCallback } from "react";

export type MediaCaptureType = "photo" | "video" | "audio" | "signature";

export type MediaCaptureResult = {
  type: MediaCaptureType;
  dataUrl: string;
  blob?: Blob;
  timestamp: number;
}

interface UseMediaCaptureOptions {
  onCapture: (result: MediaCaptureResult) => void;
}

export function useMediaCapture({ onCapture }: UseMediaCaptureOptions) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const stopAllStreams = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
  }, []);

  const capturePhoto = useCallback(async (): Promise<MediaCaptureResult | null> => {
    setIsCapturing(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      mediaStreamRef.current = stream;

      const video = document.createElement("video");
      video.srcObject = stream;
      video.autoplay = true;
      await new Promise((resolve) => (video.onloadedmetadata = resolve));
      await video.play();

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Cannot get canvas context");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      stopAllStreams();
      setIsCapturing(false);

      const result: MediaCaptureResult = {
        type: "photo",
        dataUrl,
        timestamp: Date.now(),
      };
      onCapture(result);
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de capture photo");
      setIsCapturing(false);
      stopAllStreams();
      return null;
    }
  }, [onCapture, stopAllStreams]);

  const captureSignature = useCallback((): MediaCaptureResult | null => {
    setIsCapturing(true);
    setError(null);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 200;
      canvas.style.border = "1px solid #ccc";
      canvas.style.background = "white";
      canvas.style.cursor = "crosshair";
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Cannot get canvas context");

      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      let drawing = false;
      const getPos = (e: MouseEvent | Touch) => {
        const rect = canvas.getBoundingClientRect();
        return {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
      };

      const startDraw = (e: MouseEvent | TouchEvent) => {
        drawing = true;
        const pos = "touches" in e ? getPos(e.touches[0]) : getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
      };

      const draw = (e: MouseEvent | TouchEvent) => {
        if (!drawing) return;
        e.preventDefault();
        const pos = "touches" in e ? getPos(e.touches[0]) : getPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      };

      const endDraw = () => {
        drawing = false;
      };

      canvas.addEventListener("mousedown", startDraw);
      canvas.addEventListener("mousemove", draw);
      canvas.addEventListener("mouseup", endDraw);
      canvas.addEventListener("mouseleave", endDraw);
      canvas.addEventListener("touchstart", startDraw);
      canvas.addEventListener("touchmove", draw);
      canvas.addEventListener("touchend", endDraw);

      const dataUrl = canvas.toDataURL("image/png");

      canvas.removeEventListener("mousedown", startDraw);
      canvas.removeEventListener("mousemove", draw);
      canvas.removeEventListener("mouseup", endDraw);
      canvas.removeEventListener("mouseleave", endDraw);
      canvas.removeEventListener("touchstart", startDraw);
      canvas.removeEventListener("touchmove", draw);
      canvas.removeEventListener("touchend", endDraw);

      setIsCapturing(false);
      const result: MediaCaptureResult = {
        type: "signature",
        dataUrl,
        timestamp: Date.now(),
      };
      onCapture(result);
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de capture signature");
      setIsCapturing(false);
      return null;
    }
  }, [onCapture]);

  const captureAudio = useCallback(async (): Promise<MediaCaptureResult | null> => {
    setIsCapturing(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      return new Promise((resolve) => {
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        const chunks: Blob[] = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: "audio/webm" });
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            stopAllStreams();
            setIsCapturing(false);
            const result: MediaCaptureResult = {
              type: "audio",
              dataUrl,
              blob,
              timestamp: Date.now(),
            };
            onCapture(result);
            resolve(result);
          };
          reader.readAsDataURL(blob);
        };

        mediaRecorder.start();

        setTimeout(() => {
          if (mediaRecorder.state !== "inactive") {
            mediaRecorder.stop();
          }
        }, 5000);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de capture audio");
      setIsCapturing(false);
      stopAllStreams();
      return null;
    }
  }, [onCapture, stopAllStreams]);

  const captureVideo = useCallback(async (): Promise<MediaCaptureResult | null> => {
    setIsCapturing(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: true,
      });
      mediaStreamRef.current = stream;

      return new Promise((resolve) => {
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        const chunks: Blob[] = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: "video/webm" });
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            stopAllStreams();
            setIsCapturing(false);
            const result: MediaCaptureResult = {
              type: "video",
              dataUrl,
              blob,
              timestamp: Date.now(),
            };
            onCapture(result);
            resolve(result);
          };
          reader.readAsDataURL(blob);
        };

        mediaRecorder.start();

        setTimeout(() => {
          if (mediaRecorder.state !== "inactive") {
            mediaRecorder.stop();
          }
        }, 10000);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de capture vidéo");
      setIsCapturing(false);
      stopAllStreams();
      return null;
    }
  }, [onCapture, stopAllStreams]);

  const capture = useCallback(
    async (type: MediaCaptureType): Promise<MediaCaptureResult | null> => {
      switch (type) {
        case "photo":
          return capturePhoto();
        case "signature":
          return captureSignature();
        case "audio":
          return captureAudio();
        case "video":
          return captureVideo();
        default:
          return null;
      }
    },
    [capturePhoto, captureSignature, captureAudio, captureVideo]
  );

  return {
    isCapturing,
    error,
    capture,
    stopAllStreams,
  };
}
