# Seeds up to 3 real product photos per master item (Unsplash / Pixabay).
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\seed-master-images.ps1

$ErrorActionPreference = "Stop"
$Storage = Join-Path $env:USERPROFILE ".hyperlocalmart\media"
New-Item -ItemType Directory -Force -Path $Storage | Out-Null

$Headers = @{
  "User-Agent" = "LocalHyperMart/1.0 (local-dev; seed-master-images)"
  "Accept"     = "image/*,*/*"
}

function U([string]$id) {
  "https://images.unsplash.com/$id`?auto=format&fit=crop&w=640&h=640&q=80"
}

# Category pools of verified real photos (used to fill slots 2 and 3).
$Pools = @{
  veg = @(
    (U "photo-1546094096-0df4bcaaa337"),
    (U "photo-1508747703725-719777637510"),
    (U "photo-1518977956812-cd3dbadaaf31"),
    (U "photo-1598170845058-32b9d6a5da37"),
    (U "photo-1583663848850-46af132dc08e"),
    (U "photo-1590502593747-42a996133562"),
    (U "photo-1604977042946-1eecc30f269e"),
    (U "photo-1563565375-f3fdfdbefa83"),
    (U "photo-1576045057995-568f588f82fb"),
    (U "photo-1567375698348-5d9d5ae99de0"),
    (U "photo-1618375569909-3c8616cf7733"),
    (U "photo-1594282486552-05b4d80fbb9f"),
    (U "photo-1566842600175-97dca489844f"),
    (U "photo-1512621776951-a57141f2eefd"),
    (U "photo-1498837167922-ddd27525d352"),
    (U "photo-1540420773420-3366772f4999"),
    (U "photo-1542838132-92c53300491e"),
    "https://cdn.pixabay.com/photo/2017/09/16/19/21/salad-2756467_640.jpg",
    "https://cdn.pixabay.com/photo/2016/08/11/08/04/vegetables-1584999_640.jpg"
  )
  dairy = @(
    (U "photo-1563636619-e9143da7973b"),
    (U "photo-1488477181946-6428a0291777"),
    (U "photo-1589985270826-4b7bb135bc9d"),
    (U "photo-1486297678162-eb2a19b0a32d"),
    (U "photo-1550583724-b2692b85b150"),
    (U "photo-1571212515416-fef01fc43637"),
    (U "photo-1559181567-c3190ca9959b"),
    (U "photo-1571115177098-24ec42ed204d")
  )
  snack = @(
    (U "photo-1558961363-fa8fdf82db35"),
    (U "photo-1566478989037-eec170784d0b"),
    (U "photo-1599490659213-e2b9527bd087"),
    (U "photo-1599599810769-bcde5a160d32"),
    (U "photo-1571771894821-ce9b6c11b08e"),
    (U "photo-1511381939415-e44015466834"),
    (U "photo-1612929633738-8fe44f7ec841"),
    (U "photo-1551754655-cd27e38d2076"),
    (U "photo-1551024506-0bccd828d307"),
    (U "photo-1569718212165-3a8278d5f624"),
    (U "photo-1509440159596-0249088772ff")
  )
  drink = @(
    (U "photo-1554866585-cd94860890b7"),
    (U "photo-1548839140-29a749e1cf4d"),
    (U "photo-1564890369478-c89ca6d9cde9"),
    (U "photo-1625772299848-391b6a87d7b3"),
    (U "photo-1559056199-641a0ac8b55e"),
    (U "photo-1621506289937-a8e4df240d0b"),
    (U "photo-1572490122747-3968b75cc699"),
    (U "photo-1621263764928-df1444c5e859"),
    (U "photo-1470337458703-46ad1756a187"),
    (U "photo-1604719312566-8912e9227c6a")
  )
  staple = @(
    (U "photo-1586201375761-83865001e31c"),
    (U "photo-1615485290382-441e4d049cb5"),
    (U "photo-1574323347407-f5e1ad6d020b"),
    (U "photo-1608571423902-eed4a5ad8108"),
    (U "photo-1587049352846-4a222e784d38"),
    (U "photo-1536304993881-ff6e9eefa2a6"),
    (U "photo-1606923829579-0cb981a83e2e"),
    (U "photo-1615484477778-ca3b77940c25"),
    (U "photo-1550989460-0adf9ea622e2")
  )
}

