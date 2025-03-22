import { AirconContext } from "@/components/AirconProvider";
import { useContext } from "react";
import { useStore } from "zustand";

export const useAirconContext = () => {
	const airconStore = useContext(AirconContext);
	if (!airconStore) throw new Error("Missing AirconContext.Provider in tree");
	return useStore(airconStore);
};
