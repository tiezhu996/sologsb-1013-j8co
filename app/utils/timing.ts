import type { Scene, ShowData } from 'stage-cue-editor/models/show';

export function startSeconds(value: string): number {
  const [hour = '0', minute = '0', second = '0'] = value.split(':');
  return Number(hour) * 3600 + Number(minute) * 60 + Number(second);
}

export function formatClock(totalSeconds: number): string {
  const total = ((Math.round(totalSeconds) % 86400) + 86400) % 86400;
  const hour = Math.floor(total / 3600);
  const minute = Math.floor((total % 3600) / 60);
  const second = total % 60;
  const base = [hour, minute]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
  return second ? `${base}:${String(second).padStart(2, '0')}` : base;
}

export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes && seconds) return `${minutes}分${seconds}秒`;
  if (minutes) return `${minutes}分`;
  return `${seconds}秒`;
}

export function sceneDuration(scene: Scene): number {
  return scene.cues.reduce(
    (total, item) => total + (Number(item.duration) || 0),
    0,
  );
}

export function sceneEndSeconds(scene: Scene): number {
  return startSeconds(scene.startTime) + sceneDuration(scene);
}

export function recalculateScene(scene: Scene): void {
  let elapsed = 0;
  scene.cues.forEach((item) => {
    item.offset = elapsed;
    elapsed += Number(item.duration) || 0;
  });
}

export function recalculateShow(show: ShowData): void {
  let cursor: number | null = null;
  show.scenes.forEach((scene) => {
    recalculateScene(scene);
    if (cursor !== null && !scene.fixedStart && Number.isFinite(cursor)) {
      scene.startTime = formatClock(cursor);
    }
    const end = sceneEndSeconds(scene);
    if (Number.isFinite(end)) cursor = end;
  });
}
