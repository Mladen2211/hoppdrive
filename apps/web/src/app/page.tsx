'use client';

import { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { HeroSection } from '@/components/b2c/HeroSection';
import { FleetSection } from '@/components/b2c/FleetSection';
import { PricingSection } from '@/components/b2c/PricingSection';
import { ContactForm } from '@/components/b2c/ContactForm';
import { MapSection } from '@/components/b2c/MapSection';
import { api } from '@/lib/api';
import type { VehicleCardData } from '@/components/b2c/VehicleCard';

export default function HomePage() {
  const [vehicles, setVehicles] = useState<VehicleCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [pricingConfig, setPricingConfig] = useState<any>(null);

  useEffect(() => {
    api.getVehicles()
      .then((data) => setVehicles(data))
      .catch(() => setVehicles([]))
      .finally(() => setLoading(false));

    api.getSetting('pricing')
      .then((data) => setPricingConfig(data))
      .catch(() => {});
  }, []);

  const handleInquire = (vehicle: VehicleCardData) => {
    setSelectedVehicle(`${vehicle.brand} ${vehicle.model}`);
    document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const vehicleNames = vehicles.map((v) => `${v.brand} ${v.model}`);

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <FleetSection vehicles={vehicles} loading={loading} onInquire={handleInquire} />
        <PricingSection config={pricingConfig} />
        <ContactForm
          preselectedVehicle={selectedVehicle}
          vehicleNames={vehicleNames}
        />
        <MapSection />
      </main>
      <Footer />
    </>
  );
}
