/**
 * Agenda à suivre depuis le téléphone (iPhone, Google Agenda, Outlook) : un flux iCalendar
 * servi à une adresse secrète propre à chaque compte (/cal/<jeton>.ics).
 * Contient les rendez-vous (avec leurs rappels) et les échéances des soins sans rendez-vous.
 */
import { addUnit, apptTitle, careInfo, diffDays, type Profile } from './reminders';

/** Échappement des valeurs texte (RFC 5545 §3.3.11). */
export const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Lignes repliées à 75 octets (RFC 5545 §3.1), sans couper un caractère UTF-8. */
export function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let cur = '', size = 0, limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (size + n > limit) { parts.push(cur); cur = ''; size = 0; limit = 74; }
    cur += ch; size += n;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

const d8 = (iso: string) => iso.replace(/-/g, '');
const pad = (n: number) => String(n).padStart(2, '0');

/** Rendez-vous passés gardés dans l'agenda (jours) */
const PAST_DAYS = 180;

export function buildCalendar(familyName: string, profiles: Profile[], today: string, stamp = new Date()): string {
  const dtstamp = stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const L: string[] = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Carnet de santé familial//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsText(`Carnet · ${familyName}`)}`, 'X-WR-TIMEZONE:Europe/Paris',
    'REFRESH-INTERVAL;VALUE=DURATION:PT4H', 'X-PUBLISHED-TTL:PT4H',
  ];
  const alarm = (days: number, text: string) => {
    L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(text)}`, `TRIGGER:${days > 0 ? `-P${days}D` : 'PT0S'}`, 'END:VALARM');
  };
  for (const p of profiles) {
    if (p.archived) continue;
    const appts = p.appointments ?? [];
    for (const a of appts) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date)) continue;
      if (a.status !== 'planned' && !(a.status === 'done' && diffDays(today, a.date) <= PAST_DAYS)) continue;
      const title = apptTitle(a, p);
      L.push('BEGIN:VEVENT', `UID:appt-${a.id}@carnet`, `DTSTAMP:${dtstamp}`, `SUMMARY:${icsText(`${title} · ${p.name}`)}`);
      if (a.time && /^\d{2}:\d{2}$/.test(a.time)) {
        const [h, m] = a.time.split(':').map(Number);
        const end = h >= 23 ? `${d8(addUnit(a.date, 1, 'd'))}T00${pad(m)}00` : `${d8(a.date)}T${pad(h + 1)}${pad(m)}00`;
        // Heure locale « flottante » : affichée à l'heure saisie, dans le fuseau du téléphone
        L.push(`DTSTART:${d8(a.date)}T${pad(h)}${pad(m)}00`, `DTEND:${end}`);
      } else {
        L.push(`DTSTART;VALUE=DATE:${d8(a.date)}`, `DTEND;VALUE=DATE:${d8(addUnit(a.date, 1, 'd'))}`);
      }
      if (a.place) L.push(`LOCATION:${icsText(a.place)}`);
      if (a.note) L.push(`DESCRIPTION:${icsText(a.note)}`);
      if (a.status === 'done') L.push('STATUS:CONFIRMED');
      if (a.status === 'planned') for (const r of a.reminders ?? []) if (r.on) alarm(r.days, `${title} · ${p.name}`);
      L.push('END:VEVENT');
    }
    for (const c of p.cares ?? []) {
      const i = careInfo(c, appts, today);
      if (!i.due || !['ok', 'remind', 'pending', 'overdue'].includes(i.status)) continue;
      L.push('BEGIN:VEVENT', `UID:due-${p.id}-${c.id}-${i.due}@carnet`, `DTSTAMP:${dtstamp}`,
        `SUMMARY:${icsText(`Échéance : ${c.name} · ${p.name}`)}`,
        `DTSTART;VALUE=DATE:${d8(i.due)}`, `DTEND;VALUE=DATE:${d8(addUnit(i.due, 1, 'd'))}`, 'TRANSP:TRANSPARENT',
        `DESCRIPTION:${icsText('Pensez à prendre rendez-vous. À noter dans le carnet une fois le rendez-vous fixé.')}`);
      if (i.rem && i.rem < i.due && i.rem >= today) alarm(diffDays(i.due, i.rem), `Prendre rendez-vous : ${c.name} · ${p.name}`);
      L.push('END:VEVENT');
    }
  }
  L.push('END:VCALENDAR');
  return L.map(fold).join('\r\n') + '\r\n';
}
