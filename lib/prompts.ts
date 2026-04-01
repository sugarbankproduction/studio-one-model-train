// lib/prompts.ts — client-safe, no Node.js imports

export const DEFAULT_PROMPT = `You are annotating military training footage of LCAC (Landing Craft Air Cushion) hovercraft operations for an AI model training dataset.

Watch this 5-second clip and write a single, dense descriptive caption (2-4 sentences) covering:
- What is happening (action, motion, activity)
- Camera angle and framing (wide shot, close-up, tracking shot, etc.)
- Environmental conditions (water, beach, dock, time of day, weather if visible)
- Any notable details (personnel, wake patterns, ramp position, cargo, etc.)

Be specific and factual. Do not speculate. Do not reference time codes.`
