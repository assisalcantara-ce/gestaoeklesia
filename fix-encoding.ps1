$utf8 = [System.Text.Encoding]::UTF8
$utf8bom = New-Object System.Text.UTF8Encoding($true)

# Tabela de substituições mojibake -> correto (baseada em UTF-8 bytes relidos como CP1252)
# Ordenar do mais longo para o mais curto para evitar substituições parciais
$replacements = [ordered]@{
    # Emojis (4-byte UTF-8 -> 4 CP1252 chars)
    ([string][char]0x00F0 + [string][char]0x0178 + [string][char]0x201C + [string][char]0x201E) = [string][char]0xD83D + [string][char]0xDCC4  # 📄
    ([string][char]0x00F0 + [string][char]0x0178 + [string][char]0x201C + [string][char]0x0161) = [string][char]0xD83D + [string][char]0xDCDA  # 📚
    ([string][char]0x00F0 + [string][char]0x0178 + [string][char]0x201C + [string][char]0x2122) = [string][char]0xD83D + [string][char]0xDCCB  # 📋
    ([string][char]0x00F0 + [string][char]0x0178 + [string][char]0x2018 + [string][char]0x00A4) = [string][char]0xD83D + [string][char]0xDC64  # 👤
    ([string][char]0x00F0 + [string][char]0x0178 + [string][char]0x2019 + [string][char]0x00B0) = [string][char]0xD83D + [string][char]0xDCB0  # 💰
    ([string][char]0x00F0 + [string][char]0x0178 + [string][char]0x2019 + [string][char]0x00A5) = [string][char]0xD83D + [string][char]0xDCB5  # 💵
    ([string][char]0x00F0 + [string][char]0x0178 + [string][char]0x2018 + [string][char]0x00A5) = [string][char]0xD83D + [string][char]0xDC65  # 👥
    ([string][char]0x00F0 + [string][char]0x0178 + [string][char]0x201D + [string][char]0x2019) = [string][char]0xD83D + [string][char]0xDD11  # 🔑
    ([string][char]0x00F0 + [string][char]0x0178 + [string][char]0x201D + [string][char]0x2026) = [string][char]0xD83D + [string][char]0xDD16  # 🔖
    ([string][char]0x00F0 + [string][char]0x0178 + [string][char]0x201D + [string][char]0x2022) = [string][char]0xD83D + [string][char]0xDD12  # 🔒
    ([string][char]0x00F0 + [string][char]0x0178 + [string][char]0x201D + [string][char]0x201C) = [string][char]0xD83D + [string][char]0xDD0C  # 🔌
    ([string][char]0x00F0 + [string][char]0x0178 + [string][char]0x201C + [string][char]0x2026) = [string][char]0xD83D + [string][char]0xDCC5  # 📅
    ([string][char]0x00F0 + [string][char]0x0178 + [string][char]0x201C + [string][char]0x008A) = [string][char]0xD83D + [string][char]0xDCCA  # 📊
    ([string][char]0x00F0 + [string][char]0x0178 + [string][char]0x0081 + [string][char]0x00A6) = [string][char]0xD83C + [string][char]0xDFE6  # 🏦
    ([string][char]0x00F0 + [string][char]0x0178 + [string][char]0x201C + [string][char]0x2020) = [string][char]0xD83D + [string][char]0xDCC6  # 📆
    ([string][char]0x00F0 + [string][char]0x0178 + [string][char]0x0081 + [string][char]0x00A4) = [string][char]0xD83C + [string][char]0xDFE4  # 🏤
    # 3-byte unicode chars mojibake
    ([string][char]0x00E2 + [string][char]0x20AC + [string][char]0x0153) = [string][char]0x0152    # Œ (rare)
    ([string][char]0x00E2 + [string][char]0x20AC + [string][char]0x2122) = [string][char]0x2122    # ™
    ([string][char]0x00E2 + [string][char]0x20AC + [string][char]0x00A2) = [string][char]0x2022    # •
    ([string][char]0x00E2 + [string][char]0x20AC + [string][char]0x201D) = [string][char]0x201D    # "
    ([string][char]0x00E2 + [string][char]0x20AC + [string][char]0x201C) = [string][char]0x201C    # "
    ([string][char]0x00E2 + [string][char]0x20AC + [string][char]0x0161) = [string][char]0x0161    # š
    ([string][char]0x00E2 + [string][char]0x20AC + [string][char]0x2018) = [string][char]0x2018    # '
    ([string][char]0x00E2 + [string][char]0x20AC + [string][char]0x2019) = [string][char]0x2019    # '
    ([string][char]0x00E2 + [string][char]0x20AC + [string][char]0x2026) = [string][char]0x2026    # …
    ([string][char]0x00E2 + [string][char]0x20AC + [string][char]0x2020) = [string][char]0x2020    # †
    ([string][char]0x00E2 + [string][char]0x20AC + [string][char]0x2021) = [string][char]0x2021    # ‡
    ([string][char]0x00E2 + [string][char]0x20AC + [string][char]0x0160) = [string][char]0x0160    # Š
    ([string][char]0x00E2 + [string][char]0x20AC + [string][char]0x201A) = [string][char]0x201A    # ‚
    ([string][char]0x00E2 + [string][char]0x20AC + [string][char]0x0192) = [string][char]0x0192    # ƒ
    ([string][char]0x00E2 + [string][char]0x20AC + [string][char]0x201E) = [string][char]0x201E    # „
    ([string][char]0x00E2 + [string][char]0x20AC + [string][char]0x201D + [string][char]0x00A4) = [string][char]0x2014  # em dash — (fallback)
    ([string][char]0x00E2 + [string][char]0x20AC + [string][char]0x201D) = [string][char]0x2014    # — em dash
    ([string][char]0x00E2 + [string][char]0x20AC + [string][char]0x201C) = [string][char]0x201C    # " (dup handled)
    ([string][char]0x00E2 + [string][char]0x20AC + [string][char]0x0096) = [string][char]0x2013    # –  en dash
    ([string][char]0x00E2 + [string][char]0x20AC + [string][char]0x0093) = [string][char]0x2013    # – en dash variant
    ([string][char]0x00E2 + [string][char]0x20AC + [string][char]0x0094) = [string][char]0x2014    # — em dash variant
    # Box drawing
    ([string][char]0x00E2 + [string][char]0x0094 + [string][char]0x20AC) = [string][char]0x2500    # ─
    # Arrows/symbols
    ([string][char]0x00E2 + [string][char]0x0096 + [string][char]0x00B2) = [string][char]0x25B2    # ▲
    ([string][char]0x00E2 + [string][char]0x0096 + [string][char]0x00BC) = [string][char]0x25BC    # ▼
    ([string][char]0x00E2 + [string][char]0x009A + [string][char]0x2122) = [string][char]0x2699    # ⚙
    ([string][char]0x00E2 + [string][char]0x009A + [string][char]0x00A0) = [string][char]0x26A0    # ⚠
    ([string][char]0x00E2 + [string][char]0x00A6 + [string][char]0x201E) = [string][char]0x2684    # rare
    ([string][char]0x00E2 + [string][char]0x0097 + [string][char]0x00A0) = [string][char]0x25E0    # rare
    ([string][char]0x00E2 + [string][char]0x00AF + [string][char]0x00BD) = [string][char]0x2E3D    # rare
    ([string][char]0x00E2 + [string][char]0x008A + [string][char]0x0095) = [string][char]0x2295    # ⊕
    ([string][char]0x00E2 + [string][char]0x0097 + [string][char]0x00BC) = [string][char]0x25FC    # ◼
    ([string][char]0x00E2 + [string][char]0x00A6 + [string][char]0x0096) = [string][char]0x2696    # ⚖
    ([string][char]0x00E2 + [string][char]0x009A + [string][char]0x00B0) = [string][char]0x26B0    # ⚰
    ([string][char]0x00E2 + [string][char]0x009C + [string][char]0x0093) = [string][char]0x2713    # ✓
    ([string][char]0x00E2 + [string][char]0x009C + [string][char]0x0097) = [string][char]0x2717    # ✗
    ([string][char]0x00E2 + [string][char]0x009D + [string][char]0x00A4) = [string][char]0x2764    # ❤
    # Bullet/circle
    ([string][char]0x00E2 + [string][char]0x00A6 + [string][char]0x02DC) = [string][char]0x2698    # rare
    ([string][char]0x00E2 + [string][char]0x009D + [string][char]0x0093) = [string][char]0x2753    # ❓
    ([string][char]0x00E2 + [string][char]0x008F + [string][char]0x00A3) = [string][char]0x23E3    # rare
    ([string][char]0x00E2 + [string][char]0x009E + [string][char]0x0085) = [string][char]0x2785    # rare
    ([string][char]0x00E2 + [string][char]0x0097 + [string][char]0x00A3) = [string][char]0x25E3    # rare
    # Variation selector ️ (U+FE0F, appears after some emojis)
    ([string][char]0x00EF + [string][char]0x00B8 + [string][char]0x008F) = [string][char]0xFE0F    # ️ variation selector
    # 2-byte Portuguese mojibake (most common)
    ([string][char]0x00C3 + [string][char]0x00A9) = [string][char]0x00E9    # é
    ([string][char]0x00C3 + [string][char]0x00A3) = [string][char]0x00E3    # ã
    ([string][char]0x00C3 + [string][char]0x00A7) = [string][char]0x00E7    # ç
    ([string][char]0x00C3 + [string][char]0x00B5) = [string][char]0x00F5    # õ
    ([string][char]0x00C3 + [string][char]0x00A1) = [string][char]0x00E1    # á
    ([string][char]0x00C3 + [string][char]0x00A0) = [string][char]0x00E0    # à
    ([string][char]0x00C3 + [string][char]0x00A2) = [string][char]0x00E2    # â
    ([string][char]0x00C3 + [string][char]0x00AA) = [string][char]0x00EA    # ê
    ([string][char]0x00C3 + [string][char]0x00AD) = [string][char]0x00ED    # í
    ([string][char]0x00C3 + [string][char]0x00B3) = [string][char]0x00F3    # ó
    ([string][char]0x00C3 + [string][char]0x00B4) = [string][char]0x00F4    # ô
    ([string][char]0x00C3 + [string][char]0x00BA) = [string][char]0x00FA    # ú
    ([string][char]0x00C3 + [string][char]0x00BC) = [string][char]0x00FC    # ü
    ([string][char]0x00C3 + [string][char]0x00B1) = [string][char]0x00F1    # ñ
    ([string][char]0x00C3 + [string][char]0x00A8) = [string][char]0x00E8    # è
    ([string][char]0x00C3 + [string][char]0x00AB) = [string][char]0x00EB    # ë
    ([string][char]0x00C3 + [string][char]0x00AF) = [string][char]0x00EF    # ï
    ([string][char]0x00C3 + [string][char]0x00B0) = [string][char]0x00F0    # ð
    ([string][char]0x00C3 + [string][char]0x00B6) = [string][char]0x00F6    # ö
    ([string][char]0x00C3 + [string][char]0x00B8) = [string][char]0x00F8    # ø
    ([string][char]0x00C3 + [string][char]0x00BB) = [string][char]0x00FB    # û
    ([string][char]0x00C3 + [string][char]0x009F) = [string][char]0x00DF    # ß
    # Uppercase accented
    ([string][char]0x00C3 + [string][char]0x0087) = [string][char]0x00C7    # Ç
    ([string][char]0x00C3 + [string][char]0x0089) = [string][char]0x00C9    # É
    ([string][char]0x00C3 + [string][char]0x0088) = [string][char]0x00C8    # È
    ([string][char]0x00C3 + [string][char]0x008A) = [string][char]0x00CA    # Ê
    ([string][char]0x00C3 + [string][char]0x0081) = [string][char]0x00C1    # Á
    ([string][char]0x00C3 + [string][char]0x0082) = [string][char]0x00C2    # Â
    ([string][char]0x00C3 + [string][char]0x0083) = [string][char]0x00C3    # Ã (capital)
    ([string][char]0x00C3 + [string][char]0x0085) = [string][char]0x00C5    # Å
    ([string][char]0x00C3 + [string][char]0x008D) = [string][char]0x00CD    # Í
    ([string][char]0x00C3 + [string][char]0x0093) = [string][char]0x00D3    # Ó
    ([string][char]0x00C3 + [string][char]0x0094) = [string][char]0x00D4    # Ô
    ([string][char]0x00C3 + [string][char]0x0095) = [string][char]0x00D5    # Õ
    ([string][char]0x00C3 + [string][char]0x009A) = [string][char]0x00DA    # Ú
    ([string][char]0x00C3 + [string][char]0x009C) = [string][char]0x00DC    # Ü
    ([string][char]0x00C3 + [string][char]0x0080) = [string][char]0x00C0    # À
    ([string][char]0x00C3 + [string][char]0x0091) = [string][char]0x00D1    # Ñ
    ([string][char]0x00C3 + [string][char]0x0097) = [string][char]0x00D7    # × (multiplication)
    ([string][char]0x00C3 + [string][char]0x009B) = [string][char]0x00DB    # Û
    ([string][char]0x00C3 + [string][char]0x009D) = [string][char]0x00DD    # Ý
    # Â + something (2-byte mojibake for chars in 0x80-0xBF range)
    ([string][char]0x00C2 + [string][char]0x00B7) = [string][char]0x00B7    # · middle dot
    ([string][char]0x00C2 + [string][char]0x00A7) = [string][char]0x00A7    # §
    ([string][char]0x00C2 + [string][char]0x00B0) = [string][char]0x00B0    # °
    ([string][char]0x00C2 + [string][char]0x00A9) = [string][char]0x00A9    # ©
    ([string][char]0x00C2 + [string][char]0x00AE) = [string][char]0x00AE    # ®
    ([string][char]0x00C2 + [string][char]0x00BD) = [string][char]0x00BD    # ½
    ([string][char]0x00C2 + [string][char]0x00BC) = [string][char]0x00BC    # ¼
    ([string][char]0x00C2 + [string][char]0x00BE) = [string][char]0x00BE    # ¾
    ([string][char]0x00C2 + [string][char]0x00AB) = [string][char]0x00AB    # «
    ([string][char]0x00C2 + [string][char]0x00BB) = [string][char]0x00BB    # »
    ([string][char]0x00C2 + [string][char]0x00A0) = [string][char]0x00A0    # NBSP
    ([string][char]0x00C2 + [string][char]0x00A3) = [string][char]0x00A3    # £
    ([string][char]0x00C2 + [string][char]0x00B1) = [string][char]0x00B1    # ±
    ([string][char]0x00C2 + [string][char]0x00B2) = [string][char]0x00B2    # ²
    ([string][char]0x00C2 + [string][char]0x00B3) = [string][char]0x00B3    # ³
    ([string][char]0x00C2 + [string][char]0x00B5) = [string][char]0x00B5    # µ
    ([string][char]0x00C2 + [string][char]0x00A6) = [string][char]0x00A6    # ¦
}

$files = Get-ChildItem -Recurse "C:\BACKUP\DESENVOLVIMENTO\gestaoeklesia\src" -Filter "*.tsx"
$totalFiles = 0; $totalLines = 0

foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName, $utf8)
    $original = $content
    foreach ($pair in $replacements.GetEnumerator()) {
        $content = $content.Replace($pair.Key, $pair.Value)
    }
    if ($content -ne $original) {
        [System.IO.File]::WriteAllText($file.FullName, $content, $utf8bom)
        $totalFiles++
        Write-Host "Corrigido: $($file.FullName -replace 'C:\\BACKUP\\DESENVOLVIMENTO\\gestaoeklesia\\src\\','')"
    }
}
Write-Host "Total: $totalFiles arquivos corrigidos"


