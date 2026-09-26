import { module, test } from 'qunit';
import {
  formatClock,
  formatDuration,
  recalculateShow,
  sceneDuration,
  startSeconds,
} from 'stage-cue-editor/utils/timing';
import type { Cue, Scene, ShowData } from 'stage-cue-editor/models/show';

function makeScene(
  id: string,
  startTime: string,
  fixedStart: boolean,
  durations: number[],
): Scene {
  const cues: Cue[] = durations.map((duration, index) => ({
    id: `${id}-cue-${index}`,
    kind: '灯光',
    title: `${id} 提示 ${index + 1}`,
    duration,
    owner: '',
    lighting: '',
    sound: '',
    props: [],
    cast: [],
    notes: '',
    dependsOn: [],
    offset: 0,
  }));
  return {
    id,
    act: '第一幕',
    name: id,
    title: id,
    startTime,
    fixedStart,
    locked: false,
    cues,
  };
}

function makeShow(scenes: Scene[]): ShowData {
  return { title: '', venue: '', date: '', scenes, updatedAt: '' };
}

module('Unit | Utility | timing', function () {
  test('startSeconds 解析 HH:MM 与 HH:MM:SS', function (assert) {
    assert.strictEqual(startSeconds('19:30'), 19 * 3600 + 30 * 60);
    assert.strictEqual(startSeconds('19:35:30'), 19 * 3600 + 35 * 60 + 30);
  });

  test('formatClock 输出整分或带秒时间', function (assert) {
    assert.strictEqual(formatClock(19 * 3600 + 30 * 60), '19:30');
    assert.strictEqual(formatClock(19 * 3600 + 35 * 60 + 30), '19:35:30');
  });

  test('formatDuration 输出可读时长', function (assert) {
    assert.strictEqual(formatDuration(330), '5分30秒');
    assert.strictEqual(formatDuration(120), '2分');
    assert.strictEqual(formatDuration(45), '45秒');
  });

  test('调整场次顺序后，未固定场次顺接上一场散场时间', function (assert) {
    const show = makeShow([
      makeScene('a', '19:30', true, [60, 60]),
      makeScene('b', '20:00', false, [120]),
      makeScene('c', '21:00', false, [60]),
    ]);
    const [third] = show.scenes.splice(2, 1);
    show.scenes.splice(1, 0, third!);
    recalculateShow(show);
    assert.strictEqual(show.scenes[1]!.id, 'c');
    assert.strictEqual(show.scenes[1]!.startTime, '19:32');
    assert.strictEqual(show.scenes[2]!.startTime, '19:33');
  });

  test('固定开场的场次按自己时间开始，后续场次从它往后接', function (assert) {
    const show = makeShow([
      makeScene('a', '19:30', true, [60]),
      makeScene('b', '20:15', true, [60]),
      makeScene('c', '21:00', false, [60]),
    ]);
    recalculateShow(show);
    assert.strictEqual(show.scenes[1]!.startTime, '20:15');
    assert.strictEqual(show.scenes[2]!.startTime, '20:16');
  });

  test('提示时长变化后，后面场次的开场时间跟着挪', function (assert) {
    const show = makeShow([
      makeScene('a', '19:30', true, [60]),
      makeScene('b', '20:00', false, [60]),
    ]);
    recalculateShow(show);
    assert.strictEqual(show.scenes[1]!.startTime, '19:31');
    show.scenes[0]!.cues[0]!.duration = 180;
    recalculateShow(show);
    assert.strictEqual(show.scenes[1]!.startTime, '19:33');
  });

  test('重算后每场提示顺序与总时长正确', function (assert) {
    const show = makeShow([makeScene('a', '19:30', true, [45, 90, 120])]);
    recalculateShow(show);
    const scene = show.scenes[0]!;
    assert.deepEqual(
      scene.cues.map((item) => item.offset),
      [0, 45, 135],
    );
    assert.strictEqual(sceneDuration(scene), 255);
    assert.strictEqual(
      formatClock(startSeconds(scene.startTime) + sceneDuration(scene)),
      '19:34:15',
    );
  });

  test('某场开场时间非法时，后续场次从最后一个有效散场时间顺接', function (assert) {
    const show = makeShow([
      makeScene('a', '19:30', true, [60]),
      makeScene('b', 'abc', true, [60]),
      makeScene('c', '21:00', false, [60]),
    ]);
    recalculateShow(show);
    assert.strictEqual(show.scenes[2]!.startTime, '19:31');
  });
});
