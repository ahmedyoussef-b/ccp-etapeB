const SPEECH_PREFIX = "[Speech]";

function log(level: "log" | "warn" | "error", label: string, data?: Record<string, unknown>) {
  if (level === "error") {
    console.error(`${SPEECH_PREFIX} ❌ ${label}`, data ?? "");
  } else if (level === "warn") {
    console.warn(`${SPEECH_PREFIX} ⚠️ ${label}`, data ?? "");
  } else {
    console.log(`${SPEECH_PREFIX} ℹ️ ${label}`, data ?? "");
  }
}

export const speechLogger = {
  info: (label: string, data?: Record<string, unknown>) => log("log", label, data),
  warn: (label: string, data?: Record<string, unknown>) => log("warn", label, data),
  error: (label: string, data?: Record<string, unknown>) => log("error", label, data),
  trace: {
    listeningStart: (language: string, continuous: boolean) =>
      speechLogger.info("startListening", { language, continuous }),
    listeningStop: (reason?: string) =>
      speechLogger.info("stopListening", { reason }),
    recognitionResult: (transcript: string, isFinal: boolean, confidence?: number) =>
      speechLogger.info("recognitionResult", { transcript, isFinal, confidence }),
    recognitionError: (error: string, message?: string) =>
      speechLogger.error("recognitionError", { error, message }),
    speakStart: (text: string, language: string) =>
      speechLogger.info("speakStart", { textLength: text.length, language }),
    speakEnd: () =>
      speechLogger.info("speakEnd"),
    speakError: (message?: string) =>
      speechLogger.error("speakError", { message }),
    toggle: (next: boolean) =>
      speechLogger.info("toggleListening", { next }),
    guidanceSpoken: (text: string) =>
      speechLogger.info("guidanceSpoken", { text }),
  },
};
