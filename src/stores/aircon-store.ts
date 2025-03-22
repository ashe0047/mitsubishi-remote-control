import { AirConSettings, AirConState } from "@/lib/mqtt/mqtt-config";
import { MqttClient } from "mqtt";
import { createStore } from "zustand";

type AirconsType = Record<
	string,
	{ settings: AirConSettings; state: AirConState }
>;
export interface AirconProps {
	client: MqttClient | null;
	isConnected: boolean;
}
export interface AirconStoreState extends AirconProps {
	setClient: (client: MqttClient) => void;
	setIsConnected: (connected: boolean) => void;
	aircons: AirconsType;
	setAircon: (
		roomId: string,
		settings: AirConSettings,
		state: AirConState
	) => void;
	updateState: (roomId: string, newState: Partial<AirConState>) => void;
	getAirconForRoom: (roomId: string) => {
		settings: AirConSettings;
		state: AirConState;
	};
}

export type AirconStore = ReturnType<typeof createAirconStore>;

// this is a store creator function instead of a hook
const createAirconStore = (initProps?: Partial<AirconProps>) => {
	const DEFAULT_PROPS: AirconProps = {
		client: null,
		isConnected: false,
	};

	return createStore<AirconStoreState>()((set, get) => ({
		...DEFAULT_PROPS,
		...initProps,
		aircons: {},
		setClient: (client) =>
			set({
				client,
			}),
		setIsConnected: (connected) => set({ isConnected: connected }),
		setAircon(roomId, settings, state) {
			const aircons = get().aircons;
			aircons[roomId] = { settings, state };
			set({ aircons });
		},
		updateState(roomId, newState) {
			const aircons = get().aircons;
			aircons[roomId] = {
				...aircons[roomId],
				state: { ...aircons[roomId].state, ...newState },
			};
			set({ aircons });
		},
		getAirconForRoom(roomId: string) {
			const aircons = get().aircons;
			return aircons[roomId];
		},
	}));
};

export default createAirconStore;
