// lib/configContext.ts
import { AppConfig } from "@/lib/config/config";
import { createContext, useContext } from "react";

const AppConfigContext = createContext<AppConfig | undefined>(undefined);

export function useConfig() {
  const context = useContext(AppConfigContext);
  if (!context) {
    throw new Error("useConfig must be used within a ConfigProvider");
  }
  return context;
}

export default AppConfigContext;