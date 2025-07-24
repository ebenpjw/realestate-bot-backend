try {
    $response = Invoke-RestMethod -Uri 'http://localhost:4040/api/tunnels' -TimeoutSec 5
    $tunnel = $response.tunnels | Where-Object { $_.config.addr -eq 'http://localhost:8080' } | Select-Object -First 1
    if ($tunnel) {
        Write-Host $tunnel.public_url
    } else {
        Write-Host 'No tunnel found'
    }
} catch {
    Write-Host 'ngrok not running'
}
