import React from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
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

type RotationEvent = TimelineEvent;

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
  actualSkill?: string;
  resourceDriven?: boolean;
  substituted?: boolean;
  delta: number | null;
  verdict: "Queued" | "Perfect" | "Good" | "Early" | "Late" | "Clip" | "Miss" | "Wrong" | "Pull" | "Unavailable";
  at: number;
  actionAt?: number;
};

type RunAttemptRecord = {
  eventId: string | null;
  skill: string;
  key: string;
  verdict: Attempt["verdict"];
  delta: number | null;
};

type RunRecord = {
  id: string;
  rotationId: string;
  rotationName: string;
  at: string;
  score: number;
  gcdAccuracy: number;
  ogcdAccuracy: number;
  coreRate: number;
  avgDelta: number;
  p95: number;
  misses: number;
  wrong: number;
  clips: number;
  attempts: RunAttemptRecord[];
};

type HistoryAnalysis = {
  bestScore: number | null;
  recentScore: number | null;
  runCount: number;
  trend: Array<{ id: string; at: string; score: number }>;
  skillRows: Array<{
    skill: string;
    count: number;
    avgAbsDelta: number;
    missRate: number;
    clips: number;
  }>;
  slowKeyInsight: string | null;
  recommendations: string[];
};

type Feedback = Attempt & {
  id: number;
  skill: string;
};

type TrainerInputHandlers = {
  onKeyDown: (event: KeyboardEvent) => void;
  onKeyUp: (event: KeyboardEvent) => void;
  onWheel: (event: WheelEvent) => void;
  onAuxClick: (event: MouseEvent) => void;
  onContextMenu: (event: MouseEvent) => void;
  onMouseDown: (event: MouseEvent) => void;
};

type CooldownEntry = {
  startsAt: number;
  endsAt: number;
  duration: number;
  maxCharges?: number;
  charges?: number;
};

type CooldownState = Record<string, CooldownEntry>;

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
const HISTORY_STORAGE_KEY = "brd-train-history-v1";
const HISTORY_LIMIT = 50;
const SONG_DURATION = 45;

const flexSkillGroups: string[][] = [
  ["魔法爆裂", "伶牙俐齒", "輝煌箭"],
];

function flexGroupKey(skill: string): string | null {
  for (const group of flexSkillGroups) {
    if (group.includes(skill)) return group[0];
  }
  return null;
}

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
  "側風誘導箭": 60,
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

const skillMaxCharges: Record<string, number> = {
  "碎心箭": 3,
};

const legacySkillNames: Record<string, string> = {
  "魔法爆裂": "魔法爆裂",
  "爆發射擊": "魔法爆裂",
  "爆发射击": "魔法爆裂",
  "辉煌箭": "輝煌箭",
  "伶牙俐齿": "伶牙俐齒",
  "狂风蚀箭": "狂風蝕箭",
  "烈毒咬箭": "烈毒咬箭",
  "纷乱箭 / 共鸣箭": "紛亂箭 / 共鳴箭",
  "侧风诱导箭": "側風誘導箭",
  "绝峰箭 / 爆破箭": "絕峰箭 / 爆破箭",
  "碎心箭": "碎心箭",
  "九天连箭": "九天連箭",
  "完美音调": "完美音調",
  "猛者强击": "猛者強擊",
  "光明神的最终乐章": "光明神的最終樂章",
  "战斗之声": "戰鬥之聲",
  "巧力之幻药": "巧力之幻藥",
  "大地神的抒情恋歌": "大地神的抒情戀歌",
  "光阴神的礼赞凯歌": "光陰神的禮讚凱歌",
  "内丹": "內丹",
  "亲疏自行": "親疏自行",
  "伤头": "傷頭",
  "放浪神的小步舞曲": "放浪神的小步舞曲",
  "贤者的叙事谣": "賢者的敘事謠",
  "军神的赞美歌": "軍神的讚美歌",
};

function normalizeSkillName(skill: string) {
  return legacySkillNames[skill.trim()] ?? skill;
}

function displaySkillName(skill: string | null | undefined) {
  if (!skill) return "";
  return normalizeSkillName(skill);
}

function skillRecast(skill: string, role: SkillRole, settings: SettingsState) {
  if (skillRecasts[skill] !== undefined) return skillRecasts[skill];
  if (role === "gcd") return settings.gcd;
  if (role === "potion") return 270;
  if (role === "buff" || role === "song") return 120;
  if (role === "utility") return 60;
  return 30;
}

function refreshCooldownEntry(cooldown: CooldownEntry, now: number): CooldownEntry | null {
  const maxCharges = cooldown.maxCharges ?? 1;
  if (maxCharges <= 1) return cooldown.endsAt > now ? cooldown : null;
  if (cooldown.startsAt > now || cooldown.endsAt > now) return cooldown;

  const durationMs = cooldown.duration * 1000;
  const elapsedCharges = Math.max(1, Math.floor((now - cooldown.endsAt) / durationMs) + 1);
  const nextCharges = Math.min(maxCharges, (cooldown.charges ?? maxCharges) + elapsedCharges);
  if (nextCharges >= maxCharges) return null;
  const nextStartsAt = cooldown.endsAt + (elapsedCharges - 1) * durationMs;
  return {
    ...cooldown,
    startsAt: nextStartsAt,
    endsAt: nextStartsAt + durationMs,
    charges: nextCharges,
  };
}

function verdictClass(verdict: Attempt["verdict"] | null | undefined) {
  if (!verdict) return "";
  return verdict === "Unavailable" ? "Unavailable Wrong" : verdict;
}

