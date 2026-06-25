import React from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  BarChart3,
  Bolt,
  CalendarClock,
  Copy,
  Crosshair,
  Gauge,
  Keyboard,
  MousePointer2,
  Play,
  Plus,
  Save,
  Settings,
  Shield,
  Square,
  Trash2,
} from "lucide-react";
import "./styles.css";

type SkillRole =
  | "gcd"
  | "ogcd"
  | "song"
  | "buff"
  | "proc"
  | "utility"
  | "potion";

type Priority = "core" | "high" | "medium" | "delayable" | "mechanic";

type TimelineEvent = {
  id: string;
  time: number;
  kind: "GCD" | "oGCD" | "Mechanic" | "State";
  skill: string;
  key: string;
  early: number;
  late: number;
  priority: Priority;
  note: string;
};

type Rotation = {
  id: string;
  name: string;
  duration: number;
  description: string;
  events: TimelineEvent[];
};

type Keybind = {
  skill: string;
  key: string;
  role: SkillRole;
  zone: "left" | "ctrl" | "mouse" | "wheel" | "dpi" | "custom";
  iconUrl?: string;
};

type SettingsState = {
  gcd: number;
  queueWindow: number;
  ping: number;
  frameRate: number;
  animationLock: number;
  allowEarlyPull: boolean;
  showHints: boolean;
  sound: boolean;
  procMode: boolean;
};

type Attempt = {
  eventId: string | null;
  expectedSkill: string | null;
  expectedKey: string | null;
  actualKey: string;
  delta: number | null;
  verdict: "Queued" | "Perfect" | "Good" | "Early" | "Late" | "Clip" | "Miss" | "Wrong" | "Pull";
  at: number;
  actionAt?: number;
};

type Feedback = Attempt & {
  id: number;
  skill: string;
};

type CooldownState = Record<string, { startsAt: number; endsAt: number; duration: number }>;

type QueuedAction = {
  executeAt: number;
  key: string;
  skill: string;
};

type CombatEngineState = {
  animationLockUntil: number;
  gcdReadyAt: number;
  gcdStartedAt: number;
  queuedAction: QueuedAction | null;
};

type ResolvedRelease = {
  verdict: Attempt["verdict"];
  actionAt: number;
  delta: number;
  queued: boolean;
  accepted: boolean;
};

type BardSong = "放浪神的小步舞曲" | "賢者的敘事謠" | "軍神的讚美歌";

const STORAGE_KEY = "brd-train-state-v1";
const SONG_DURATION = 45;

const defaultKeybinds: Keybind[] = [
  { skill: "魔法爆裂", key: "1", role: "gcd", zone: "left" },
  { skill: "輝煌箭", key: "R", role: "gcd", zone: "left" },
  { skill: "伶牙俐齒", key: "2", role: "gcd", zone: "left" },
  { skill: "狂風蝕箭", key: "3", role: "gcd", zone: "left" },
  { skill: "烈毒咬箭", key: "4", role: "gcd", zone: "left" },
  { skill: "光明神的返場餘音", key: "Q", role: "buff", zone: "left" },
  { skill: "紛亂箭 / 共鳴箭", key: "E", role: "ogcd", zone: "left" },
  { skill: "側風誘導箭", key: "F", role: "ogcd", zone: "left" },
  { skill: "絕峰箭 / 爆破箭", key: "G", role: "gcd", zone: "left" },
  { skill: "碎心箭", key: "M5", role: "ogcd", zone: "mouse" },
  { skill: "九天連箭", key: "Alt+/", role: "ogcd", zone: "custom" },
  { skill: "完美音調", key: "M4", role: "proc", zone: "mouse" },
  { skill: "猛者強擊", key: "T", role: "buff", zone: "left" },
  { skill: "光明神的最終樂章", key: "C", role: "buff", zone: "left" },
  { skill: "戰鬥之聲", key: "V", role: "buff", zone: "left" },
  { skill: "巧力之幻藥", key: "X", role: "potion", zone: "left" },
  { skill: "行吟", key: "Z", role: "utility", zone: "left" },
  { skill: "大地神的抒情戀歌", key: "Alt+,", role: "utility", zone: "dpi" },
  { skill: "光陰神的禮讚凱歌", key: "Alt+.", role: "utility", zone: "dpi" },
  { skill: "內丹", key: "滾輪中鍵", role: "utility", zone: "wheel" },
  { skill: "親疏自行", key: "Alt+N", role: "utility", zone: "wheel" },
  { skill: "傷頭", key: "Alt+M", role: "utility", zone: "wheel" },
  { skill: "放浪神的小步舞曲", key: "Ctrl+1", role: "song", zone: "ctrl" },
  { skill: "賢者的敘事謠", key: "Ctrl+2", role: "song", zone: "ctrl" },
  { skill: "軍神的讚美歌", key: "Ctrl+3", role: "song", zone: "ctrl" },
];

const defaultSettings: SettingsState = {
  gcd: 2.5,
  queueWindow: 500,
  ping: 45,
  frameRate: 60,
  animationLock: 620,
  allowEarlyPull: false,
  showHints: true,
  sound: false,
  procMode: true,
};

const idleCombatEngine: CombatEngineState = {
  animationLockUntil: 0,
  gcdReadyAt: 0,
  gcdStartedAt: 0,
  queuedAction: null,
};

const skillIcons: Record<string, string> = {
  "魔法爆裂": "https://xivapi.com/i/002000/002618_hr1.png",
  "輝煌箭": "https://xivapi.com/i/002000/002616_hr1.png",
  "伶牙俐齒": "https://xivapi.com/i/002000/002608_hr1.png",
  "烈毒咬箭": "https://xivapi.com/i/002000/002613_hr1.png",
  "狂風蝕箭": "https://xivapi.com/i/002000/002614_hr1.png",
  "光明神的返場餘音": "https://xivapi.com/i/002000/002100_hr1.png",
  "紛亂箭 / 共鳴箭": "https://xivapi.com/i/000000/000353_hr1.png",
  "共鳴箭": "https://xivapi.com/i/002000/002624_hr1.png",
  "側風誘導箭": "https://xivapi.com/i/002000/002610_hr1.png",
  "絕峰箭 / 爆破箭": "https://xivapi.com/i/002000/002619_hr1.png",
  "碎心箭": "https://xivapi.com/i/002000/002623_hr1.png",
  "九天連箭": "https://xivapi.com/i/002000/002606_hr1.png",
  "完美音調": "https://xivapi.com/i/002000/002611_hr1.png",
  "猛者強擊": "https://xivapi.com/i/000000/000352_hr1.png",
  "光明神的最終樂章": "https://xivapi.com/i/002000/002622_hr1.png",
  "戰鬥之聲": "https://xivapi.com/i/002000/002601_hr1.png",
  "巧力之幻藥": "https://xivapi.com/i/020000/020615_hr1.png",
  // BRD support actions: Troubadour, Nature's Minne, the Warden's Paean.
  "行吟": "https://xivapi.com/i/002000/002612_hr1.png",
  "大地神的抒情戀歌": "https://xivapi.com/i/002000/002615_hr1.png",
  "光陰神的禮讚凱歌": "https://xivapi.com/i/002000/002609_hr1.png",
  "內丹": "https://xivapi.com/i/000000/000821_hr1.png",
  "親疏自行": "https://xivapi.com/i/000000/000822_hr1.png",
  "傷頭": "https://xivapi.com/i/000000/000848_hr1.png",
  "放浪神的小步舞曲": "https://xivapi.com/i/002000/002607_hr1.png",
  "賢者的敘事謠": "https://xivapi.com/i/002000/002602_hr1.png",
  "軍神的讚美歌": "https://xivapi.com/i/002000/002603_hr1.png",
};

const skillRecasts: Record<string, number> = {
  "紛亂箭 / 共鳴箭": 60,
  "側風誘導箭": 15,
  "碎心箭": 15,
  "九天連箭": 15,
  "完美音調": 1,
  "猛者強擊": 120,
  "光明神的最終樂章": 110,
  "戰鬥之聲": 120,
  "巧力之幻藥": 270,
  "行吟": 90,
  "大地神的抒情戀歌": 120,
  "光陰神的禮讚凱歌": 45,
  "內丹": 120,
  "親疏自行": 120,
  "傷頭": 30,
  "放浪神的小步舞曲": 120,
  "賢者的敘事謠": 120,
  "軍神的讚美歌": 120,
};

function skillRecast(skill: string, role: SkillRole, settings: SettingsState) {
  if (skillRecasts[skill] !== undefined) return skillRecasts[skill];
  if (role === "gcd") return settings.gcd;
  if (role === "potion") return 270;
  if (role === "buff" || role === "song") return 120;
  if (role === "utility") return 60;
  return 30;
}

const ev = (
  id: string,
  time: number,
  kind: TimelineEvent["kind"],
  skill: string,
  key: string,
  priority: Priority,
  note = "",
  early = 180,
  late = 250
): TimelineEvent => ({
  id,
  time,
  kind,
  skill,
  key,
  early,
  late,
  priority,
  note,
});

