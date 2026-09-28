import { useState, useEffect } from "react";
import type { PipelineResult } from "./pipeline-schema";

const STORAGE_KEY = "dataintel_pipeline_result";
let inMemoryResult: PipelineResult | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function setPipelineResult(result: PipelineResult | null) {
  inMemoryResult = result;
  if (typeof window !== "undefined") {
    try {
      if (result) {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(result));
      } else {
        window.sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn("Failed to persist pipeline result to sessionStorage:", e);
    }
  }
  notify();
}

export function getPipelineResult(): PipelineResult | null {
  if (inMemoryResult) return inMemoryResult;
  if (typeof window !== "undefined") {
    try {
      const stored = window.sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        inMemoryResult = JSON.parse(stored) as PipelineResult;
        return inMemoryResult;
      }
    } catch {
      // ignore JSON parse errors
    }
  }
  return null;
}

export function usePipelineResult(): PipelineResult | null {
  const [result, setResult] = useState<PipelineResult | null>(() => getPipelineResult());

  useEffect(() => {
    setResult(getPipelineResult());
    const handler = () => setResult(getPipelineResult());
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  return result;
}
