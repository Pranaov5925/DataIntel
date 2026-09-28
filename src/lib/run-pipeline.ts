import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { PipelineResult } from "./pipeline-schema";

const inputSchema = z.object({
  planId: z.string(),
  title: z.string(),
  request: z.string(),
  requiredFields: z.array(z.string()),
  geography: z.string(),
  industry: z.string(),
  target: z.string(),
});

export type RunPipelineInput = z.infer<typeof inputSchema>;
export type RunPipelineResult =
  | { success: true; data: PipelineResult }
  | { success: false; error: string };

export const runPipelineFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<RunPipelineResult> => {
    const { runGeminiPipeline } = await import("../server/pipeline-runner");
    return runGeminiPipeline(data);
  });
