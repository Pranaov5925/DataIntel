import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { PipelineResult } from "./pipeline-schema";

import { requirementUnderstandingSchema, workflowStepSchema } from "./workflow-schema";

const inputSchema = z.object({
  planId: z.string(),
  title: z.string(),
  request: z.string(),
  understanding: requirementUnderstandingSchema.optional(),
  requiredFields: z.array(z.string()).optional(),
  geography: z.string().optional(),
  industry: z.string().optional(),
  target: z.string().optional(),
  constraints: z.array(z.string()).optional(),
  freshness: z.string().optional(),
  searchIntent: z.string().optional(),
  stages: z.array(workflowStepSchema).optional(),
});

export type RunPipelineInput = z.infer<typeof inputSchema>;
export type RunPipelineResult =
  { success: true; data: PipelineResult; runId: string } | { success: false; error: string };

export const runPipelineFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<RunPipelineResult> => {
    const { runMistralPipeline } = await import("../server/pipeline-runner");
    return runMistralPipeline(data);
  });

export const startPipelineRunFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{ success: boolean; runId: string; error?: string }> => {
    const { startPipelineRun } = await import("../server/pipeline-runner");
    return startPipelineRun(data);
  });

export const getPipelineProgressFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ runId: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const { getPipelineProgress } = await import("../server/pipeline-runner");
    return getPipelineProgress(data.runId);
  });
