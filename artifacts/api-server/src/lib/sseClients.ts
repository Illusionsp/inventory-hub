import type { Response } from "express";

const clients = new Map<number, Set<Response>>();

export function registerSseClient(userId: number, res: Response): void {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId)!.add(res);
}

export function unregisterSseClient(userId: number, res: Response): void {
  clients.get(userId)?.delete(res);
  if (clients.get(userId)?.size === 0) clients.delete(userId);
}

export function pushSseToUser(userId: number, data: unknown): void {
  const userClients = clients.get(userId);
  if (!userClients?.size) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of userClients) {
    try {
      res.write(payload);
    } catch {
      userClients.delete(res);
    }
  }
}
