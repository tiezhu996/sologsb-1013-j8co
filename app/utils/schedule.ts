import type { Scene } from 'stage-cue-editor/models/show';

/** 解析 HH:MM(:SS) 为当天秒数（宽松，非法输入可能返回 NaN） */
export function startSeconds(value: string): number {
  const [hour = '0', minute = '0', second = '0'] = value.split(':');
  return Number(hour) * 3600 + Number(minute) * 60 + Number(second);
}

/** 严格解析 HH:MM(:SS)，输入不完整或非法时返回 null，避免重排时产生 NaN */
export function parseStart(value: string): number | null {
  const match = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? 0);
  if (hour > 23 || minute > 59 || second > 59) return null;
  return hour * 3600 + minute * 60 + second;
}

/** 把当天秒数格式化为 HH:MM（整分）或 HH:MM:SS */
export function formatClock(totalSeconds: number): string {
  const total = ((Math.floor(totalSeconds) % 86400) + 86400) % 86400;
  const hour = Math.floor(total / 3600);
  const minute = Math.floor((total % 3600) / 60);
  const second = total % 60;
  const base = [hour, minute]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
  return second === 0 ? base : `${base}:${String(second).padStart(2, '0')}`;
}

export function timeLabel(scene: Scene, offset: number): string {
  return formatClock(startSeconds(scene.startTime) + offset);
}

/** 重算一场内每条提示相对开场的时间偏移 */
export function recalculateScene(scene: Scene): void {
  let elapsed = 0;
  scene.cues.forEach((item) => {
    item.offset = elapsed;
    elapsed += Number(item.duration) || 0;
  });
}

/** 一场所有提示加起来的演出时长（秒） */
export function sceneDuration(scene: Scene): number {
  return scene.cues.reduce(
    (total, item) => total + (Number(item.duration) || 0),
    0,
  );
}

/** 人类可读时长，如 5分30秒 / 45秒 / 1时10分 */
export function formatDuration(totalSeconds: number): string {
  const total = Math.max(0, Math.round(totalSeconds));
  const hour = Math.floor(total / 3600);
  const minute = Math.floor((total % 3600) / 60);
  const second = total % 60;
  if (hour) return `${hour}时${minute}分`;
  if (minute) return second ? `${minute}分${second}秒` : `${minute}分`;
  return `${second}秒`;
}

/**
 * 按场次顺序重排时间：
 * - 第一场或开场时间被固定的场次，按自己写的开场时间开始；
 * - 其余场次开场时间顺着上一场散场时间往后接（无间隔）；
 * - 提示时长变化后，后面的场次开场时间整体顺延；
 * - 固定场次的开场时间正在输入（暂时非法）时保留原文本，
 *   后面的场次先沿用上一场散场时间，不产生 NaN。
 */
export function reflowScenes(scenes: Scene[]): void {
  let previousEnd: number | null = null;
  scenes.forEach((scene, index) => {
    recalculateScene(scene);
    const ownStart = parseStart(scene.startTime);
    let anchor: number;
    if (index === 0 || scene.fixedStart) {
      anchor = ownStart ?? previousEnd ?? 0;
      if (ownStart !== null) scene.startTime = formatClock(anchor);
    } else {
      anchor = previousEnd ?? ownStart ?? 0;
      scene.startTime = formatClock(anchor);
    }
    previousEnd = anchor + sceneDuration(scene);
  });
}
