import { randomUUID } from 'crypto';

export function newId(): string {
  return randomUUID().split('-')[0] + randomUUID().split('-')[0];
}
