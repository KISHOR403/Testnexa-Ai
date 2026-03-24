$body = @{
    requirement = "User can login with email and password"
    appType     = "web"
    detailLevel = "basic"
} | ConvertTo-Json

try {
    Write-Host "Sending request..."
    $response = Invoke-WebRequest -Uri "http://localhost:5000/api/v1/generate" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 90
    
    Write-Host "`nSUCCESS!"
    Write-Host "Status: $($response.StatusCode)"
    Write-Host "`nResponse:"
    $response.Content | Out-File -FilePath "response-success.json"
    $response.Content
    
}
catch {
    Write-Host "`nERROR!"
    Write-Host "Status: $($_.Exception.Response.StatusCode.value__)"
    
    $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
    $errorBody = $reader.ReadToEnd()
    $reader.Close()
    
    Write-Host "`nError Response:"
    $errorBody | Out-File -FilePath "response-error.json"
    $errorBody
}