$Products = @(
  @{ Id = "f1111111-1111-4111-8111-111111111111"; Name = "Tomato"; Cat = "veg"; Url = (U "photo-1546094096-0df4bcaaa337") },
  @{ Id = "f2222222-2222-4222-8222-222222222222"; Name = "Onion"; Cat = "veg"; Url = (U "photo-1508747703725-719777637510") },
  @{ Id = "f3333333-3333-4333-8333-333333333333"; Name = "Rice"; Cat = "staple"; Url = (U "photo-1586201375761-83865001e31c") },
  @{ Id = "f0100001-0001-4001-8001-000000000001"; Name = "Potato"; Cat = "veg"; Url = (U "photo-1518977956812-cd3dbadaaf31") },
  @{ Id = "f0100002-0002-4002-8002-000000000002"; Name = "Carrot"; Cat = "veg"; Url = (U "photo-1598170845058-32b9d6a5da37") },
  @{ Id = "f0100003-0003-4003-8003-000000000003"; Name = "Green Chilli"; Cat = "veg"; Url = (U "photo-1583663848850-46af132dc08e") },
  @{ Id = "f0100004-0004-4004-8004-000000000004"; Name = "Lemon"; Cat = "veg"; Url = (U "photo-1590502593747-42a996133562") },
  @{ Id = "f0100005-0005-4005-8005-000000000005"; Name = "Cucumber"; Cat = "veg"; Url = (U "photo-1604977042946-1eecc30f269e") },
  @{ Id = "f0100006-0006-4006-8006-000000000006"; Name = "Capsicum"; Cat = "veg"; Url = (U "photo-1563565375-f3fdfdbefa83") },
  @{ Id = "f0100011-0011-4011-8011-000000000011"; Name = "Spinach"; Cat = "veg"; Url = (U "photo-1576045057995-568f588f82fb") },
  @{ Id = "f0100012-0012-4012-8012-000000000012"; Name = "Cluster Beans"; Cat = "veg"; Url = (U "photo-1567375698348-5d9d5ae99de0") },
  @{ Id = "f0100013-0013-4013-8013-000000000013"; Name = "Coriander"; Cat = "veg"; Url = (U "photo-1618375569909-3c8616cf7733") },
  @{ Id = "f0100021-0021-4021-8021-000000000021"; Name = "Cabbage"; Cat = "veg"; Url = (U "photo-1594282486552-05b4d80fbb9f") },
  @{ Id = "f0100022-0022-4022-8022-000000000022"; Name = "Cauliflower"; Cat = "veg"; Url = (U "photo-1566842600175-97dca489844f") },
  @{ Id = "f0100023-0023-4023-8023-000000000023"; Name = "Brinjal"; Cat = "veg"; Url = "https://cdn.pixabay.com/photo/2017/09/16/19/21/salad-2756467_640.jpg" },
  @{ Id = "f0100024-0024-4024-8024-000000000024"; Name = "Ladies Finger"; Cat = "veg"; Url = "https://cdn.pixabay.com/photo/2016/08/11/08/04/vegetables-1584999_640.jpg" },
  @{ Id = "f0200001-0001-4001-8001-000000000101"; Name = "Toned Milk 500ml"; Cat = "dairy"; Url = (U "photo-1563636619-e9143da7973b") },
  @{ Id = "f0200002-0002-4002-8002-000000000102"; Name = "Curd 400g"; Cat = "dairy"; Url = (U "photo-1488477181946-6428a0291777") },
  @{ Id = "f0200003-0003-4003-8003-000000000103"; Name = "Butter 100g"; Cat = "dairy"; Url = (U "photo-1589985270826-4b7bb135bc9d") },
  @{ Id = "f0200011-0011-4011-8011-000000000111"; Name = "Paneer 200g"; Cat = "dairy"; Url = (U "photo-1486297678162-eb2a19b0a32d") },
  @{ Id = "f0200012-0012-4012-8012-000000000112"; Name = "Ghee 200ml"; Cat = "dairy"; Url = (U "photo-1589985270826-4b7bb135bc9d") },
  @{ Id = "f0200013-0013-4013-8013-000000000113"; Name = "Buttermilk 200ml"; Cat = "dairy"; Url = (U "photo-1550583724-b2692b85b150") },
  @{ Id = "f0200021-0021-4021-8021-000000000121"; Name = "Full Cream Milk 1L"; Cat = "dairy"; Url = (U "photo-1563636619-e9143da7973b") },
  @{ Id = "f0200022-0022-4022-8022-000000000122"; Name = "Cheese Cubes 200g"; Cat = "dairy"; Url = (U "photo-1486297678162-eb2a19b0a32d") },
  @{ Id = "f0200023-0023-4023-8023-000000000123"; Name = "Flavoured Yogurt 100g"; Cat = "dairy"; Url = (U "photo-1571212515416-fef01fc43637") },
  @{ Id = "f0300001-0001-4001-8001-000000000201"; Name = "Parle-G Biscuits 800g"; Cat = "snack"; Url = (U "photo-1558961363-fa8fdf82db35") },
  @{ Id = "f0300002-0002-4002-8002-000000000202"; Name = "Lays Classic Chips 52g"; Cat = "snack"; Url = (U "photo-1566478989037-eec170784d0b") },
  @{ Id = "f0300003-0003-4003-8003-000000000203"; Name = "Mixture Namkeen 200g"; Cat = "snack"; Url = (U "photo-1599490659213-e2b9527bd087") },
  @{ Id = "f0300004-0004-4004-8004-000000000204"; Name = "Good Day Cookies 200g"; Cat = "snack"; Url = (U "photo-1558961363-fa8fdf82db35") },
  @{ Id = "f0300011-0011-4011-8011-000000000211"; Name = "Peanut Chikki 100g"; Cat = "snack"; Url = (U "photo-1599599810769-bcde5a160d32") },
  @{ Id = "f0300012-0012-4012-8012-000000000212"; Name = "Banana Chips 150g"; Cat = "snack"; Url = (U "photo-1571771894821-ce9b6c11b08e") },
  @{ Id = "f0300013-0013-4013-8013-000000000213"; Name = "Chocolate Wafer 75g"; Cat = "snack"; Url = (U "photo-1511381939415-e44015466834") },
  @{ Id = "f0300021-0021-4021-8021-000000000221"; Name = "Maggi Noodles 70g"; Cat = "snack"; Url = (U "photo-1612929633738-8fe44f7ec841") },
  @{ Id = "f0300022-0022-4022-8022-000000000222"; Name = "Kurkure Masala 90g"; Cat = "snack"; Url = (U "photo-1551754655-cd27e38d2076") },
  @{ Id = "f0300023-0023-4023-8023-000000000223"; Name = "Murruku Pack 200g"; Cat = "snack"; Url = (U "photo-1599490659213-e2b9527bd087") },
  @{ Id = "f0400001-0001-4001-8001-000000000301"; Name = "Thums Up 750ml"; Cat = "drink"; Url = (U "photo-1554866585-cd94860890b7") },
  @{ Id = "f0400002-0002-4002-8002-000000000302"; Name = "Bisleri Water 1L"; Cat = "drink"; Url = (U "photo-1548839140-29a749e1cf4d") },
  @{ Id = "f0400003-0003-4003-8003-000000000303"; Name = "Tea Dust 250g"; Cat = "drink"; Url = (U "photo-1564890369478-c89ca6d9cde9") },
  @{ Id = "f0400004-0004-4004-8004-000000000304"; Name = "Sprite 750ml"; Cat = "drink"; Url = (U "photo-1625772299848-391b6a87d7b3") },
  @{ Id = "f0400011-0011-4011-8011-000000000311"; Name = "Filter Coffee Powder 200g"; Cat = "drink"; Url = (U "photo-1559056199-641a0ac8b55e") },
  @{ Id = "f0400012-0012-4012-8012-000000000312"; Name = "Fresh Orange Juice 200ml"; Cat = "drink"; Url = (U "photo-1621506289937-a8e4df240d0b") },
  @{ Id = "f0400013-0013-4013-8013-000000000313"; Name = "Boost 500g"; Cat = "drink"; Url = (U "photo-1572490122747-3968b75cc699") },
  @{ Id = "f0400021-0021-4021-8021-000000000321"; Name = "Coca Cola 750ml"; Cat = "drink"; Url = (U "photo-1554866585-cd94860890b7") },
  @{ Id = "f0400022-0022-4022-8022-000000000322"; Name = "Lemon Soda 600ml"; Cat = "drink"; Url = (U "photo-1621263764928-df1444c5e859") },
  @{ Id = "f0400023-0023-4023-8023-000000000323"; Name = "Horlicks 500g"; Cat = "drink"; Url = (U "photo-1572490122747-3968b75cc699") },
  @{ Id = "f0500001-0001-4001-8001-000000000401"; Name = "Toor Dal 1kg"; Cat = "staple"; Url = (U "photo-1615485290382-441e4d049cb5") },
  @{ Id = "f0500002-0002-4002-8002-000000000402"; Name = "Wheat Atta 1kg"; Cat = "staple"; Url = (U "photo-1574323347407-f5e1ad6d020b") },
  @{ Id = "f0500003-0003-4003-8003-000000000403"; Name = "Sunflower Oil 1L"; Cat = "staple"; Url = (U "photo-1608571423902-eed4a5ad8108") },
  @{ Id = "f0500011-0011-4011-8011-000000000411"; Name = "Sugar 1kg"; Cat = "staple"; Url = (U "photo-1587049352846-4a222e784d38") },
  @{ Id = "f0500021-0021-4021-8021-000000000421"; Name = "Basmati Rice 1kg"; Cat = "staple"; Url = (U "photo-1536304993881-ff6e9eefa2a6") }
)

