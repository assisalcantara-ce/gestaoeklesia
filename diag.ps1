$f = 'C:\BACKUP\DESENVOLVIMENTO\gestaoeklesia\src\app\configuracoes\nomenclaturas\page.tsx'
$u8 = [System.Text.Encoding]::UTF8
$c = [System.IO.File]::ReadAllText($f, $u8)
$lines = $c -split "`n"

# buscar linhas com chars não-ASCII acima de U+007F
$lineNum = 0
foreach ($line in $lines) {
    $lineNum++
    $hasNonAscii = $false
    foreach ($ch in $line.ToCharArray()) {
        if ([int][char]$ch -gt 0x7F) {
            $hasNonAscii = $true
            break
        }
    }
    if ($hasNonAscii) {
        Write-Host "=== Linha $lineNum ==="
        Write-Host $line
        # mostrar codepoints dos chars não-ASCII
        foreach ($ch in $line.ToCharArray()) {
            $cp = [int][char]$ch
            if ($cp -gt 0x7F) {
                Write-Host ("  U+{0:X4} ({1})" -f $cp, $ch)
            }
        }
    }
}
