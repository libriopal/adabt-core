import crypto from 'crypto';

export function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function generateUUID(): string {
  return crypto.randomUUID();
}

export function deterministicHash(...parts: (string | number)[]): string {
  const combined = parts.join('||');
  return crypto.createHash('sha256').update(combined).digest('hex').substring(0, 16);
}
