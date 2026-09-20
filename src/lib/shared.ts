/** Feste Video-Beschreibung – wird IMMER für Buffer-Posts verwendet. */
export const VIDEO_DESCRIPTION = `You won't believe how this story ends...
Stay until the end because the plot twist is INSANE.
Would you have done the same?
#reddit #redditstories #storytime
#stories #fyp`;

export type ThemeId = "black" | "white" | "red" | "orange" | "blue";

export const THEMES: { id: ThemeId; label: string; dot: string }[] = [
  { id: "black", label: "Schwarz", dot: "#17171c" },
  { id: "white", label: "Weiß", dot: "#f4f4f6" },
  { id: "red", label: "Rot", dot: "#ff3b4d" },
  { id: "orange", label: "Orange", dot: "#ff7a1a" },
  { id: "blue", label: "Blau", dot: "#3b82f6" },
];

export type AiProviderId = "mistral" | "openrouter" | "groq" | "openai" | "custom";

export const AI_PROVIDERS: Record<
  AiProviderId,
  { label: string; baseUrl: string; model: string; hint: string }
> = {
  mistral: {
    label: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    model: "mistral-large-latest",
    hint: "API-Key von console.mistral.ai",
  },
  openrouter: {
    label: "Qwen (OpenRouter)",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "qwen/qwen-2.5-72b-instruct",
    hint: "API-Key von openrouter.ai – Zugriff auf Qwen & viele weitere Modelle",
  },
  groq: {
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    hint: "API-Key von console.groq.com",
  },
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    hint: "API-Key von platform.openai.com",
  },
  custom: {
    label: "Eigener Endpunkt",
    baseUrl: "",
    model: "",
    hint: "Beliebiger OpenAI-kompatibler Endpunkt (z. B. Ollama, LM Studio)",
  },
};

export interface AppSettings {
  // KI
  aiProvider: AiProviderId;
  aiKey: string;
  aiBaseUrl: string;
  aiModel: string;
  storyTopic: string;
  storyLanguage: "en" | "de";
  storyLength: number; // Ziel-Wortzahl pro Story
  // Supabase TTS
  supabaseUrl: string;
  supabaseKey: string;
  ttsFunction: string;
  ttsVoice: string;
  ttsSpeed: number;
  readTitle: boolean; // Titel am Anfang vorlesen
  // Buffer
  bufferToken: string;
  bufferChannelId: string;
  bufferChannelName: string;
  // Video / Rendering
  bayCount: number;
  resolution: "720" | "1080";
  fps: "30" | "60";
  subtitleEnabled: boolean;
  subtitleWords: number; // Wörter pro Untertitel-Block
  subtitleSize: number; // Schriftgröße relativ (1 = Standard)
  subtitlePosition: "center" | "upper" | "lower";
  subtitleColor: string;
  titleCardEnabled: boolean;
  titleCardDuration: number; // Sekunden
  titleCardStyle: "dark" | "accent" | "blur";
  showProgressBar: boolean;
  bgVolume: number; // 0..1 Lautstärke Hintergrund-Clip
  videoBitrate: number; // Mbit/s
  concurrency: number; // parallele Render-Jobs
  // Planung
  scheduleStart: string; // ISO-String Startzeitpunkt
  scheduleGap: number; // Minuten zwischen geplanten Posts
  // Autopilot
  autopilotPerHour: number; // Videos pro Stunde
  autopilotMode: "draft" | "queue" | "schedule";
}

export const DEFAULT_SETTINGS: AppSettings = {
  aiProvider: "mistral",
  aiKey: "",
  aiBaseUrl: AI_PROVIDERS.mistral.baseUrl,
  aiModel: AI_PROVIDERS.mistral.model,
  storyTopic: "",
  storyLanguage: "en",
  storyLength: 220,
  supabaseUrl: "",
  supabaseKey: "",
  ttsFunction: "tts",
  ttsVoice: "alloy",
  ttsSpeed: 1,
  readTitle: true,
  bufferToken: "",
  bufferChannelId: "",
  bufferChannelName: "",
  bayCount: 10,
  resolution: "720",
  fps: "30",
  subtitleEnabled: true,
  subtitleWords: 4,
  subtitleSize: 1,
  subtitlePosition: "center",
  subtitleColor: "#ffffff",
  titleCardEnabled: true,
  titleCardDuration: 3,
  titleCardStyle: "blur",
  showProgressBar: true,
  bgVolume: 0,
  videoBitrate: 8,
  concurrency: 10,
  scheduleStart: "",
  scheduleGap: 45,
  autopilotPerHour: 4,
  autopilotMode: "schedule",
};

export const MAX_BAYS = 10;
