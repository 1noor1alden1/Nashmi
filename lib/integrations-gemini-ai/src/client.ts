import { GoogleGenAI } from "@google/genai";

const apiKey =
  process.env.GEMINI_API_KEY ||
  process.env.AI_INTEGRATIONS_GEMINI_API_KEY;

const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;

// Create the client only when an API key is available.
export const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      ...(baseUrl
        ? {
            httpOptions: {
              baseUrl,
            },
          }
        : {}),
    })
  : new Proxy({} as GoogleGenAI, {
      get() {
        throw new Error(
          "Gemini AI is not configured. Set GEMINI_API_KEY to enable AI features."
        );
      },
    });