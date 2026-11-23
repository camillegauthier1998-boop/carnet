/**
 * Calcul des échéances et des rappels côté serveur : mêmes règles que l'interface (careInfo dans public/app.js).
 * Les dates sont des chaînes AAAA-MM-JJ, sans fuseau horaire.
 */

export interface Freq { n: number; unit: 'd' | 'w' | 'm' | 'y' }
export interface Care {
  id: string; name: string; archived?: boolean; pending?: boolean;
  freq?: Freq | null; remind?: Freq | null;
  realizations?: { date: string }[];
}
export interface Appointment {
  id: string; careId?: string | null; title?: string; date: string; time?: string; place?: string; note?: string;
  status: string; reminders?: { days: number; on: boolean }[];
  /** Rendez-vous commun à plusieurs membres : même groupId sur chacun */
  groupId?: string | null;
}
export interface Profile { id: string; name: string; archived?: boolean; cares?: Care[]; appointments?: Appointment[] }

const pad = (n: number) => String(n).padStart(2, '0');
const toUTC = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const fromUTC = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** Ajoute n jours, semaines, mois ou années (fin de mois respectée : 31 janvier + 1 mois = 28 ou 29 février). */
export function addUnit(iso: string, n: number, u: Freq['unit']): string {
  const d = toUTC(iso);
  if (u === 'd') d.setUTCDate(d.getUTCDate() + n);
  else if (u === 'w') d.setUTCDate(d.getUTCDate() + 7 * n);
  else {
    const day = d.getUTCDate();
    d.setUTCDate(1);
    if (u === 'm') d.setUTCMonth(d.getUTCMonth() + n); else d.setUTCFullYear(d.getUTCFullYear() + n);
    const dim = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, dim));
  }
  return fromUTC(d);
}

export const diffDays = (a: string, b: string) => Math.round((toUTC(a).getTime() - toUTC(b).getTime()) / 864e5);

/** Date du jour en France (les rappels partent le matin, heure de Paris). */
export function parisToday(now = new Date()): string {
  const p = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const v = (t: string) => p.find((x) => x.type === t)!.value;
  return `${v('year')}-${v('month')}-${v('day')}`;
}

export const frDate = (iso: string, withYear = true) =>
  toUTC(iso).toLocaleDateString('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'long', ...(withYear ? { year: 'numeric' } : {}) }).replace(/^1 /, '1er ');

export type Status = 'stopped' | 'booked' | 'toConfirm' | 'new' | 'free' | 'overdue' | 'pending' | 'remind' | 'ok';

export function careInfo(care: Care, appts: Appointment[], today: string) {
  const dates = (care.realizations ?? []).map((r) => r.date).filter(Boolean).sort();
  const last = dates.length ? dates[dates.length - 1] : null;
  const due = care.freq && last ? addUnit(last, care.freq.n, care.freq.unit) : null;
  const rem = due ? (care.remind ? addUnit(due, -care.remind.n, care.remind.unit) : due) : null;
  const appt = appts.filter((a) => a.careId === care.id && a.status === 'planned').sort((a, b) => (a.date < b.date ? -1 : 1))[0] ?? null;
  let status: Status;
  if (care.archived) status = 'stopped';
  else if (appt) status = appt.date >= today ? 'booked' : 'toConfirm';
  else if (!last) status = 'new';
  else if (!care.freq) status = 'free';
  else if (due! < today) status = 'overdue';
  else if (rem! <= today) status = care.pending ? 'pending' : 'remind';
  else status = 'ok';
  return { last, due, rem, appt, status };
}

export const apptTitle = (a: Appointment, p: Profile) => a.title || p.cares?.find((c) => c.id === a.careId)?.name || 'Rendez-vous';

export interface Reminder { key: string; title: string; body: string; url: string }

export const andJoin = (l: string[]) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} et ${l[l.length - 1]}` : l[0] ?? '');

/** Rendez-vous à venir regroupés : un élément par rendez-vous commun, avec tous les membres concernés. */
export function apptGroups(profiles: Profile[], keep: (a: Appointment) => boolean) {
  const out: { a: Appointment; p: Profile; names: string[]; ids: string[] }[] = [];
  const seen = new Map<string, (typeof out)[number]>();
  for (const p of profiles) {
    if (p.archived) continue;
    for (const a of p.appointments ?? []) {
      if (!keep(a)) continue;
      const g = a.groupId ? seen.get(a.groupId) : undefined;
      if (g) { g.names.push(p.name); g.ids.push(a.id); continue; }
      const item = { a, p, names: [p.name], ids: [a.id] };
      if (a.groupId) seen.set(a.groupId, item);
      out.push(item);
    }
  }
  return out;
}

/** Une échéance dépassée n'est signalée que si elle date de moins d'une semaine (pas d'avalanche à la mise en service). */
const OVERDUE_WINDOW = 7;

/**
 * Rappels à envoyer aujourd'hui pour une famille. Chaque rappel a une clé stable :
 * l'appelant n'envoie que les clés pas encore envoyées, ce qui rattrape aussi un matin manqué.
 */
export function remindersFor(profiles: Profile[], today: string): Reminder[] {
  const out: Reminder[] = [];
  for (const p of profiles) {
    if (p.archived) continue;
    const appts = p.appointments ?? [];
    for (const c of p.cares ?? []) {
      const i = careInfo(c, appts, today);
      if (!i.due) continue;
      if (i.status === 'remind' || i.status === 'pending') {
        out.push({
          key: `rem:${p.id}:${c.id}:${i.due}`, title: 'Rendez-vous à prendre',
          body: `${c.name} pour ${p.name} : échéance le ${frDate(i.due)}.`, url: '/',
        });
      } else if (i.status === 'overdue' && diffDays(today, i.due) <= OVERDUE_WINDOW) {
        out.push({
          key: `due:${p.id}:${c.id}:${i.due}`, title: 'Échéance dépassée',
          body: `${c.name} pour ${p.name} était prévu le ${frDate(i.due)}.`, url: '/',
        });
      }
    }
  }
  // Rendez-vous : un seul message pour un rendez-vous commun à plusieurs membres
  for (const { a, p, names } of apptGroups(profiles, (x) => x.status === 'planned' && x.date >= today)) {
      // Plusieurs rappels le même jour (rendez-vous noté tard) : un seul message, le plus proche
      const due = (a.reminders ?? []).filter((r) => r.on && addUnit(a.date, -r.days, 'd') <= today).sort((x, y) => x.days - y.days);
      if (!due.length) continue;
      const n = diffDays(a.date, today);
      const when = n === 0 ? 'aujourd’hui' : n === 1 ? 'demain' : `dans ${n} jours`;
      out.push({
        key: a.groupId ? `appt:g:${a.groupId}:${a.date}:${due[0].days}` : `appt:${p.id}:${a.id}:${a.date}:${due[0].days}`,
        title: `Rendez-vous ${when}`,
        body: `${apptTitle(a, p)} pour ${andJoin(names)}${n > 1 ? ` le ${frDate(a.date, false)}` : ''}${a.time ? ` à ${a.time}` : ''}${a.place ? ` · ${a.place}` : ''}.`,
        url: '/',
      });
  }
  return out;
}