const rotationsSeed: Rotation[] = [
  {
    id: "opener-2gcd",
    name: "2GCD 開場",
    duration: 22,
    description: "短前置，快速把歌曲、團輔、爆發藥與核心 oGCD 壓進開場。",
    events: [
      ev("2-1", 0, "GCD", "狂風蝕箭", "3", "core", "上第一個 DoT"),
      ev("2-2", 0.68, "oGCD", "放浪神的小步舞曲", "Ctrl+1", "core", "開歌拿 Wanderer Coda"),
      ev("2-3", 2.5, "GCD", "烈毒咬箭", "4", "core", "上第二個 DoT"),
      ev("2-4", 3.16, "oGCD", "光明神的最終樂章", "C", "core", "開場 1 Coda 也要進團輔"),
      ev("2-5", 3.85, "oGCD", "戰鬥之聲", "V", "core", "團輔核心"),
      ev("2-6", 5, "GCD", "魔法爆裂", "1", "medium", "保持 GCD 運轉"),
      ev("2-7", 5.68, "oGCD", "猛者強擊", "T", "core", "自身爆發核心"),
      ev("2-8", 6.35, "oGCD", "巧力之幻藥", "X", "high", "藥窗壓力點"),
      ev("2-9", 7.5, "GCD", "輝煌箭", "R", "high", "吃團輔與自身 buff"),
      ev("2-10", 8.18, "oGCD", "紛亂箭 / 共鳴箭", "E", "high", "高價值 oGCD"),
      ev("2-11", 8.86, "oGCD", "九天連箭", "Alt+/", "high", "15s 技能，爆發內要求快"),
      ev("2-12", 10, "GCD", "絕峰箭 / 爆破箭", "G", "high", "Soul Voice 高時優先"),
      ev("2-13", 10.68, "oGCD", "完美音調", "M4", "high", "3 層優先，避免溢出"),
      ev("2-14", 12.5, "GCD", "伶牙俐齒", "2", "core", "刷新雙 DoT"),
      ev("2-15", 13.18, "oGCD", "側風誘導箭", "F", "medium", "可微延，但不要漂出爆發"),
    ],
  },
  {
    id: "opener-3gcd",
    name: "3GCD 開場",
    duration: 24,
    description: "較穩定的前置，讓左手爆發鍵壓力略降，適合新鍵位熟悉。",
    events: [
      ev("3-1", 0, "GCD", "狂風蝕箭", "3", "core"),
      ev("3-2", 0.7, "oGCD", "放浪神的小步舞曲", "Ctrl+1", "core"),
      ev("3-3", 2.5, "GCD", "烈毒咬箭", "4", "core"),
      ev("3-4", 5, "GCD", "魔法爆裂", "1", "medium"),
      ev("3-5", 5.68, "oGCD", "光明神的最終樂章", "C", "core"),
      ev("3-6", 6.36, "oGCD", "戰鬥之聲", "V", "core"),
      ev("3-7", 7.5, "GCD", "輝煌箭", "R", "high"),
      ev("3-8", 8.18, "oGCD", "猛者強擊", "T", "core"),
      ev("3-9", 8.86, "oGCD", "巧力之幻藥", "X", "high"),
      ev("3-10", 10, "GCD", "伶牙俐齒", "2", "core"),
      ev("3-11", 10.68, "oGCD", "紛亂箭 / 共鳴箭", "E", "high"),
      ev("3-12", 11.36, "oGCD", "九天連箭", "Alt+/", "high"),
      ev("3-13", 12.5, "GCD", "絕峰箭 / 爆破箭", "G", "high"),
      ev("3-14", 13.18, "oGCD", "完美音調", "M4", "high"),
    ],
  },
  {
    id: "burst-120",
    name: "120 秒爆發",
    duration: 26,
    description: "三 Coda 團輔、猛者、雙九天與高資源技能集中測試。",
    events: [
      ev("b-1", 0, "GCD", "伶牙俐齒", "2", "core", "爆發前刷新 DoT"),
      ev("b-2", 0.68, "oGCD", "光明神的最終樂章", "C", "core", "3 Coda 核心團輔"),
      ev("b-3", 1.36, "oGCD", "戰鬥之聲", "V", "core"),
      ev("b-4", 2.5, "GCD", "輝煌箭", "R", "high"),
      ev("b-5", 3.18, "oGCD", "猛者強擊", "T", "core"),
      ev("b-6", 3.86, "oGCD", "巧力之幻藥", "X", "high"),
      ev("b-7", 5, "GCD", "絕峰箭 / 爆破箭", "G", "high"),
      ev("b-8", 5.68, "oGCD", "紛亂箭 / 共鳴箭", "E", "high"),
      ev("b-9", 6.36, "oGCD", "九天連箭", "Alt+/", "high", "第一發九天"),
      ev("b-10", 7.5, "GCD", "魔法爆裂", "1", "medium"),
      ev("b-11", 8.18, "oGCD", "完美音調", "M4", "high"),
      ev("b-12", 10, "GCD", "輝煌箭", "R", "high"),
      ev("b-13", 10.68, "oGCD", "側風誘導箭", "F", "medium"),
      ev("b-14", 12.5, "GCD", "魔法爆裂", "1", "medium"),
      ev("b-15", 15, "GCD", "伶牙俐齒", "2", "core"),
      ev("b-16", 21.36, "oGCD", "九天連箭", "Alt+/", "high", "第二發九天，檢查是否漂出團輔"),
    ],
  },
  {
    id: "burst-head-graze",
    name: "120 秒爆發 + 傷頭",
    duration: 26,
    description: "在爆發核心中插入 Head Graze，測試機制優先級覆蓋。",
    events: [
      ev("h-1", 0, "GCD", "伶牙俐齒", "2", "core"),
      ev("h-2", 0.68, "oGCD", "光明神的最終樂章", "C", "core"),
      ev("h-3", 1.36, "oGCD", "戰鬥之聲", "V", "core"),
      ev("h-4", 2.5, "GCD", "輝煌箭", "R", "high"),
      ev("h-5", 3.16, "Mechanic", "傷頭", "Alt+M", "mechanic", "機制優先，覆蓋可延後輸出 oGCD", 250, 300),
      ev("h-6", 3.86, "oGCD", "猛者強擊", "T", "core"),
      ev("h-7", 5, "GCD", "絕峰箭 / 爆破箭", "G", "high"),
      ev("h-8", 5.68, "oGCD", "巧力之幻藥", "X", "high"),
      ev("h-9", 6.36, "oGCD", "九天連箭", "Alt+/", "high"),
      ev("h-10", 7.5, "GCD", "魔法爆裂", "1", "medium"),
      ev("h-11", 8.18, "oGCD", "完美音調", "M4", "high"),
      ev("h-12", 10.68, "oGCD", "行吟", "Z", "mechanic", "防禦技能插入，觀察是否打亂爆發"),
      ev("h-13", 12.5, "GCD", "伶牙俐齒", "2", "core"),
      ev("h-14", 15.68, "oGCD", "側風誘導箭", "F", "medium"),
      ev("h-15", 21.36, "oGCD", "九天連箭", "Alt+/", "high"),
    ],
  },
];

const keyDisplayOrder = [
  "1",
  "R",
  "2",
  "3",
  "4",
  "Q",
  "E",
  "F",
  "G",
  "T",
  "C",
  "V",
  "X",
  "Z",
  "Ctrl+1",
  "Ctrl+2",
  "Ctrl+3",
  "M4",
  "M5",
  "Alt+/",
  "滾輪中鍵",
  "滾輪上",
  "滾輪下",
  "Alt+N",
  "Alt+M",
  "Alt+,",
  "Alt+.",
];

const legacyKeyMap: Record<string, string> = {
  "扳機": "Alt+/",
  "F24": "Alt+/",
  "滾輪左傾": "Alt+N",
  "滾輪右傾": "Alt+M",
  "DPI1": "Alt+,",
  "DPI2": "Alt+.",
};

function mapLegacyKey(key: string) {
  return legacyKeyMap[key] ?? key;
}

function normalizeStoredEventKey(skill: string, key: string) {
  if (skill === "完美音調" && key === "M5") return "M4";
  if (skill === "碎心箭" && key === "M4") return "M5";
  return mapLegacyKey(key);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw);
    return {
      ...state,
      keybinds: state.keybinds?.map((bind: Keybind) => ({
        ...bind,
        key: normalizeStoredEventKey(bind.skill, bind.key),
      })),
      rotations: state.rotations?.map((rotation: Rotation) => ({
        ...rotation,
        events: rotation.events.map((event) => ({
          ...event,
          key: normalizeStoredEventKey(event.skill, event.key),
        })),
      })),
    };
  } catch {
    return null;
  }
}

function normalizeSettings(settings: Partial<SettingsState> | null | undefined): SettingsState {
  return { ...defaultSettings, ...(settings ?? {}) };
}

type TrainerInput = {
  key: string;
  source: "keyboard" | "mouse" | "wheel";
};

const MODIFIER_KEYS = new Set(["Alt", "Control", "Meta", "Shift"]);
const MOUSE_MIDDLE_KEY = "滾輪中鍵";
const WHEEL_UP_KEY = "滾輪上";
const WHEEL_DOWN_KEY = "滾輪下";

const codeKeyMap: Record<string, string> = {
  Backquote: "`",
  Backslash: "\\",
  BracketLeft: "[",
  BracketRight: "]",
  Comma: ",",
  Equal: "=",
  Minus: "-",
  Period: ".",
  Quote: "'",
  Semicolon: ";",
  Slash: "/",
  Space: "Space",
  Tab: "Tab",
};

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest("input, textarea, select, [contenteditable='true'], [role='textbox']")
  );
}

function normalizeKeyboardKey(event: KeyboardEvent) {
  if (MODIFIER_KEYS.has(event.key)) return null;
  if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3);
  if (/^Digit[0-9]$/.test(event.code)) return event.code.slice(5);
  if (/^F(?:[1-9]|1[0-9]|2[0-4])$/.test(event.code)) return event.code;
  if (/^Numpad[0-9]$/.test(event.code)) return event.code;
  if (event.code in codeKeyMap) return codeKeyMap[event.code];
  if (event.key === " ") return "Space";
  return event.key.length === 1 ? event.key.toUpperCase() : event.key;
}

function isModifierKey(event: KeyboardEvent) {
  return MODIFIER_KEYS.has(event.key);
}

function normalizeKeyboardInput(event: KeyboardEvent): TrainerInput | null {
  const key = normalizeKeyboardKey(event);
  if (!key) return null;
  const modifiers = [
    event.ctrlKey ? "Ctrl" : "",
    event.altKey ? "Alt" : "",
    event.shiftKey ? "Shift" : "",
    event.metaKey ? "Meta" : "",
  ].filter(Boolean);
  return { key: [...modifiers, key].join("+"), source: "keyboard" };
}

function normalizeMouseInput(event: MouseEvent): TrainerInput | null {
  const keyByButton: Record<number, string> = {
    1: MOUSE_MIDDLE_KEY,
    3: "M4",
    4: "M5",
  };
  const key = keyByButton[event.button];
  return key ? { key, source: "mouse" } : null;
}

function normalizeWheelInput(event: WheelEvent): TrainerInput | null {
  if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) return null;
  return {
    key: event.deltaY < 0 ? WHEEL_UP_KEY : WHEEL_DOWN_KEY,
    source: "wheel",
  };
}