function Get-ContentType([string]$Url) {
  $ext = [IO.Path]::GetExtension(($Url -split '\?')[0]).ToLowerInvariant()
  switch ($ext) {
    ".png"  { return @{ Ext = ".png";  Type = "image/png" } }
    ".webp" { return @{ Ext = ".webp"; Type = "image/webp" } }
    default { return @{ Ext = ".jpg";  Type = "image/jpeg" } }
  }
}

function Save-Image([string]$Url, [string]$Dest) {
  Invoke-WebRequest -Uri $Url -OutFile $Dest -Headers $Headers -UseBasicParsing -TimeoutSec 45
  if (-not (Test-Path $Dest) -or ((Get-Item $Dest).Length -lt 3000)) {
    throw "Downloaded file too small or missing"
  }
}

function Get-ThreeUrls($product) {
  $primary = $product.Url
  $pool = @($Pools[$product.Cat] | Where-Object { $_ -ne $primary })
  # Rotate pool by product index so neighbors get different extras
  $hash = [Math]::Abs($product.Name.GetHashCode())
  $picked = New-Object System.Collections.Generic.List[string]
  $picked.Add($primary)
  for ($i = 0; $i -lt $pool.Count -and $picked.Count -lt 3; $i++) {
    $candidate = $pool[($hash + $i) % $pool.Count]
    if (-not ($picked -contains $candidate)) { $picked.Add($candidate) }
  }
  # Absolute last resort: other category pools
  if ($picked.Count -lt 3) {
    foreach ($extra in ($Pools.Values | ForEach-Object { $_ } | Select-Object -Unique)) {
      if ($picked.Count -ge 3) { break }
      if (-not ($picked -contains $extra)) { $picked.Add($extra) }
    }
  }
  return ,$picked.ToArray()
}

