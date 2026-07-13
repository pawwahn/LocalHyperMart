# Convert a markdown-ish text file to a formatted .docx using Microsoft Word COM.
# Usage: powershell -ExecutionPolicy Bypass -File .\scripts\md-to-docx.ps1 -InputFile <path> -OutputFile <path>

param(
    [Parameter(Mandatory = $true)][string]$InputFile,
    [Parameter(Mandatory = $true)][string]$OutputFile
)

$ErrorActionPreference = "Stop"

$InputFile = (Resolve-Path $InputFile).Path
$lines = Get-Content -LiteralPath $InputFile

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$doc = $word.Documents.Add()
$sel = $word.Selection

function Add-Heading($text, $level) {
    $sel.Style = $doc.Styles.Item("Heading $level")
    $sel.TypeText($text)
    $sel.TypeParagraph()
}

function Add-Body($text) {
    $sel.Style = $doc.Styles.Item("Normal")
    $sel.Font.Name = "Calibri"
    $sel.Font.Size = 11
    $sel.Font.Bold = $false
    $sel.TypeText($text)
    $sel.TypeParagraph()
}

function Add-Code($text) {
    $sel.Style = $doc.Styles.Item("Normal")
    $sel.Font.Name = "Consolas"
    $sel.Font.Size = 10
    $sel.TypeText($text)
    $sel.TypeParagraph()
    $sel.Font.Name = "Calibri"
    $sel.Font.Size = 11
}

function Strip-Md($text) {
    $t = $text -replace '\*\*(.+?)\*\*', '$1'
    $t = $t -replace '`(.+?)`', '$1'
    return $t
}

$i = 0
while ($i -lt $lines.Count) {
    $line = $lines[$i]

    # Table block: a line with pipes followed by a separator row (---|---)
    if ($line -match '^\s*\|.*\|\s*$' -and ($i + 1) -lt $lines.Count -and $lines[$i + 1] -match '^\s*\|[\s:|-]+\|\s*$') {
        $tableRows = @()
        while ($i -lt $lines.Count -and $lines[$i] -match '^\s*\|.*\|\s*$') {
            $tableRows += $lines[$i]
            $i++
        }
        $parsed = @()
        foreach ($r in $tableRows) {
            if ($r -match '^\s*\|[\s:|-]+\|\s*$') { continue }
            $cells = $r.Trim().Trim('|').Split('|') | ForEach-Object { (Strip-Md $_.Trim()) }
            $parsed += ,$cells
        }
        if ($parsed.Count -gt 0) {
            $cols = $parsed[0].Count
            $rng = $sel.Range
            $tbl = $doc.Tables.Add($rng, $parsed.Count, $cols)
            $tbl.Borders.Enable = $true
            $tbl.Style = "Table Grid"
            for ($r = 0; $r -lt $parsed.Count; $r++) {
                for ($c = 0; $c -lt $cols; $c++) {
                    $val = if ($c -lt $parsed[$r].Count) { $parsed[$r][$c] } else { "" }
                    $cell = $tbl.Cell($r + 1, $c + 1)
                    $cell.Range.Text = $val
                    if ($r -eq 0) { $cell.Range.Bold = 1 }
                }
            }
            $word.Selection.EndKey(6) | Out-Null  # wdStory
            $sel.TypeParagraph()
        }
        continue
    }

    if ($line -match '^#{1}\s+(.*)') { Add-Heading (Strip-Md $matches[1]) 1; $i++; continue }
    if ($line -match '^#{2}\s+(.*)') { Add-Heading (Strip-Md $matches[1]) 2; $i++; continue }
    if ($line -match '^#{3}\s+(.*)') { Add-Heading (Strip-Md $matches[1]) 3; $i++; continue }
    if ($line -match '^\s*---\s*$') { Add-Body ""; $i++; continue }
    if ($line -match '^ {4}(.*)') { Add-Code $matches[1]; $i++; continue }
    if ($line.Trim() -eq '') { Add-Body ""; $i++; continue }

    Add-Body (Strip-Md $line)
    $i++
}

$wdFormatDocumentDefault = 16
$doc.SaveAs([ref]$OutputFile, [ref]$wdFormatDocumentDefault)
$doc.Close()
$word.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($sel) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
Write-Host "Created: $OutputFile"
