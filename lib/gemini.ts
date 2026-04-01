// lib/gemini.ts
import { GoogleGenAI } from '@google/genai'
import fs from 'fs'
import path from 'path'

export const DEFAULT_PROMPT = `You are annotating military training footage of LCAC (Landing Craft Air Cushion) hovercraft operations for an AI model training dataset.

Watch this 5-second clip and write a single, dense descriptive caption (2-4 sentences) covering:
- What is happening (action, motion, activity)
- Camera angle and framing (wide shot, close-up, tracking shot, etc.)
- Environmental conditions (water, beach, dock, time of day, weather if visible)
- Any notable details (personnel, wake patterns, ramp position, cargo, etc.)

Be specific and factual. Do not speculate. Do not reference time codes.`

async function waitForActive(
  ai: GoogleGenAI,
  fileName: string
): Promise<void> {
  for (let i = 0; i < 30; i++) {
    const file = await ai.files.get({ name: fileName })
    if (file.state === 'ACTIVE') return
    if (file.state === 'FAILED') throw new Error(`File ${fileName} failed processing`)
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error(`Timed out waiting for file ${fileName} to become ACTIVE`)
}

export async function captionClip(
  apiKey: string,
  model: string,
  prompt: string,
  filePath: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey })

  // Upload
  const uploaded = await ai.files.upload({
    file: filePath,
    config: { mimeType: 'video/mp4' },
  })

  try {
    await waitForActive(ai, uploaded.name!)

    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            { fileData: { fileUri: uploaded.uri!, mimeType: 'video/mp4' } },
            { text: prompt },
          ],
        },
      ],
    })

    return response.text?.trim() ?? ''
  } finally {
    // Always clean up, even on error
    try {
      await ai.files.delete({ name: uploaded.name! })
    } catch {
      // non-fatal
    }
  }
}

export function writeSidecar(clipsDir: string, filename: string, caption: string): void {
  const txtPath = path.join(clipsDir, filename.replace('.mp4', '.txt'))
  fs.writeFileSync(txtPath, caption, 'utf8')
}

export function appendJsonl(clipsDir: string, filename: string, caption: string): void {
  const jsonlPath = path.join(clipsDir, 'captions.jsonl')
  const line = JSON.stringify({ file: filename, caption }) + '\n'
  fs.appendFileSync(jsonlPath, line, 'utf8')
}
