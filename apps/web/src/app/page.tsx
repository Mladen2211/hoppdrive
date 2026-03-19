'use client';

import { useState, useEffect, useMemo } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { HeroSection } from '@/components/b2c/HeroSection';
import { WhyHoppDrive } from '@/components/b2c/WhyHoppDrive';
import { HowItWorks } from '@/components/b2c/HowItWorks';
import { FleetSection } from '@/components/b2c/FleetSection';
import { PricingSection } from '@/components/b2c/PricingSection';
import { SocialProof } from '@/components/b2c/SocialProof';
import { FaqSection } from '@/components/b2c/FaqSection';
import { ContactForm } from '@/components/b2c/ContactForm';
import { MapSection } from '@/components/b2c/MapSection';
import { api } from '@/lib/api';
import type { VehicleCardData } from '@/components/b2c/VehicleCard';

interface SectionConfig {
  sectionKey: string;
  isActive: boolean;
  sortOrder: number;
  content: Record<string, any>;
}

export default function HomePage() {
  const [vehicles, setVehicles] = useState<VehicleCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [pricingConfig, setPricingConfig] = useState<any>(null);
  const [sections, setSections] = useState<SectionConfig[]>([]);
  const [sectionsLoaded, setSectionsLoaded] = useState(false);

  useEffect(() => {
    api.getVehicles()
      .then((data) => setVehicles(data))
      .catch(() => setVehicles([]))
      .finally(() => setLoading(false));

    api.getSetting('pricing')
      .then((data) => setPricingConfig(data))
      .catch(() => {});

    api.getHomepageSections()
      .then((data) => setSections(data))
      .catch(() => setSections([]))
      .finally(() => setSectionsLoaded(true));
  }, []);

  const handleInquire = (vehicle: VehicleCardData) => {
    setSelectedVehicle(`${vehicle.brand} ${vehicle.model}`);
    document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const vehicleNames = vehicles.map((v) => `${v.brand} ${v.model}`);

  // Build a map of sectionKey → content for quick lookup
  const sectionMap = useMemo(() => {
    const map: Record<string, Record<string, any>> = {};
    for (const s of sections) {
      map[s.sectionKey] = s.content as Record<string, any>;
    }
    return map;
  }, [sections]);

  // Active section keys in sorted order
  const activeSections = useMemo(() => {
    if (!sectionsLoaded || sections.length === 0) {
      // Fallback: show all sections in default order if API hasn't loaded yet
      return ['hero', 'why_hoppdrive', 'fleet', 'how_it_works', 'pricing', 'social_proof', 'faq', 'contact', 'map'];
    }
    return sections
      .filter((s) => s.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => s.sectionKey);
  }, [sections, sectionsLoaded]);

  const renderSection = (key: string) => {
    const content = sectionMap[key] || {};
    switch (key) {
      case 'hero':
        return <HeroSection key={key} content={content} />;
      case 'why_hoppdrive':
        return <WhyHoppDrive key={key} content={content} />;
      case 'fleet':
        return <FleetSection key={key} vehicles={vehicles} loading={loading} onInquire={handleInquire} content={content} />;
      case 'how_it_works':
        return <HowItWorks key={key} content={content} />;
      case 'pricing':
        return <PricingSection key={key} config={pricingConfig} content={content} />;
      case 'social_proof':
        return <SocialProof key={key} content={content} />;
      case 'faq':
        return <FaqSection key={key} content={content} />;
      case 'contact':
        return (
          <ContactForm
            key={key}
            preselectedVehicle={selectedVehicle}
            vehicleNames={vehicleNames}
            content={content}
          />
        );
      case 'map':
        return <MapSection key={key} content={content} />;
      default:
        return null;
    }
  };

  return (
    <>
      <Navbar />
      <main className="flex-1">
        {activeSections.map(renderSection)}
      </main>
      <Footer />
    </>
  );
}
