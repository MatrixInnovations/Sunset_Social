import { spawnSync } from 'child_process';
import path from 'path';

type Report = {
  adaProfiles: string[];
  adaWall: string[];
  beaProfiles: string[];
  cleoProfiles: string[];
  cleoWall: string[];
  hidden: boolean;
  reshowError: string;
  missing: { reason: string; order: { profile_id: string | null; status: string; review_note: string }; tickets: string };
  marker: { reason: string; order: { status: string; tickets: string } };
  nsp: string;
  config: string;
  anonExecute: boolean;
  authExecute: boolean;
  futureSelect: boolean;
};

const ada = '11111111-1111-4111-8111-111111111111';
const bea = '22222222-2222-4222-8222-222222222222';
const cleo = '33333333-3333-4333-8333-333333333333';

describe('guest wall row security', () => {
  const report = loadReport();

  it('lets two ticket holders see each other and hides the wall from someone without a ticket', () => {
    expect(report.adaProfiles).toEqual([ada, bea].sort());
    expect(report.adaWall).toEqual([ada, bea].sort());
    expect(report.beaProfiles).toEqual([ada, bea].sort());
    expect(report.cleoProfiles).toEqual([cleo]);
    expect(report.cleoWall).toEqual([]);
  });

  it('lets a refunded guest hide and refuses to show them again', () => {
    expect(report.hidden).toBe(false);
    expect(report.reshowError).toMatch(/valid ticket/i);
  });

  it('records a profile-less review order when the account is already gone', () => {
    expect(report.missing.reason).toBe('missing_profile');
    expect(report.missing.order).toMatchObject({ profile_id: null, status: 'review', review_note: 'missing_profile' });
    expect(report.missing.tickets).toBe('0');
  });

  it('honors a refund marker inside the same transaction as the order', () => {
    expect(report.marker.reason).toBe('refund_marker');
    expect(report.marker.order).toMatchObject({ status: 'refunded', tickets: '0' });
  });

  it('keeps the ticket check in a private schema and does not grant future tables', () => {
    expect(report.nsp).toBe('private');
    expect(report.config).toContain('search_path=');
    expect(report.anonExecute).toBe(false);
    expect(report.authExecute).toBe(true);
    expect(report.futureSelect).toBe(false);
  });
});

function loadReport(): Report {
  const script = path.join(__dirname, '../../scripts/wall-rls.mjs');
  const result = spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    timeout: 120000,
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `wall-rls exited ${result.status}`);
  }
  const line = result.stdout.trim().split('\n').pop() ?? '';
  return JSON.parse(line) as Report;
}
