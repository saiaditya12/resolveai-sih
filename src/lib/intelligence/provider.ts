import OpenAI from "openai";
import {
  complaintAnalysisResponseFormat,
  complaintAnalysisSystemPrompt,
  createComplaintAnalysisUserMessage,
} from "./prompts.ts";
import { GROQ_API_BASE_URL } from "./provider-config.ts";
import type { ComplaintAnalysisInput } from "./input.ts";

export interface ComplaintAnalysisProviderOptions {
  apiKey: string;
  model: string;
  fetch?: typeof fetch;
}

export async function requestComplaintAnalysis(
  complaint: ComplaintAnalysisInput,
  options: ComplaintAnalysisProviderOptions,
): Promise<unknown> {
  const client = new OpenAI({
    apiKey: options.apiKey,
    baseURL: GROQ_API_BASE_URL,
    timeout: 20_000,
    maxRetries: 0,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  const response = await client.responses.create({
    model: options.model,
    input: [
      { role: "system", content: complaintAnalysisSystemPrompt },
      {
        role: "user",
        content: createComplaintAnalysisUserMessage(complaint),
      },
    ],
    text: {
      format: complaintAnalysisResponseFormat,
    },
  });

  const output = response.output_text.trim();
  if (!output) throw new Error("The model returned an empty result.");
  return JSON.parse(output) as unknown;
}
