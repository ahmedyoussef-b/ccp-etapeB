export type GeoLocation = {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp?: number;
};

export function getGeolocation(): Promise<GeoLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Géolocalisation non supportée"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
      },
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

export function capturePhoto(videoElement: HTMLVideoElement): string {
  const canvas = document.createElement("canvas");
  canvas.width = videoElement.videoWidth || 640;
  canvas.height = videoElement.videoHeight || 480;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Impossible d'accéder au contexte canvas");
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.9);
}

export function startRecording(
  stream: MediaStream,
  mimeType = "video/webm;codecs=vp9"
): MediaRecorder {
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType });
  } catch {
    try {
      recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    } catch {
      recorder = new MediaRecorder(stream);
    }
  }
  return recorder;
}

export function stopRecording(recorder: MediaRecorder): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (recorder.state === "inactive") {
      reject(new Error("Enregistreur inactif"));
      return;
    }
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
      resolve(blob);
    };
    recorder.stop();
  });
}

export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function blobToObjectURL(blob: Blob): string {
  return URL.createObjectURL(blob);
}

export function revokeObjectURL(url: string): void {
  if (url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

export function getSupportedMimeType(
  types: string[]
): string | undefined {
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return undefined;
}

export function createAudioVisualizer(
  audioContext: AudioContext,
  analyser: AnalyserNode,
  canvas: HTMLCanvasElement
): (() => void) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  const ctx2d = ctx as CanvasRenderingContext2D;

  function draw() {
    requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);

    ctx2d.fillStyle = "rgb(17, 24, 39)";
    ctx2d.fillRect(0, 0, canvas.width, canvas.height);

    const barWidth = (canvas.width / bufferLength) * 2.5;
    let barHeight: number;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      barHeight = (dataArray[i] / 255) * canvas.height;
      const gradient = ctx2d.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
      gradient.addColorStop(0, "rgb(34, 197, 94)");
      gradient.addColorStop(0.5, "rgb(234, 179, 8)");
      gradient.addColorStop(1, "rgb(239, 68, 68)");
      ctx2d.fillStyle = gradient;
      ctx2d.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
      x += barWidth + 1;
    }
  }

  draw();

  return () => {
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);
  };
}

export function clearSignature(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

export function signatureToDataURL(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/png");
}