function verdictLabel(verdict: Attempt["verdict"] | null | undefined) {
  if (!verdict) return "";
  const labels: Record<Attempt["verdict"], string> = {
    Queued: "已佇列",
    Perfect: "完美",
    Good: "良好",
    Early: "過早",
    Late: "過晚",
    Clip: "卡 GCD",
    Miss: "漏按",
    Wrong: "誤觸",
    Pull: "搶開",
    Unavailable: "冷卻未好",
  };
  return labels[verdict];
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
    id: "opener-standard",
    name: "標準開場",
    duration: 24,
    description:
      "NGA 7.0 通用起手（猛者後置）：先開旅神歌、補上雙持續傷害、團輔內打兩次九天連箭，猛者強擊後置提高容錯。",
    events: [
      ev("o-1", 0.0, "GCD", "狂風蝕箭", "3", "core", "先上第一個持續傷害"),
      ev("o-2", 0.7, "oGCD", "放浪神的小步舞曲", "Ctrl+1", "core", "先開旅神歌取得放浪神的尾聲"),
      ev("o-3", 2.5, "GCD", "烈毒咬箭", "4", "core", "補上第二個持續傷害"),
      ev("o-4", 3.2, "oGCD", "九天連箭", "Alt+/", "core", "九天#1（前半 GCD，雙九天起點）"),
      ev("o-5", 5.0, "GCD", "伶牙俐齒", "2", "medium", "填充；觸發時可換魔法爆裂或輝煌箭"),
      ev("o-6", 5.7, "oGCD", "戰鬥之聲", "V", "core", "團輔前置"),
      ev("o-7", 7.5, "GCD", "魔法爆裂", "1", "high", "填充"),
      ev("o-8", 8.2, "oGCD", "光明神的最終樂章", "C", "core", "三尾聲團輔"),
      ev("o-9", 10.0, "GCD", "伶牙俐齒", "2", "medium", "填充"),
      ev("o-10", 10.7, "oGCD", "碎心箭", "M5", "high", "爆發內優先打出"),
      ev("o-11", 12.5, "GCD", "輝煌箭", "R", "high", "填充（proc）"),
      ev("o-12", 13.2, "oGCD", "完美音調", "M4", "high", "消耗詩心"),
      ev("o-13", 15.0, "GCD", "伶牙俐齒", "2", "medium", "填充"),
      ev("o-14", 15.7, "oGCD", "猛者強擊", "T", "core", "猛者後置（通用軸放最後，容錯高）"),
      ev("o-15", 17.5, "GCD", "伶牙俐齒", "2", "medium", "填充"),
      ev("o-16", 18.5, "oGCD", "九天連箭", "Alt+/", "core", "九天#2（團輔內雙九天，距#1約15s）"),
      ev("o-17", 20.0, "GCD", "伶牙俐齒", "2", "medium", "回填充"),
    ],
  },
  {
    id: "burst-120",
    name: "120 秒爆發",
    duration: 24,
    description:
      "NGA 7.0 通用 120 秒爆發（3-6-9 軍九）：用伶牙俐齒刷新雙持續傷害、切歌、團輔內雙九天，絕峰箭接爆破箭，猛者強擊後置。",
    events: [
      ev("b-1", 0.0, "GCD", "伶牙俐齒", "2", "core", "爆發前刷新雙持續傷害"),
      ev("b-2", 0.7, "oGCD", "放浪神的小步舞曲", "Ctrl+1", "core", "2 分鐘切歌"),
      ev("b-3", 2.5, "GCD", "伶牙俐齒", "2", "medium", "填充"),
      ev("b-4", 3.2, "oGCD", "九天連箭", "Alt+/", "core", "九天#1（前半 GCD）"),
      ev("b-5", 5.0, "GCD", "魔法爆裂", "1", "high", "填充"),
      ev("b-6", 5.7, "oGCD", "戰鬥之聲", "V", "core", "團輔前置"),
      ev("b-7", 7.5, "GCD", "絕峰箭 / 爆破箭", "G", "high", "靈魂吟唱 100，打出絕峰箭"),
      ev("b-8", 8.2, "oGCD", "光明神的最終樂章", "C", "core", "三尾聲團輔 6%"),
      ev("b-9", 10.0, "GCD", "絕峰箭 / 爆破箭", "G", "high", "爆破箭跟進"),
      ev("b-10", 10.7, "oGCD", "碎心箭", "M5", "high", "爆發內優先打出"),
      ev("b-11", 12.5, "GCD", "輝煌箭", "R", "high", "填充（proc）"),
      ev("b-12", 13.2, "oGCD", "完美音調", "M4", "high", "消耗詩心"),
      ev("b-13", 15.0, "GCD", "伶牙俐齒", "2", "medium", "填充"),
      ev("b-14", 15.7, "oGCD", "猛者強擊", "T", "core", "猛者後置"),
      ev("b-15", 17.5, "GCD", "伶牙俐齒", "2", "medium", "填充"),
      ev("b-16", 18.5, "oGCD", "九天連箭", "Alt+/", "core", "九天#2（雙九天，距#1約15s）"),
      ev("b-17", 20.0, "GCD", "伶牙俐齒", "2", "medium", "回填充"),
    ],
  },
  {
    id: "burst-head-graze",
    name: "120 爆發 + 傷頭",
    duration: 24,
    description: "在 NGA 通用 120 秒爆發核心插入傷頭，訓練機制覆蓋輸出 oGCD 的取捨。",
    events: [
      ev("h-1", 0.0, "GCD", "伶牙俐齒", "2", "core", "刷新雙持續傷害"),
      ev("h-2", 0.7, "oGCD", "放浪神的小步舞曲", "Ctrl+1", "core", "切歌"),
      ev("h-3", 2.5, "GCD", "伶牙俐齒", "2", "medium", "填充"),
      ev("h-4", 3.2, "oGCD", "九天連箭", "Alt+/", "core", "九天#1"),
      ev("h-5", 5.0, "Mechanic", "傷頭", "Alt+M", "mechanic", "機制優先：覆蓋可延後輸出 oGCD", 250, 300),
      ev("h-6", 5.7, "oGCD", "戰鬥之聲", "V", "core", "團輔前置"),
      ev("h-7", 7.5, "GCD", "絕峰箭 / 爆破箭", "G", "high", "絕峰箭後進入爆破箭預備"),
      ev("h-8", 8.2, "oGCD", "光明神的最終樂章", "C", "core", "三尾聲團輔"),
      ev("h-9", 10.0, "GCD", "絕峰箭 / 爆破箭", "G", "high", "爆破箭跟進"),
      ev("h-10", 10.7, "oGCD", "碎心箭", "M5", "high", "爆發內優先打出"),
      ev("h-11", 12.5, "GCD", "輝煌箭", "R", "high", "填充"),
      ev("h-12", 13.2, "oGCD", "完美音調", "M4", "high", "消耗詩心"),
      ev("h-13", 15.0, "GCD", "伶牙俐齒", "2", "medium", "填充"),
      ev("h-14", 15.7, "oGCD", "猛者強擊", "T", "core", "猛者後置"),
      ev("h-15", 17.5, "GCD", "伶牙俐齒", "2", "medium", "填充"),
      ev("h-16", 18.5, "oGCD", "九天連箭", "Alt+/", "core", "九天#2"),
      ev("h-17", 20.0, "GCD", "伶牙俐齒", "2", "medium", "回填充"),
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

function normalizeStoredRotation(rotation: Rotation): Rotation {
  const seed = rotationsSeed.find((item) => item.id === rotation.id);
  if (seed) return seed;
  return {
    ...rotation,
    events: rotation.events.map((event) => ({
      ...event,
      skill: normalizeSkillName(event.skill),
      key: normalizeStoredEventKey(normalizeSkillName(event.skill), event.key),
    })),
  };
}

function normalizeStoredKeybind(bind: Keybind): Keybind {
  const skill = normalizeSkillName(bind.skill);
  return {
    ...bind,
    skill,
    key: normalizeStoredEventKey(skill, bind.key),
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw);
    return {
      ...state,
      keybinds: state.keybinds?.map(normalizeStoredKeybind),
      rotations: state.rotations?.map(normalizeStoredRotation),
    };
  } catch {
    return null;
  }
}

function loadHistory(): RunRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const history = JSON.parse(raw);
    if (!Array.isArray(history)) return [];
    return history.slice(0, HISTORY_LIMIT).map((run: RunRecord) => ({
      ...run,
      attempts: run.attempts?.map((attempt) => ({
        ...attempt,
        skill: normalizeSkillName(attempt.skill),
      })) ?? [],
    }));
  } catch {
    return [];
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

const BLOCKED_CTRL_NUMBER_REASON = "瀏覽器會用來切換分頁，頁面無法攔截";
const BLOCKED_BROWSER_SHORTCUT_REASON = "瀏覽器分頁/視窗快捷鍵，頁面無法攔截";
const BLOCKED_SYSTEM_KEY_REASON = "瀏覽器系統鍵，頁面無法攔截";
const PARTIAL_MOUSE_SIDE_REASON = "滑鼠側鍵可能觸發瀏覽器上一頁/下一頁，攔截不保證成功";
const PARTIAL_ALT_REASON = "Alt 組合可能觸發瀏覽器選單或焦點跳轉";
const PARTIAL_WHEEL_REASON = "滾輪事件可能與頁面捲動衝突";
const PARTIAL_BROWSER_FUNCTION_REASON = "可能觸發瀏覽器功能（說明/尋找）";
const PARTIAL_CTRL_REASON = "Ctrl 組合可能與瀏覽器快捷鍵衝突";

const CTRL_NUMBER_KEY_PATTERN = /^[0-9]$/;
const BLOCKED_CTRL_KEYS = new Set(["W", "T", "N", "Q", "TAB"]);
const BLOCKED_CTRL_SHIFT_KEYS = new Set(["TAB", "T", "N", "W"]);
const BLOCKED_FUNCTION_KEYS = new Set(["F5", "F11", "F12"]);
const PARTIAL_MOUSE_KEYS = new Set(["M4", "M5"]);
const PARTIAL_WHEEL_KEYS = new Set([WHEEL_UP_KEY, WHEEL_DOWN_KEY]);
const PARTIAL_FUNCTION_KEYS = new Set(["F1", "F3", "F6"]);

function classifyKeyCapture(key: string): { level: "safe" | "partial" | "blocked"; reason: string; suggestion: string } {
  const parts = key
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
  const normalizedParts = parts.map((part) => part.toUpperCase());
  const baseKey = normalizedParts[normalizedParts.length - 1] ?? "";
  const modifiers = new Set(normalizedParts.slice(0, -1));
  const modifierCount = modifiers.size;
  const hasCtrl = modifiers.has("CTRL") || modifiers.has("CONTROL");
  const hasAlt = modifiers.has("ALT");
  const hasShift = modifiers.has("SHIFT");
  const hasOnlyCtrl = hasCtrl && modifierCount === 1;
  const hasOnlyCtrlShift = hasCtrl && hasShift && modifierCount === 2;
  const upperKey = key.trim().toUpperCase();

  if (hasOnlyCtrl && CTRL_NUMBER_KEY_PATTERN.test(baseKey)) {
    return {
      level: "blocked",
      reason: BLOCKED_CTRL_NUMBER_REASON,
      suggestion: "建議在遊戲內改成單鍵或非 Ctrl+數字，或日後用桌面版捕捉",
    };
  }

  if ((hasOnlyCtrl && BLOCKED_CTRL_KEYS.has(baseKey)) || (hasOnlyCtrlShift && BLOCKED_CTRL_SHIFT_KEYS.has(baseKey))) {
    return {
      level: "blocked",
      reason: BLOCKED_BROWSER_SHORTCUT_REASON,
      suggestion: "請在遊戲內改用其他鍵位",
    };
  }

  if (modifierCount === 0 && BLOCKED_FUNCTION_KEYS.has(baseKey)) {
    return {
      level: "blocked",
      reason: BLOCKED_SYSTEM_KEY_REASON,
      suggestion: "請在遊戲內改用其他鍵位",
    };
  }

  if (PARTIAL_MOUSE_KEYS.has(upperKey)) {
    return {
      level: "partial",
      reason: PARTIAL_MOUSE_SIDE_REASON,
      suggestion: "若會跳頁，請在 Razer Synapse 把側鍵映射成鍵盤鍵",
    };
  }

  if (hasAlt) {
    return {
      level: "partial",
      reason: PARTIAL_ALT_REASON,
      suggestion: "若異常，改用非 Alt 鍵或交給驅動映射",
    };
  }

  if (PARTIAL_WHEEL_KEYS.has(key.trim())) {
    return {
      level: "partial",
      reason: PARTIAL_WHEEL_REASON,
      suggestion: "若捲動異常，改用按鍵代替滾輪",
    };
  }

  if (modifierCount === 0 && PARTIAL_FUNCTION_KEYS.has(baseKey)) {
    return {
      level: "partial",
      reason: PARTIAL_BROWSER_FUNCTION_REASON,
      suggestion: "建議改用其他鍵位",
    };
  }

  if (hasCtrl) {
    return {
      level: "partial",
      reason: PARTIAL_CTRL_REASON,
      suggestion: "建議改用無修飾鍵或確認瀏覽器不攔截",
    };
  }

  return { level: "safe", reason: "", suggestion: "" };
}

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
    proc: "觸發",
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
  if (expected.kind !== "GCD") return abs <= 120 ? "Perfect" : "Good";
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
  const wrong = attempts.filter((a) => a.verdict === "Wrong" || a.verdict === "Unavailable").length;
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

function createRunRecord(rotation: Rotation, attempts: Attempt[], keyBySkill: Record<string, string>): RunRecord {
  const result = scoreAttempts(rotation, attempts);
  const eventById = new Map(rotation.events.map((event) => [event.id, event]));
  const resolvedEventKey = (event: TimelineEvent) => keyBySkill[event.skill] ?? event.key;
  const hitEventIds = new Set(attempts.map((attempt) => attempt.eventId).filter((eventId): eventId is string => Boolean(eventId)));
  const recordedAttempts: RunAttemptRecord[] = [
    ...attempts.map((attempt) => {
      const event = attempt.eventId ? eventById.get(attempt.eventId) : undefined;
      return {
        eventId: attempt.eventId,
        skill: event?.skill ?? attempt.expectedSkill ?? "未匹配輸入",
        key: event ? resolvedEventKey(event) : attempt.expectedKey ?? attempt.actualKey,
        verdict: attempt.verdict,
        delta: attempt.delta,
      };
    }),
    ...rotation.events
      .filter((event) => !hitEventIds.has(event.id))
      .map((event) => ({
        eventId: event.id,
        skill: event.skill,
        key: resolvedEventKey(event),
        verdict: "Miss" as Attempt["verdict"],
        delta: null,
      })),
  ];

  return {
    id: crypto.randomUUID(),
    rotationId: rotation.id,
    rotationName: rotation.name,
    at: new Date().toISOString(),
    score: result.score,
    gcdAccuracy: result.gcdAccuracy,
    ogcdAccuracy: result.ogcdAccuracy,
    coreRate: result.coreRate,
    avgDelta: result.avg,
    p95: result.p95,
    misses: result.misses.length,
    wrong: result.wrong,
    clips: attempts.filter((attempt) => attempt.verdict === "Clip").length,
    attempts: recordedAttempts,
  };
}

function analyzeRunHistory(runs: RunRecord[]): HistoryAnalysis {
  const bestScore = runs.length ? Math.max(...runs.map((run) => run.score)) : null;
  const recentScore = runs[0]?.score ?? null;
  const trend = runs
    .slice(0, 10)
    .reverse()
    .map((run) => ({ id: run.id, at: run.at, score: run.score }));
  const skillStats = new Map<
    string,
    { count: number; validHits: number; deltaTotal: number; deltaCount: number; clips: number }
  >();
  const keyStats = new Map<string, { deltaTotal: number; deltaCount: number }>();

  runs.forEach((run) => {
    run.attempts.forEach((attempt) => {
      if (attempt.skill !== "未匹配輸入" && (attempt.eventId || attempt.verdict === "Miss")) {
        const current = skillStats.get(attempt.skill) ?? {
          count: 0,
          validHits: 0,
          deltaTotal: 0,
          deltaCount: 0,
          clips: 0,
        };
        current.count += 1;
        if (attempt.eventId && (attempt.verdict === "Queued" || attempt.verdict === "Perfect" || attempt.verdict === "Good")) {
          current.validHits += 1;
        }
        if (attempt.delta !== null && attempt.eventId) {
          current.deltaTotal += Math.abs(attempt.delta);
          current.deltaCount += 1;
        }
        if (attempt.verdict === "Clip") current.clips += 1;
        skillStats.set(attempt.skill, current);
      }

      if (attempt.eventId && attempt.delta !== null && attempt.verdict !== "Miss") {
        const current = keyStats.get(attempt.key) ?? { deltaTotal: 0, deltaCount: 0 };
        current.deltaTotal += Math.abs(attempt.delta);
        current.deltaCount += 1;
        keyStats.set(attempt.key, current);
      }
    });
  });

  const skillRows = [...skillStats.entries()]
    .map(([skill, item]) => ({
      skill,
      count: item.count,
      avgAbsDelta: item.deltaCount ? item.deltaTotal / item.deltaCount : 0,
      missRate: item.count ? ((item.count - item.validHits) / item.count) * 100 : 0,
      clips: item.clips,
    }))
    .sort((a, b) => b.avgAbsDelta - a.avgAbsDelta)
    .slice(0, 8);

  const slowKeys = [...keyStats.entries()]
    .map(([key, item]) => ({
      key,
      avgAbsDelta: item.deltaCount ? item.deltaTotal / item.deltaCount : 0,
      count: item.deltaCount,
    }))
    .filter((item) => item.count >= 2 && item.avgAbsDelta >= 180)
    .sort((a, b) => b.avgAbsDelta - a.avgAbsDelta)
    .slice(0, 3);

  const slowKeyInsight = slowKeys.length
    ? `偏慢鍵位集中在 ${slowKeys.map((item) => `${item.key} ${formatDelta(item.avgAbsDelta)}`).join("、")}。`
    : null;
  const mostMissed = [...skillRows].filter((row) => row.count >= 2).sort((a, b) => b.missRate - a.missRate)[0];
  const slowestKey = slowKeys[0];
  const mostClipped = [...skillRows].filter((row) => row.clips > 0).sort((a, b) => b.clips - a.clips)[0];
  const recommendations = [
    mostMissed && mostMissed.missRate > 0
      ? `${mostMissed.skill} 漏按率最高（${Math.round(mostMissed.missRate)}%），先把它前後 2 秒的提示節奏固定下來。`
      : null,
    slowestKey ? `${slowestKey.key} 平均慢 ${Math.round(slowestKey.avgAbsDelta)}ms，建議單獨練同鍵連續輸入與手位回收。` : null,
    mostClipped ? `${mostClipped.skill} Clip 次數最多（${mostClipped.clips}），優先檢查該 oGCD 是否太貼近下一個 GCD。` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 3);

  return {
    bestScore,
    recentScore,
    runCount: runs.length,
    trend,
    skillRows,
    slowKeyInsight,
    recommendations,
  };
}

function App() {
  const stored = loadState();
  const [tab, setTab] = React.useState("train");
  const [keybinds, setKeybinds] = React.useState<Keybind[]>(stored?.keybinds ?? defaultKeybinds);
  const [rotations, setRotations] = React.useState<Rotation[]>(stored?.rotations ?? rotationsSeed);
  const [settings, setSettings] = React.useState<SettingsState>(normalizeSettings(stored?.settings));
  const [history, setHistory] = React.useState<RunRecord[]>(() => loadHistory());
  const [selectedRotationId, setSelectedRotationId] = React.useState(rotations[0]?.id ?? "opener-standard");
  const [isRunning, setIsRunning] = React.useState(false);
  const [startAt, setStartAt] = React.useState<number | null>(null);
  const [countdownStartAt, setCountdownStartAt] = React.useState<number | null>(null);
  const [countdownValue, setCountdownValue] = React.useState<number | null>(null);
  const [now, setNow] = React.useState(0);
  const [attempts, setAttempts] = React.useState<Attempt[]>([]);
  const [missedEventIds, setMissedEventIds] = React.useState<Set<string>>(new Set());
  const [flashKey, setFlashKey] = React.useState<{ key: string; verdict: Attempt["verdict"] } | null>(null);
  const [feedback, setFeedback] = React.useState<Feedback | null>(null);
  const [cooldowns, setCooldowns] = React.useState<CooldownState>({});
  const [cooldownClock, setCooldownClock] = React.useState(0);
  const [combatEngine, setCombatEngine] = React.useState<CombatEngineState>(idleCombatEngine);
  const [calibrating, setCalibrating] = React.useState<string | null>(null);
  const wheelInputAtRef = React.useRef(0);
  const flashClearTimerRef = React.useRef<number | null>(null);
  const handlersRef = React.useRef<TrainerInputHandlers | null>(null);
  const attemptsRef = React.useRef(attempts);
  const missedEventIdsRef: React.MutableRefObject<Set<string>> = React.useRef(new Set());
  const pendingCompletedRef = React.useRef<Set<string>>(new Set());
  const [calibrationMessage, setCalibrationMessage] = React.useState("尚未開始校準");

  attemptsRef.current = attempts;
  const selectedRotation = rotations.find((r) => r.id === selectedRotationId) ?? rotations[0];
  const stats = React.useMemo(() => scoreAttempts(selectedRotation, attempts), [selectedRotation, attempts]);
  const keyBySkill = React.useMemo(() => {
    const m: Record<string, string> = {};
    for (const b of keybinds) m[b.skill] = b.key;
    return m;
  }, [keybinds]);
  const roleBySkill = React.useMemo(() => {
    const m: Record<string, SkillRole> = {};
    for (const b of keybinds) m[b.skill] = b.role;
    return m;
  }, [keybinds]);
  const eventKey = (event: TimelineEvent) => keyBySkill[event.skill] ?? event.key;
  const rotationHistory = React.useMemo(
    () => history.filter((run) => run.rotationId === selectedRotation.id),
    [history, selectedRotation.id]
  );
  const historyAnalysis = React.useMemo(() => analyzeRunHistory(rotationHistory), [rotationHistory]);
  const bestRotationScore = historyAnalysis.bestScore;
  const isNewBestScore = attempts.length > 0 && (bestRotationScore === null || stats.score >= bestRotationScore);
  const currentEvent = React.useMemo(
    () =>
      selectedRotation.events.find((event) => {
        const window = inputWindow(event, settings);
        return now >= event.time - window.early / 1000 && now <= event.time + window.late / 1000;
      }),
    [now, selectedRotation, settings]
  );
  const nextEvents = React.useMemo(
    () => selectedRotation.events.filter((event) => event.time > now).slice(0, 5),
    [now, selectedRotation]
  );
  const visibleRotationEvents = React.useMemo(
    () => selectedRotation.events.filter((event) => event.time >= now - 5 && event.time <= now + 25),
    [now, selectedRotation]
  );
  const bardGaugeTimeline = React.useMemo(
    () => buildBardGaugeTimeline(selectedRotation, attempts, settings.procMode),
    [selectedRotation, attempts, settings.procMode]
  );
  const bardGauge = React.useMemo(() => sampleBardGauge(bardGaugeTimeline, now), [bardGaugeTimeline, now]);

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ keybinds, rotations, settings }));
  }, [keybinds, rotations, settings]);

  React.useEffect(() => {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, HISTORY_LIMIT)));
  }, [history]);

  React.useEffect(() => {
    pendingCompletedRef.current.clear();
  }, [attempts]);

  React.useEffect(() => {
    if (!Object.keys(cooldowns).length) return undefined;
    const timer = window.setInterval(() => {
      const now = performance.now();
      setCooldownClock(now);
      setCooldowns((items) =>
        Object.fromEntries(
          Object.entries(items).flatMap(([skill, cooldown]) => {
            const refreshed = refreshCooldownEntry(cooldown, now);
            return refreshed ? [[skill, refreshed]] : [];
          })
        )
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
      detectMissedEvents(elapsed);
      setNow(Math.min(selectedRotation.duration, elapsed));
      if (elapsed >= selectedRotation.duration) {
        finishTrainingNaturally();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isRunning, selectedRotation, settings, startAt]);

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

  function detectMissedEvents(elapsed: number) {
    const attemptedEventIds = new Set(
      attemptsRef.current
        .map((attempt) => attempt.eventId)
        .filter((eventId): eventId is string => Boolean(eventId))
    );
    const newMissedEvents = selectedRotation.events.filter((event) => {
      const window = inputWindow(event, settings);
      return (
        elapsed > event.time + (window.late + 120) / 1000 &&
        !attemptedEventIds.has(event.id) &&
        !missedEventIdsRef.current.has(event.id)
      );
    });

    if (newMissedEvents.length === 0) return;

    newMissedEvents.forEach((event) => missedEventIdsRef.current.add(event.id));
    setMissedEventIds(new Set(missedEventIdsRef.current));

    const latestMiss = newMissedEvents[newMissedEvents.length - 1];
    const missedFeedback: Feedback = {
      eventId: latestMiss.id,
      expectedSkill: latestMiss.skill,
      expectedKey: latestMiss.key,
      actualKey: "",
      delta: null,
      verdict: "Miss",
      at: elapsed,
      id: performance.now(),
      skill: latestMiss.skill,
    };
    setFeedback(missedFeedback);
    if (settings.sound) playFeedbackSound("Miss");
    window.setTimeout(() => setFeedback(null), 720);
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

  function skillForActualKey(key: string) {
    const skill = keybindForKey(key)?.skill;
    return skill ? displaySkillName(skill) : undefined;
  }

  function triggerCooldownForKey(key: string, delaySeconds = 0) {
    const bind = keybindForKey(key);
    if (!bind) return;
    const duration = skillRecast(bind.skill, bind.role, settings);
    if (duration <= 0) return;
    const startsAt = performance.now() + Math.max(0, delaySeconds) * 1000;
    const maxCharges = skillMaxCharges[bind.skill] ?? 1;
    setCooldowns((items) => {
      if (maxCharges <= 1) {
        return {
          ...items,
          [bind.skill]: {
            duration,
            startsAt,
            endsAt: startsAt + duration * 1000,
          },
        };
      }

      const current = items[bind.skill];
      const refreshed = current ? refreshCooldownEntry(current, startsAt) : null;
      const availableCharges = refreshed?.charges ?? maxCharges;
      if (availableCharges <= 0) return items;
      const nextCharges = availableCharges - 1;
      const isRecovering = Boolean(refreshed && refreshed.charges !== undefined && refreshed.charges < maxCharges);
      return {
        ...items,
        [bind.skill]: {
          duration,
          maxCharges,
          charges: nextCharges,
          startsAt: isRecovering ? refreshed!.startsAt : startsAt,
          endsAt: isRecovering ? refreshed!.endsAt : startsAt + duration * 1000,
        },
      };
    });
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
          : "Good";
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
        ? { executeAt, key: eventKey(event), skill: event.skill }
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
      const capture = classifyKeyCapture(input.key);
      const successMessage = `${calibrating} 已校準為 ${input.key}`;
      setCalibrationMessage(
        capture.level === "safe"
          ? successMessage
          : `${successMessage}，但此鍵為瀏覽器保留鍵，訓練時可能被打斷（${capture.reason}）`
      );
      setCalibrating(null);
      return;
    }
    if (!canReceiveTrainerInput()) return;
    handleInput(input.key);
  };

  handlersRef.current = {
    onKeyDown: (event: KeyboardEvent) => {
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
    },
    onKeyUp: (event: KeyboardEvent) => {
      if (shouldOwnBrowserInput(event) && (isModifierKey(event) || event.altKey || event.ctrlKey || event.metaKey)) {
        blockBrowserInput(event);
      }
    },
    onMouseDown: (event: MouseEvent) => {
      const input = normalizeMouseInput(event);
      if (!input) return;
      if (!canReceiveTrainerInput() && !calibrating && isKnownTrainerKey(input.key)) {
        blockBrowserInput(event);
        triggerCooldownForKey(input.key);
        showInputFeedback(input.key);
        return;
      }
      dispatchInput(input, event);
    },
    onAuxClick: (event: MouseEvent) => {
      if (normalizeMouseInput(event)) blockBrowserInput(event);
    },
    onContextMenu: (event: MouseEvent) => {
      if (shouldOwnBrowserInput(event)) blockBrowserInput(event);
    },
    onWheel: (event: WheelEvent) => {
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
    },
  };

  React.useEffect(() => {
    const onEngineKeyDown = (event: KeyboardEvent) => handlersRef.current?.onKeyDown(event);
    const onEngineKeyUp = (event: KeyboardEvent) => handlersRef.current?.onKeyUp(event);
    const onEngineMouseDown = (event: MouseEvent) => handlersRef.current?.onMouseDown(event);
    const onEngineAuxClick = (event: MouseEvent) => handlersRef.current?.onAuxClick(event);
    const onEngineContextMenu = (event: MouseEvent) => handlersRef.current?.onContextMenu(event);
    const onEngineWheel = (event: WheelEvent) => handlersRef.current?.onWheel(event);
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
  }, []);

  function inputTime() {
    if (countdownStartAt !== null) return (performance.now() - countdownStartAt) / 1000 - 3;
    return (performance.now() - (startAt ?? performance.now())) / 1000;
  }

  function handleInput(actualKey: string) {
    const at = inputTime();
    const actualSkill = skillForActualKey(actualKey);
    const pressedFlexGroup = actualSkill ? flexGroupKey(actualSkill) : null;
    let acceptedRelease: { event: TimelineEvent; release: ResolvedRelease } | null = null;
    const liveCompletedIds = new Set(
      attemptsRef.current
        .map((attempt) => attempt.eventId)
        .filter((eventId): eventId is string => Boolean(eventId))
    );
    pendingCompletedRef.current.forEach((eventId) => liveCompletedIds.add(eventId));
    function nearestIncompleteSkillEvent(skill: string) {
      return selectedRotation.events
        .filter((event) => !liveCompletedIds.has(event.id) && event.skill === skill)
        .map((event) => ({ event, distance: Math.abs(event.time - at) }))
        .filter(({ distance }) => !skillNameMatches(skill, radiantFinaleSkillNames) || distance <= settings.gcd)
        .sort((a, b) => a.distance - b.distance)[0]?.event ?? null;
    }
    function resourceDrivenAttempt(): Attempt | null {
      if (!actualSkill || !isResourceDrivenSkill(actualSkill)) return null;
      const resourceGauge = sampleBardGauge(bardGaugeTimeline, at);
      const matchedEvent = nearestIncompleteSkillEvent(actualSkill);
      const canUseAdHoc = allowsAdHocResourceSpend(actualSkill);
      if (!matchedEvent && !canUseAdHoc) return null;
      const resourceEvent: TimelineEvent =
        matchedEvent ?? ev(`resource-${crypto.randomUUID()}`, at, resourceDrivenKind(actualSkill), actualSkill, actualKey, "high", "資源消耗");
      const releaseEvent: TimelineEvent = {
        ...resourceEvent,
        time: resourceEvent.kind === "GCD" ? Math.max(at, combatEngine.gcdReadyAt || at) : at,
        key: actualKey,
      };
      const release = resolveCombatRelease(at, releaseEvent, (at - releaseEvent.time) * 1000, combatEngine);
      if (
        release.accepted &&
        !isSkillAvailable(resourceEvent, resourceGauge, new Map(Object.entries(cooldowns)), performance.now())
      ) {
        return {
          eventId: null,
          expectedSkill: resourceEvent.skill,
          expectedKey: eventKey(resourceEvent),
          actualKey,
          actualSkill,
          resourceDriven: true,
          delta: release.delta,
          verdict: "Unavailable",
          at,
          actionAt: release.actionAt,
        };
      }
      if (!release.accepted) return null;
      acceptedRelease = { event: releaseEvent, release };
      if (matchedEvent) {
        pendingCompletedRef.current.add(matchedEvent.id);
      }
      return {
        eventId: matchedEvent?.id ?? null,
        expectedSkill: resourceEvent.skill,
        expectedKey: eventKey(resourceEvent),
        actualKey,
        actualSkill,
        resourceDriven: true,
        delta: matchedEvent ? Math.round((at - matchedEvent.time) * 1000) : 0,
        verdict: release.verdict === "Queued" ? "Queued" : release.verdict === "Clip" ? "Clip" : "Good",
        at,
        actionAt: release.actionAt,
      };
    }
    function hasNearbyQueuedEvent() {
      if (!actualSkill) return false;
      if (isResourceDrivenSkill(actualSkill)) return false;
      return selectedRotation.events.some((event) => {
        const sameSkill = event.skill === actualSkill;
        const eventFlexGroup = flexGroupKey(event.skill);
        const sameFlexGroup =
          pressedFlexGroup !== null && eventFlexGroup !== null && eventFlexGroup === pressedFlexGroup;
        return (sameSkill || sameFlexGroup) && event.time >= at - settings.gcd && event.time <= at + settings.gcd;
      });
    }
    const candidates = selectedRotation.events
      .filter((event) => !liveCompletedIds.has(event.id))
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
      ({ event }) => eventKey(event).toUpperCase() === actualKey.toUpperCase()
    );
    const flexCandidates = pressedFlexGroup
      ? candidates.filter(({ event }) => {
          const eventFlexGroup = flexGroupKey(event.skill);
          return eventFlexGroup !== null && eventFlexGroup === pressedFlexGroup;
        })
      : [];
    const selectedCandidate = matchingCandidates[0] ?? flexCandidates[0] ?? candidates[0];
    const expected = selectedCandidate?.event;
    const delta = selectedCandidate?.delta ?? null;
    const expectedFlexGroup = expected ? flexGroupKey(expected.skill) : null;
    const substitutedHit =
      expected !== undefined &&
      eventKey(expected).toUpperCase() !== actualKey.toUpperCase() &&
      expectedFlexGroup !== null &&
      expectedFlexGroup === pressedFlexGroup;
    let attempt: Attempt;
    const resourceAttempt = resourceDrivenAttempt();
    if (resourceAttempt) {
      attempt = resourceAttempt;
    } else if (!expected) {
      const firstUpcoming = selectedRotation.events.find((event) => !liveCompletedIds.has(event.id) && event.time >= 0);
      if (at < -settings.queueWindow / 1000 && firstUpcoming && eventKey(firstUpcoming).toUpperCase() === actualKey.toUpperCase()) {
        attempt = {
          eventId: null,
          expectedSkill: firstUpcoming.skill,
          expectedKey: eventKey(firstUpcoming),
          actualKey,
          actualSkill,
          delta: (at - firstUpcoming.time) * 1000,
          verdict: settings.allowEarlyPull ? "Early" : "Pull",
          at,
        };
      } else {
        if (hasNearbyQueuedEvent()) {
          showInputFeedback(actualKey, "Queued");
          return;
        }
        attempt = {
          eventId: null,
          expectedSkill: null,
          expectedKey: null,
          actualKey,
          actualSkill,
          delta: null,
          verdict: "Wrong",
          at,
        };
      }
    } else if (eventKey(expected).toUpperCase() !== actualKey.toUpperCase() && !substitutedHit) {
      if (hasNearbyQueuedEvent()) {
        showInputFeedback(actualKey, "Queued");
        return;
      }
      attempt = {
        eventId: null,
        expectedSkill: expected.skill,
        expectedKey: eventKey(expected),
        actualKey,
        actualSkill,
        delta,
        verdict: "Wrong",
        at,
      };
    } else {
      const release = resolveCombatRelease(at, expected, delta, combatEngine);
      if (
        release.accepted &&
        !isSkillAvailable(expected, bardGauge, new Map(Object.entries(cooldowns)), performance.now())
      ) {
        attempt = {
          eventId: null,
          expectedSkill: expected.skill,
          expectedKey: eventKey(expected),
          actualKey,
          actualSkill,
          substituted: substitutedHit ? true : undefined,
          delta: release.delta,
          verdict: "Unavailable",
          at,
          actionAt: release.actionAt,
        };
        setAttempts((items) => [...items, attempt]);
        showInputFeedback(actualKey, attempt.verdict);
        setFeedback({
          ...attempt,
          id: performance.now(),
          skill: attempt.expectedSkill ?? actualKey,
        });
        if (settings.sound) playFeedbackSound(attempt.verdict);
        window.setTimeout(() => setFeedback(null), 720);
        return;
      }
      attempt = {
        eventId: release.accepted ? expected.id : null,
        expectedSkill: expected.skill,
        expectedKey: eventKey(expected),
        actualKey,
        actualSkill,
        substituted: substitutedHit ? true : undefined,
        delta: release.delta,
        verdict: release.verdict,
        at,
        actionAt: release.actionAt,
      };
      if (release.accepted) {
        pendingCompletedRef.current.add(expected.id);
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
    attemptsRef.current = [];
    missedEventIdsRef.current.clear();
    setMissedEventIds(new Set());
    pendingCompletedRef.current.clear();
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

  function finishTrainingNaturally() {
    const recordedAttempts = attemptsRef.current;
    if (recordedAttempts.length > 0) {
      const record = createRunRecord(selectedRotation, recordedAttempts, keyBySkill);
      setHistory((items) => [record, ...items].slice(0, HISTORY_LIMIT));
    }
    setIsRunning(false);
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

  function clearHistory() {
    if (!window.confirm("確定要清除全部歷史成績？此動作無法復原。")) return;
    setHistory([]);
  }

  return (
    <main className="appShell">
      <header className="topbar">
        <div>
          <p className="eyebrow">FINAL FANTASY XIV / BRD / PATCH 7.2 PROFILE</p>
          <h1>吟遊詩人爆發軸訓練器</h1>
        </div>
        <div className="sourceNote">
          技能名稱以 FINAL FANTASY XIV 繁體中文版官方職業指南為準；圖標使用 XIVAPI 遊戲素材。
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
              <div className={`feedbackToast ${verdictClass(feedback.verdict)}`} key={feedback.id}>
                <strong>{verdictLabel(feedback.verdict)}</strong>
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
              <em>{currentEvent ? eventKey(currentEvent) : "-"}</em>
            </div>

            <div className="combatState">
              <div>
                <span>歌曲</span>
                <strong>{bardGauge.song}</strong>
              </div>
              <div>
                <span>尾聲</span>
                <strong>{bardGauge.coda} / 3</strong>
              </div>
              <div>
                <span>靈魂吟唱</span>
                <strong>{bardGauge.soulVoice}</strong>
              </div>
              <div>
                <span>團輔窗口</span>
                <strong className="buffTimerList">
                  {[
                    { label: "猛者", value: bardGauge.buffTimers.ragingStrikes },
                    { label: "戰聲", value: bardGauge.buffTimers.battleVoice },
                    { label: "終章", value: bardGauge.buffTimers.radiantFinale },
                  ].map((timer) => (
                    <span className={`buffTimerItem ${timer.value > 0 ? "active" : "inactive"}`} key={timer.label}>
                      <b>{timer.label}</b>
                      <em>{timer.value > 0 ? `${timer.value.toFixed(1)}s` : "-"}</em>
                    </span>
                  ))}
                </strong>
              </div>
            </div>
            <BardGaugePanel gauge={bardGauge} />

            <RotationDisplay
              events={visibleRotationEvents}
              attempts={attempts}
              missedEventIds={missedEventIds}
              now={now}
              duration={selectedRotation.duration}
              lastFeedback={feedback}
              cooldowns={cooldowns}
              cooldownClock={cooldownClock}
              gaugeMarkers={bardGauge.markers}
              eventGaugeMarkers={bardGauge.eventMarkers}
              keyBySkill={keyBySkill}
              roleBySkill={roleBySkill}
            />

            <InputFeelPanel
              currentEvent={currentEvent}
              engine={combatEngine}
              now={now}
              settings={settings}
              nextGcd={selectedRotation.events.find((event) => event.kind === "GCD" && event.time > now)}
              lastFeedback={feedback}
              keyBySkill={keyBySkill}
            />

            <div className="hintStrip">
              {settings.showHints
                ? nextEvents.map((event) => (
                    <span key={event.id}>
                      {event.skill} <b>{eventKey(event)}</b>
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
              <Metric
                label="本次 / 最佳"
                value={`${stats.score} / ${bestRotationScore ?? "-"}`}
                suffix={isNewBestScore ? "新紀錄" : ""}
              />
            </div>
            <div className="recentLog">
              <h3>最近輸入</h3>
              {attempts.slice(-6).reverse().map((attempt, index) => (
                <div key={`${attempt.at}-${index}`} className={`logItem ${verdictClass(attempt.verdict)}`}>
                  <span>{attempt.actualKey}</span>
                  <b>{verdictLabel(attempt.verdict)}</b>
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
                <div className="derivedKeyCell">
                  <input value={eventKey(event)} readOnly />
                  <small>鍵位由技能綁定決定，請到鍵位頁修改</small>
                </div>
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
            {keybinds.map((bind, index) => {
              const capture = classifyKeyCapture(bind.key);
              return (
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
                        items.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, key: event.target.value } : item
                        )
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
                  {capture.level !== "safe" && (
                    <div className={`keyCaptureWarning ${capture.level}`}>
                      <div className="keyCaptureBadge">
                        <AlertTriangle size={14} />
                        <b>{capture.level === "blocked" ? "瀏覽器保留鍵" : "可能攔截不穩"}</b>
                      </div>
                      <span>{capture.reason}；{capture.suggestion}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {tab === "analysis" && (
        <section className="analysisGrid">
          <div className="panel reportHero">
            <p>{selectedRotation.name} 報告</p>
            <h2>{historyAnalysis.bestScore ?? "-"} / 100</h2>
            <span>
              最佳分 / 最近一次 {historyAnalysis.recentScore ?? "-"} / 累積 {historyAnalysis.runCount} 次
            </span>
            <button className="dangerButton" onClick={clearHistory}>
              <Trash2 size={16} /> 清除歷史
            </button>
          </div>
          <MetricCard icon={Gauge} label="最佳分" value={historyAnalysis.bestScore === null ? "-" : `${historyAnalysis.bestScore}`} />
          <MetricCard icon={Activity} label="最近一次" value={historyAnalysis.recentScore === null ? "-" : `${historyAnalysis.recentScore}`} />
          <MetricCard icon={Shield} label="累積次數" value={`${historyAnalysis.runCount}`} />
          <div className="panel analysisPanel">
            <h3>分數趨勢</h3>
            {historyAnalysis.runCount < 3 ? (
              <p>多練幾次（目前 {historyAnalysis.runCount} 次）以解鎖趨勢與建議。</p>
            ) : (
              <div className="trendBars">
                {historyAnalysis.trend.map((run) => (
                  <div className="trendBar" key={run.id}>
                    <span style={{ height: `${Math.max(8, run.score)}%` }} />
                    <b>{run.score}</b>
                    <em>{new Date(run.at).toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" })}</em>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="panel analysisPanel">
            <h3>技能聚合</h3>
            {historyAnalysis.skillRows.length ? (
              <div className="skillAggregateTable">
                <div className="skillAggregateHead">
                  <span>技能</span>
                  <span>次數</span>
                  <span>平均絕對延遲</span>
                  <span>漏按率</span>
                  <span>Clip</span>
                </div>
                {historyAnalysis.skillRows.map((row) => (
                  <div className="skillAggregateRow" key={row.skill}>
                    <b>{row.skill}</b>
                    <span>{row.count}</span>
                    <span>{formatDelta(row.avgAbsDelta)}</span>
                    <span>{Math.round(row.missRate)}%</span>
                    <span>{row.clips}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p>還沒有此爆發軸的歷史資料。</p>
            )}
          </div>
          <div className="panel analysisPanel">
            <h3>鍵位洞察</h3>
            <p>{historyAnalysis.slowKeyInsight ?? "目前沒有明顯偏慢鍵位。"}</p>
          </div>
          <div className="panel analysisPanel">
            <h3>資料驅動建議</h3>
            {historyAnalysis.runCount < 3 ? (
              <p>多練幾次（目前 {historyAnalysis.runCount} 次）以解鎖趨勢與建議。</p>
            ) : historyAnalysis.recommendations.length ? (
              historyAnalysis.recommendations.map((item) => <p key={item}>{item}</p>)
            ) : (
              <p>目前沒有明顯瓶頸，維持同一爆發軸再累積樣本。</p>
            )}
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
            ["procMode", "使用 80% 詩心觸發模擬"],
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
  const normalizedSkill = displaySkillName(skill);
  const url = skillIcons[normalizedSkill];
  if (url && !failed) {
    return <img src={url} alt="" onError={() => setFailed(true)} />;
  }
  return <>{normalizedSkill.slice(0, 2)}</>;
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
  return (
    (Boolean(attempt.eventId) || Boolean(attempt.resourceDriven && attempt.actualSkill)) &&
    attempt.verdict !== "Wrong" &&
    attempt.verdict !== "Miss" &&
    attempt.verdict !== "Pull" &&
    attempt.verdict !== "Unavailable"
  );
}

type GaugeMarker = {
  eventId?: string;
  at: number;
  label: string;
  kind: "song" | "tick" | "spender" | "coda" | "soul";
};

type BardGaugeCodaStates = {
  mage: boolean;
  army: boolean;
  wanderer: boolean;
};

type BardGaugeResourceState = {
  codaStates: BardGaugeCodaStates;
  soulVoice: number;
  pitchStacks: number;
  armyStacks: number;
  blastArrowReady: boolean;
};

type BardGaugeSongStart = {
  at: number;
  song: BardSong;
};

type BardBuffWindow = {
  name: "Raging Strikes" | "Battle Voice" | "Radiant Finale";
  startsAt: number;
  endsAt: number;
};

type BardGaugeTimeline = {
  duration: number;
  initial: BardGaugeResourceState & {
    song: BardSong | null;
    songStart: number | null;
  };
  songStarts: BardGaugeSongStart[];
  checkpoints: Array<{
    at: number;
    state: BardGaugeResourceState;
  }>;
  skillMarkers: GaugeMarker[];
  tickMarkersBySongPrefix: GaugeMarker[][];
  buffWindows: BardBuffWindow[];
};

type BardGaugeSnapshot = {
  song: BardSong | "無歌曲";
  songRemaining: number;
  coda: number;
  codaStates: BardGaugeCodaStates;
  soulVoice: number;
  pitchStacks: number;
  maxRepertoire: number;
  pitchReady: boolean;
  pitchAdvice: string;
  apexReady: boolean;
  blastArrowReady: boolean;
  markers: GaugeMarker[];
  eventMarkers: Record<string, GaugeMarker[]>;
  nextMarker: GaugeMarker | null;
  buffTimers: {
    ragingStrikes: number;
    battleVoice: number;
    radiantFinale: number;
  };
  armyHastePct: number;
};

type BardGauge = BardGaugeSnapshot;

const perfectPitchSkillNames = new Set(["完美音調", "perfectpitch", "perfect pitch"]);
const radiantFinaleSkillNames = new Set(["光明神的最終樂章", "radiantfinale", "radiant finale"]);
const apexBlastSkillNames = new Set(["絕峰箭 / 爆破箭", "絕峰箭", "爆破箭", "apexarrow", "apex arrow", "blastarrow", "blast arrow"]);
const resourceDrivenSkillNames = new Set([
  ...perfectPitchSkillNames,
  ...radiantFinaleSkillNames,
  ...apexBlastSkillNames,
]);
const bardBuffDefinitions: Array<{
  name: BardBuffWindow["name"];
  skill: string;
  duration: number;
}> = [
  { name: "Raging Strikes", skill: "猛者強擊", duration: 20 },
  { name: "Battle Voice", skill: "戰鬥之聲", duration: 15 },
  { name: "Radiant Finale", skill: "光明神的最終樂章", duration: 20 },
];

function normalizedSkillName(skill: string) {
  return skill.trim().toLowerCase();
}

function skillNameMatches(skill: string, names: Set<string>) {
  return names.has(skill) || names.has(normalizedSkillName(skill));
}

function isResourceDrivenSkill(skill: string) {
  return skillNameMatches(skill, resourceDrivenSkillNames);
}

function allowsAdHocResourceSpend(skill: string) {
  return skillNameMatches(skill, perfectPitchSkillNames) || skillNameMatches(skill, apexBlastSkillNames);
}

function resourceDrivenKind(skill: string): TimelineEvent["kind"] {
  return skillNameMatches(skill, apexBlastSkillNames) ? "GCD" : "oGCD";
}

function isSkillAvailable(
  event: RotationEvent,
  gaugeSnapshot: BardGauge,
  cooldowns: Map<string, CooldownEntry>,
  now: number
): boolean {
  const maxCharges = skillMaxCharges[event.skill] ?? 1;
  const hasTrackedCooldown = skillRecasts[event.skill] !== undefined || skillMaxCharges[event.skill] !== undefined;
  if (hasTrackedCooldown) {
    const cooldown = cooldowns.get(event.skill);
    const refreshed = cooldown ? refreshCooldownEntry(cooldown, now) : null;
    if (refreshed) {
      if (maxCharges > 1) {
        const availableCharges = refreshed.charges ?? maxCharges;
        if (availableCharges <= 0) return false;
      } else {
        return false;
      }
    }
  }

  if (skillNameMatches(event.skill, perfectPitchSkillNames)) {
    return gaugeSnapshot.pitchStacks >= 1;
  }
  if (skillNameMatches(event.skill, radiantFinaleSkillNames)) {
    return gaugeSnapshot.coda >= 1;
  }
  if (skillNameMatches(event.skill, apexBlastSkillNames)) {
    return gaugeSnapshot.soulVoice >= 20 || gaugeSnapshot.blastArrowReady;
  }
  return true;
}

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
  if (song === "放浪神的小步舞曲") return "+詩心";
  if (song === "軍神的讚美歌") return "+軍神";
  return "靈魂 +5";
}

function plannedGaugeMarkersForEvent(event: TimelineEvent): GaugeMarker[] {
  if (isSongSkill(event.skill)) return [{ eventId: event.id, at: event.time, label: "+尾聲", kind: "song" }];
  if (event.skill === "九天連箭") return [{ eventId: event.id, at: event.time, label: "+詩心", kind: "tick" }];
  if (event.skill === "完美音調") return [{ eventId: event.id, at: event.time, label: "詩心 0", kind: "spender" }];
  if (event.skill === "絕峰箭 / 爆破箭") return [{ eventId: event.id, at: event.time, label: "靈魂 0", kind: "soul" }];
  if (event.skill === "光明神的最終樂章") return [{ eventId: event.id, at: event.time, label: "尾聲 0", kind: "coda" }];
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
      blastArrowReady: false,
    };
  }
  return {
    song: "放浪神的小步舞曲" as BardSong,
    songStart: -34,
    codaStates: { mage: true, army: true, wanderer: true },
    soulVoice: 100,
    pitchStacks: 3,
    armyStacks: 0,
    blastArrowReady: false,
  };
}

function buildBardGaugeTimeline(rotation: Rotation, attempts: Attempt[], procMode: boolean): BardGaugeTimeline {
  const eventById = new Map(rotation.events.map((event) => [event.id, event]));
  const successfulSkills = attempts
    .filter(isSuccessfulAttempt)
    .map((attempt, index) => {
      const event = eventById.get(attempt.eventId ?? "");
      if (event) {
        return { id: event.id, at: attempt.actionAt ?? Math.max(attempt.at, event.time), skill: event.skill };
      }
      if (attempt.resourceDriven && attempt.actualSkill) {
        return {
          id: `resource-${index}-${attempt.at.toFixed(3)}`,
          at: attempt.actionAt ?? attempt.at,
          skill: attempt.actualSkill,
        };
      }
      return null;
    })
    .filter((item): item is { id: string; at: number; skill: string } => Boolean(item))
    .sort((a, b) => a.at - b.at);

  const initial = getInitialBardGauge(rotation.id);
  const songStarts = [
    ...(initial.song && initial.songStart !== null ? [{ at: initial.songStart, song: initial.song }] : []),
    ...successfulSkills
      .filter((item) => isSongSkill(item.skill))
      .map((item) => ({ at: item.at, song: item.skill as BardSong })),
  ].sort((a, b) => a.at - b.at);
  const buffWindows = successfulSkills.flatMap((item) => {
    const definition = bardBuffDefinitions.find((buff) => buff.skill === item.skill);
    return definition
      ? [{ name: definition.name, startsAt: item.at, endsAt: item.at + definition.duration }]
      : [];
  });

  const songAt = (time: number) => {
    const active = songStarts.filter((item) => item.at <= time && time < item.at + SONG_DURATION);
    return active.length ? active[active.length - 1] : null;
  };

  const resourceEvents: Array<
    { at: number; type: "skill"; id: string; skill: string } |
    { at: number; type: "tick"; song: BardSong; tickIndex: number }
  > = successfulSkills.map((item) => ({ at: item.at, type: "skill", id: item.id, skill: item.skill }));
  const tickMarkersBySongPrefix: GaugeMarker[][] = songStarts.map(() => []);

  songStarts.forEach((segment, segmentIndex) => {
    const nextStart = songStarts[segmentIndex + 1]?.at ?? Infinity;
    const end = Math.min(segment.at + SONG_DURATION, nextStart, rotation.duration);
    for (let tick = 1; segment.at + tick * 3 <= end; tick += 1) {
      const tickAt = segment.at + tick * 3;
      if (tickAt >= 0 && deterministicRepertoireProc(tick, procMode)) {
        resourceEvents.push({ at: tickAt, type: "tick", song: segment.song, tickIndex: tick });
      }
    }
  });

  let codaStates = { ...initial.codaStates };
  let soulVoice = initial.soulVoice;
  let pitchStacks = initial.pitchStacks;
  let armyStacks = initial.armyStacks;
  let blastArrowReady = initial.blastArrowReady;
  const checkpoints: BardGaugeTimeline["checkpoints"] = [];
  const skillMarkers: GaugeMarker[] = [];

  const grantRepertoire = (song: BardSong | null) => {
    if (!song) return;
    soulVoice = Math.min(100, soulVoice + 5);
    if (song === "放浪神的小步舞曲") pitchStacks = Math.min(3, pitchStacks + 1);
    if (song === "軍神的讚美歌") armyStacks = Math.min(4, armyStacks + 1);
  };
  const pushCheckpoint = (at: number) => {
    checkpoints.push({
      at,
      state: {
        codaStates: { ...codaStates },
        soulVoice,
        pitchStacks,
        armyStacks,
        blastArrowReady,
      },
    });
  };

  resourceEvents
    .sort((a, b) => a.at - b.at || (a.type === "skill" ? -1 : 1))
    .forEach((event) => {
      if (event.type === "tick") {
        grantRepertoire(event.song);
        pushCheckpoint(event.at);
        return;
      }
      if (isSongSkill(event.skill)) {
        codaStates = { ...codaStates, [songCodaKey(event.skill)]: true };
        pitchStacks = 0;
        armyStacks = 0;
        skillMarkers.push({ eventId: event.id, at: event.at, label: "+尾聲", kind: "song" });
      } else if (event.skill === "九天連箭") {
        grantRepertoire(songAt(event.at)?.song ?? null);
        skillMarkers.push({ eventId: event.id, at: event.at, label: "+詩心", kind: "tick" });
      } else if (event.skill === "完美音調") {
        pitchStacks = 0;
        skillMarkers.push({ eventId: event.id, at: event.at, label: "詩心 0", kind: "spender" });
      } else if (event.skill === "絕峰箭 / 爆破箭") {
        if (soulVoice >= 20) {
          blastArrowReady = soulVoice >= 80;
          soulVoice = 0;
          skillMarkers.push({ eventId: event.id, at: event.at, label: blastArrowReady ? "爆破箭預備" : "靈魂 0", kind: "soul" });
        } else if (blastArrowReady) {
          blastArrowReady = false;
          skillMarkers.push({ eventId: event.id, at: event.at, label: "爆破 0", kind: "soul" });
        }
      } else if (event.skill === "光明神的最終樂章") {
        codaStates = { mage: false, army: false, wanderer: false };
        skillMarkers.push({ eventId: event.id, at: event.at, label: "尾聲 0", kind: "coda" });
      }
      pushCheckpoint(event.at);
    });

  songStarts.forEach((_, prefixIndex) => {
    const visibleSongStarts = songStarts.slice(0, prefixIndex + 1);
    const markers: GaugeMarker[] = [];
    visibleSongStarts.forEach((segment, segmentIndex) => {
      const nextStart = visibleSongStarts[segmentIndex + 1]?.at ?? Infinity;
      const end = Math.min(segment.at + SONG_DURATION, nextStart, rotation.duration);
      for (let tick = 1; segment.at + tick * 3 <= end; tick += 1) {
        const tickAt = segment.at + tick * 3;
        if (tickAt >= 0 && deterministicRepertoireProc(tick, procMode)) {
          markers.push({ at: tickAt, label: eventGaugeTickLabel(segment.song), kind: "tick" });
        }
      }
    });
    tickMarkersBySongPrefix[prefixIndex] = markers;
  });

  return {
    duration: rotation.duration,
    initial,
    songStarts,
    checkpoints,
    skillMarkers,
    tickMarkersBySongPrefix,
    buffWindows,
  };
}

function sampleBardGauge(timeline: BardGaugeTimeline, now: number): BardGaugeSnapshot {
  const activeSongStarts = timeline.songStarts.filter((item) => item.at <= now);
  const activeSongs = activeSongStarts.filter((item) => now < item.at + SONG_DURATION);
  const activeSong = activeSongs.length ? activeSongs[activeSongs.length - 1] : null;
  const activeCheckpoints = timeline.checkpoints.filter((item) => item.at <= now);
  const checkpoint = activeCheckpoints.length ? activeCheckpoints[activeCheckpoints.length - 1] : undefined;
  const state = checkpoint?.state ?? timeline.initial;
  const visibleTickMarkers = activeSongStarts.length
    ? timeline.tickMarkersBySongPrefix[activeSongStarts.length - 1] ?? []
    : [];
  const markers = [
    ...visibleTickMarkers,
    ...timeline.skillMarkers.filter((marker) => marker.at <= now),
  ].sort((a, b) => a.at - b.at);

  const song = activeSong?.song ?? "無歌曲";
  const songRemaining = activeSong ? Math.max(0, activeSong.at + SONG_DURATION - now) : 0;
  const inWanderer = song === "放浪神的小步舞曲";
  const inArmy = song === "軍神的讚美歌";
  const maxRepertoire = inArmy ? 4 : inWanderer ? 3 : 0;
  const displayStacks = inWanderer ? state.pitchStacks : inArmy ? state.armyStacks : 0;
  const buffRemaining = (name: BardBuffWindow["name"]) =>
    timeline.buffWindows
      .filter((buff) => buff.name === name && buff.startsAt <= now && now < buff.endsAt)
      .reduce((remaining, buff) => Math.max(remaining, buff.endsAt - now), 0);
  const pitchReady = inWanderer && (state.pitchStacks === 3 || (state.pitchStacks > 0 && songRemaining < 3.2));
  const pitchAdvice =
    song === "無歌曲"
      ? "尚未開歌：尾聲 / 詩心 / 靈魂吟唱不會自己產生"
      : inWanderer
        ? state.pitchStacks === 3
          ? "3 層，現在打完美音調"
          : songRemaining < 3.2 && state.pitchStacks > 0
            ? "歌快結束，先打掉詩心"
            : "等詩心觸發或九天連箭"
        : inArmy
          ? `${state.armyStacks} / 4 層軍神加速`
          : "賢者歌：詩心不顯示層數，但會給靈魂吟唱 / 碎心箭資源";
  return {
    song,
    songRemaining,
    coda: Object.values(state.codaStates).filter(Boolean).length,
    codaStates: state.codaStates,
    soulVoice: state.soulVoice,
    pitchStacks: displayStacks,
    maxRepertoire,
    pitchReady,
    pitchAdvice,
    apexReady: state.soulVoice >= 20,
    blastArrowReady: state.blastArrowReady,
    markers,
    eventMarkers: markers.reduce<Record<string, GaugeMarker[]>>((items, marker) => {
      if (!marker.eventId) return items;
      return { ...items, [marker.eventId]: [...(items[marker.eventId] ?? []), marker] };
    }, {}),
    nextMarker: markers.find((marker) => marker.at >= now) ?? null,
    buffTimers: {
      ragingStrikes: buffRemaining("Raging Strikes"),
      battleVoice: buffRemaining("Battle Voice"),
      radiantFinale: buffRemaining("Radiant Finale"),
    },
    armyHastePct: inArmy ? Math.min(16, state.armyStacks * 4) : 0,
  };
}

function BardGaugePanel({ gauge }: { gauge: BardGaugeSnapshot }) {
  const songClass =
    gauge.song === "放浪神的小步舞曲"
      ? "wanderer"
      : gauge.song === "軍神的讚美歌"
        ? "army"
        : gauge.song === "賢者的敘事謠"
          ? "mage"
          : "idle";
  return (
    <section className={`ffxivBardGauge ${songClass} ${gauge.pitchReady ? "pitchReady" : ""} ${gauge.blastArrowReady ? "blastReady" : ""}`}>
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
          <div className="repertoireOverlay" aria-label={`詩心 ${gauge.pitchStacks}`}>
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

        <div className="cssCodaLayer" aria-label={`尾聲 ${gauge.coda} / 3`}>
          <i className={`mage ${gauge.codaStates.mage ? "filled" : ""}`} />
          <i className={`army ${gauge.codaStates.army ? "filled" : ""}`} />
          <i className={`wanderer ${gauge.codaStates.wanderer ? "filled" : ""}`} />
        </div>
      </div>
      <div className="gaugeCallout">
        <strong>{gauge.pitchAdvice}</strong>
        {gauge.armyHastePct > 0 && <em>軍神急速 {gauge.armyHastePct}%</em>}
        {gauge.blastArrowReady && <em>爆破箭預備</em>}
        <span>
          {gauge.nextMarker
            ? `下一個 ${gauge.nextMarker.label} @ ${gauge.nextMarker.at.toFixed(1)}s`
            : gauge.apexReady
              ? "靈魂吟唱 20+：可用絕峰箭"
              : "靈魂吟唱累積中"}
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
  const bad = verdict === "Wrong" || verdict === "Unavailable" || verdict === "Clip" || verdict === "Miss" || verdict === "Pull";
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
  keyBySkill,
}: {
  currentEvent: TimelineEvent | undefined;
  engine: CombatEngineState;
  now: number;
  settings: SettingsState;
  nextGcd: TimelineEvent | undefined;
  lastFeedback: Feedback | null;
  keyBySkill: Record<string, string>;
}) {
  const eventKey = (event: TimelineEvent) => keyBySkill[event.skill] ?? event.key;
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
    queue: "動作佇列",
    queued: "已佇列",
    animationLock: "動畫鎖",
    ready: isGcd ? "可送出 GCD" : "可插入 oGCD",
    weaveRisk: "動畫鎖風險",
  };
  const feel =
    !currentEvent
      ? "等待輸入窗口"
      : queuedAction
        ? `${queuedAction.skill} 已佇列`
        : lockRemainingMs > 0
          ? "角色仍在動畫鎖"
        : isGcd
            ? "GCD 復唱 / 動作佇列"
            : weaveBudgetMs !== null && weaveBudgetMs < 0
              ? "oGCD 會卡到下一個 GCD"
              : "oGCD 插入窗口";

  return (
    <div className={`feelPanel ${verdictClass(lastFeedback?.verdict)}`}>
      <div className="feelStatus">
        <strong>{feel}</strong>
        <span>
          {currentEvent
            ? `${currentEvent.skill} / ${eventKey(currentEvent)} / ${phaseLabel[releasePhase]}${rawDelta !== null ? ` / ${formatDelta(rawDelta)}` : ""}`
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
        <span className="recastTrackLabel">{gcdRemainingMs > 0 ? `GCD ${Math.ceil(gcdRemainingMs)}ms` : "GCD 可用"}</span>
        <span className="queueTrackLabel">{queuedAction ? queuedAction.key : queueOpen ? "佇列開啟" : `${Math.round(lockRemainingMs)}ms 鎖`}</span>
        <span className="readyTrackLabel">{phaseLabel[releasePhase]}</span>
        <i />
      </div>
      <div className="weaveGauge">
        <span>下一個 GCD / 鎖 {Math.round(lockMs)}ms</span>
        <strong>{weaveMs === null ? "-" : `${Math.round(weaveMs)}ms`}</strong>
        <em className={weaveBudgetMs !== null && weaveBudgetMs < 0 ? "danger" : "safe"}>
          {weaveBudgetMs !== null && weaveBudgetMs < 0 ? `卡 ${Math.round(Math.abs(weaveBudgetMs))}ms` : "可安全插入"}
        </em>
      </div>
    </div>
  );
}

function RotationDisplay({
  events,
  attempts,
  missedEventIds,
  now,
  duration,
  lastFeedback,
  cooldowns,
  cooldownClock,
  gaugeMarkers,
  eventGaugeMarkers,
  keyBySkill,
  roleBySkill,
}: {
  events: TimelineEvent[];
  attempts: Attempt[];
  missedEventIds: Set<string>;
  now: number;
  duration: number;
  lastFeedback: Feedback | null;
  cooldowns: CooldownState;
  cooldownClock: number;
  gaugeMarkers: GaugeMarker[];
  eventGaugeMarkers: Record<string, GaugeMarker[]>;
  keyBySkill: Record<string, string>;
  roleBySkill: Record<string, SkillRole>;
}) {
  const railRef = React.useRef<HTMLDivElement | null>(null);
  const [railWidth, setRailWidth] = React.useState<number | null>(null);
  React.useEffect(() => {
    const node = railRef.current;
    if (!node) return undefined;
    const updateWidth = () => {
      const nextWidth = Math.round(node.getBoundingClientRect().width);
      setRailWidth((current) => (current === nextWidth ? current : nextWidth));
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const railReady = railWidth !== null && railWidth > 0;
  const measuredRailWidth = railWidth ?? 0;
  const centerX = railReady ? Math.round(Math.max(132, Math.min(220, measuredRailWidth * 0.18))) : 0;
  const pixelsPerSecond = railReady ? Math.max(52, Math.min(74, measuredRailWidth / 18)) : 52;
  const railFeedback =
    lastFeedback?.verdict === "Queued" || lastFeedback?.verdict === "Perfect" || lastFeedback?.verdict === "Good"
      ? "hit"
      : lastFeedback
        ? "bad"
        : "";
  const cdNow = cooldownClock || performance.now();
  const visiblePadding = 50;
  const isVisibleX = (x: number) => railReady && x >= -visiblePadding && x <= measuredRailWidth + visiblePadding;
  const successfulAttemptForEvent = (eventId: string) => {
    const attempt = attempts.find((item) => item.eventId === eventId);
    return attempt && attempt.verdict !== "Miss" && attempt.verdict !== "Wrong" ? attempt : null;
  };
  const attemptStatusClass = (verdict: Attempt["verdict"]) => {
    if (verdict === "Queued" || verdict === "Perfect" || verdict === "Good") return "success";
    if (verdict === "Early" || verdict === "Late") return "warning";
    return "danger";
  };
  const eventById = React.useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
  const actualTokenKind = (attempt: Attempt) => {
    const actualSkill = displaySkillName(attempt.actualSkill);
    const role = actualSkill ? roleBySkill[actualSkill] : undefined;
    if (role === "gcd") return "gcd";
    if (role) return "ogcd";
    const matchedEvent = attempt.eventId ? eventById.get(attempt.eventId) : undefined;
    return matchedEvent?.kind === "GCD" ? "gcd" : "ogcd";
  };
  return (
    <section className={`rotationDisplay ${railFeedback}`} aria-label="Rotation display">
      <div className="rotationHeader">
        <span>Rotation Display</span>
        <strong>{now.toFixed(1)}s / {duration.toFixed(1)}s</strong>
      </div>
      <div className="rotationRail" ref={railRef}>
        {railReady && <div className="rotationPlayhead" style={{ left: `${centerX}px` }} />}
        {railReady && gaugeMarkers
          .filter((marker) => !marker.eventId)
          .map((marker) => {
            const x = centerX + (marker.at - now) * pixelsPerSecond;
            if (x < -72 || x > measuredRailWidth + 72) return null;
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
        <div className="rotationLaneLabel recommendation">推薦 GCD</div>
        <div className="rotationLaneLabel recommendationWeave">推薦 oGCD</div>
        <div className="rotationLaneLabel actual">真實</div>
        {railReady && events.map((event) => {
          const attempt = successfulAttemptForEvent(event.id);
          const missedVerdict: Attempt["verdict"] | null = !attempt && missedEventIds.has(event.id) ? "Miss" : null;
          const gaugeBadges = eventGaugeMarkers[event.id] ?? plannedGaugeMarkersForEvent(event);
          const isCurrent = Math.abs(event.time - now) <= 0.35;
          const isPast = event.time < now - 0.35;
          const status = isCurrent ? "current" : isPast ? "past" : "upcoming";
          const x = centerX + (event.time - now) * pixelsPerSecond;
          if (!isVisibleX(x)) return null;
          const cooldown = cooldowns[event.skill];
          const cooldownStarted = Boolean(cooldown && cooldown.startsAt <= cdNow);
          const remaining = cooldown && cooldownStarted && !isPast ? Math.max(0, (cooldown.endsAt - cdNow) / 1000) : 0;
          const cooling = Boolean(cooldown && cooldownStarted && remaining > 0);
          const eventMaxCharges = skillMaxCharges[event.skill] ?? cooldown?.maxCharges ?? 1;
          const chargeCount = eventMaxCharges > 1 ? cooldown?.charges ?? eventMaxCharges : null;
          const outOfCharges = chargeCount !== null && chargeCount <= 0;
          const notReady = cooling && (outOfCharges || chargeCount === null) && (isCurrent || (event.time > now && event.time - now < 2.5));
          const cooldownProgress = cooldown ? Math.max(0, Math.min(1, remaining / cooldown.duration)) : 0;
          const isFlex = flexGroupKey(event.skill) !== null;
          const tokenKey = keyBySkill[event.skill] ?? event.key;
          return (
            <div
              className={`rotationToken recommendationToken ${event.kind.toLowerCase()} ${event.priority} ${status} ${attempt ? "matched" : ""} ${verdictClass(missedVerdict)} ${cooling ? "cooling" : ""} ${notReady ? "notReady" : ""}`}
              key={event.id}
              style={{ left: `${x}px`, "--cooldown-progress": cooldownProgress } as React.CSSProperties}
              title={`${event.time.toFixed(1)}s ${event.skill} ${tokenKey}`}
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
                {chargeCount !== null && <em className="cooldownCharges">{chargeCount}</em>}
              </div>
              <span className="tokenKey">{tokenKey}</span>
              {gaugeBadges.length > 0 && (
                <span className="tokenGaugeBadges">
                  {gaugeBadges.map((marker) => (
                    <i className={marker.kind} key={`${marker.kind}-${marker.label}`}>
                      {marker.label}
                    </i>
                  ))}
                </span>
              )}
              {isFlex && <em className="tokenSubstitute">替</em>}
              {attempt && <b className="tokenVerdict">✓</b>}
              {missedVerdict && <b className="tokenVerdict">{verdictLabel(missedVerdict)}</b>}
            </div>
          );
        })}
        {railReady && attempts.map((attempt, index) => {
          const at = attempt.actionAt ?? attempt.at;
          const x = centerX + (at - now) * pixelsPerSecond;
          if (!isVisibleX(x)) return null;
          const age = Math.max(0, now - at);
          const opacity = age > 0 ? Math.max(0.28, 1 - age / 5) : 1;
          const actualSkill = displaySkillName(attempt.actualSkill);
          const kindClass = actualTokenKind(attempt);
          const isLoosePress = attempt.eventId === null && !attempt.substituted && !attempt.resourceDriven;
          return (
            <div
              className={`actualToken ${kindClass} ${attemptStatusClass(attempt.verdict)} ${verdictClass(attempt.verdict)} ${attempt.substituted ? "substituted" : ""} ${isLoosePress ? "loosePress" : ""}`}
              key={`${attempt.at}-${attempt.actualKey}-${index}`}
              style={{ left: `${x}px`, opacity } as React.CSSProperties}
              title={`${at.toFixed(1)}s ${actualSkill || attempt.actualKey} ${verdictLabel(attempt.verdict)}`}
            >
              {isLoosePress && <b className="actualFloat">誤觸</b>}
              <div className="tokenIcon">{actualSkill ? <SkillIcon skill={actualSkill} /> : attempt.actualKey}</div>
              <span className="tokenKey">{attempt.actualKey}</span>
              {attempt.substituted && <em className="tokenSubstitute">替</em>}
              {attempt.resourceDriven && <em className="tokenSubstitute">資</em>}
            </div>
          );
        })}
      </div>
      <div className="weaveLegend">
        <span><i className="recommendDot" /> 上：推薦</span>
        <span><i className="actualDot" /> 下：真實</span>
        <span><i className="okDot" /> 綠：命中</span>
        <span><i className="warnDot" /> 琥珀：早晚</span>
        <span><i className="badDot" /> 紅：錯誤 / 漏按</span>
        <span><b>替</b> 替代</span>
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
        {keybinds.map((bind) => {
          const flash = flashKey?.key.toUpperCase() === bind.key.toUpperCase() ? verdictClass(flashKey.verdict) : "";
          const cooldown = cooldowns[bind.skill];
          const cooldownStarted = Boolean(cooldown && cooldown.startsAt <= now);
          const remaining = cooldown && cooldownStarted ? Math.max(0, (cooldown.endsAt - now) / 1000) : 0;
          const cooling = Boolean(cooldown && cooldownStarted && remaining > 0);
          const bindMaxCharges = skillMaxCharges[bind.skill] ?? cooldown?.maxCharges ?? 1;
          const chargeCount = bindMaxCharges > 1 ? cooldown?.charges ?? bindMaxCharges : null;
          const cooldownProgress = cooldown ? Math.max(0, Math.min(1, remaining / cooldown.duration)) : 0;
          return (
            <button
              className={`heatKey ${bind.zone} ${flash} ${cooling ? "cooling" : ""}`}
              key={`${bind.skill}-${bind.key}`}
              onClick={() => onInput(bind.key)}
              style={{ "--cooldown-progress": cooldownProgress } as React.CSSProperties}
            >
              <span className="heatIcon" aria-hidden="true">
                <SkillIcon skill={bind.skill} />
                {cooling && (
                  <>
                    <i className="cooldownShade" />
                    <em className="cooldownText">{remaining >= 10 ? Math.ceil(remaining) : remaining.toFixed(1)}</em>
                  </>
                )}
                {chargeCount !== null && <em className="cooldownCharges">{chargeCount}</em>}
              </span>
              <span className="heatText">
                <b>{bind.skill}</b>
                <span>{bind.key}</span>
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
