"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface Config {
  API_URL: string;
  DB_API_URL: string;
}

const ConfigContext = createContext<Config | null>(null);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<Config | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch("/api/config");
        const data = await response.json();
        setConfig(data);
      } catch (error) {
        console.error("Failed to fetch config:", error);
      }
    };

    fetchConfig();
  }, []);

  return (
    <ConfigContext.Provider value={config}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const config = useContext(ConfigContext);
  if (!config) {
    return {
      API_URL: "",
      DB_API_URL: "",
    };
  }
  return config;
}