function blockBrowserInput(event: Event) {
  event.preventDefault();
  event.stopPropagation();
}

function roleLabel(role: SkillRole) {
  const labels: Record<SkillRole, string> = {
    gcd: "GCD",
    ogcd: "oGCD",
    song: "歌曲",
    buff: "團輔",
    proc: "Proc",
    utility: "機制",
    potion: "爆發藥",
  };
  return labels[role];
}

function priorityLabel(priority: Priority) {
  const labels: Record<Priority, string> = {
    core: "核心",
    high: "高",
    medium: "中",
    delayable: "可延",
    mechanic: "機制",
  };
  return labels[priority];
}

function inputWindow(event: TimelineEvent, settings: SettingsState) {
  if (event.kind === "GCD") {
    return { early: settings.queueWindow, late: 280 };
  }
  return { early: event.early, late: Math.max(event.late, 320) };
}

function clientInputDelay(settings: SettingsState) {
  return 1000 / Math.max(30, settings.frameRate);
}

function outboundLatency(settings: SettingsState) {
  return Math.max(0, settings.ping / 2);
}

function effectiveActionDelta(delta: number, settings: SettingsState) {
  return delta + clientInputDelay(settings) + outboundLatency(settings);
}

function effectiveAnimationLock(settings: SettingsState) {
  return settings.animationLock + settings.ping;
}

function calcVerdict(
  delta: number,
  expected: TimelineEvent,
  settings: SettingsState,
  secondsToNextGcd: number | null
): Attempt["verdict"] {
  if (isQueuedGcd(delta, expected, settings)) return "Queued";
  const effectiveDelta = effectiveActionDelta(delta, settings);
  if (
    expected.kind !== "GCD" &&
    secondsToNextGcd !== null &&
    secondsToNextGcd * 1000 - Math.max(0, effectiveDelta) < effectiveAnimationLock(settings)
  ) {
    return "Clip";
  }
  const abs = Math.abs(effectiveDelta);
  if (abs <= 120) return "Perfect";
  const window = inputWindow(expected, settings);
  if (effectiveDelta >= -window.early && effectiveDelta <= window.late) return "Good";
  return effectiveDelta < 0 ? "Early" : "Late";
}

function isQueuedGcd(delta: number, event: TimelineEvent, settings: SettingsState) {
  return event.kind === "GCD" && delta >= -settings.queueWindow && delta <= -120;
}

function scoredDelta(delta: number, event: TimelineEvent, settings: SettingsState) {
  return isQueuedGcd(delta, event, settings) ? 0 : effectiveActionDelta(delta, settings);
}

