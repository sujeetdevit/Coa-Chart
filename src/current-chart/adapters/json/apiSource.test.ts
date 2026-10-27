import { describe, expect, it } from 'vitest';
import type { ApiConfig } from '../../configuration/apiConfig';
import type { ChartQuery, DatasetKey } from '../types';
import { apiSnapshotUrls, formatApiDateTime } from './apiSource';

const HOUR_MS = 3_600_000;
const noon = new Date(2026, 9, 22, 12, 0, 0).getTime();

// Fixed values of its own, so editing apiConfig.ts never changes what these tests expect.
const TEST_CONFIG: ApiConfig = {
  dvsn: 'TST',
  boardId: 7,
  userId: 'TESTUSER',
  userIp: '10.1.2.3',
  windowBeforeNowHours: 24,
  windowAfterNowHours: 12,
};

function url(key: DatasetKey, query: ChartQuery = {}, base = 'http://host/api/'): string {
  const target = apiSnapshotUrls(base, TEST_CONFIG, () => noon)[key];
  return typeof target === 'function' ? target(query) : target;
}

const params = (key: DatasetKey, query: ChartQuery = {}) => new URL(url(key, query)).searchParams;

describe('formatApiDateTime', () => {
  it('formats as dd/MM/yyyy HH:mm:ss', () => {
    expect(formatApiDateTime(new Date(2026, 0, 5, 3, 4, 9).getTime())).toBe('05/01/2026 03:04:09');
  });
});

describe('apiSnapshotUrls', () => {
  it('trims trailing slashes and sends only division and board to BoardDetails', () => {
    expect(url('boardDetails')).toBe('http://host/api/GetBoardDetails?Dvsn=TST&Board=7');
  });

  it('uses the window before and after now, and each endpoint own parameter names', () => {
    const from = formatApiDateTime(noon - 24 * HOUR_MS);
    const to = formatApiDateTime(noon + 12 * HOUR_MS);
    expect(params('blocks').get('blkdvsn')).toBe('TST');
    expect(params('blocks').get('blkboardid')).toBe('7');
    expect(params('blocks').get('frmDateTime')).toBe(from);
    expect(params('blocks').get('toDateTime')).toBe(to);
    expect(params('stationLines').get('fromtime')).toBe(from);
    expect(params('stationLines').get('totime')).toBe(to);
    expect(params('crew').get('Boardid')).toBe('7');
    expect(params('cautions').get('Ctnboardid')).toBe('7');
  });

  it('adds the user to the movement call only', () => {
    expect(params('movement').get('UserID')).toBe('TESTUSER');
    expect(params('movement').get('UserIP')).toBe('10.1.2.3');
    expect(params('loco').has('UserID')).toBe(false);
  });

  it('lets the query override the board and window', () => {
    const query = { boardId: 3, from: noon, to: noon + HOUR_MS };
    expect(params('remarks', query).get('Board')).toBe('3');
    expect(params('remarks', query).get('frmDateTime')).toBe(formatApiDateTime(noon));
    expect(params('remarks', query).get('toDateTime')).toBe(formatApiDateTime(noon + HOUR_MS));
  });
});
