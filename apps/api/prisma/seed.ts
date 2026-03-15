import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding database...');

  // ─── Admin User ──────────────────────────────────────────
  const adminPassword = await bcrypt.hash('ChangeMe123!@#', 12);
  await prisma.admin.upsert({
    where: { email: 'admin@hoppdrive.ch' },
    update: {},
    create: {
      id: uuid(),
      email: 'admin@hoppdrive.ch',
      name: 'HoppDrive Admin',
      passwordHash: adminPassword,
      mustResetPassword: true,
    },
  });
  console.log('  ✓ Admin user created (admin@hoppdrive.ch / ChangeMe123!@#)');

  // ─── Default Pricing Rules ───────────────────────────────
  await prisma.pricingRule.deleteMany();
  await prisma.pricingRule.createMany({
    data: [
      { id: uuid(), fromDay: 1, toDay: 7, discountPercent: 0 },
      { id: uuid(), fromDay: 8, toDay: 30, discountPercent: 20 },
      { id: uuid(), fromDay: 31, toDay: null, discountPercent: 40 },
    ],
  });
  console.log('  ✓ Pricing rules created (0%, 20%, 40%)');

  // ─── Sample Vehicles (affordable, practical fleet) ───────
  const vehicles = [
    {
      id: uuid(),
      brand: 'Škoda',
      model: 'Superb Combi',
      type: 'estate' as const,
      year: 2024,
      basePricePerDay: 79,
      currency: 'CHF',
      horsepower: 150,
      transmission: 'automatic' as const,
      seats: 5,
      fuelType: 'petrol' as const,
      isAvailable: true,
    },
    {
      id: uuid(),
      brand: 'Škoda',
      model: 'Octavia Combi',
      type: 'estate' as const,
      year: 2024,
      basePricePerDay: 65,
      currency: 'CHF',
      horsepower: 150,
      transmission: 'automatic' as const,
      seats: 5,
      fuelType: 'petrol' as const,
      isAvailable: true,
    },
    {
      id: uuid(),
      brand: 'Škoda',
      model: 'Octavia',
      type: 'sedan' as const,
      year: 2024,
      basePricePerDay: 59,
      currency: 'CHF',
      horsepower: 150,
      transmission: 'automatic' as const,
      seats: 5,
      fuelType: 'petrol' as const,
      isAvailable: true,
    },
    {
      id: uuid(),
      brand: 'Škoda',
      model: 'Karoq',
      type: 'suv' as const,
      year: 2024,
      basePricePerDay: 69,
      currency: 'CHF',
      horsepower: 150,
      transmission: 'automatic' as const,
      seats: 5,
      fuelType: 'petrol' as const,
      isAvailable: true,
    },
    {
      id: uuid(),
      brand: 'Škoda',
      model: 'Kodiaq',
      type: 'suv' as const,
      year: 2024,
      basePricePerDay: 85,
      currency: 'CHF',
      horsepower: 190,
      transmission: 'automatic' as const,
      seats: 7,
      fuelType: 'diesel' as const,
      isAvailable: true,
    },
    {
      id: uuid(),
      brand: 'Škoda',
      model: 'Enyaq iV',
      type: 'suv' as const,
      year: 2024,
      basePricePerDay: 89,
      currency: 'CHF',
      horsepower: 204,
      transmission: 'automatic' as const,
      seats: 5,
      fuelType: 'electric' as const,
      range: '540 km',
      isAvailable: true,
    },
    {
      id: uuid(),
      brand: 'VW',
      model: 'Golf Variant',
      type: 'estate' as const,
      year: 2024,
      basePricePerDay: 69,
      currency: 'CHF',
      horsepower: 150,
      transmission: 'automatic' as const,
      seats: 5,
      fuelType: 'petrol' as const,
      isAvailable: true,
    },
    {
      id: uuid(),
      brand: 'VW',
      model: 'Passat Variant',
      type: 'estate' as const,
      year: 2024,
      basePricePerDay: 79,
      currency: 'CHF',
      horsepower: 150,
      transmission: 'automatic' as const,
      seats: 5,
      fuelType: 'diesel' as const,
      isAvailable: true,
    },
    {
      id: uuid(),
      brand: 'VW',
      model: 'Tiguan',
      type: 'suv' as const,
      year: 2024,
      basePricePerDay: 79,
      currency: 'CHF',
      horsepower: 150,
      transmission: 'automatic' as const,
      seats: 5,
      fuelType: 'petrol' as const,
      isAvailable: true,
    },
    {
      id: uuid(),
      brand: 'SEAT',
      model: 'Leon Sportstourer',
      type: 'estate' as const,
      year: 2024,
      basePricePerDay: 59,
      currency: 'CHF',
      horsepower: 150,
      transmission: 'automatic' as const,
      seats: 5,
      fuelType: 'petrol' as const,
      isAvailable: true,
    },
    {
      id: uuid(),
      brand: 'Hyundai',
      model: 'Tucson',
      type: 'suv' as const,
      year: 2024,
      basePricePerDay: 75,
      currency: 'CHF',
      horsepower: 150,
      transmission: 'automatic' as const,
      seats: 5,
      fuelType: 'hybrid' as const,
      isAvailable: true,
    },
    {
      id: uuid(),
      brand: 'Toyota',
      model: 'Corolla Touring Sports',
      type: 'estate' as const,
      year: 2024,
      basePricePerDay: 69,
      currency: 'CHF',
      horsepower: 140,
      transmission: 'automatic' as const,
      seats: 5,
      fuelType: 'hybrid' as const,
      isAvailable: true,
    },
  ];

  for (const v of vehicles) {
    await prisma.vehicle.upsert({
      where: { id: v.id },
      update: {},
      create: v,
    });
  }
  console.log(`  ✓ ${vehicles.length} sample vehicles created`);

  console.log('\n✅ Seed complete!');
}

seed()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
