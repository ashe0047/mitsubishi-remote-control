import { useContext } from "react";
import { useStore } from "zustand";
import { ApiAirconContext } from "@/components/AirconProvider";
import { ApiAirconStoreState } from "@/stores/api-aircon-store";

export const useAirconStore = <T>(selector: (state: ApiAirconStoreState) => T) => {
  const store = useContext(ApiAirconContext);
  if (!store) {
    throw new Error('useApiAirconStore must be used within ApiAirconProvider');
  }
  return useStore(store, selector);
};