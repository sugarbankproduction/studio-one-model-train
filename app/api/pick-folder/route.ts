// app/api/pick-folder/route.ts
import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

export async function GET() {
  const ps = `
Add-Type -AssemblyName System.Windows.Forms
$d = New-Object System.Windows.Forms.FolderBrowserDialog
$d.Description = 'Select your video clips folder'
$d.ShowNewFolderButton = $false
if ($d.ShowDialog() -eq 'OK') { Write-Output $d.SelectedPath }
`
  try {
    const result = execSync(
      `powershell -NoProfile -NonInteractive -Command "${ps.replace(/\n/g, ' ')}"`,
      { encoding: 'utf8', timeout: 60000 }
    ).trim()

    if (!result) {
      return NextResponse.json({ cancelled: true })
    }

    return NextResponse.json({ path: result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