function formatDelta(delta: number | null) {
  if (delta === null) return "-";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${Math.round(delta)}ms`;
}

function scoreAttempts(rotation: Rotation, attempts: Attempt[]) {
  const hits = attempts.filter((a) => a.eventId);
  const wrong = attempts.filter((a) => a.verdict === "Wrong").length;
  const pulls = attempts.filter((a) => a.verdict === "Pull").length;
  const misses = rotation.events.filter(
    (event) => !attempts.some((attempt) => attempt.eventId === event.id)
  );
  const goodHits = hits.filter((a) => a.verdict === "Perfect" || a.verdict === "Good" || a.verdict === "Queued");
  const gcdEvents = rotation.events.filter((e) => e.kind === "GCD");
  const ogcdEvents = rotation.events.filter((e) => e.kind !== "GCD");
  const gcdHits = goodHits.filter((a) => gcdEvents.some((e) => e.id === a.eventId));
  const ogcdHits = goodHits.filter((a) => ogcdEvents.some((e) => e.id === a.eventId));
  const deltas = hits.map((a) => Math.abs(a.delta ?? 0)).sort((a, b) => a - b);
  const p95 = deltas.length ? deltas[Math.min(deltas.length - 1, Math.floor(deltas.length * 0.95))] : 0;
  const avg = deltas.length ? deltas.reduce((sum, value) => sum + value, 0) / deltas.length : 0;
  const coreEvents = rotation.events.filter((e) => e.priority === "core" || e.priority === "mechanic");
  const coreHits = coreEvents.filter((event) =>
    goodHits.some((attempt) => attempt.eventId === event.id)
  );
  const score = Math.max(
    0,
    Math.round(
      100 -
        misses.length * 8 -
        wrong * 5 -
        pulls * 6 -
        hits.filter((a) => a.verdict === "Late" || a.verdict === "Early").length * 3 -
        hits.filter((a) => a.verdict === "Clip").length * 4 -
        Math.max(0, avg - 140) / 8
    )
  );
  return {
    score,
    wrong: wrong + pulls,
    misses,
    avg,
    p95,
    gcdAccuracy: gcdEvents.length ? Math.round((gcdHits.length / gcdEvents.length) * 100) : 0,
    ogcdAccuracy: ogcdEvents.length ? Math.round((ogcdHits.length / ogcdEvents.length) * 100) : 0,
    coreRate: coreEvents.length ? Math.round((coreHits.length / coreEvents.length) * 100) : 0,
    slowest: [...hits]
      .filter((a) => a.delta !== null)
      .sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0))
      .slice(0, 5),
  };
}

function App() {
  const stored = loadState();
  const [tab, setTab] = React.useState("train");
  const [keybinds, setKeybinds] = React.useState<Keybind[]>(stored?.keybinds ?? defaultKeybinds);
  const [rotations, setRotations] = React.useState<Rotation[]>(stored?.rotations ?? rotationsSeed);
  const [settings, setSettings] = React.useState<SettingsState>(normalizeSettings(stored?.settings));
  const [selectedRotationId, setSelectedRotationId] = React.useState(rotations[0]?.id ?? "opener-2gcd");
  const [isRunning, setIsRunning] = React.useState(false);
  const [startAt, setStartAt] = React.useState<number | null>(null);
  const [countdownStartAt, setCountdownStartAt] = React.useState<number | null>(null);
  const [countdownValue, setCountdownValue] = React.useState<number | null>(null);
  const [now, setNow] = React.useState(0);
  const [attempts, setAttempts] = React.useState<Attempt[]>([]);
  const [flashKey, setFlashKey] = React.useState<{ key: string; verdict: Attempt["verdict"] } | null>(null);
  const [feedback, setFeedback] = React.useState<Feedback | null>(null);
  const [cooldowns, setCooldowns] = React.useState<CooldownState>({});
  const [cooldownClock, setCooldownClock] = React.useState(0);
  const [combatEngine, setCombatEngine] = React.useState<CombatEngineState>(idleCombatEngine);
  const [calibrating, setCalibrating] = React.useState<string | null>(null);
  const wheelInputAtRef = React.useRef(0);
  const flashClearTimerRef = React.useRef<number | null>(null);
  const [calibrationMessage, setCalibrationMessage] = React.useState("尚未開始校準");

  const selectedRotation = rotations.find((r) => r.id === selectedRotationId) ?? rotations[0];
  const stats = scoreAttempts(selectedRotation, attempts);
  const currentEvent = selectedRotation.events.find((event) => {
    const window = inputWindow(event, settings);
    return now >= event.time - window.early / 1000 && now <= event.time + window.late / 1000;
  });
  const nextEvents = selectedRotation.events.filter((event) => event.time > now).slice(0, 5);
  const completedIds = new Set(attempts.map((attempt) => attempt.eventId).filter(Boolean));
  const visibleRotationEvents = selectedRotation.events.filter(
    (event) => event.time >= now - 5 && event.time <= now + 25
  );
  const bardGauge = getBardGauge(now, selectedRotation, attempts, settings.procMode);

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ keybinds, rotations, settings }));
  }, [keybinds, rotations, settings]);

  React.useEffect(() => {
    if (!Object.keys(cooldowns).length) return undefined;
    const timer = window.setInterval(() => {
      const now = performance.now();
      setCooldownClock(now);
      setCooldowns((items) =>
        Object.fromEntries(Object.entries(items).filter(([, cooldown]) => cooldown.endsAt > now))
      );
    }, 100);
    return () => window.clearInterval(timer);
  }, [cooldowns]);

  React.useEffect(() => {
    if (!combatEngine.queuedAction || now < combatEngine.queuedAction.executeAt) return;
    setCombatEngine((engine) => ({ ...engine, queuedAction: null }));
  }, [combatEngine.queuedAction, now]);

  React.useEffect(() => {
    return () => {
      if (flashClearTimerRef.current !== null) {
        window.clearTimeout(flashClearTimerRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (!isRunning || startAt === null) return undefined;
    let frame = 0;
    const tick = () => {
      const elapsed = (performance.now() - startAt) / 1000;
      setNow(Math.min(selectedRotation.duration, elapsed));
      if (elapsed >= selectedRotation.duration) {
        setIsRunning(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isRunning, selectedRotation.duration, startAt]);

  React.useEffect(() => {
    if (countdownStartAt === null) return undefined;
    let frame = 0;
    const tick = () => {
      const elapsed = (performance.now() - countdownStartAt) / 1000;
      const remaining = Math.max(0, 3 - elapsed);
      setCountdownValue(Math.ceil(remaining));
      if (elapsed >= 3) {
        setCountdownStartAt(null);
        setCountdownValue(null);
        setNow(0);
        setStartAt(performance.now());
        setIsRunning(true);
        return;
      }
      setNow(elapsed - 3);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [countdownStartAt]);

  function showInputFeedback(key: string, verdict: Attempt["verdict"] = "Good") {
    if (flashClearTimerRef.current !== null) {
      window.clearTimeout(flashClearTimerRef.current);
    }
    setFlashKey({ key, verdict });
    flashClearTimerRef.current = window.setTimeout(() => {
      setFlashKey(null);
      flashClearTimerRef.current = null;
    }, 280);
  }

  function isKnownTrainerKey(key: string) {
    return keyDisplayOrder.some((item) => item.toUpperCase() === key.toUpperCase()) ||
      keybinds.some((item) => item.key.toUpperCase() === key.toUpperCase()) ||
      key === WHEEL_UP_KEY ||
      key === WHEEL_DOWN_KEY;
  }

  function keybindForKey(key: string) {
    return keybinds.find((item) => item.key.toUpperCase() === key.toUpperCase());
  }

  function triggerCooldownForKey(key: string, delaySeconds = 0) {
    const bind = keybindForKey(key);
    if (!bind) return;
    const duration = skillRecast(bind.skill, bind.role, settings);
    if (duration <= 0) return;
    const startsAt = performance.now() + Math.max(0, delaySeconds) * 1000;
    setCooldowns((items) => ({
      ...items,
      [bind.skill]: {
        duration,
        startsAt,
        endsAt: startsAt + duration * 1000,
      },
    }));
    setCooldownClock(performance.now());
  }

  function isAcceptedRelease(verdict: Attempt["verdict"]) {
    return verdict === "Queued" || verdict === "Perfect" || verdict === "Good" || verdict === "Late" || verdict === "Clip";
  }

  function nextGcdAfter(time: number, excludedId?: string) {
    return selectedRotation.events.find(
      (event) => event.kind === "GCD" && event.time > time && event.id !== excludedId
    );
  }

  function resolveCombatRelease(
    at: number,
    event: TimelineEvent,
    delta: number,
    engine: CombatEngineState
  ): ResolvedRelease {
    const queueWindowSeconds = settings.queueWindow / 1000;
    const frameSeconds = clientInputDelay(settings) / 1000;
    const lockedUntil = Math.max(engine.animationLockUntil, 0);
    const isGcd = event.kind === "GCD";

    if (isGcd) {
      const queueOpensAt = event.time - queueWindowSeconds;
      const canQueue = at >= queueOpensAt && at < event.time - frameSeconds;
      const lockedThroughGcd = lockedUntil > event.time + frameSeconds;
      if (canQueue) {
        return {
          verdict: lockedThroughGcd ? "Clip" : "Queued",
          actionAt: Math.max(event.time, lockedUntil),
          delta: lockedThroughGcd ? Math.round((Math.max(event.time, lockedUntil) - event.time) * 1000) : 0,
          queued: !lockedThroughGcd,
          accepted: true,
        };
      }
      if (at < queueOpensAt) {
        return {
          verdict: event.time <= 0 && settings.allowEarlyPull ? "Early" : "Pull",
          actionAt: at,
          delta: Math.round(delta),
          queued: false,
          accepted: false,
        };
      }
      if (lockedUntil > at + frameSeconds) {
        return {
          verdict: "Clip",
          actionAt: lockedUntil,
          delta: Math.round((lockedUntil - event.time) * 1000),
          queued: true,
          accepted: true,
        };
      }
      const effectiveDelta = effectiveActionDelta(delta, settings);
      const abs = Math.abs(effectiveDelta);
      const window = inputWindow(event, settings);
      const verdict =
        abs <= 120
          ? "Perfect"
          : effectiveDelta >= -window.early && effectiveDelta <= window.late
            ? "Good"
            : effectiveDelta < 0
              ? "Early"
              : "Late";
      return {
        verdict,
        actionAt: Math.max(at, event.time),
        delta: Math.round(effectiveDelta),
        queued: false,
        accepted: isAcceptedRelease(verdict),
      };
    }

    const actionAt = lockedUntil > at + frameSeconds ? lockedUntil : at;
    const actionDelta = (actionAt - event.time) * 1000;
    const window = inputWindow(event, settings);
    if (actionDelta < -window.early) {
      return {
        verdict: "Early",
        actionAt,
        delta: Math.round(actionDelta),
        queued: lockedUntil > at + frameSeconds,
        accepted: false,
      };
    }

    const nextGcd = nextGcdAfter(actionAt, event.id);
    const clipsNextGcd =
      nextGcd !== undefined && (nextGcd.time - actionAt) * 1000 < effectiveAnimationLock(settings);
    if (clipsNextGcd) {
      return {
        verdict: "Clip",
        actionAt,
        delta: Math.round(actionDelta),
        queued: lockedUntil > at + frameSeconds,
        accepted: true,
      };
    }

    const effectiveDelta = effectiveActionDelta(actionDelta, settings);
    const abs = Math.abs(effectiveDelta);
    const verdict =
      lockedUntil > at + frameSeconds
        ? "Queued"
        : abs <= 120
          ? "Perfect"
          : effectiveDelta >= -window.early && effectiveDelta <= window.late
            ? "Good"
            : effectiveDelta < 0
              ? "Early"
              : "Late";
    return {
      verdict,
      actionAt,
      delta: verdict === "Queued" ? Math.round(actionDelta) : Math.round(effectiveDelta),
      queued: verdict === "Queued",
      accepted: isAcceptedRelease(verdict),
    };
  }

  function commitCombatEngineAction(event: TimelineEvent, release: ResolvedRelease) {
    if (!release.accepted) return;
    const executeAt = release.actionAt;
    const lockEndsAt = executeAt + effectiveAnimationLock(settings) / 1000;
    setCombatEngine((engine) => ({
      animationLockUntil: Math.max(engine.animationLockUntil, lockEndsAt),
      gcdReadyAt: event.kind === "GCD" ? executeAt + settings.gcd : engine.gcdReadyAt,
      gcdStartedAt: event.kind === "GCD" ? executeAt : engine.gcdStartedAt,
      queuedAction: release.queued
        ? { executeAt, key: event.key, skill: event.skill }
        : null,
    }));
  }

  function receiveHeatmapInput(key: string) {
    if ((isRunning && startAt !== null) || countdownStartAt !== null) {
      handleInput(key);
      return;
    }
    triggerCooldownForKey(key);
    showInputFeedback(key);
  }

  React.useEffect(() => {
    const canReceiveTrainerInput = () => (isRunning && startAt !== null) || countdownStartAt !== null;
    const shouldOwnBrowserInput = (event: Event) =>
      !isEditableTarget(event.target) && (calibrating !== null || canReceiveTrainerInput());
    const dispatchInput = (input: TrainerInput, event: Event) => {
      if (isEditableTarget(event.target)) return;
      if (shouldOwnBrowserInput(event)) {
        blockBrowserInput(event);
      }
      if (calibrating) {
        setKeybinds((items) =>
          items.map((item) => (item.skill === calibrating ? { ...item, key: input.key } : item))
        );
        setCalibrationMessage(`${calibrating} 撌脣皜砍 ${input.key}`);
        setCalibrating(null);
        return;
      }
      if (!canReceiveTrainerInput()) return;
      handleInput(input.key);
    };
    const onEngineKeyDown = (event: KeyboardEvent) => {
      if (isModifierKey(event) && shouldOwnBrowserInput(event)) {
        blockBrowserInput(event);
        return;
      }
      if (event.repeat) return;
      const input = normalizeKeyboardInput(event);
      if (!input) return;
      if (!canReceiveTrainerInput() && !calibrating && isKnownTrainerKey(input.key)) {
        blockBrowserInput(event);
        triggerCooldownForKey(input.key);
        showInputFeedback(input.key);
        return;
      }
      dispatchInput(input, event);
    };
    const onEngineKeyUp = (event: KeyboardEvent) => {
      if (shouldOwnBrowserInput(event) && (isModifierKey(event) || event.altKey || event.ctrlKey || event.metaKey)) {
        blockBrowserInput(event);
      }
    };
    const onEngineMouseDown = (event: MouseEvent) => {
      const input = normalizeMouseInput(event);
      if (!input) return;
      if (!canReceiveTrainerInput() && !calibrating && isKnownTrainerKey(input.key)) {
        blockBrowserInput(event);
        triggerCooldownForKey(input.key);
        showInputFeedback(input.key);
        return;
      }
      dispatchInput(input, event);
    };
    const onEngineAuxClick = (event: MouseEvent) => {
      if (normalizeMouseInput(event)) blockBrowserInput(event);
    };
    const onEngineContextMenu = (event: MouseEvent) => {
      if (shouldOwnBrowserInput(event)) blockBrowserInput(event);
    };
    const onEngineWheel = (event: WheelEvent) => {
      const input = normalizeWheelInput(event);
      if (!input) return;
      const now = performance.now();
      if (now - wheelInputAtRef.current < 120) {
        blockBrowserInput(event);
        return;
      }
      wheelInputAtRef.current = now;
      if (!canReceiveTrainerInput() && !calibrating && isKnownTrainerKey(input.key)) {
        blockBrowserInput(event);
        triggerCooldownForKey(input.key);
        showInputFeedback(input.key);
        return;
      }
      dispatchInput(input, event);
    };
    window.addEventListener("keydown", onEngineKeyDown, true);
    window.addEventListener("keyup", onEngineKeyUp, true);
    window.addEventListener("mousedown", onEngineMouseDown, true);
    window.addEventListener("auxclick", onEngineAuxClick, true);
    window.addEventListener("contextmenu", onEngineContextMenu, true);
    window.addEventListener("wheel", onEngineWheel, { capture: true, passive: false });
    return () => {
      window.removeEventListener("keydown", onEngineKeyDown, true);
      window.removeEventListener("keyup", onEngineKeyUp, true);
      window.removeEventListener("mousedown", onEngineMouseDown, true);
      window.removeEventListener("auxclick", onEngineAuxClick, true);
      window.removeEventListener("contextmenu", onEngineContextMenu, true);
      window.removeEventListener("wheel", onEngineWheel, true);
    };
  });

  function inputTime() {
    if (countdownStartAt !== null) return (performance.now() - countdownStartAt) / 1000 - 3;
    return (performance.now() - (startAt ?? performance.now())) / 1000;
  }

  function handleInput(actualKey: string) {
    const at = inputTime();
    let acceptedRelease: { event: TimelineEvent; release: ResolvedRelease } | null = null;
    const candidates = selectedRotation.events
      .filter((event) => !completedIds.has(event.id))
      .map((event) => ({
        event,
        delta: (at - event.time) * 1000,
      }))
      .filter(({ event, delta }) => {
        const window = inputWindow(event, settings);
        return delta >= -window.early && delta <= window.late + 120;
      })
      .sort((a, b) => Math.abs(scoredDelta(a.delta, a.event, settings)) - Math.abs(scoredDelta(b.delta, b.event, settings)));
    const matchingCandidates = candidates.filter(
      ({ event }) => event.key.toUpperCase() === actualKey.toUpperCase()
    );
    const selectedCandidate = matchingCandidates[0] ?? candidates[0];
    const expected = selectedCandidate?.event;
    const delta = selectedCandidate?.delta ?? null;
    let attempt: Attempt;
    if (!expected) {
      const firstUpcoming = selectedRotation.events.find((event) => !completedIds.has(event.id) && event.time >= 0);
      if (at < -settings.queueWindow / 1000 && firstUpcoming?.key.toUpperCase() === actualKey.toUpperCase()) {
        attempt = {
          eventId: null,
          expectedSkill: firstUpcoming.skill,
          expectedKey: firstUpcoming.key,
          actualKey,
          delta: (at - firstUpcoming.time) * 1000,
          verdict: settings.allowEarlyPull ? "Early" : "Pull",
          at,
        };
      } else {
        attempt = {
          eventId: null,
          expectedSkill: null,
          expectedKey: null,
          actualKey,
          delta: null,
          verdict: "Wrong",
          at,
        };
      }
    } else if (expected.key.toUpperCase() !== actualKey.toUpperCase()) {
      attempt = {
        eventId: null,
        expectedSkill: expected.skill,
        expectedKey: expected.key,
        actualKey,
        delta,
        verdict: "Wrong",
        at,
      };
    } else {
      const release = resolveCombatRelease(at, expected, delta, combatEngine);
      attempt = {
        eventId: release.accepted ? expected.id : null,
        expectedSkill: expected.skill,
        expectedKey: expected.key,
        actualKey,
        delta: release.delta,
        verdict: release.verdict,
        at,
        actionAt: release.actionAt,
      };
      if (release.accepted) {
        acceptedRelease = { event: expected, release };
      }
    }
    if (acceptedRelease) {
      commitCombatEngineAction(acceptedRelease.event, acceptedRelease.release);
      triggerCooldownForKey(actualKey, acceptedRelease.release.actionAt - at);
    }
    setAttempts((items) => [...items, attempt]);
    showInputFeedback(actualKey, attempt.verdict);
    setFeedback({
      ...attempt,
      id: performance.now(),
      skill: attempt.expectedSkill ?? actualKey,
    });
    if (settings.sound) playFeedbackSound(attempt.verdict);
    window.setTimeout(() => setFeedback(null), 720);
  }

  function resetTrainingState() {
    setAttempts([]);
    setFeedback(null);
    setFlashKey(null);
    setCooldowns({});
    setCooldownClock(0);
    setCombatEngine(idleCombatEngine);
    if (flashClearTimerRef.current !== null) {
      window.clearTimeout(flashClearTimerRef.current);
      flashClearTimerRef.current = null;
    }
  }

  function startTraining() {
    resetTrainingState();
    setNow(-3);
    setStartAt(null);
    setIsRunning(false);
    setCountdownValue(3);
    setCountdownStartAt(performance.now());
  }

  function stopTraining() {
    resetTrainingState();
    setCountdownStartAt(null);
    setCountdownValue(null);
    setStartAt(null);
    setIsRunning(false);
  }

  function chooseRotation(rotationId: string) {
    resetTrainingState();
    setCountdownStartAt(null);
    setCountdownValue(null);
    setStartAt(null);
    setIsRunning(false);
    setNow(0);
    setSelectedRotationId(rotationId);
  }

  function updateRotationEvent(index: number, patch: Partial<TimelineEvent>) {
    setRotations((items) =>
      items.map((rotation) =>
        rotation.id === selectedRotation.id
          ? {
              ...rotation,
              events: rotation.events
                .map((event, eventIndex) => (eventIndex === index ? { ...event, ...patch } : event))
                .sort((a, b) => a.time - b.time),
            }
          : rotation
      )
    );
  }

  function addRotationEvent() {
    const newEvent = ev(
      `custom-${crypto.randomUUID()}`,
      Math.min(selectedRotation.duration, Math.round((now + 2.5) * 10) / 10),
      "oGCD",
      "新技能",
      "F",
      "medium",
      "自訂事件"
    );
    setRotations((items) =>
      items.map((rotation) =>
        rotation.id === selectedRotation.id
          ? { ...rotation, events: [...rotation.events, newEvent].sort((a, b) => a.time - b.time) }
          : rotation
      )
    );
  }

  function duplicateRotation() {
    const copy = {
      ...selectedRotation,
      id: `copy-${crypto.randomUUID()}`,
      name: `${selectedRotation.name} 複本`,
      events: selectedRotation.events.map((event) => ({ ...event, id: `copy-${crypto.randomUUID()}` })),
    };
    setRotations((items) => [...items, copy]);
    chooseRotation(copy.id);
  }

  return (
    <main className="appShell">
      <header className="topbar">
        <div>
          <p className="eyebrow">FINAL FANTASY XIV / BRD / PATCH 7.2 PROFILE</p>
          <h1>吟遊詩人爆發軸訓練器</h1>
        </div>
        <div className="sourceNote">
          技能與調整固定在 7.2 訓練語境；圖標使用 XIVAPI 遊戲素材，灰機作中文技能資料參考。
        </div>
      </header>

      <nav className="tabs" aria-label="主要頁籤">
        {[
          ["train", "訓練", Crosshair],
          ["timeline", "爆發軸", CalendarClock],
          ["keybinds", "鍵位", Keyboard],
          ["analysis", "分析", BarChart3],
          ["settings", "設定", Settings],
        ].map(([id, label, Icon]) => (
          <button key={id as string} className={tab === id ? "active" : ""} onClick={() => setTab(id as string)}>
            {React.createElement(Icon as typeof Crosshair, { size: 18 })}
            {label as string}
          </button>
        ))}
      </nav>

      {tab === "train" && (
        <section className="trainGrid">
          <section className="panel focusPanel">
            <div className="trainingControls">
              <select value={selectedRotationId} onChange={(event) => chooseRotation(event.target.value)}>
                {rotations.map((rotation) => (
                  <option key={rotation.id} value={rotation.id}>
                    {rotation.name}
                  </option>
                ))}
              </select>
              <button className="primary" onClick={startTraining}>
                <Play size={18} /> {countdownValue !== null ? "準備中" : "開始"}
              </button>
              <button onClick={stopTraining}>
                <Square size={18} /> 停止
              </button>
            </div>

            {feedback && (
              <div className={`feedbackToast ${feedback.verdict}`} key={feedback.id}>
                <strong>{feedback.verdict}</strong>
                <span>{formatDelta(feedback.delta)}</span>
              </div>
            )}

            {countdownValue !== null && (
              <div className="battleCountdown" aria-live="assertive">
                <div>
                  <span>戰鬥開始倒數</span>
                  <strong>{countdownValue || "START"}</strong>
                  <em>準備戰鬥</em>
                </div>
              </div>
            )}

            <div className={`focusCue ${currentEvent ? "active" : ""}`}>
              <span>{now < 0 ? "準備戰鬥" : currentEvent ? "判定窗口" : "等待輸入窗口"}</span>
              <strong>{currentEvent?.skill ?? (now < 0 ? "開場倒數" : "依時間軸準備")}</strong>
              <em>{currentEvent?.key ?? "-"}</em>
            </div>

            <div className="combatState">
              <div>
                <span>歌曲</span>
                <strong>{bardGauge.song}</strong>
              </div>
              <div>
                <span>Coda</span>
                <strong>{bardGauge.coda} / 3</strong>
              </div>
              <div>
                <span>Soul Voice</span>
                <strong>{bardGauge.soulVoice}</strong>
              </div>
              <div>
                <span>團輔窗口</span>
                <strong>{now < 0 ? "準備中" : now < 20 ? `${(20 - now).toFixed(1)}s` : "結束"}</strong>
              </div>
            </div>
            <BardGaugePanel gauge={bardGauge} />

            <RotationDisplay
              events={visibleRotationEvents}
              attempts={attempts}
              now={now}
              duration={selectedRotation.duration}
              lastFeedback={feedback}
              cooldowns={cooldowns}
              cooldownClock={cooldownClock}
              gaugeMarkers={bardGauge.markers}
              eventGaugeMarkers={bardGauge.eventMarkers}
            />

            <InputFeelPanel
              currentEvent={currentEvent}
              engine={combatEngine}
              now={now}
              settings={settings}
              nextGcd={selectedRotation.events.find((event) => event.kind === "GCD" && event.time > now)}
              lastFeedback={feedback}
            />

            <div className="hintStrip">
              {settings.showHints
                ? nextEvents.map((event) => (
                    <span key={event.id}>
                      {event.skill} <b>{event.key}</b>
                    </span>
                  ))
                : "提示已關閉"}
            </div>
          </section>

          <section className="panel trainingSummaryPanel">
            <div className="summaryMetrics">
              <Metric label="總分" value={`${stats.score}`} suffix="/100" />
              <Metric label="GCD 準確率" value={`${stats.gcdAccuracy}%`} />
              <Metric label="oGCD 準確率" value={`${stats.ogcdAccuracy}%`} />
              <Metric label="核心完成率" value={`${stats.coreRate}%`} />
              <Metric label="漏按" value={`${stats.misses.length}`} />
              <Metric label="誤觸" value={`${stats.wrong}`} />
              <Metric label="Clip 風險" value={`${attempts.filter((attempt) => attempt.verdict === "Clip").length}`} />
            </div>
            <div className="recentLog">
              <h3>最近輸入</h3>
              {attempts.slice(-6).reverse().map((attempt, index) => (
                <div key={`${attempt.at}-${index}`} className={`logItem ${attempt.verdict}`}>
                  <span>{attempt.actualKey}</span>
                  <b>{attempt.verdict}</b>
                  <em>{formatDelta(attempt.delta)}</em>
                </div>
              ))}
            </div>
          </section>

          <KeyboardHeatmap
            keybinds={keybinds}
            flashKey={flashKey}
            cooldowns={cooldowns}
            cooldownClock={cooldownClock}
            onInput={receiveHeatmapInput}
          />
        </section>
      )}

      {tab === "timeline" && (
        <section className="panel widePanel">
          <div className="panelHeader">
            <div>
              <span>爆發軸編輯</span>
              <p>{selectedRotation.description}</p>
            </div>
            <div className="actions">
              <button onClick={addRotationEvent}>
                <Plus size={18} /> 新增技能
              </button>
              <button onClick={duplicateRotation}>
                <Copy size={18} /> 複製軸
              </button>
            </div>
          </div>
          <div className="rotationPicker">
            {rotations.map((rotation) => (
              <button
                key={rotation.id}
                className={rotation.id === selectedRotationId ? "active" : ""}
                onClick={() => chooseRotation(rotation.id)}
              >
                {rotation.name}
              </button>
            ))}
          </div>
          <div className="dataTable">
            <div className="tableHead">
              <span>時間</span>
              <span>類型</span>
              <span>技能</span>
              <span>按鍵</span>
              <span>優先級</span>
              <span>窗口</span>
              <span>備註</span>
              <span />
            </div>
            {selectedRotation.events.map((event, index) => (
              <div className="tableRow" key={event.id}>
                <input
                  type="number"
                  step="0.1"
                  value={event.time}
                  onChange={(change) => updateRotationEvent(index, { time: Number(change.target.value) })}
                />
                <select
                  value={event.kind}
                  onChange={(change) => updateRotationEvent(index, { kind: change.target.value as TimelineEvent["kind"] })}
                >
                  <option>GCD</option>
                  <option>oGCD</option>
                  <option>Mechanic</option>
                  <option>State</option>
                </select>
                <input value={event.skill} onChange={(change) => updateRotationEvent(index, { skill: change.target.value })} />
                <input value={event.key} onChange={(change) => updateRotationEvent(index, { key: change.target.value })} />
                <select
                  value={event.priority}
                  onChange={(change) => updateRotationEvent(index, { priority: change.target.value as Priority })}
                >
                  <option value="core">核心</option>
                  <option value="high">高</option>
                  <option value="medium">中</option>
                  <option value="delayable">可延</option>
                  <option value="mechanic">機制</option>
                </select>
                <span className="windowText">-{event.early}/+{event.late}ms</span>
                <input value={event.note} onChange={(change) => updateRotationEvent(index, { note: change.target.value })} />
                <button
                  className="iconButton"
                  onClick={() =>
                    setRotations((items) =>
                      items.map((rotation) =>
                        rotation.id === selectedRotation.id
                          ? { ...rotation, events: rotation.events.filter((_, eventIndex) => eventIndex !== index) }
                          : rotation
                      )
                    )
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "keybinds" && (
        <section className="panel widePanel">
          <div className="panelHeader">
            <div>
              <span>鍵位與校準</span>
              <p>支援鍵盤、Ctrl 組合、滑鼠側鍵名稱、滾輪傾斜名稱與 DPI 映射鍵。</p>
            </div>
            <div className="calibration">{calibrationMessage}</div>
          </div>
          <div className="keybindGrid">
            {keybinds.map((bind, index) => (
              <div className="bindCard" key={bind.skill}>
                <div className="skillIcon mini" data-kind={bind.role}>
                  <SkillIcon skill={bind.skill} />
                </div>
                <div>
                  <strong>{bind.skill}</strong>
                  <span>{roleLabel(bind.role)} / {bind.zone}</span>
                </div>
                <input
                  value={bind.key}
                  onChange={(event) =>
                    setKeybinds((items) =>
                      items.map((item, itemIndex) => (itemIndex === index ? { ...item, key: event.target.value } : item))
                    )
                  }
                />
                <button onClick={() => {
                  setCalibrating(bind.skill);
                  setCalibrationMessage(`請按下 ${bind.skill} 的實際按鍵。若 5 秒內沒反應，代表瀏覽器可能偵測不到。`);
                  window.setTimeout(() => {
                    setCalibrating((current) => {
                      if (current === bind.skill) {
                        setCalibrationMessage("此鍵沒有送出瀏覽器可偵測事件，請在 Razer Synapse 映射成鍵盤鍵或滑鼠按鍵。");
                        return null;
                      }
                      return current;
                    });
                  }, 5000);
                }}>
                  <MousePointer2 size={16} /> 校準
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "analysis" && (
        <section className="analysisGrid">
          <div className="panel reportHero">
            <p>{selectedRotation.name} 報告</p>
            <h2>{stats.score} / 100</h2>
            <span>依最近一次訓練輸入即時計算，資料保留在本機瀏覽器。</span>
          </div>
          <MetricCard icon={Gauge} label="平均延遲" value={formatDelta(stats.avg)} />
          <MetricCard icon={Activity} label="p95 最慢延遲" value={formatDelta(stats.p95)} />
          <MetricCard icon={Shield} label="核心完成率" value={`${stats.coreRate}%`} />
          <div className="panel analysisPanel">
            <h3>最慢技能</h3>
            {stats.slowest.length ? (
              stats.slowest.map((attempt, index) => (
                <div className="slowItem" key={`${attempt.at}-${index}`}>
                  <b>{index + 1}. {attempt.expectedSkill}</b>
                  <span>{attempt.expectedKey} / {formatDelta(attempt.delta)}</span>
                </div>
              ))
            ) : (
              <p>還沒有訓練資料。</p>
            )}
          </div>
          <div className="panel analysisPanel">
            <h3>鍵位判斷</h3>
            <p>
              若 X / T / C / V 連續偏慢，代表左手爆發區過於集中；若 M4 / M5 偏慢，
              可能是滑鼠握持或側鍵辨識成本偏高。Head Graze 插入模式可檢查機制技能是否覆蓋到核心團輔。
            </p>
          </div>
        </section>
      )}

      {tab === "settings" && (
        <section className="panel settingsPanel">
          <SettingNumber label="GCD 長度" value={settings.gcd} step={0.01} onChange={(gcd) => setSettings({ ...settings, gcd })} />
          <SettingNumber label="Action Queue 窗口 ms" value={settings.queueWindow} step={10} onChange={(queueWindow) => setSettings({ ...settings, queueWindow })} />
          <SettingNumber label="Ping 往返 ms" value={settings.ping} step={5} onChange={(ping) => setSettings({ ...settings, ping })} />
          <SettingNumber label="動畫鎖基準 ms" value={settings.animationLock} step={10} onChange={(animationLock) => setSettings({ ...settings, animationLock })} />
          <label className="settingLine">
            <span>前端 FPS / 輸入輪詢</span>
            <select value={settings.frameRate} onChange={(event) => setSettings({ ...settings, frameRate: Number(event.target.value) })}>
              <option value={30}>30 FPS</option>
              <option value={60}>60 FPS</option>
              <option value={120}>120 FPS</option>
              <option value={144}>144 FPS</option>
            </select>
          </label>
          {[
            ["allowEarlyPull", "允許倒數搶開"],
            ["showHints", "顯示下一步提示"],
            ["sound", "啟用錯誤音效"],
            ["procMode", "使用 80% Repertoire proc 模擬"],
          ].map(([key, label]) => (
            <label className="toggleLine" key={key}>
              <span>{label}</span>
              <input
                type="checkbox"
                checked={Boolean(settings[key as keyof SettingsState])}
                onChange={(event) => setSettings({ ...settings, [key]: event.target.checked })}
              />
            </label>
          ))}
        </section>
      )}
    </main>
  );
}

function Metric({ label, value, suffix = "" }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}<em>{suffix}</em></strong>
    </div>
  );
}

function SkillIcon({ skill }: { skill: string }) {
  const [failed, setFailed] = React.useState(false);
  const url = skillIcons[skill];
  if (url && !failed) {
    return <img src={url} alt="" onError={() => setFailed(true)} />;
  }
  return <>{skill.slice(0, 2)}</>;
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof Bolt; label: string; value: string }) {
  return (
    <div className="panel metricCard">
      <Icon size={22} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SettingNumber({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="settingLine">
      <span>{label}</span>
      <input type="number" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function isSuccessfulAttempt(attempt: Attempt) {
  return Boolean(attempt.eventId) && attempt.verdict !== "Wrong" && attempt.verdict !== "Miss";
}

type GaugeMarker = {
  eventId?: string;
  at: number;
  label: string;
  kind: "song" | "tick" | "spender" | "coda" | "soul";
};

function songCodaKey(song: BardSong) {
  if (song === "賢者的敘事謠") return "mage";
  if (song === "軍神的讚美歌") return "army";
  return "wanderer";
}

function isSongSkill(skill: string): skill is BardSong {
  return skill === "放浪神的小步舞曲" || skill === "賢者的敘事謠" || skill === "軍神的讚美歌";
}

function deterministicRepertoireProc(tickIndex: number, procMode: boolean) {
  if (!procMode) return true;
  return tickIndex % 5 !== 0;
}

function eventGaugeTickLabel(song: BardSong) {
  if (song === "放浪神的小步舞曲") return "+Pitch";
  if (song === "軍神的讚美歌") return "+Army";
  return "+5 SV";
}

function plannedGaugeMarkersForEvent(event: TimelineEvent): GaugeMarker[] {
  if (isSongSkill(event.skill)) return [{ eventId: event.id, at: event.time, label: "+Coda", kind: "song" }];
  if (event.skill === "九天連箭") return [{ eventId: event.id, at: event.time, label: "+Rep", kind: "tick" }];
  if (event.skill === "完美音調") return [{ eventId: event.id, at: event.time, label: "Pitch 0", kind: "spender" }];
  if (event.skill === "絕峰箭 / 爆破箭") return [{ eventId: event.id, at: event.time, label: "SV 0", kind: "soul" }];
  if (event.skill === "光明神的最終樂章") return [{ eventId: event.id, at: event.time, label: "Coda 0", kind: "coda" }];
  return [];
}

function getInitialBardGauge(rotationId: string) {
  if (rotationId.includes("opener")) {
    return {
      song: null as BardSong | null,
      songStart: null as number | null,
      codaStates: { mage: false, army: false, wanderer: false },
      soulVoice: 0,
      pitchStacks: 0,
      armyStacks: 0,
    };
  }
  return {
    song: "放浪神的小步舞曲" as BardSong,
    songStart: -34,
    codaStates: { mage: true, army: true, wanderer: true },
    soulVoice: 100,
    pitchStacks: 3,
    armyStacks: 0,
  };
}

function getBardGauge(now: number, rotation: Rotation, attempts: Attempt[], procMode: boolean) {
  const eventById = new Map(rotation.events.map((event) => [event.id, event]));
  const successfulSkills = attempts
    .filter(isSuccessfulAttempt)
    .map((attempt) => {
      const event = eventById.get(attempt.eventId ?? "");
      return event ? { id: event.id, at: attempt.actionAt ?? Math.max(attempt.at, event.time), skill: event.skill } : null;
    })
    .filter((item): item is { id: string; at: number; skill: string } => Boolean(item))
    .filter((item) => item.at <= now)
    .sort((a, b) => a.at - b.at);

  const initial = getInitialBardGauge(rotation.id);
  const songStarts = [
    ...(initial.song && initial.songStart !== null ? [{ at: initial.songStart, song: initial.song }] : []),
    ...successfulSkills
      .filter((item) => isSongSkill(item.skill))
      .map((item) => ({ at: item.at, song: item.skill as BardSong })),
  ].sort((a, b) => a.at - b.at);

  const songAt = (time: number) => {
    const active = songStarts.filter((item) => item.at <= time && time < item.at + SONG_DURATION);
    return active.length ? active[active.length - 1] : null;
  };

  const resourceEvents: Array<
    { at: number; type: "skill"; id: string; skill: string } |
    { at: number; type: "tick"; song: BardSong; tickIndex: number }
  > = successfulSkills.map((item) => ({ at: item.at, type: "skill", id: item.id, skill: item.skill }));
  const gaugeMarkers: GaugeMarker[] = [];

  songStarts.forEach((segment, segmentIndex) => {
    const nextStart = songStarts[segmentIndex + 1]?.at ?? Infinity;
    const end = Math.min(segment.at + SONG_DURATION, nextStart, rotation.duration);
    for (let tick = 1; segment.at + tick * 3 <= end; tick += 1) {
      const tickAt = segment.at + tick * 3;
      if (tickAt >= 0 && deterministicRepertoireProc(tick, procMode)) {
        gaugeMarkers.push({ at: tickAt, label: eventGaugeTickLabel(segment.song), kind: "tick" });
        if (tickAt <= now) {
          resourceEvents.push({ at: tickAt, type: "tick", song: segment.song, tickIndex: tick });
        }
      }
    }
  });

  let codaStates = { ...initial.codaStates };
  let soulVoice = initial.soulVoice;
  let pitchStacks = initial.pitchStacks;
  let armyStacks = initial.armyStacks;

  const grantRepertoire = (song: BardSong | null) => {
    if (!song) return;
    soulVoice = Math.min(100, soulVoice + 5);
    if (song === "放浪神的小步舞曲") pitchStacks = Math.min(3, pitchStacks + 1);
    if (song === "軍神的讚美歌") armyStacks = Math.min(4, armyStacks + 1);
  };

  resourceEvents
    .sort((a, b) => a.at - b.at || (a.type === "skill" ? -1 : 1))
    .forEach((event) => {
      if (event.type === "tick") {
        grantRepertoire(event.song);
        return;
      }
      if (isSongSkill(event.skill)) {
        codaStates = { ...codaStates, [songCodaKey(event.skill)]: true };
        pitchStacks = 0;
        armyStacks = 0;
        gaugeMarkers.push({ eventId: event.id, at: event.at, label: "+Coda", kind: "song" });
        return;
      }
      if (event.skill === "九天連箭") {
        grantRepertoire(songAt(event.at)?.song ?? null);
        gaugeMarkers.push({ eventId: event.id, at: event.at, label: "+Rep", kind: "tick" });
        return;
      }
      if (event.skill === "完美音調") {
        pitchStacks = 0;
        gaugeMarkers.push({ eventId: event.id, at: event.at, label: "Pitch 0", kind: "spender" });
        return;
      }
      if (event.skill === "絕峰箭 / 爆破箭") {
        soulVoice = 0;
        gaugeMarkers.push({ eventId: event.id, at: event.at, label: "SV 0", kind: "soul" });
        return;
      }
      if (event.skill === "光明神的最終樂章") {
        codaStates = { mage: false, army: false, wanderer: false };
        gaugeMarkers.push({ eventId: event.id, at: event.at, label: "Coda 0", kind: "coda" });
      }
    });

  const activeSong = songAt(now);
  const song = activeSong?.song ?? "無歌曲";
  const songRemaining = activeSong ? Math.max(0, activeSong.at + SONG_DURATION - now) : 0;
  const inWanderer = song === "放浪神的小步舞曲";
  const inArmy = song === "軍神的讚美歌";
  const maxRepertoire = inArmy ? 4 : inWanderer ? 3 : 0;
  const displayStacks = inWanderer ? pitchStacks : inArmy ? armyStacks : 0;
  const pitchReady = inWanderer && (pitchStacks === 3 || (pitchStacks > 0 && songRemaining < 3.2));
  const pitchAdvice =
    song === "無歌曲"
      ? "尚未開歌：Coda / Repertoire / Soul Voice 不會自己產生"
      : inWanderer
        ? pitchStacks === 3
          ? "3 層，現在打完美音調"
          : songRemaining < 3.2 && pitchStacks > 0
            ? "歌快結束，先打掉詩心"
            : "等 Repertoire tick 或九天連箭"
        : inArmy
          ? `${armyStacks} / 4 層軍神加速`
          : "賢者歌：Repertoire 不顯示層數，但會給 Soul Voice / 碎心箭資源";
  return {
    song,
    songRemaining,
    coda: Object.values(codaStates).filter(Boolean).length,
    codaStates,
    soulVoice,
    pitchStacks: displayStacks,
    maxRepertoire,
    pitchReady,
    pitchAdvice,
    apexReady: soulVoice >= 80,
    markers: gaugeMarkers.sort((a, b) => a.at - b.at),
    eventMarkers: gaugeMarkers.reduce<Record<string, GaugeMarker[]>>((items, marker) => {
      if (!marker.eventId) return items;
      return { ...items, [marker.eventId]: [...(items[marker.eventId] ?? []), marker] };
    }, {}),
    nextMarker: gaugeMarkers.find((marker) => marker.at >= now) ?? null,
  };
}

function BardGaugePanel({ gauge }: { gauge: ReturnType<typeof getBardGauge> }) {
  const songClass =
    gauge.song === "放浪神的小步舞曲"
      ? "wanderer"
      : gauge.song === "軍神的讚美歌"
        ? "army"
        : gauge.song === "賢者的敘事謠"
          ? "mage"
          : "idle";
  return (
    <section className={`ffxivBardGauge ${songClass} ${gauge.pitchReady ? "pitchReady" : ""}`}>
      <div className="ffxivGaugeBody">
        <div className="cssSongGauge">
          <div className="songCrest" aria-hidden="true">
            <i />
            <b />
          </div>
          <div className="musicStaff" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="songEndCap" aria-hidden="true" />
          <div className="songTimerNumber">{gauge.songRemaining.toFixed(0)}</div>
          <div className="repertoireOverlay" aria-label={`Repertoire ${gauge.pitchStacks}`}>
            {Array.from({ length: gauge.maxRepertoire }).map((_, stack) => (
              <i key={stack} className={stack < gauge.pitchStacks ? "filled" : ""} />
            ))}
          </div>
        </div>

        <div className="cssSoulVoiceLayer">
          <div className="soulVoiceTrack">
            <i style={{ width: `${gauge.soulVoice}%` }} />
          </div>
          <div className="soulNumber">{gauge.soulVoice}</div>
        </div>

        <div className="cssCodaLayer" aria-label={`Coda ${gauge.coda} of 3`}>
          <i className={`mage ${gauge.codaStates.mage ? "filled" : ""}`} />
          <i className={`army ${gauge.codaStates.army ? "filled" : ""}`} />
          <i className={`wanderer ${gauge.codaStates.wanderer ? "filled" : ""}`} />
        </div>
      </div>
      <div className="gaugeCallout">
        <strong>{gauge.pitchAdvice}</strong>
        <span>
          {gauge.nextMarker
            ? `Next ${gauge.nextMarker.label} @ ${gauge.nextMarker.at.toFixed(1)}s`
            : gauge.apexReady
              ? "Soul Voice 80+：Apex / Blast window"
              : "Soul Voice building"}
        </span>
      </div>
    </section>
  );
}

function playFeedbackSound(verdict: Attempt["verdict"]) {
  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const good = verdict === "Queued" || verdict === "Perfect" || verdict === "Good";
  const bad = verdict === "Wrong" || verdict === "Clip" || verdict === "Miss" || verdict === "Pull";
  oscillator.frequency.value = good ? 880 : bad ? 180 : 420;
  oscillator.type = good ? "sine" : "square";
  gain.gain.setValueAtTime(0.001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.09);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.1);
}

function InputFeelPanel({
  currentEvent,
  engine,
  now,
  settings,
  nextGcd,
  lastFeedback,
}: {
  currentEvent: TimelineEvent | undefined;
  engine: CombatEngineState;
  now: number;
  settings: SettingsState;
  nextGcd: TimelineEvent | undefined;
  lastFeedback: Feedback | null;
}) {
  const rawDelta = currentEvent ? (now - currentEvent.time) * 1000 : null;
  const isGcd = currentEvent?.kind === "GCD";
  const lockMs = effectiveAnimationLock(settings);
  const lockRemainingMs = Math.max(0, (engine.animationLockUntil - now) * 1000);
  const gcdReadyAt = engine.gcdReadyAt || currentEvent?.time || 0;
  const gcdStartedAt = engine.gcdStartedAt || Math.max(0, gcdReadyAt - settings.gcd);
  const gcdRemainingMs = Math.max(0, (gcdReadyAt - now) * 1000);
  const queueOpensAt = gcdReadyAt - settings.queueWindow / 1000;
  const queueOpen = now >= queueOpensAt && now < gcdReadyAt;
  const queuedAction = engine.queuedAction && engine.queuedAction.executeAt >= now ? engine.queuedAction : null;
  const weaveMs = nextGcd ? Math.max(0, (nextGcd.time - now) * 1000) : null;
  const weaveBudgetMs = weaveMs === null ? null : weaveMs - lockMs;
  const recastProgress = Math.max(
    0,
    Math.min(100, ((now - gcdStartedAt) / Math.max(0.001, gcdReadyAt - gcdStartedAt || settings.gcd)) * 100)
  );
  const queueStart = Math.max(
    0,
    Math.min(100, ((queueOpensAt - gcdStartedAt) / Math.max(0.001, gcdReadyAt - gcdStartedAt || settings.gcd)) * 100)
  );
  const releasePhase =
    !currentEvent
      ? "idle"
      : queuedAction
        ? "queued"
        : lockRemainingMs > 0
          ? "animationLock"
          : isGcd && queueOpen
            ? "queue"
            : isGcd && gcdRemainingMs <= 0
              ? "ready"
              : !isGcd && weaveBudgetMs !== null && weaveBudgetMs < 0
                ? "weaveRisk"
                : !isGcd
                  ? "ready"
                  : "locked";
  const phaseLabel: Record<typeof releasePhase, string> = {
    idle: "等待事件",
    locked: "GCD 轉圈中",
    queue: "Action Queue",
    queued: "已佇列",
    animationLock: "Animation Lock",
    ready: isGcd ? "可送出 GCD" : "可插入 oGCD",
    weaveRisk: "Animation lock 風險",
  };
  const feel =
    !currentEvent
      ? "等待輸入窗口"
      : queuedAction
        ? `${queuedAction.skill} queued`
        : lockRemainingMs > 0
          ? "角色仍在 animation lock"
          : isGcd
            ? "GCD Recast / Action Queue"
            : weaveBudgetMs !== null && weaveBudgetMs < 0
              ? "oGCD 會 clip 下一個 GCD"
              : "oGCD Weave Slot";

  return (
    <div className={`feelPanel ${lastFeedback?.verdict ?? ""}`}>
      <div className="feelStatus">
        <strong>{feel}</strong>
        <span>
          {currentEvent
            ? `${currentEvent.skill} / ${currentEvent.key} / ${phaseLabel[releasePhase]}${rawDelta !== null ? ` / ${formatDelta(rawDelta)}` : ""}`
            : "等待時間軸進入可輸入窗口"}
        </span>
      </div>
      <div
        className={`ffxivReleaseGauge ${isGcd ? "gcdRelease" : "weaveRelease"} ${releasePhase}`}
        style={{
          "--recast-progress": `${recastProgress}%`,
          "--queue-start": `${queueStart}%`,
        } as React.CSSProperties}
      >
        <span className="recastTrackLabel">{gcdRemainingMs > 0 ? `GCD ${Math.ceil(gcdRemainingMs)}ms` : "GCD ready"}</span>
        <span className="queueTrackLabel">{queuedAction ? queuedAction.key : queueOpen ? "Queue open" : `${Math.round(lockRemainingMs)}ms lock`}</span>
        <span className="readyTrackLabel">{phaseLabel[releasePhase]}</span>
        <i />
      </div>
      <div className="weaveGauge">
        <span>下一個 GCD / 鎖 {Math.round(lockMs)}ms</span>
        <strong>{weaveMs === null ? "-" : `${Math.round(weaveMs)}ms`}</strong>
        <em className={weaveBudgetMs !== null && weaveBudgetMs < 0 ? "danger" : "safe"}>
          {weaveBudgetMs !== null && weaveBudgetMs < 0 ? `Clip ${Math.round(Math.abs(weaveBudgetMs))}ms` : "Safe weave"}
        </em>
      </div>
    </div>
  );
}

function RotationDisplay({
  events,
  attempts,
  now,
  duration,
  lastFeedback,
  cooldowns,
  cooldownClock,
  gaugeMarkers,
  eventGaugeMarkers,
}: {
  events: TimelineEvent[];
  attempts: Attempt[];
  now: number;
  duration: number;
  lastFeedback: Feedback | null;
  cooldowns: CooldownState;
  cooldownClock: number;
  gaugeMarkers: GaugeMarker[];
  eventGaugeMarkers: Record<string, GaugeMarker[]>;
}) {
  const railRef = React.useRef<HTMLDivElement | null>(null);
  const [railWidth, setRailWidth] = React.useState(900);
  React.useEffect(() => {
    const node = railRef.current;
    if (!node) return undefined;
    const updateWidth = () => setRailWidth(node.getBoundingClientRect().width);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const centerX = Math.round(Math.max(132, Math.min(220, railWidth * 0.18)));
  const pixelsPerSecond = Math.max(52, Math.min(74, railWidth / 18));
  const railFeedback =
    lastFeedback?.verdict === "Queued" || lastFeedback?.verdict === "Perfect" || lastFeedback?.verdict === "Good"
      ? "hit"
      : lastFeedback
        ? "bad"
        : "";
  const cdNow = cooldownClock || performance.now();
  return (
    <section className={`rotationDisplay ${railFeedback}`} aria-label="Rotation display">
      <div className="rotationHeader">
        <span>Rotation Display</span>
        <strong>{now.toFixed(1)}s / {duration.toFixed(1)}s</strong>
      </div>
      <div className="rotationRail" ref={railRef}>
        <div className="rotationPlayhead" style={{ left: `${centerX}px` }} />
        {gaugeMarkers
          .filter((marker) => !marker.eventId)
          .map((marker) => {
            const x = centerX + (marker.at - now) * pixelsPerSecond;
            if (x < -72 || x > railWidth + 72) return null;
            const status = marker.at < now - 0.15 ? "past" : Math.abs(marker.at - now) <= 0.15 ? "current" : "upcoming";
            return (
              <div
                className={`gaugeTimelineMarker ${marker.kind} ${status}`}
                key={`${marker.kind}-${marker.at}-${marker.label}`}
                style={{ left: `${x}px` }}
                title={`${marker.at.toFixed(1)}s ${marker.label}`}
              >
                <i />
                <span>{marker.label}</span>
              </div>
            );
          })}
        {events.map((event) => {
          const attempt = attempts.find((item) => item.eventId === event.id);
          const gaugeBadges = eventGaugeMarkers[event.id] ?? plannedGaugeMarkersForEvent(event);
          const isCurrent = Math.abs(event.time - now) <= 0.35;
          const isPast = event.time < now - 0.35;
          const status = isCurrent ? "current" : isPast ? "past" : "upcoming";
          const x = centerX + (event.time - now) * pixelsPerSecond;
          if (x < -92 || x > railWidth + 92) return null;
          const cooldown = cooldowns[event.skill];
          const cooldownStarted = Boolean(cooldown && cooldown.startsAt <= cdNow);
          const remaining = cooldown && cooldownStarted && !isPast ? Math.max(0, (cooldown.endsAt - cdNow) / 1000) : 0;
          const cooling = Boolean(cooldown && cooldownStarted && remaining > 0);
          const notReady = cooling && (isCurrent || (event.time > now && event.time - now < 2.5));
          const cooldownProgress = cooldown ? Math.max(0, Math.min(1, remaining / cooldown.duration)) : 0;
          return (
            <div
              className={`rotationToken ${event.kind.toLowerCase()} ${event.priority} ${status} ${attempt?.verdict ?? ""} ${cooling ? "cooling" : ""} ${notReady ? "notReady" : ""}`}
              key={event.id}
              style={{ left: `${x}px`, "--cooldown-progress": cooldownProgress } as React.CSSProperties}
              title={`${event.time.toFixed(1)}s ${event.skill} ${event.key}`}
            >
              <small>{event.time.toFixed(1)}</small>
              <div className="tokenIcon">
                <SkillIcon skill={event.skill} />
                {cooling && (
                  <>
                    <i className="cooldownShade" />
                    <em className="cooldownText">{remaining >= 10 ? Math.ceil(remaining) : remaining.toFixed(1)}</em>
                  </>
                )}
              </div>
              <span className="tokenKey">{event.key}</span>
              {gaugeBadges.length > 0 && (
                <span className="tokenGaugeBadges">
                  {gaugeBadges.map((marker) => (
                    <i className={marker.kind} key={`${marker.kind}-${marker.label}`}>
                      {marker.label}
                    </i>
                  ))}
                </span>
              )}
              {attempt && <b className="tokenVerdict">{attempt.verdict}</b>}
            </div>
          );
        })}
      </div>
      <div className="weaveLegend">
        <span><i className="gcdDot" /> GCD</span>
        <span><i className="ogcdDot" /> oGCD / ability</span>
        <span><i className="clipDot" /> clip risk</span>
      </div>
    </section>
  );
}

function KeyboardHeatmap({
  keybinds,
  flashKey,
  cooldowns,
  cooldownClock,
  onInput,
}: {
  keybinds: Keybind[];
  flashKey: { key: string; verdict: Attempt["verdict"] } | null;
  cooldowns: CooldownState;
  cooldownClock: number;
  onInput: (key: string) => void;
}) {
  const now = cooldownClock || performance.now();
  return (
    <section className="panel heatmap">
      <div className="panelHeader">
        <span>鍵盤 / 滑鼠熱區</span>
        <strong>按鍵確認</strong>
      </div>
      <div className="heatKeys">
        {keyDisplayOrder.map((key) => {
          const bind = keybinds.find((item) => item.key.toUpperCase() === key.toUpperCase());
          const flash = flashKey?.key.toUpperCase() === key.toUpperCase() ? flashKey.verdict : "";
          const cooldown = bind ? cooldowns[bind.skill] : null;
          const cooldownStarted = Boolean(cooldown && cooldown.startsAt <= now);
          const remaining = cooldown && cooldownStarted ? Math.max(0, (cooldown.endsAt - now) / 1000) : 0;
          const cooling = Boolean(cooldown && cooldownStarted && remaining > 0);
          const cooldownProgress = cooldown ? Math.max(0, Math.min(1, remaining / cooldown.duration)) : 0;
          return (
            <button
              className={`heatKey ${bind?.zone ?? "empty"} ${flash} ${cooling ? "cooling" : ""}`}
              key={key}
              onClick={() => onInput(key)}
              style={{ "--cooldown-progress": cooldownProgress } as React.CSSProperties}
            >
              <span className="heatIcon" aria-hidden="true">
                {bind ? <SkillIcon skill={bind.skill} /> : "?"}
                {cooling && (
                  <>
                    <i className="cooldownShade" />
                    <em className="cooldownText">{remaining >= 10 ? Math.ceil(remaining) : remaining.toFixed(1)}</em>
                  </>
                )}
              </span>
              <span className="heatText">
                <b>{key}</b>
                <span>{bind?.skill ?? "未綁定"}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
