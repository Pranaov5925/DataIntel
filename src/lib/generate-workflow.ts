import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { CollectionPlan } from "./workflow-schema";

const inputSchema = z.object({
  request: z.string().min(1, "Request cannot be empty"),
  preferences: z.record(z.string()).optional(),
});

export type GenerateWorkflowResult =
  { success: true; data: CollectionPlan } | { success: false; error: string };

export const generateWorkflowFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<GenerateWorkflowResult> => {
    const { runOllamaWorkflow } = await import("../server/workflow-runner");
    return runOllamaWorkflow(data);
  });
