import type { Primitive, TextPrimitive } from '../types';
import { paintPrimitives, type PaintContext } from './paintPrimitives';

/** Records every call and property assignment made on the context, in order. */
function recorder() {
  const log: string[] = [];
  const props: Record<string, unknown> = {};
  const ctx = new Proxy(
    {},
    {
      get: (_, name: string) =>
        name in props
          ? props[name]
          : (...args: unknown[]) => {
              log.push(
                `${name}(${args.map((a) => (typeof a === 'number' ? +a.toFixed(2) : String(a))).join(',')})`,
              );
            },
      set: (_, name: string, value: unknown) => {
        props[name] = value;
        log.push(`${name}=${String(value)}`);
        return true;
      },
    },
  ) as unknown as PaintContext;
  return { ctx, log, calls: (name: string) => log.filter((entry) => entry.startsWith(`${name}(`)) };
}

const text = (overrides: Partial<TextPrimitive>): TextPrimitive => ({
  kind: 'text',
  id: 't',
  x: 100,
  y: 50,
  text: 'UMB',
  fill: '#000',
  fontSize: 10,
  fontFamily: 'Arial',
  align: 'left',
  baseline: 'top',
  ...overrides,
});

describe('paintPrimitives', () => {
  it('paints items in model order, so later items end up on top', () => {
    const { ctx, log } = recorder();
    const items: Primitive[] = [
      { kind: 'rect', id: 'a', x: 0, y: 0, width: 10, height: 5, fill: 'red' },
      { kind: 'circle', id: 'b', x: 3, y: 4, radius: 2, fill: 'green' },
    ];
    paintPrimitives(ctx, items);

    expect(log.indexOf('fillRect(0,0,10,5)')).toBeLessThan(log.indexOf('arc(3,4,2,0,6.28)'));
  });

  it('fills a rectangle and outlines it only when it has a stroke', () => {
    const plain = recorder();
    paintPrimitives(plain.ctx, [{ kind: 'rect', id: 'a', x: 1, y: 2, width: 3, height: 4, fill: 'red' }]);
    expect(plain.log).toContain('fillStyle=red');
    expect(plain.calls('strokeRect')).toEqual([]);

    const outlined = recorder();
    paintPrimitives(outlined.ctx, [
      { kind: 'rect', id: 'a', x: 1, y: 2, width: 3, height: 4, fill: 'red', stroke: 'blue', strokeWidth: 2 },
    ]);
    expect(outlined.log).toContain('strokeStyle=blue');
    expect(outlined.calls('strokeRect')).toEqual(['strokeRect(1,2,3,4)']);
  });

  it('draws a polyline with its dash, and closes and fills a polygon', () => {
    const line = recorder();
    paintPrimitives(line.ctx, [
      { kind: 'line', id: 'l', points: [0, 0, 10, 0, 10, 10], stroke: 'black', strokeWidth: 1, dash: [4, 2] },
    ]);
    expect(line.log).toEqual(
      expect.arrayContaining([
        'moveTo(0,0)',
        'lineTo(10,0)',
        'lineTo(10,10)',
        'setLineDash(4,2)',
        'stroke()',
      ]),
    );
    expect(line.calls('closePath')).toEqual([]);
    expect(line.calls('fill')).toEqual([]);

    const polygon = recorder();
    paintPrimitives(polygon.ctx, [
      {
        kind: 'line',
        id: 'p',
        points: [0, 0, 10, 0, 5, 8],
        stroke: 'black',
        strokeWidth: 1,
        closed: true,
        fill: 'blue',
      },
    ]);
    expect(polygon.log).toEqual(expect.arrayContaining(['closePath()', 'fillStyle=blue', 'fill()']));
  });

  it('clears a previous dash before solid strokes', () => {
    const { ctx, log } = recorder();
    paintPrimitives(ctx, [
      { kind: 'line', id: 'dashed', points: [0, 0, 5, 5], stroke: 'black', strokeWidth: 1, dash: [3, 3] },
      { kind: 'line', id: 'solid', points: [0, 0, 5, 5], stroke: 'black', strokeWidth: 1 },
    ]);
    expect(log.filter((entry) => entry.startsWith('setLineDash'))).toEqual([
      'setLineDash(3,3)',
      'setLineDash()',
    ]);
  });

  it('draws all segments of a batch in one path', () => {
    const { ctx, calls } = recorder();
    paintPrimitives(ctx, [
      { kind: 'segments', id: 's', points: [0, 0, 0, 5, 10, 0, 10, 5], stroke: 'grey', strokeWidth: 1 },
    ]);
    expect(calls('beginPath')).toHaveLength(1);
    expect(calls('moveTo')).toEqual(['moveTo(0,0)', 'moveTo(10,0)']);
    expect(calls('stroke')).toHaveLength(1);
  });

  it('applies each item’s opacity and leaves the context opaque', () => {
    const { ctx, log } = recorder();
    paintPrimitives(ctx, [
      { kind: 'rect', id: 'a', x: 0, y: 0, width: 1, height: 1, fill: 'red', opacity: 0.4 },
      { kind: 'rect', id: 'b', x: 0, y: 0, width: 1, height: 1, fill: 'red' },
    ]);
    expect(log.filter((entry) => entry.startsWith('globalAlpha'))).toEqual([
      'globalAlpha=0.4',
      'globalAlpha=1',
      'globalAlpha=1',
    ]);
  });

  describe('text', () => {
    it('anchors a single line by its baseline setting', () => {
      const y = (baseline: TextPrimitive['baseline']) => {
        const { ctx, calls } = recorder();
        paintPrimitives(ctx, [text({ baseline })]);
        return calls('fillText')[0];
      };
      // Drawn with a middle baseline, so the line centre is shifted from the anchor.
      expect(y('top')).toBe('fillText(UMB,100,55)');
      expect(y('middle')).toBe('fillText(UMB,100,50)');
      expect(y('bottom')).toBe('fillText(UMB,100,45)');
    });

    it('passes alignment and the bold font through', () => {
      const { ctx, log } = recorder();
      paintPrimitives(ctx, [text({ align: 'right', bold: true, fontSize: 12 })]);
      expect(log).toEqual(
        expect.arrayContaining(['textAlign=right', 'textBaseline=middle', 'font=bold 12px Arial']),
      );
    });

    it('stacks the lines of multi-line text as one block around the anchor', () => {
      const { ctx, calls } = recorder();
      paintPrimitives(ctx, [text({ text: '12345\nDR MOHIT', baseline: 'bottom', lineHeight: 1.2 })]);
      // Two 12 px lines ending at y = 50: centres at 32 and 44.
      expect(calls('fillText')).toEqual(['fillText(12345,100,32)', 'fillText(DR MOHIT,100,44)']);
    });

    it('sets the font only when it changes', () => {
      const { ctx, log } = recorder();
      paintPrimitives(ctx, [
        text({ id: 'a' }),
        text({ id: 'b' }),
        text({ id: 'c', bold: true }),
        text({ id: 'd' }),
      ]);
      expect(log.filter((entry) => entry.startsWith('font='))).toEqual([
        'font=10px Arial',
        'font=bold 10px Arial',
        'font=10px Arial',
      ]);
    });
  });
});
