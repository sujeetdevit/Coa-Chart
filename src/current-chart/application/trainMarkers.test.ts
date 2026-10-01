import { event, train } from '../../tests/fixtures/smallModel';
import type { TrainEvent } from '../domain';
import { deriveTrainMarkers } from './trainMarkers';

const at = (m: number) => Date.UTC(2026, 8, 20, 12, m);
const with_ = (e: TrainEvent, extra: Partial<TrainEvent>): TrainEvent => ({ ...e, ...extra });

describe('deriveTrainMarkers', () => {
  it('marks a train originating here as departed and its last report as the floating point', () => {
    const markers = deriveTrainMarkers(
      train('T', [
        event(1, 'AAA', { departure: at(0) }),
        with_(event(2, 'BBB', { arrival: at(10) }), { isLastReported: true }),
      ]),
      3,
    );
    expect(markers.departed).toEqual({ eventIndex: 0, at: 'departure' });
    expect(markers.floating).toEqual({ eventIndex: 1, at: 'arrival' });
    expect(markers.destination).toBeUndefined();
  });

  it('puts the floating point on the departure when the train has left its last reported station', () => {
    const markers = deriveTrainMarkers(
      train('T', [with_(event(1, 'AAA', { arrival: at(0), departure: at(5) }), { isLastReported: true })]),
      3,
    );
    expect(markers.floating).toEqual({ eventIndex: 0, at: 'departure' });
    expect(markers.departed).toBeUndefined(); // arrived from elsewhere, not originating here
  });

  it('shows a terminating square instead of a floating point', () => {
    const markers = deriveTrainMarkers(
      train('T', [
        event(1, 'AAA', { departure: at(0) }),
        with_(event(2, 'BBB', { arrival: at(10) }), { isDestination: true, isLastReported: true }),
      ]),
      3,
    );
    expect(markers.destination).toEqual({ eventIndex: 1, at: 'arrival' });
    expect(markers.floating).toBeUndefined();
    expect(markers.handoverOut).toBe(false);
  });

  it('marks handover from and to other boards', () => {
    const markers = deriveTrainMarkers(
      train('T', [
        with_(event(1, 'AAA', { arrival: at(0), departure: at(1) }), { prevBoardId: 1, nextBoardId: 3 }),
        with_(event(2, 'BBB', { arrival: at(10), departure: at(11) }), { prevBoardId: 3, nextBoardId: 7 }),
      ]),
      3,
    );
    expect(markers.handoverIn).toBe(true);
    expect(markers.handoverOut).toBe(true);
  });

  it('draws no handover arrows within the board or without a board id', () => {
    const t = train('T', [
      with_(event(1, 'AAA', { departure: at(0) }), { prevBoardId: 3, nextBoardId: 3 }),
      with_(event(2, 'BBB', { arrival: at(10) }), { prevBoardId: 3, nextBoardId: 3 }),
    ]);
    expect(deriveTrainMarkers(t, 3)).toMatchObject({ handoverIn: false, handoverOut: false });
    expect(
      deriveTrainMarkers(
        train('X', [with_(event(1, 'AAA', { departure: at(0) }), { prevBoardId: 1 })]),
        undefined,
      ),
    ).toMatchObject({ handoverIn: false });
  });

  it('handles a train with no events', () => {
    expect(deriveTrainMarkers(train('T', []), 3)).toEqual({ handoverIn: false, handoverOut: false });
  });
});
