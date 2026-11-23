import { describe, expect, it } from 'vitest';
import { buildCalendar, fold, icsText } from '../src/calendar';

describe('format iCalendar', () => {
  it('échappe les caractères spéciaux', () => {
    expect(icsText('a;b,c\\d\ne')).toBe('a\;b\\,c\\\\d\\ne');
  });
  it('replie les longues lignes à 75 octets sans couper les accents', () => {
    const line = 'SUMMARY:' + 'é'.repeat(60);
    const out = fold(line);
    for (const l of out.split('\r\n')) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(out.split('\r\n').map((l, i) => (i ? l.slice(1) : l)).join('')).toBe(line);
  });
});

describe('agenda d’une famille', () => {
  const profiles = [{
    id: 'p1', name: 'Poki',
    cares: [
      { id: 'c1', name: 'Vaccin', freq: { n: 1, unit: 'y' as const }, remind: { n: 1, unit: 'm' as const }, realizations: [{ date: '2025-12-15' }] },
      { id: 'c2', name: 'Vermifuge', freq: { n: 3, unit: 'm' as const }, remind: null, realizations: [{ date: '2026-10-10' }] },
    ],
    appointments: [
      { id: 'a1', careId: 'c1', date: '2026-12-01', time: '10:30', place: 'Clinique, Paris', status: 'planned', reminders: [{ days: 7, on: true }, { days: 2, on: false }] },
      { id: 'a2', title: 'Ancien', date: '2025-01-01', status: 'done' },
      { id: 'a3', title: 'Annulé', date: '2026-12-05', status: 'cancelled' },
    ],
  }, { id: 'p2', name: 'Archivé', archived: true, appointments: [{ id: 'a9', title: 'Caché', date: '2026-12-02', status: 'planned' }] }];
  const ics = buildCalendar('Famille Test', profiles, '2026-11-21', new Date('2026-11-21T08:00:00Z'));
  const unfolded = ics.replace(/\r\n /g, '');

  it('produit un calendrier valide, en CRLF, nommé d’après la famille', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(unfolded).toContain('X-WR-CALNAME:Carnet · Famille Test');
    expect(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });
  it('contient le rendez-vous à l’heure saisie, son lieu et seulement ses rappels actifs', () => {
    expect(unfolded).toContain('UID:appt-a1@carnet');
    expect(unfolded).toContain('SUMMARY:Vaccin · Poki');
    expect(unfolded).toContain('DTSTART:20261201T103000');
    expect(unfolded).toContain('DTEND:20261201T113000');
    expect(unfolded).toContain('LOCATION:Clinique\\, Paris');
    expect(unfolded.match(/TRIGGER:-P7D/g)).toHaveLength(1);
    expect(unfolded).not.toContain('TRIGGER:-P2D');
  });
  it('ajoute les échéances sans rendez-vous, avec une alerte « prendre rendez-vous »', () => {
    expect(unfolded).toContain('SUMMARY:Échéance : Vermifuge · Poki');
    expect(unfolded).toContain('DTSTART;VALUE=DATE:20270110');
    expect(unfolded).not.toContain('Échéance : Vaccin');
  });
  it('écarte les rendez-vous annulés, trop anciens et les profils archivés', () => {
    expect(unfolded).not.toContain('Annulé');
    expect(unfolded).not.toContain('Ancien');
    expect(unfolded).not.toContain('Caché');
  });
});

describe('rendez-vous commun dans l’agenda', () => {
  it('un seul événement pour tous les membres', () => {
    const a = (id: string) => ({ id, title: 'Vermifuge', date: '2026-12-01', status: 'planned', groupId: 'g1', reminders: [] });
    const ics = buildCalendar('F', [{ id: 'h1', name: 'Hercule', appointments: [a('a1')] }, { id: 'h2', name: 'Tornade', appointments: [a('a2')] }], '2026-11-21').replace(/\r\n /g, '');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).toContain('UID:appt-g-g1@carnet');
    expect(ics).toContain('SUMMARY:Vermifuge · Hercule\\, Tornade');
  });
});
