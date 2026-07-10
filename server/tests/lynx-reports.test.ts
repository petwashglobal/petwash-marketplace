/**
 * Lynx dashboard REPORTS (deep dual-bay analytics) — regression pin (2026-07-10).
 *
 * Verified against the Nayax Developer Portal (via MCP): operator reporting is the
 * Widgets Dashboard API —
 *   GET  /operational/v1/dashboard/widgets?screenTypeId=1   (discover widget IDs)
 *   POST /operational/v1/dashboard/get-widget-data          (revenue by day/month/machine)
 * Bearer User Token; Content-Type application/json. This adds getReportWidgets +
 * getReportWidgetData to the money-safe LynxClient and exposes them as super-admin
 * Tower Control feeds. READ-ONLY; dark until LYNX_ENABLED + LYNX_USER_TOKEN.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const CLIENT = fs.readFileSync(path.resolve(__dirname, '..', 'services', 'LynxClient.ts'), 'utf8');
const ADMIN = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'admin-lynx.ts'), 'utf8');

describe('Lynx dashboard reports (2026-07-10)', () => {
  it('getReportWidgets discovers widgets for a screen', () => {
    expect(CLIENT).toMatch(/export function getReportWidgets\(screenTypeId = 1\)/);
    expect(CLIENT).toMatch(/\/operational\/v1\/dashboard\/widgets\?screenTypeId=/);
  });

  it('getReportWidgetData POSTs to get-widget-data with filters', () => {
    expect(CLIENT).toMatch(/export function getReportWidgetData\(input: LynxWidgetDataRequest\)/);
    expect(CLIENT).toMatch(/request\('POST', '\/operational\/v1\/dashboard\/get-widget-data', body\)/);
    expect(CLIENT).toMatch(/getReportWidgets,/);
    expect(CLIENT).toMatch(/getReportWidgetData,/);
  });

  it('exposed as super-admin Tower Control feeds, audited', () => {
    expect(ADMIN).toMatch(/router\.get\('\/reports\/widgets', \.\.\.requireSuperAdmin/);
    expect(ADMIN).toMatch(/router\.post\('\/reports\/widget-data', \.\.\.requireSuperAdmin/);
    expect(ADMIN).toMatch(/ADMIN_LYNX_REPORT_WIDGETS/);
    expect(ADMIN).toMatch(/ADMIN_LYNX_REPORT_WIDGET_DATA/);
  });

  it('widget-data validates widgetTypeId and filters shape', () => {
    expect(ADMIN).toMatch(/if \(!Number\.isFinite\(widgetTypeId\)\) return res\.status\(400\)/);
    expect(ADMIN).toMatch(/filters must be an array/);
  });
});
