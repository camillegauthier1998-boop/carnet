import { describe, expect, it } from 'vitest';
import { addUnit, careInfo, parisToday, remindersFor, type Profile } from '../src/reminders';

const care = (o: object = {}) => ({ id: 'c1', name: 'Vaccin', freq: { n: 1, unit: 'y' as const }, remind: { n: 1, unit: 'm' as const }, realizations: [{ date: '2025-12-15' }], ...o });
const prof = (o: Partial<Profile> = {}): Profile => ({ id: 'p1', name: 'Poki', cares: [care()], appointments: [], ...o });

describe('dates', () => {
  it('respecte la fin des mois et les années bissextiles', () => {
    expect(addUnit('2026-01-31', 1, 'm')).toBe('2026-02-28');
    expect(addUnit('2028-02-29', 1, 'y')).toBe('2029-02-28');
    expect(addUnit('2026-12-28', 1, 'w')).toBe('2027-01-04');
    expect(addUnit('2026-03-01', -1, 'd')).toBe('2026-02-28');
  });
  it('prend la date du jour à Paris', () => {
    expect(parisToday(new Date('2026-11-21T23:30:00Z'))).toBe('2026-11-22');
    expect(parisToday(new Date('2026-07-01T21:59:00Z'))).toBe('2026-07-01');
  });
  it('calcule le même état que l’interface', () => {
    expect(careInfo(care(), [], '2026-11-01')).toMatchObject({ last: '2025-12-15', due: '2026-12-15', rem: '2026-11-15', status: 'ok' });
    expect(careInfo(care(), [], '2026-11-20').status).toBe('remind');
    expect(careInfo(care({ pending: true }), [], '2026-11-20').status).toBe('pending');
    expect(careInfo(care(), [], '2026-12-16').status).toBe('overdue');
    expect(careInfo(care(), [{ id: 'a', careId: 'c1', date: '2026-12-01', status: 'planned' }], '2026-11-20').status).toBe('booked');
    expect(careInfo(care({ realizations: [] }), [], '2026-11-20').status).toBe('new');
  });
});

describe('rappels du matin', () => {
  it('rappelle de prendre rendez-vous à partir de la date de rappel, avec une clé stable', () => {
    expect(remindersFor([prof()], '2026-11-14')).toEqual([]);
    const r = remindersFor([prof()], '2026-11-15');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ key: 'rem:p1:c1:2026-12-15', title: 'Rendez-vous à prendre' });
    expect(r[0].body).toBe('Vaccin pour Poki : échéance le 15 décembre 2026.');
    expect(remindersFor([prof()], '2026-11-20')[0].key).toBe(r[0].key);
  });
  it('ne rappelle plus rien une fois le rendez-vous noté, sauf ses propres rappels', () => {
    const p = prof({ appointments: [{ id: 'a1', careId: 'c1', date: '2026-12-01', time: '10:30', place: 'Clinique', status: 'planned', reminders: [{ days: 7, on: true }, { days: 2, on: true }] }] });
    expect(remindersFor([p], '2026-11-20')).toEqual([]);
    const j7 = remindersFor([p], '2026-11-24');
    expect(j7).toEqual([{ key: 'appt:p1:a1:2026-12-01:7', title: 'Rendez-vous dans 7 jours', body: 'Vaccin pour Poki le 1er décembre à 10:30 · Clinique.', url: '/' }]);
    expect(remindersFor([p], '2026-11-29')[0]).toMatchObject({ key: 'appt:p1:a1:2026-12-01:2', title: 'Rendez-vous dans 2 jours' });
    expect(remindersFor([p], '2026-11-30')[0].title).toBe('Rendez-vous demain');
    expect(remindersFor([p], '2026-11-30')[0].body).toBe('Vaccin pour Poki à 10:30 · Clinique.');
  });
  it('un rendez-vous noté tard ne déclenche qu’un message (le rappel le plus proche)', () => {
    const p = prof({ appointments: [{ id: 'a1', title: 'Contrôle', date: '2026-11-23', status: 'planned', reminders: [{ days: 7, on: true }, { days: 2, on: true }] }] });
    const r = remindersFor([p], '2026-11-21');
    expect(r.filter((x) => x.key.startsWith('appt'))).toHaveLength(1);
    expect(r.find((x) => x.key.startsWith('appt'))!.key).toBe('appt:p1:a1:2026-11-23:2');
  });
  it('ignore les rappels désactivés, les profils archivés, les soins arrêtés et les vieilles échéances', () => {
    const off = prof({ cares: [], appointments: [{ id: 'a', title: 'X', date: '2026-11-25', status: 'planned', reminders: [{ days: 7, on: false }] }] });
    expect(remindersFor([off], '2026-11-21')).toEqual([]);
    expect(remindersFor([prof({ archived: true })], '2026-11-20')).toEqual([]);
    expect(remindersFor([prof({ cares: [care({ archived: true })] })], '2026-11-20')).toEqual([]);
    expect(remindersFor([prof()], '2026-12-20')[0].key).toBe('due:p1:c1:2026-12-15');
    expect(remindersFor([prof()], '2027-01-10')).toEqual([]);
  });
});

describe('rendez-vous commun à plusieurs membres', () => {
  const appt = (id: string) => ({ id, title: 'Vermifuge', date: '2026-12-01', status: 'planned', groupId: 'g1', reminders: [{ days: 7, on: true }] });
  const horses: Profile[] = [
    { id: 'h1', name: 'Hercule', cares: [], appointments: [appt('a1')] },
    { id: 'h2', name: 'Tornade', cares: [], appointments: [appt('a2')] },
    { id: 'h3', name: 'Éclair', cares: [], appointments: [appt('a3')] },
  ];
  it('un seul rappel, qui nomme tous les membres', () => {
    const r = remindersFor(horses, '2026-11-24');
    expect(r).toEqual([{ key: 'appt:g:g1:2026-12-01:7', title: 'Rendez-vous dans 7 jours', body: 'Vermifuge pour Hercule, Tornade et Éclair le 1er décembre.', url: '/' }]);
  });
});
