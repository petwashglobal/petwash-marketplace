/**
 * PetWash™ K9000 Station Alert Email 2026
 *
 * IoT-driven operational alerts to station operators, franchise owners, and admins.
 * 10 alert types with per-alert urgency, color, and CTA.
 *
 * Type: OPERATIONAL (transactional) — no unsubscribe
 * Audience: station_operator | franchise_owner | admin | maintenance_team
 */

import { PETWASH_LOGO_BASE64 } from './logo-base64';
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP_URL } from '@shared/support-contact';

// Alert type configuration
const ALERT_CONFIG = {
  offline: {
    labelHe: 'תחנה לא מקוונת', labelEn: 'Station Offline',
    icon: '🔴', urgency: 'critical', color: '#D32F2F', bgColor: '#FFF5F5',
  },
  back_online: {
    labelHe: 'תחנה חזרה לפעילות', labelEn: 'Station Back Online',
    icon: '🟢', urgency: 'resolved', color: '#1A7A3F', bgColor: '#F5FFF8',
  },
  maintenance_due: {
    labelHe: 'תחזוקה נדרשת', labelEn: 'Maintenance Due',
    icon: '🔧', urgency: 'warning', color: '#E65100', bgColor: '#FFF8F0',
  },
  low_supply: {
    labelHe: 'חומר בעל רמה נמוכה', labelEn: 'Low Supply Level',
    icon: '⚠️', urgency: 'warning', color: '#F57C00', bgColor: '#FFF9F0',
  },
  fault: {
    labelHe: 'תקלה טכנית', labelEn: 'Technical Fault',
    icon: '🚨', urgency: 'critical', color: '#B71C1C', bgColor: '#FFF0F0',
  },
  payment_failure: {
    labelHe: 'תשלום נכשל', labelEn: 'Payment Failure',
    icon: '💳', urgency: 'high', color: '#AD1457', bgColor: '#FFF0F5',
  },
  weather_closure: {
    labelHe: 'סגירה מזג אוויר', labelEn: 'Weather Closure',
    icon: '⛈️', urgency: 'info', color: '#0277BD', bgColor: '#F0F7FF',
  },
  usage_milestone: {
    labelHe: 'אבן דרך שימוש', labelEn: 'Usage Milestone',
    icon: '🏆', urgency: 'success', color: '#1A7A3F', bgColor: '#F5FFF8',
  },
  theft_attempt: {
    labelHe: 'ניסיון פריצה', labelEn: 'Tamper / Theft Attempt',
    icon: '🚨', urgency: 'critical', color: '#B71C1C', bgColor: '#FFF0F0',
  },
  daily_report: {
    labelHe: 'דוח יומי', labelEn: 'Daily Station Report',
    icon: '📊', urgency: 'info', color: '#1565C0', bgColor: '#F0F5FF',
  },
} as const;

type AlertType = keyof typeof ALERT_CONFIG;

const URGENCY_COLORS: Record<string, string> = {
  critical: '#D32F2F',
  high:     '#AD1457',
  warning:  '#E65100',
  info:     '#1565C0',
  success:  '#1A7A3F',
  resolved: '#1A7A3F',
};

// Brand
const HEADER_BG = '#0F0F0F';
const BODY_BG   = '#FFFFFF';
const GOLD      = '#B8941F';
const DIVIDER   = '#E8DEC8';

export interface K9000StationAlertParams {
  alertType: AlertType;
  stationId: string;
  stationName: string;
  stationAddress?: string;
  stationCity?: string;
  franchiseOwner?: string;
  operatorName?: string;
  alertMessage: string;
  alertMessageEn?: string;
  details?: Record<string, string>;
  metrics?: {
    totalWashes?: number;
    revenueToday?: number;
    uptimePercent?: number;
    supplyLevel?: number;
    lastWash?: string;
    temperature?: number;
  };
  ctaUrl?: string;
  ctaLabelHe?: string;
  ctaLabelEn?: string;
  reportDate?: string;
  language?: string;
}

