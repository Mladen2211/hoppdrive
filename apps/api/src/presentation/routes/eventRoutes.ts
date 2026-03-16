import { Router, Request, Response } from 'express';
import type { Container } from '../../infrastructure/config/container';
import { eventBus } from '../../infrastructure/services/EventBus';

export function eventRoutes(container: Container): Router {
  const router = Router();

  /**
   * GET /api/events — Server-Sent Events stream (admin only).
   * Auth via ?token= query param (EventSource cannot send headers).
   */
  router.get('/', (req: Request, res: Response) => {
    // Authenticate via query param
    const token = (req.query.token as string) || '';
    const payload = container.tokenService.verifyAccessToken(token);
    if (!payload) {
      res.status(401).json({ success: false, error: 'Invalid or expired token' });
      return;
    }
    // SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // disable nginx buffering
    });

    // Send initial connected event
    res.write(`data: ${JSON.stringify({ event: 'connected', timestamp: new Date().toISOString() })}\n\n`);

    // Keep-alive every 30s to prevent proxy/tunnel timeouts
    const keepAlive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 30_000);

    // Relay app events to this SSE connection
    const onEvent = (payload: { event: string; data?: unknown; timestamp: string }) => {
      res.write(`event: ${payload.event}\ndata: ${JSON.stringify(payload)}\n\n`);
    };

    eventBus.on('sse', onEvent);

    // Cleanup on client disconnect
    req.on('close', () => {
      clearInterval(keepAlive);
      eventBus.off('sse', onEvent);
    });
  });

  return router;
}