$mediaLines = New-Object System.Collections.Generic.List[string]
$catalogLines = New-Object System.Collections.Generic.List[string]
$catalogLines.Add("DELETE FROM master_item_images;")
$failed = New-Object System.Collections.Generic.List[string]
$totalOk = 0

$n = 0
foreach ($p in $Products) {
  $n++
  $slotUrls = Get-ThreeUrls $p
  $slotOk = 0

  for ($slot = 0; $slot -lt $slotUrls.Count -and $slot -lt 3; $slot++) {
    $mediaId = [guid]::NewGuid().ToString()
    $candidates = @($slotUrls[$slot]) + @($Pools[$p.Cat]) | Select-Object -Unique
    $saved = $false
    $meta = $null
    $file = $null

    foreach ($u in $candidates) {
      try {
        $meta = Get-ContentType $u
        $file = Join-Path $Storage "$mediaId$($meta.Ext)"
        Save-Image -Url $u -Dest $file
        $saved = $true
        break
      } catch {
        # try next candidate
      }
    }

    if (-not $saved) {
      Write-Host ("  slot {0} FAIL {1}" -f $slot, $p.Name)
      continue
    }

    $size = (Get-Item $file).Length
    $pathSql = $file.Replace("\", "\\").Replace("'", "''")
    $safeName = (($p.Name -replace "'", "''") + "-$slot" + $meta.Ext)
    $publicUrl = "/api/v1/media/$mediaId/content"
    $mediaLines.Add("INSERT INTO media_files (id, original_name, content_type, size_bytes, storage_path, context, owner_user_id, public_url, scan_status) VALUES ('$mediaId', '$safeName', '$($meta.Type)', $size, E'$pathSql', 'CATALOG_PRODUCT', NULL, '$publicUrl', 'CLEAN') ON CONFLICT (id) DO NOTHING;")
    $imgId = [guid]::NewGuid().ToString()
    $catalogLines.Add("INSERT INTO master_item_images (id, master_item_id, media_id, public_url, sort_order) SELECT '$imgId', '$($p.Id)', '$mediaId', '$publicUrl', $slot WHERE EXISTS (SELECT 1 FROM master_items WHERE id = '$($p.Id)');")
    $slotOk++
    $totalOk++
    Start-Sleep -Milliseconds 120
  }

  if ($slotOk -eq 0) {
    $failed.Add($p.Name)
    Write-Host ("[{0}/{1}] FAIL {2}" -f $n, $Products.Count, $p.Name)
  } else {
    Write-Host ("[{0}/{1}] OK {2} ({3}/3 images)" -f $n, $Products.Count, $p.Name, $slotOk)
  }
}

if ($mediaLines.Count -eq 0) { throw "No images downloaded." }

$tmpMedia = Join-Path $env:TEMP "hlm_seed_media.sql"
$tmpCatalog = Join-Path $env:TEMP "hlm_seed_catalog_images.sql"
($mediaLines -join "`n") | Set-Content -Path $tmpMedia -Encoding ascii
($catalogLines -join "`n") | Set-Content -Path $tmpCatalog -Encoding ascii

Write-Host "Applying media SQL..."
Get-Content $tmpMedia | docker exec -i hlm-postgres psql -U hyperlocalmart -d hyperlocalmart_media -v ON_ERROR_STOP=1 | Out-Null
Write-Host "Applying catalog SQL..."
Get-Content $tmpCatalog | docker exec -i hlm-postgres psql -U hyperlocalmart -d hyperlocalmart_catalog -v ON_ERROR_STOP=1 | Out-Null
Write-Host ("Seeded {0} images across {1} items. Failed items: {2}" -f $totalOk, $Products.Count, $(if ($failed.Count) { $failed -join ', ' } else { 'none' }))
