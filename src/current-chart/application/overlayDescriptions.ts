import type { Block, ChartLocation, ChartRemark, TrainRemark, UnusualOccurrence } from '../domain';
import type { BlockPeriod } from './blockPeriods';
import { cautionSpeedText, type CautionGroup } from './cautions';
import { lineCode, type LineOccupancy } from './lineOccupancy';
import {
  formatIstDateTime as dateTime,
  formatIstTime,
  trainTitle,
  type TooltipContent,
} from './trainDescriptions';

export function describeLocation(location: ChartLocation): string {
  return location.kind === 'station'
    ? location.stationCode
    : `${location.fromStationCode}-${location.toStationCode}`;
}

const DIRECTION = { UP: 'UP line', DN: 'DN line', BOTH: 'Both lines' } as const;

export function describeBlock(block: Block, period: BlockPeriod): TooltipContent {
  const lines = [`${block.department} — ${block.reason}`, DIRECTION[block.direction]];
  if (block.permitted.start !== undefined && block.permitted.end !== undefined) {
    lines.push(`Permitted ${dateTime(block.permitted.start)} – ${formatIstTime(block.permitted.end)}`);
  }
  if (block.actual.start !== undefined) {
    const end = block.actual.end !== undefined ? formatIstTime(block.actual.end) : 'in progress';
    lines.push(`Actual ${dateTime(block.actual.start)} – ${end}`);
  }
  if (block.clearedAt !== undefined) lines.push(`Cleared ${dateTime(block.clearedAt)}`);
  if (period.burst) {
    const minutes = Math.round((period.burst.end - period.burst.start) / 60_000);
    lines.push(`Burst ${minutes} min beyond permitted end`);
  }
  if (period.permittedOnly) lines.push('Not started');
  return { title: `Block ${describeLocation(block.location)}`, lines };
}

/** Manual: block section name, location, speed and from date/time. */
export function describeCautionGroup(group: CautionGroup): TooltipContent {
  const lines: string[] = [];
  for (const c of group.cautions) {
    const speed = [
      c.passengerSpeed !== undefined ? `Pass ${c.passengerSpeed}` : '',
      c.goodsSpeed !== undefined ? `Goods ${c.goodsSpeed}` : '',
    ]
      .filter(Boolean)
      .join(', ');
    lines.push(`${c.kmLocation}  ${speed || 'no speed given'}  from ${dateTime(c.from)}`);
    lines.push(`  ${c.reason} (${c.department})`);
  }
  const speeds = cautionSpeedText(group);
  return {
    title: `Caution ${describeLocation(group.location)} · ${DIRECTION[group.direction]}${speeds ? ` · ${speeds}` : ''}`,
    lines,
  };
}

const UNUSUAL_TYPE: Record<string, string> = {
  SIGG: 'Signal',
  ENGG: 'Engineering',
  ELEC: 'Electrical',
  TELE: 'Telecommunication',
  ACF: 'All communication failure',
  MISC: 'Miscellaneous',
  OTHER: 'Other',
};

/** Manual: section/block section, unusual type, start time and reason. */
export function describeUnusual(u: UnusualOccurrence): TooltipContent {
  const lines = [UNUSUAL_TYPE[u.type] ?? u.type, `Start ${dateTime(u.start)}`, u.reason];
  if (u.end !== undefined) lines.push(`End ${dateTime(u.end)}`);
  if (u.detentionMinutes !== undefined) lines.push(`Detention ${u.detentionMinutes} min`);
  return { title: `Unusual ${describeLocation(u.location)}`, lines };
}

const LINE_TYPE = { MAIN: 'main line', LOOP: 'loop line', SIDING: 'siding', UNKNOWN: 'line' } as const;

export function describeLine(stationCode: string, occupancy: LineOccupancy): TooltipContent {
  const { line, state, train } = occupancy;
  return {
    title: `${stationCode} ${lineCode(line)} (${LINE_TYPE[line.type]} ${line.name})`,
    lines: [state === 'OCCUPIED' && train ? `Occupied by ${trainTitle(train)}` : 'Free'],
  };
}

export function describeTrainRemarks(remarks: TrainRemark[]): TooltipContent {
  return {
    title: `Remark ${remarks[0]?.locationCode ?? ''}`,
    lines: remarks.flatMap((r) => [`${formatIstTime(r.at)} ${r.trainName}: ${r.remark}`, `  by ${r.userId}`]),
  };
}

export function describeChartRemark(remark: ChartRemark): TooltipContent {
  return {
    title: 'Remark',
    lines: [remark.text, `${dateTime(remark.from)} – ${dateTime(remark.to)}`, `by ${remark.userId}`],
  };
}
