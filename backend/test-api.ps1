$body = @{
    requirement = "User can login with email and password"
    appType     = "web"
    detailLevel = "basic"
} | ConvertTo-Json

try {
    Write-Host "Sending request to backend..."
    Write-Host "Request body: $body"
    
    $response = Invoke-WebRequest -Uri "http://localhost:5000/api/v1/generate" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 60
    
    Write-Host "Success! Status Code: $($response.StatusCode)"
    Write-Host "Response:"
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
    
}
catch {
    Write-Host "Error occurred!"
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)"
    
    if ($_.ErrorDetails.Message) {
        Write-Host "Error Message:"
        $_.ErrorDetails.Message
    }
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $reader.DiscardBufferedData()
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body:"
        $responseBody
    }
}
