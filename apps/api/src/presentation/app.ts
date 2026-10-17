import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';

import type { Container } from '../infrastructure/config/container';
import { vehicleRoutes } from './routes/vehicleRoutes';
import { contactRoutes } from './routes/contactRoutes';
import { authRoutes } from './routes/authRoutes';
import { bookingRoutes } from './routes/bookingRoutes';
import { pricingRoutes } from './routes/pricingRoutes';
import { dashboardRoutes } from './routes/dashboardRoutes';
import { settingsRoutes } from './routes/settingsRoutes';
import { eventRoutes } from './routes/eventRoutes';
import { locationRoutes } from './routes/locationRoutes';
import { notificationRoutes } from './routes/notificationRoutes';
import { invoiceRoutes } from './routes/invoiceRoutes';
import { searchRoutes } from './routes/searchRoutes';
import { testimonialRoutes } from './routes/testimonialRoutes';
import { faqRoutes } from './routes/faqRoutes';
import { homepageSectionRoutes } from './routes/homepageSectionRoutes';
import { legalRoutes } from './routes/legalRoutes';
import { maintenanceRoutes } from './routes/maintenanceRoutes';
import { errorHandler } from './middleware/errorHandler';

export function createApp(container: Container): express.Application {
  const app = express();

  // ─── Global Middleware ──────────────────────────────────────
  app.use(helmet());
  // Support comma-separated allowed origins via CORS_ORIGIN env var
  const rawCors = process.env.CORS_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:99';
  const allowedOrigins = rawCors.split(',').map((s) => s.trim()).filter(Boolean);

  app.use(cors({
    origin: (origin, callback) => {
      // Allow server-to-server requests (no origin) and same-origin requests
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }));
  app.use(morgan('combined'));
  app.use(express.json({
    limit: '5mb',
    // Only capture raw body in development for debugging JSON parse issues
    verify: process.env.NODE_ENV !== 'production'
      ? (req: any, _res: any, buf: Buffer, encoding: any) => {
          try { req.rawBody = buf.toString(encoding || 'utf8'); } catch { /* ignore */ }
        }
      : undefined,
  }));
  app.use(cookieParser());

  // ─── Static Files (Uploads) ─────────────────────────────────
  const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
  app.use('/uploads', express.static(uploadDir, {
    maxAge: '365d',
    immutable: true,
  }));

  // ─── Health Check ───────────────────────────────────────────
  app.get('/api/health', async (_req, res) => {
    try {
      await container.prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', timestamp: new Date().toISOString(), database: 'ok' });
    } catch (err) {
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        database: 'unavailable',
      });
    }
  });

  // ─── API Routes ─────────────────────────────────────────────
  app.use('/api/vehicles', vehicleRoutes(container));
  app.use('/api/contact', contactRoutes(container));
  app.use('/api/auth', authRoutes(container));
  app.use('/api/bookings', bookingRoutes(container));
  app.use('/api/pricing', pricingRoutes(container));
  app.use('/api/dashboard', dashboardRoutes(container));
  app.use('/api/settings', settingsRoutes(container));
  app.use('/api/events', eventRoutes(container));
  app.use('/api/locations', locationRoutes(container));
  app.use('/api/notifications', notificationRoutes(container));
  app.use('/api/invoices', invoiceRoutes(container));
  app.use('/api/search', searchRoutes(container));
  app.use('/api/testimonials', testimonialRoutes(container));
  app.use('/api/faq', faqRoutes(container));
  app.use('/api/homepage-sections', homepageSectionRoutes(container));
  app.use('/api/legal', legalRoutes());
  app.use('/api/maintenance', maintenanceRoutes(container));

  // ─── Global Error Handler ───────────────────────────────────
  app.use(errorHandler);

  return app;
}
