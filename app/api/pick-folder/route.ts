// app/api/pick-folder/route.ts
import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

export async function GET() {
  const script = `
Add-Type -AssemblyName System.Windows.Forms
$d = New-Object System.Windows.Forms.FolderBrowserDialog
$d.Description = 'Select your video clips folder'
$d.ShowNewFolderButton = $false
$d.RootFolder = 'MyComputer'
[System.Windows.Forms.Application]::EnableVisualStyles()
if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Output $d.SelectedPath
}
`.trim()

  const tmpScript = join(tmpdir(), `pick-folder-${Date.now()}.ps1`)

  try {
    writeFileSync(tmpScript, script, 'utf8')

    const result = execSync(
      `powershell -NoProfile -Sta -WindowStyle Hidden -ExecutionPolicy Bypass -File "${tmpScript}"`,
      { encoding: 'utf8', timeout: 120000 }
    ).trim()

    if (!result) {
      return NextResponse.json({ cancelled: true })
    }

    return NextResponse.json({ path: result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    try { unlinkSync(tmpScript) } catch { /* ignore */ }
  }
}
