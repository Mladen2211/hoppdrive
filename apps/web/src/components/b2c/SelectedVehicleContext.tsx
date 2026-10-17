'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

interface SelectedVehicleContextType {
  selectedVehicle: string | null;
  selectVehicle: (name: string) => void;
}

const SelectedVehicleContext = createContext<SelectedVehicleContextType | null>(null);

/**
 * Shares the "Jetzt anfragen" vehicle pick between FleetSection and ContactForm,
 * which can be arbitrarily far apart in the CMS-configurable section order —
 * lifting this into a client boundary lets both stay independent server-rendered
 * section slots instead of being physically merged into one component.
 */
export function SelectedVehicleProvider({ children }: { children: ReactNode }) {
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);

  function selectVehicle(name: string) {
    setSelectedVehicle(name);
    document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <SelectedVehicleContext.Provider value={{ selectedVehicle, selectVehicle }}>
      {children}
    </SelectedVehicleContext.Provider>
  );
}

export function useSelectedVehicle() {
  const ctx = useContext(SelectedVehicleContext);
  if (!ctx) throw new Error('useSelectedVehicle must be used within SelectedVehicleProvider');
  return ctx;
}
