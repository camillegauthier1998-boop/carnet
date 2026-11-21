import type { Env } from './types';

/** Envoi d'e-mails configuré (secret RESEND_API_KEY + variable MAIL_FROM). */
export const mailEnabled = (env: Env): boolean => !!(env.RESEND_API_KEY && env.MAIL_FROM);

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function resetEmail(name: string, link: string): { subject: string; text: string; html: string } {
  const subject = 'Carnet de santé familial : nouveau mot de passe';
  const text = `Bonjour ${name},\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :\n${link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe actuel reste valable.`;
  const html = `<p>Bonjour ${escapeHtml(name)},</p><p>Pour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :</p><p><a href="${escapeHtml(link)}">Choisir un nouveau mot de passe</a></p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe actuel reste valable.</p>`;
  return { subject, text, html };
}

export async function sendMail(env: Env, to: string, mail: { subject: string; text: string; html: string }): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject: mail.subject, text: mail.text, html: mail.html }),
  });
  if (!res.ok) throw new Error(`Envoi d'e-mail refusé : ${res.status} ${await res.text().catch(() => '')}`);
}
