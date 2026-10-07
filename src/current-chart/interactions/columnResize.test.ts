import { columnEdgeAt, draggedWidth, grabX } from './columnResize';

describe('column resize', () => {
  const edges = { caution: 1000, occupancy: 1122 };
  const stageWidth = 1312;

  describe('columnEdgeAt', () => {
    it('finds the column whose left edge is within reach of the pointer', () => {
      // The splitter is centred 2 px left of the edge.
      expect(columnEdgeAt(998, edges, stageWidth)).toBe('caution');
      expect(columnEdgeAt(1003, edges, stageWidth)).toBe('caution');
      expect(columnEdgeAt(993, edges, stageWidth)).toBe('caution');
      expect(columnEdgeAt(1120, edges, stageWidth)).toBe('occupancy');
    });

    it('finds nothing away from the edges', () => {
      expect(columnEdgeAt(1004, edges, stageWidth)).toBeUndefined();
      expect(columnEdgeAt(992, edges, stageWidth)).toBeUndefined();
      expect(columnEdgeAt(500, edges, stageWidth)).toBeUndefined();
      expect(columnEdgeAt(1200, edges, stageWidth)).toBeUndefined();
    });

    it('keeps a hidden last column reachable at the stage border', () => {
      const hidden = { caution: 1190, occupancy: stageWidth };
      expect(grabX(stageWidth, stageWidth)).toBe(stageWidth - 2);
      expect(columnEdgeAt(stageWidth - 1, hidden, stageWidth)).toBe('occupancy');
      expect(columnEdgeAt(stageWidth - 7, hidden, stageWidth)).toBe('occupancy');
    });

    it('picks the nearer edge when two are within reach', () => {
      const close = { caution: 1000, occupancy: 1006 };
      expect(columnEdgeAt(999, close, stageWidth)).toBe('caution');
      expect(columnEdgeAt(1002, close, stageWidth)).toBe('occupancy');
    });
  });

  describe('draggedWidth', () => {
    it('narrows when dragged right and widens when dragged left', () => {
      expect(draggedWidth(190, 1122, 1162, 190)).toBe(150);
      expect(draggedWidth(150, 1162, 1142, 190)).toBe(170);
    });

    it('never grows past the full width', () => {
      expect(draggedWidth(190, 1122, 900, 190)).toBe(190);
    });

    it('hides the column when dragged all the way, or to a sliver', () => {
      expect(draggedWidth(190, 1122, 1400, 190)).toBe(0);
      expect(draggedWidth(190, 1122, 1122 + 170, 190)).toBe(0);
      expect(draggedWidth(190, 1122, 1122 + 166, 190)).toBe(24);
    });

    it('reopens a hidden column once dragged left past the snap width', () => {
      expect(draggedWidth(0, 1307, 1290, 190)).toBe(0);
      expect(draggedWidth(0, 1307, 1267, 190)).toBe(40);
      expect(draggedWidth(0, 1307, 800, 190)).toBe(190);
    });
  });
});
