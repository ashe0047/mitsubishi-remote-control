"use client";
import { ThemeProvider } from "next-themes";
import { PropsWithChildren } from "react";
import { AirconContextProvider } from "./AirconProvider";
import { AppConfig } from "@/lib/config/config";
import AppConfigContext from "./AppConfig";
import useIsMounted from "@/hooks/use-mounted";

interface RootProps extends PropsWithChildren {
	appConfig: AppConfig;
}
function Root({ children, appConfig }: RootProps) {
	const isMounted = useIsMounted();
	return (
		isMounted && (
			<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
				<AppConfigContext.Provider value={appConfig}>
					<AirconContextProvider>{children}</AirconContextProvider>
				</AppConfigContext.Provider>
			</ThemeProvider>
		)
	);
}

export default Root;
