"use client";
import { ThemeProvider } from "next-themes";
import { PropsWithChildren } from "react";
import { AppConfig } from "@/lib/config/config";
import AppConfigContext from "./AppConfig";
import { TooltipProvider } from "./ui/tooltip";
import { AuthProvider } from "./providers/AuthProvider";
import { DeviceWebSocketProvider } from "./providers/DeviceWebSocketProvider";

interface RootProps extends PropsWithChildren {
	appConfig: AppConfig;
}

function Root({ children, appConfig }: RootProps) {
	return (
		<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
			<TooltipProvider delayDuration={300}>
				<AuthProvider>
					<DeviceWebSocketProvider>
						<AppConfigContext.Provider value={appConfig}>
							{children}
						</AppConfigContext.Provider>
					</DeviceWebSocketProvider>
				</AuthProvider>
			</TooltipProvider>
		</ThemeProvider>
	);
}

export default Root;