export function k9000StationAlert(p: K9000StationAlertParams): string {
  const lang = p.language ?? 'he';
  const isHe = lang === 'he';
  const cfg = ALERT_CONFIG[p.alertType];
  const urgencyColor = URGENCY_COLORS[cfg.urgency] ?? GOLD;

  const alertLabel = isHe ? cfg.labelHe : cfg.labelEn;
  const now = new Date();
  const timestamp = now.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', hour12: false });

  // Details rows
  const detailRows = p.details ? Object.entries(p.details).map(([key, val]) => `
    <tr>
      <td style="padding:7px 0;font-size:13px;color:#555;direction:rtl;border-bottom:1px solid #F0F0F0">${key}</td>
      <td style="padding:7px 0;font-size:13px;font-weight:600;color:#111;border-bottom:1px solid #F0F0F0">${val}</td>
    </tr>`).join('') : '';

  // Metrics dashboard (for daily_report or any alert with metrics)
  const metricsSection = p.metrics ? `
    <tr>
      <td style="padding:0 32px 24px">
        <div style="font-size:12px;font-weight:700;color:#888;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;direction:rtl">
          ${isHe ? 'נתוני תחנה' : 'STATION METRICS'}
        </div>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            ${p.metrics.totalWashes !== undefined ? `
            <td width="25%" align="center" style="padding:16px 8px;background:#F9F7F3;border:1px solid ${DIVIDER};border-radius:4px;margin:4px">
              <div style="font-size:22px;font-weight:700;color:${GOLD}">${p.metrics.totalWashes}</div>
              <div style="font-size:11px;color:#777;margin-top:4px">${isHe ? 'שטיפות היום' : 'Washes today'}</div>
            </td>` : ''}
            ${p.metrics.revenueToday !== undefined ? `
            <td width="25%" align="center" style="padding:16px 8px;background:#F9F7F3;border:1px solid ${DIVIDER}">
              <div style="font-size:22px;font-weight:700;color:${GOLD}">₪${(p.metrics.revenueToday/100).toFixed(0)}</div>
              <div style="font-size:11px;color:#777;margin-top:4px">${isHe ? 'הכנסות היום' : 'Revenue today'}</div>
            </td>` : ''}
            ${p.metrics.uptimePercent !== undefined ? `
            <td width="25%" align="center" style="padding:16px 8px;background:#F9F7F3;border:1px solid ${DIVIDER}">
              <div style="font-size:22px;font-weight:700;color:${p.metrics.uptimePercent >= 99 ? '#1A7A3F' : p.metrics.uptimePercent >= 95 ? '#E65100' : '#D32F2F'}">${p.metrics.uptimePercent}%</div>
              <div style="font-size:11px;color:#777;margin-top:4px">${isHe ? 'זמינות' : 'Uptime'}</div>
            </td>` : ''}
            ${p.metrics.supplyLevel !== undefined ? `
            <td width="25%" align="center" style="padding:16px 8px;background:#F9F7F3;border:1px solid ${DIVIDER}">
              <div style="font-size:22px;font-weight:700;color:${p.metrics.supplyLevel <= 20 ? '#D32F2F' : p.metrics.supplyLevel <= 40 ? '#E65100' : '#1A7A3F'}">${p.metrics.supplyLevel}%</div>
              <div style="font-size:11px;color:#777;margin-top:4px">${isHe ? 'רמת חומר' : 'Supply level'}</div>
            </td>` : ''}
          </tr>
        </table>
      </td>
    </tr>` : '';

  return `<!DOCTYPE html>
<html lang="${lang}" dir="rtl">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>K9000 ${alertLabel} — ${p.stationName}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f4f4f4">
<tr><td align="center" style="padding:24px 8px">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:${BODY_BG};border:1px solid ${DIVIDER}">

  <!-- ALERT URGENCY BANNER -->
  <tr>
    <td bgcolor="${urgencyColor}" style="padding:8px 32px;background:${urgencyColor}">
      <span style="color:#fff;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase">
        ${cfg.icon} ${cfg.urgency.toUpperCase()} — ${isHe ? 'K9000 דרישת פעולה' : 'K9000 ACTION REQUIRED'}
      </span>
    </td>
  </tr>

  <!-- HEADER -->
  <tr>
    <td bgcolor="${HEADER_BG}" style="padding:24px 32px;background:${HEADER_BG}">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <img src="${PETWASH_LOGO_BASE64}" width="120" alt="Pet Wash™" style="display:block;margin-bottom:8px"/>
            <div style="color:${GOLD};font-size:16px;font-weight:700">K9000 • ${isHe ? 'מרכז ניטור' : 'Operations Hub'}</div>
          </td>
          <td align="left" style="vertical-align:top">
            <div style="color:#aaa;font-size:11px;text-align:left">${timestamp}</div>
            <div style="color:#fff;font-size:13px;font-weight:600;margin-top:4px;text-align:left">${p.stationName}</div>
            ${p.stationCity ? `<div style="color:#888;font-size:11px;text-align:left">${p.stationCity}</div>` : ''}
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ALERT TYPE CARD -->
  <tr>
    <td style="padding:24px 32px 0">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:${cfg.bgColor};border:2px solid ${cfg.color};border-radius:4px">
        <tr>
          <td style="padding:20px 24px;direction:rtl">
            <div style="font-size:28px;margin-bottom:8px">${cfg.icon}</div>
            <div style="font-size:18px;font-weight:700;color:${cfg.color};margin-bottom:8px">
              ${alertLabel}
            </div>
            <div style="font-size:14px;color:#333;line-height:1.6">
              ${isHe ? p.alertMessage : (p.alertMessageEn ?? p.alertMessage)}
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- STATION INFO -->
  <tr>
    <td style="padding:24px 32px 0">
      <div style="font-size:12px;font-weight:700;color:#888;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;direction:rtl">
        ${isHe ? 'פרטי תחנה' : 'STATION DETAILS'}
      </div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:7px 0;font-size:13px;color:#555;direction:rtl;border-bottom:1px solid #F0F0F0">
            ${isHe ? 'מזהה תחנה' : 'Station ID'}
          </td>
          <td style="padding:7px 0;font-size:13px;font-weight:600;color:#111;font-family:monospace;border-bottom:1px solid #F0F0F0">
            ${p.stationId}
          </td>
        </tr>
        ${p.stationAddress ? `<tr>
          <td style="padding:7px 0;font-size:13px;color:#555;direction:rtl;border-bottom:1px solid #F0F0F0">${isHe ? 'כתובת' : 'Address'}</td>
          <td style="padding:7px 0;font-size:13px;color:#111;border-bottom:1px solid #F0F0F0">${p.stationAddress}</td>
        </tr>` : ''}
        ${p.operatorName ? `<tr>
          <td style="padding:7px 0;font-size:13px;color:#555;direction:rtl;border-bottom:1px solid #F0F0F0">${isHe ? 'מפעיל' : 'Operator'}</td>
          <td style="padding:7px 0;font-size:13px;color:#111;border-bottom:1px solid #F0F0F0">${p.operatorName}</td>
        </tr>` : ''}
        ${detailRows}
      </table>
    </td>
  </tr>

  ${metricsSection}

  <!-- CTA -->
  ${p.ctaUrl ? `
  <tr>
    <td style="padding:24px 32px;text-align:center">
      <table cellpadding="0" cellspacing="0" style="margin:0 auto">
        <tr><td style="background:${cfg.color}">
          <a href="${p.ctaUrl}" style="display:inline-block;padding:14px 32px;color:#fff;font-size:13px;font-weight:700;text-decoration:none;letter-spacing:2px;text-transform:uppercase">
            ${isHe ? (p.ctaLabelHe ?? 'פתח לוח בקרה') : (p.ctaLabelEn ?? 'OPEN DASHBOARD')}
          </a>
        </td></tr>
      </table>
    </td>
  </tr>` : ''}

  <!-- FOOTER -->
  <tr>
    <td bgcolor="${HEADER_BG}" style="padding:16px 32px;text-align:center;background:${HEADER_BG}">
      <p style="margin:0 0 4px;font-size:11px;color:#888">
        Pet Wash™ K9000 Operations | ${SUPPORT_EMAIL}
      </p>
      <p style="margin:0;font-size:10px;color:#555;direction:rtl">
        ${isHe ? 'הודעה תפעולית אוטומטית. אין צורך בביטול הרשמה.' : 'Automated operational alert. No unsubscribe required.'}
      </p>
    </td>
  </tr>

</table>
</td></tr></table>
</body>
</html>`;
}
