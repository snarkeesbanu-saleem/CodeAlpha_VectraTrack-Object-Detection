// Agriculture class mapping utility
export type AgriCategory = 'crop' | 'pest' | 'ignore';

const CROP_CLASSES = new Set([
  'banana', 'apple', 'orange', 'broccoli', 'carrot', 'cake', 'potted plant',
]);
const PEST_CLASSES = new Set([
  'bird', 'cat', 'dog', 'mouse', 'bear', 'sheep', 'cow',
]);
const CROP_EMOJIS: Record<string, string> = {
  banana: '🍌', apple: '🍎', orange: '🍊', broccoli: '🥦',
  carrot: '🥕', cake: '🌾', 'potted plant': '🌱',
};
const PEST_EMOJIS: Record<string, string> = {
  bird: '🐦', cat: '🐱', dog: '🐕', mouse: '🐭',
  bear: '🐻', sheep: '🐑', cow: '🐄',
};

export interface AgriInfo {
  category: AgriCategory;
  label: string;
  emoji: string;
  hexColor: string;
}

export function getAgriInfo(className: string): AgriInfo {
  const cls = className.toLowerCase();
  if (CROP_CLASSES.has(cls)) return {
    category: 'crop', label: cls, emoji: CROP_EMOJIS[cls] || '🌱',
    hexColor: '#16a34a',
  };
  if (PEST_CLASSES.has(cls)) return {
    category: 'pest', label: cls, emoji: PEST_EMOJIS[cls] || '🐛',
    hexColor: '#d97706',
  };
  return { category: 'ignore', label: cls, emoji: '⬛', hexColor: '#94a3b8' };
}

export const CROP_CLASS_LIST = ['potted plant', 'banana', 'apple', 'orange', 'broccoli', 'carrot', 'cake'];
export const PEST_CLASS_LIST = ['bird', 'cat', 'dog', 'mouse', 'bear', 'sheep', 'cow'];
export const IGNORED_CLASS_LIST = ['person', 'car', 'truck', 'bicycle', 'bus', 'laptop', 'chair', 'bottle', 'cell phone'];

export function computeHealthScore(cropCount: number, pestCount: number): number {
  return Math.max(0, Math.min(100, 100 - pestCount * 4 + cropCount * 1.5));
}

export function getHealthGrade(score: number): { grade: string; color: string; bgColor: string } {
  if (score >= 75) return { grade: '🟢 Healthy', color: '#16a34a', bgColor: '#dcfce7' };
  if (score >= 45) return { grade: '🟡 Moderate', color: '#d97706', bgColor: '#fef3c7' };
  return { grade: '🔴 Critical', color: '#dc2626', bgColor: '#fee2e2' };
}
