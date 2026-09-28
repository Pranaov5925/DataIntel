import { useState, useEffect } from "react";
import type { CollectionPlan } from "./workflow-schema";

const STORAGE_KEY = "dataintel_active_workflow_plan";
let inMemoryPlan: CollectionPlan | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function setActiveWorkflowPlan(plan: CollectionPlan | null) {
  inMemoryPlan = plan;
  if (typeof window !== "undefined") {
    try {
      if (plan) {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
      } else {
        window.sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn("Failed to persist plan to sessionStorage:", e);
    }
  }
  notify();
}

export function getActiveWorkflowPlan(): CollectionPlan | null {
  if (inMemoryPlan) return inMemoryPlan;
  if (typeof window !== "undefined") {
    try {
      const stored = window.sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        inMemoryPlan = JSON.parse(stored) as CollectionPlan;
        return inMemoryPlan;
      }
    } catch {
      // ignore JSON parse errors
    }
  }
  return null;
}

export function useActiveWorkflowPlan(): CollectionPlan | null {
  const [plan, setPlan] = useState<CollectionPlan | null>(() => getActiveWorkflowPlan());

  useEffect(() => {
    setPlan(getActiveWorkflowPlan());
    const handler = () => {
      setPlan(getActiveWorkflowPlan());
    };
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  return plan;
}
