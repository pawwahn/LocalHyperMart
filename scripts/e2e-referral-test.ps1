# End-to-end referral smoke test (local dev, gateway :8080)
$ErrorActionPreference = "Stop"
$base = "http://localhost:8080"
$paymentInternal = "http://localhost:8087"

function Get-InternalWalletBalance {
    param([string]$UserId)
    $resp = Invoke-RestMethod -Uri "$paymentInternal/api/v1/internal/wallet/$UserId" -TimeoutSec 30
    return [decimal]$resp.data.balance
}

function Invoke-Api {
    param(
        [string]$Method = "GET",
        [string]$Path,
        [object]$Body = $null,
        [string]$Token = $null
    )
    $headers = @{ Accept = "application/json" }
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }
    $params = @{
        Uri         = "$base$Path"
        Method      = $Method
        Headers     = $headers
        ContentType = "application/json"
        TimeoutSec  = 45
    }
    if ($null -ne $Body) {
        $params.Body = ($Body | ConvertTo-Json -Depth 6 -Compress)
    }
    $resp = Invoke-RestMethod @params
    if ($resp.success -eq $false) {
        throw "API error on ${Path}: $($resp.message)"
    }
    return $resp.data
}

Write-Host "==> Super-admin: enable referrals"
$admin = Invoke-Api -Method POST -Path "/api/v1/auth/login" -Body @{
    phone    = "9876500900"
    password = "password"
}
$adminToken = $admin.accessToken
Invoke-Api -Method PATCH -Path "/api/v1/platform/settings" -Token $adminToken -Body @{
    referralsEnabled              = $true
    referralReferrerRewardAmount  = 50
    referralRefereeRewardAmount   = 25
    referralShareBaseUrl          = "http://localhost:5175/shop"
    referralShareMessageTemplate  = "Order local groceries. Code {code}: {link}"
} | Out-Null

Write-Host "==> Referrer (pilot buyer): fetch share code"
$referrer = Invoke-Api -Method POST -Path "/api/v1/auth/login" -Body @{
    phone    = "9876511111"
    password = "password"
}
$referrerToken = $referrer.accessToken
$referrerId = $referrer.userId
$me = Invoke-Api -Path "/api/v1/referrals/me" -Token $referrerToken
$code = $me.code
Write-Host "    Referrer user $referrerId code $code"

$refereePhone = "9876599" + (Get-Random -Minimum 100 -Maximum 999)
Write-Host "==> Register referee $refereePhone with code $code"
$regBody = @{
    phone                = $refereePhone
    password             = "Buyer@123"
    firstName            = "Ref"
    lastName             = "Test"
    acceptedTerms        = $true
    acceptedLegalVersion = 1
    referralCode         = $code
} | ConvertTo-Json -Compress
try {
    Invoke-RestMethod -Uri "$base/api/v1/auth/register" -Method POST -ContentType "application/json" -Body $regBody -TimeoutSec 60 | Out-Null
} catch {
    $msg = $_.Exception.Message
    if ($msg -notmatch "409|already registered|Conflict") {
        Write-Host "    Register warning: $msg (will try login)"
    }
}

$referee = Invoke-Api -Method POST -Path "/api/v1/auth/login" -Body @{
    phone    = $refereePhone
    password = "Buyer@123"
}
$refereeToken = $referee.accessToken
$refereeId = $referee.userId

$refereeBal = Get-InternalWalletBalance -UserId $refereeId
Write-Host "    Referee wallet balance: $refereeBal"

$referrerBalBefore = Get-InternalWalletBalance -UserId $referrerId
Write-Host "    Referrer wallet before delivery: $referrerBalBefore"

# Synthetic first delivery hook (same as order-service after markDelivered)
$fakeOrderId = [guid]::NewGuid().ToString()
Write-Host "==> Simulate first delivery (internal referral hook) order $fakeOrderId"
Invoke-RestMethod -Uri "http://localhost:8081/api/v1/internal/referrals/order-delivered" -Method POST `
    -ContentType "application/json" `
    -Body (@{ buyerId = $refereeId; orderId = $fakeOrderId } | ConvertTo-Json) | Out-Null

Start-Sleep -Seconds 1
$referrerBalAfter = Get-InternalWalletBalance -UserId $referrerId
Write-Host "    Referrer wallet after delivery: $referrerBalAfter"

$refMe = Invoke-Api -Path "/api/v1/referrals/me" -Token $refereeToken
Write-Host "    Referee hasAppliedCode: $($refMe.hasAppliedCode) code $($refMe.appliedCode)"

$okReferee = $refereeBal -ge 25
$okReferrer = $referrerBalAfter -ge ($referrerBalBefore + 50)
if ($okReferee -and $okReferrer) {
    Write-Host "`nPASS: Referral E2E (referee ₹25 on signup, referrer ₹50 on first delivery)"
    exit 0
}
Write-Host "`nFAIL: referee ok=$okReferee referrer ok=$okReferrer"
exit 1
