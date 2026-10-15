import { EmailMessage } from './ports/notification.ports';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Minimal branded layout; real designs can replace this later. */
export function renderEmail(input: {
  to: string;
  subject: string;
  greetingName?: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  footnote?: string;
}): EmailMessage {
  const hello = `Hello${input.greetingName ? ` ${input.greetingName}` : ''},`;
  const body = input.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('');
  const button = input.action
    ? `<p><a href="${escapeHtml(input.action.url)}" style="background:#0b7a3e;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block">${escapeHtml(input.action.label)}</a></p>`
    : '';
  const footnote = input.footnote
    ? `<p style="color:#666;font-size:12px">${escapeHtml(input.footnote)}</p>`
    : '';
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#222">
<h2 style="color:#0b7a3e">ATUPA LMS</h2><p>${escapeHtml(hello)}</p>${body}${button}${footnote}
<p style="color:#999;font-size:12px">ATUPA: Wazobia Edition</p></div>`;
  const text = [
    hello,
    ...input.paragraphs,
    input.action ? `${input.action.label}: ${input.action.url}` : '',
    input.footnote ?? '',
  ]
    .filter(Boolean)
    .join('\n\n');
  return { to: input.to, subject: input.subject, html, text };
}
