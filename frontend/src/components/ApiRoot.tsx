"use client";
import { ThemeProvider } from "next-themes";
import { PropsWithChildren } from "react";
import { AppConfig } from "@/lib/config/config";
import AppConfigContext from "./AppConfig";

interface ApiRootProps extends PropsWithChildren {
  appConfig: AppConfig;
}

/**
 * ApiRoot - Global app context provider
 *
 * NOTE: ApiAirconProvider is NOT included here because it requires a roomId.
 * Room-specific pages should wrap their content with ApiAirconProvider and pass the roomId.
 */
function ApiRoot({ children, appConfig }: ApiRootProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AppConfigContext.Provider value={appConfig}>
        {children}
      </AppConfigContext.Provider>
    </ThemeProvider>
  );
}

export default ApiRoot;