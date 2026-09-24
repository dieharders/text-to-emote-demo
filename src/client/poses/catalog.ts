/**
 * The poses Clawd can take: ONE entry per pose, the single source of truth.
 *
 * To add a pose: add an entry here and a recipe in ../avatar/recipes.ts (TypeScript will point
 * at the missing recipe). Keep it to about ten: every option lengthens the engine's prompt, and
 * more options means more near-ties.
 */
import type { ChoiceQuestion } from "../../shared/api";
import type { VoicePreset } from "../voice/planSpeech";

export type PoseId =
  | "neutral"
  | "happy"
  | "excited"
  | "love"
  | "sad"
  | "angry"
  | "surprised"
  | "scared"
  | "confused"
  | "thinking";

export interface PoseDef {
  id: PoseId;
  label: string;
  emoji: string;
  /**
   * What the decision engine reads for this option. Von scores the DESCRIPTION, never the
   * label, so it starts with the emotion's name. Short, because every word lengthens the prompt.
   */
  description: string;
  /** How the babble voice shifts while this pose is showing. */
  voice: VoicePreset;
  /** Stage backdrop color. */
  tint: string;
}

export const POSES: PoseDef[] = [
  {
    id: "neutral",
    label: "Neutral",
    emoji: "😐",
    description: "neutral: calm, matter-of-fact, no strong emotion",
    voice: { pitch: 0, rate: 1, range: 3, wave: "square" },
    tint: "#2b2a27",
  },
  {
    id: "happy",
    label: "Happy",
    emoji: "😊",
    description: "happy: glad, pleased, cheerful, content",
    voice: { pitch: 2, rate: 1.05, range: 4, wave: "square" },
    tint: "#3b3421",
  },
  {
    id: "excited",
    label: "Excited",
    emoji: "🤩",
    description: "excited: thrilled, enthusiastic, celebrating",
    voice: { pitch: 4, rate: 1.25, range: 6, wave: "square" },
    tint: "#403014",
  },
  {
    id: "love",
    label: "Love",
    emoji: "😍",
    description: "love: affection, adoration, warmth, gratitude",
    voice: { pitch: 2, rate: 0.9, range: 3, wave: "triangle" },
    tint: "#3b2331",
  },
  {
    id: "sad",
    label: "Sad",
    emoji: "😢",
    description: "sad: unhappy, disappointed, lonely, sorry",
    voice: { pitch: -4, rate: 0.8, range: 2, wave: "triangle" },
    tint: "#1d2636",
  },
  {
    id: "angry",
    label: "Angry",
    emoji: "😠",
    description: "angry: mad, annoyed, frustrated, irritated",
    voice: { pitch: -2, rate: 1.15, range: 4, wave: "sawtooth" },
    tint: "#3d1d1b",
  },
  {
    id: "surprised",
    label: "Surprised",
    emoji: "😲",
    description: "surprised: shocked, astonished, caught off guard",
    voice: { pitch: 5, rate: 1.1, range: 5, wave: "square" },
    tint: "#2f2a3c",
  },
  {
    id: "scared",
    label: "Scared",
    emoji: "😨",
    description: "scared: afraid, nervous, worried, anxious",
    voice: { pitch: 3, rate: 1.2, range: 2, wave: "triangle", vibrato: 9 },
    tint: "#1e2a2f",
  },
  {
    id: "confused",
    label: "Confused",
    emoji: "😕",
    description: "confused: puzzled, unsure, does not understand",
    voice: { pitch: 1, rate: 0.95, range: 5, wave: "square" },
    tint: "#2c2b1f",
  },
  {
    id: "thinking",
    label: "Thinking",
    emoji: "🤔",
    description: "thinking: pondering, considering, working it out",
    voice: { pitch: -1, rate: 0.85, range: 2, wave: "triangle" },
    tint: "#202b26",
  },
];

export const INSTRUCTIONS = "Which emotion does the speaker express in this line?";

export const poseById = Object.fromEntries(POSES.map((p) => [p.id, p])) as Record<PoseId, PoseDef>;

export const isPoseId = (id: string): id is PoseId => id in poseById;

/** The multiple-choice question every script line is scored against. */
export function buildPoseQuestion(): ChoiceQuestion {
  return { instructions: INSTRUCTIONS, options: Object.fromEntries(POSES.map((p) => [p.id, p.description])) };
}
