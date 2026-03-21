# Script para executar SQL no Supabase via API

$supabaseUrl = $env:NEXT_PUBLIC_SUPABASE_URL
$serviceRoleKey = $env:SUPABASE_SERVICE_ROLE_KEY

# Ler o arquivo SQL
$sqlFile = "supabase/migrations/20260102200944_initial_schema.sql"
$sqlContent = Get-Content -Path $sqlFile -Raw

# Headers
$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $serviceRoleKey"
}

# Endpoint
$endpoint = "$supabaseUrl/rest/v1/rpc/sql_execute"

# Body
$body = @{
    query = $sqlContent
} | ConvertTo-Json

# Enviar
Write-Host "🚀 Enviando SQL para Supabase..."
$response = Invoke-WebRequest -Uri $endpoint -Method POST -Headers $headers -Body $body -ErrorAction SilentlyContinue

if ($response.StatusCode -eq 200) {
    Write-Host "✅ SQL executado com sucesso!"
    $response.Content | ConvertFrom-Json | Out-String | Write-Host
} else {
    Write-Host "❌ Erro ao executar SQL: $($response.StatusCode)"
    $response.Content | Write-Host
}
