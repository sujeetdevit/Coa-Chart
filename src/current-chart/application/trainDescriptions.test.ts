import { event, train } from '../../tests/fixtures/smallModel';
import { parseCoaDateTime } from '../adapters';
import type { Train } from '../domain';
import type { TrainPathPoint } from '../engine';
import { describeTrainHover, lateStatus, locoLines, trainLabelText } from './trainDescriptions';

const ist = (text: string) => parseCoaDateTime(text) ?? NaN;

const t: Train = {
  ...train('T', [
    { ...event(1, 'AAA', { departure: ist('20-09-26 22:58:37') }), lateMinutes: 0 },
    { ...event(2, 'BBB', { arrival: ist('20-09-26 23:10:00') }), lateMinutes: 12, isLastReported: true },
  ]),
  number: '12425',
  name: 'NDLS-JAT RAJDHANI',
  locos: [
    { locoNumber: '30636 F1', attached: true, position: 1, reportedAt: 0 },
    { locoNumber: '11111 1', attached: false, position: 1, reportedAt: 0 },
  ],
  crew: [{ name: 'MOHIT', type: 'DR', signOn: ist('20-09-26 20:00'), minutesOnDuty: 190 }],
};

describe('train descriptions', () => {
  it('labels with the number, falling back to the name', () => {
    expect(trainLabelText(t)).toBe('12425');
    const noNumber: Train = { ...t };
    delete noNumber.number;
    expect(trainLabelText(noNumber)).toBe('NDLS-JAT RAJDHANI');
  });

  it('describes lateness at the last reported station', () => {
    expect(lateStatus(t)).toBe('12 min late at BBB');
  });

  it('lists attached locos only when any are attached', () => {
    expect(locoLines(t)).toEqual(['30636 F1']);
  });

  it('includes the hovered point and, on the floating point, the crew', () => {
    const point: TrainPathPoint = {
      x: 0,
      y: 0,
      time: ist('20-09-26 22:58:37'),
      stationId: '1:AAA',
      kind: 'departure',
      eventIndex: 0,
    };
    const onLine = describeTrainHover(t, point, false);
    expect(onLine.title).toBe('12425 NDLS-JAT RAJDHANI');
    expect(onLine.lines).toEqual([
      'Passenger',
      'Departure AAA 22:58:37',
      '12 min late at BBB',
      'Loco 30636 F1',
    ]);
    expect(describeTrainHover(t, undefined, true).lines).toContain('MOHIT (DR) on 20:00, on duty');
  });
});
