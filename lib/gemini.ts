// lib/gemini.ts
import { GoogleGenAI } from '@google/genai'
import fs from 'fs'
import path from 'path'

export { DEFAULT_PROMPT } from '@/lib/prompts'

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
