import { useEffect, useState } from "react";
import { IndexForecastChart } from "./charts/index-forecast/App";
import type { AnnualReturnsPayload } from "./types";

function withBaseUrl(path: string) {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${base}${path.replace(/^\//, "")}`;
}

export default function App() {
  const [data, setData] = useState<AnnualReturnsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const url = new URL(withBaseUrl("data/annual-returns.json"), window.location.origin);
        const response = await fetch(url.toString());
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = (await response.json()) as AnnualReturnsPayload;
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    };
    void load();
  }, []);

  if (error) {
    return (
      <div style={{ background: "#000", color: "#fff", minHeight: "100vh", padding: 24 }}>
        <div style={{ color: "#ff5b32", fontSize: 40, fontWeight: 700 }}>ERROR</div>
        <pre>{error}</pre>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ background: "#000", color: "#fff", minHeight: "100vh", padding: 24 }}>
        <div style={{ color: "#ff5b32", fontSize: 40, fontWeight: 700 }}>LOADING...</div>
      </div>
    );
  }

  return <IndexForecastChart data={data} />;
}
