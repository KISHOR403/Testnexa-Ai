$body = @{
    requirement = "User can login with email and password"
    appType     = "web"
    detailLevel = "basic"
} | ConvertTo-Json

Write-Host "Testing backend with new API key..."
Write-Host "Sending request..."

try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/api/v1/generate" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 90
    
    Write-Host "`n✅ SUCCESS!"
    Write-Host "Status: $($response.StatusCode)"
    Write-Host "`nResponse:"
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
    
}
catch {
    Write-Host "`n❌ ERROR!"
    Write-Host "Status: $($_.Exception.Response.StatusCode.value__)"
    
    try {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        $errorBody = $reader.ReadToEnd()
        $reader.Close()
        Write-Host "`nError Details:"
        $errorBody
    }
    catch {
        Write-Host "Could not read error details"
    }
}
