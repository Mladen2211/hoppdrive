import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

/**
 * Generic Zod validation middleware factory.
 */
export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details: Record<string, string[]> = {};
      result.error.issues.forEach((issue) => {
        const path = issue.path.join('.');
        if (!details[path]) details[path] = [];
        details[path].push(issue.message);
      });

      res.status(422).json({
        success: false,
        error: 'Validation failed',
        details,
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

// ─── Schemas ────────────────────────────────────────────────────

export const createVehicleSchema = z.object({
  brand: z.string().min(1, 'Brand is required'),
  model: z.string().min(1, 'Model is required'),
  type: z.enum(['sedan', 'suv', 'estate', 'coupe', 'convertible', 'electric', 'van']),
  year: z.number().int().min(1990).max(new Date().getFullYear() + 2),
  basePricePerDay: z.number().positive('Price must be positive'),
  specs: z.object({
    horsepower: z.number().int().min(0),
    transmission: z.enum(['automatic', 'manual']),
    seats: z.number().int().min(1).max(12),
    fuelType: z.enum(['petrol', 'diesel', 'electric', 'hybrid']),
    range: z.string().optional(),
  }),
});

export const updateVehicleSchema = createVehicleSchema.partial().extend({
  isAvailable: z.boolean().optional(),
});

export const createContactRequestSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(7, 'Valid phone number is required'),
  vehicleOfInterest: z.string().optional(),
  message: z.string().min(1, 'Message is required'),
  privacyConsent: z.literal(true, {
    errorMap: () => ({ message: 'Privacy consent is required' }),
  }),
  marketingConsent: z.boolean().default(false),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(12, 'Password must be at least 12 characters'),
});

export const createBookingSchema = z.object({
  vehicleId: z.string().uuid(),
  customerName: z.string().min(1, 'Customer name is required'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  notes: z.string().optional(),
});

export const pricingQuerySchema = z.object({
  vehicleId: z.string().uuid(),
  totalDays: z.number().int().positive(),
});
