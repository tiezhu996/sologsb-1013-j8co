import { module, test } from 'qunit';
import {
  formatDuration,
  parseStart,
  recalculateScene,
  reflowScenes,
  sceneDuration,
  timeLabel,
} from 'stage-cue-editor/utils/schedule';
import type { Cue, CueKind, Scene } from 'stage-cue-editor/models/show';

function makeCue(id: string, duration: number): Cue {
  return {
    id,
    kind: '灯光' as CueKind,
    title: id,
    duration,
    owner: '',
    lighting: '',
    sound: '',
    props: [],
    cast: [],
    notes: '',
    dependsOn: [],
    offset: 0,
  };
}

function makeScene(
  id: string,
  cueDurations: number[],
  startTime: string,
  fixedStart: boolean,
): Scene {
  return {
    id,
    act: '第一幕',
    name: id,
    title: id,
    startTime,
    fixedStart,
    locked: false,
    cues: cueDurations.map((duration, index) =>
      makeCue(`${id}-${index}`, duration),
    ),
  };
}

module('Unit | Utility | schedule', function () {
  test('recalculateScene 按提示顺序累计偏移', function (assert) {
    const scene = makeScene('s1', [45, 90, 75], '19:30', true);
    recalculateScene(scene);
    assert.strictEqual(scene.cues[0]!.offset, 0);
    assert.strictEqual(scene.cues[1]!.offset, 45);
    assert.strictEqual(scene.cues[2]!.offset, 135);
    assert.strictEqual(sceneDuration(scene), 210);
  });

  test('reflowScenes：非固定场次顺着上一场散场时间开始', function (assert) {
    const scenes = [
      makeScene('s1', [60, 120], '19:30', true), // 散场 19:33
      makeScene('s2', [60], '19:40', false), // 应变为 19:33，散场 19:34
      makeScene('s3', [300], '20:00', false), // 应变为 19:34，散场 19:39
    ];
    reflowScenes(scenes);
    assert.strictEqual(scenes[0]!.startTime, '19:30');
    assert.strictEqual(scenes[1]!.startTime, '19:33');
    assert.strictEqual(scenes[2]!.startTime, '19:34');
    assert.strictEqual(
      timeLabel(scenes[0]!, sceneDuration(scenes[0]!)),
      '19:33',
    );
  });

  test('reflowScenes：固定场次按自己的时间开始，后面的场次从它往后接', function (assert) {
    const scenes = [
      makeScene('s1', [60], '19:30', true), // 散场 19:31
      makeScene('s2', [60], '20:00', true), // 固定 20:00，散场 20:01
      makeScene('s3', [60], '19:33', false), // 顺延为 20:01
    ];
    reflowScenes(scenes);
    assert.strictEqual(scenes[0]!.startTime, '19:30');
    assert.strictEqual(scenes[1]!.startTime, '20:00');
    assert.strictEqual(scenes[2]!.startTime, '20:01');
  });

  test('reflowScenes：提示时长改动后，后续场次开场时间整体顺延', function (assert) {
    const scenes = [
      makeScene('s1', [60], '19:30', true),
      makeScene('s2', [60], '20:00', false),
    ];
    reflowScenes(scenes);
    assert.strictEqual(scenes[1]!.startTime, '19:31');
    // 把上一场提示时长从 60 秒改成 660 秒（+10 分钟）
    scenes[0]!.cues[0]!.duration = 660;
    reflowScenes(scenes);
    assert.strictEqual(scenes[0]!.startTime, '19:30');
    assert.strictEqual(scenes[1]!.startTime, '19:41');
  });

  test('reflowScenes：场次顺序调整后按新顺序重排', function (assert) {
    const a = makeScene('a', [60], '19:30', true);
    const b = makeScene('b', [120], '20:00', true);
    const c = makeScene('c', [60], '21:00', false);
    const scenes = [a, b, c];
    reflowScenes(scenes);
    // a 19:30-19:31；b 固定 20:00-20:02；c 20:02-20:03
    assert.deepEqual(
      scenes.map((scene) => scene.startTime),
      ['19:30', '20:00', '20:02'],
    );
    // 把 a（固定 19:30）移到 b 之后：a 仍按自己的时间开始
    reflowScenes([b, a, c]);
    assert.strictEqual(b.startTime, '20:00');
    assert.strictEqual(a.startTime, '19:30');
    assert.strictEqual(c.startTime, '19:31'); // 从 a 散场往后接
  });

  test('reflowScenes：固定场时间暂时非法时不产生 NaN，输入文本被保留', function (assert) {
    const scenes = [
      makeScene('s1', [60], '19:30', true),
      makeScene('s2', [60], 'abc', true), // 正在输入：先沿用上一场散场
      makeScene('s3', [60], '21:00', false),
    ];
    reflowScenes(scenes);
    assert.strictEqual(scenes[1]!.startTime, 'abc');
    assert.strictEqual(scenes[2]!.startTime, '19:32');
  });

  test('reflowScenes：空场次（无提示）不影响下一场衔接', function (assert) {
    const scenes = [
      makeScene('s1', [60], '19:30', true),
      makeScene('s2', [], '19:40', false),
      makeScene('s3', [60], '20:00', false),
    ];
    reflowScenes(scenes);
    assert.strictEqual(scenes[1]!.startTime, '19:31');
    assert.strictEqual(scenes[2]!.startTime, '19:31');
  });

  test('parseStart 与时间格式', function (assert) {
    assert.strictEqual(parseStart('19:30'), 19 * 3600 + 30 * 60);
    assert.strictEqual(parseStart('19:30:45'), 19 * 3600 + 30 * 60 + 45);
    assert.strictEqual(parseStart('24:00'), null);
    assert.strictEqual(parseStart('19:60'), null);
    assert.strictEqual(parseStart('abc'), null);
  });

  test('formatDuration 人类可读', function (assert) {
    assert.strictEqual(formatDuration(45), '45秒');
    assert.strictEqual(formatDuration(60), '1分');
    assert.strictEqual(formatDuration(90), '1分30秒');
    assert.strictEqual(formatDuration(4200), '1时10分');
  });

  test('timeLabel 支持跨到秒的散场显示', function (assert) {
    const scene = makeScene('s1', [30], '19:30:30', true);
    reflowScenes([scene]);
    assert.strictEqual(scene.startTime, '19:30:30');
    assert.strictEqual(timeLabel(scene, sceneDuration(scene)), '19:31');
  });
});
