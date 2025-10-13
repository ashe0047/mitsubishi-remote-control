"use client";

import React, { PropsWithChildren, useRef } from 'react';
import { ApiAirconContext } from '@/components/AirconProvider';
import createDemoAirconStore, { DemoAirconStore } from '@/stores/demo-aircon-store';

type DemoAirconProviderProps = PropsWithChildren;

/**
 * Demo Aircon Provider
 * Provides mock AC data through the same ApiAirconContext interface
 * This allows existing components to work with demo data without modification
 */
export const DemoAirconProvider: React.FC<DemoAirconProviderProps> = ({
  children,
}) => {
  const demoStore = useRef<DemoAirconStore | undefined>(undefined);

  if (!demoStore.current) {
    demoStore.current = createDemoAirconStore();
  }

  return (
    <ApiAirconContext.Provider value={demoStore.current as never}>
      {children}
    </ApiAirconContext.Provider>
  );
};
