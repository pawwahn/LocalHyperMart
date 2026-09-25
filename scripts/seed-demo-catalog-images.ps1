# Seeds category cover tiles + product photos for all master items (demo-ready).
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\seed-demo-catalog-images.ps1
#   powershell ... -File .\scripts\seed-demo-catalog-images.ps1 -ReplaceAll
#   powershell ... -File .\scripts\seed-demo-catalog-images.ps1 -CategoriesOnly

param(
  [switch]$ReplaceAll,
  [switch]$CategoriesOnly,
  [int]$ImagesPerItem = 1
)

$ErrorActionPreference = "Stop"
$Storage = Join-Path $env:USERPROFILE ".hyperlocalmart\media"
New-Item -ItemType Directory -Force -Path $Storage | Out-Null

$Headers = @{
  "User-Agent" = "LocalHyperMart/1.0 (local-dev; seed-demo-catalog-images)"
  "Accept"     = "image/*,*/*"
}

function U([string]$id) {
  "https://images.unsplash.com/$id`?auto=format&fit=crop&w=640&h=640&q=80"
}

function UWide([string]$id) {
  "https://images.unsplash.com/$id`?auto=format&fit=crop&w=800&h=600&q=80"
}

function Get-ContentType([string]$Url) {
  $ext = [IO.Path]::GetExtension(($Url -split '\?')[0]).ToLowerInvariant()
  switch ($ext) {
    ".png"  { return @{ Ext = ".png";  Type = "image/png" } }
    ".webp" { return @{ Ext = ".webp"; Type = "image/webp" } }
    default { return @{ Ext = ".jpg";  Type = "image/jpeg" } }
  }
}

function Save-Image([string]$Url, [string]$Dest) {
  Invoke-WebRequest -Uri $Url -OutFile $Dest -Headers $Headers -UseBasicParsing -TimeoutSec 60
  if (-not (Test-Path $Dest) -or ((Get-Item $Dest).Length -lt 3000)) {
    throw "Downloaded file too small or missing"
  }
}

function Get-CategoryIndex([string]$CategoryId) {
  if ($CategoryId -match 'c9a00000-00([0-9a-f]{2})-') {
    return [Convert]::ToInt32($matches[1], 16)
  }
  return 0
}

# --- Curated pools (real product / aisle photos only) ---
$Pools = @{
  veg      = @((U "photo-1546094096-0df4bcaaa337"), (U "photo-1518977956812-cd3dbadaaf31"), (U "photo-1598170845058-32b9d6a5da37"), (U "photo-1542838132-92c53300491e"), (U "photo-1563565375-f3fdfdbefa83"), (U "photo-1576045057995-568f588f82fb"), (U "photo-1594282486552-05b4d80fbb9f"), (U "photo-1566842600175-97dca489844f"))
  fruit    = @((U "photo-1619563980362-43a561ae0361"), (U "photo-1464960462944-4bfa466b8e81"), (U "photo-1560806887-1ff4b0d3a276"), (U "photo-1528825871115-3582a0260b82"), (U "photo-1559181567-c3190ca9959b"), (U "photo-1601493701231-2a4d7a7e3c3e"))
  dairy    = @((U "photo-1563636619-e9143da7973b"), (U "photo-1488477181946-6428a0291777"), (U "photo-1486297678162-eb2a19b0a32d"), (U "photo-1550583724-b2692b85b150"), (U "photo-1509440159596-0249088772ff"), (U "photo-1589985270826-4b7bb135bc9d"))
  staple   = @((U "photo-1586201375761-83865001e31c"), (U "photo-1615485290382-441e4d049cb5"), (U "photo-1574323347407-f5e1ad6d020b"), (U "photo-1536304993881-ff6e9eefa2a6"), (U "photo-1587049352846-4a222e784d38"))
  oil      = @((U "photo-1608571423902-eed4a5ad8108"), (U "photo-1474979266404-7eaacbf37a27"), (U "photo-1596040035228-793c8d5a1a2e"))
  masala   = @((U "photo-1596040035228-793c8d5a1a2e"), (U "photo-1506368089636-6edb671bb0a2"), (U "photo-1615484477778-ca3b77940c25"))
  snack    = @((U "photo-1566478989037-eec170784d0b"), (U "photo-1599490659213-e2b9527bd087"), (U "photo-1571771894821-ce9b6c11b08e"), (U "photo-1558961363-fa8fdf82db35"), (U "photo-1551754655-cd27e38d2076"))
  sweet    = @((U "photo-1511381939415-e44015466834"), (U "photo-1606312619070-d48f4b6c0a3a"), (U "photo-1587241326561-10a86a0a8061"))
  drink    = @((U "photo-1554866585-cd94860890b7"), (U "photo-1548839140-29a749e1cf4d"), (U "photo-1621506289937-a8e4df240d0b"), (U "photo-1564890369478-c89ca6d9cde9"), (U "photo-1559056199-641a0ac8b55e"))
  biscuit  = @((U "photo-1558961363-fa8fdf82db35"), (U "photo-1499636136210-6f4ee915583e"), (U "photo-1509440159596-0249088772ff"))
  instant  = @((U "photo-1612929633738-8fe44f7ec841"), (U "photo-1569718212165-3a8278d5f624"), (U "photo-1585937421612-70a008356fbe"))
  meat     = @((U "photo-1607623814075-e51df1bdc82f"), (U "photo-1519708225311-56f9c86a0a2c"), (U "photo-1534483509719-9fe1e7e0a148"))
  cereal   = @((U "photo-1517686469429-8bdb088706a5"), (U "photo-1494859802809-d30c708de594"), (U "photo-1586201375761-83865001e31c"))
  sauce    = @((U "photo-1472476446867-f7abfbf929fe"), (U "photo-1623428187429-7a5b3a5d8a1a"), (U "photo-1606923829579-0cb981a83e2e"))
  tea      = @((U "photo-1564890369478-c89ca6d9cde9"), (U "photo-1559056199-641a0ac8b55e"), (U "photo-1572490122747-3968b75cc699"))
  clean    = @((U "photo-1585421514284-efb74c3a69d5"), (U "photo-1563453567192-0a4617ba0a3a"), (U "photo-1610557892470-55d9e80a711b"))
  pharma   = @((U "photo-1584308666744-24d5c474f2ae"), (U "photo-1631549916768-4119d2a4b0c6"), (U "photo-1587854691652-5c0a580e4817"))
  bath     = @((U "photo-1556228578-0d85b1a4d571"), (U "photo-1608245449256-9c9a0e4a4f6a"), (U "photo-1522335789203-aabd1fc54bc9"))
  beauty   = @((U "photo-1522335789203-aabd1fc54bc9"), (U "photo-1596462502278-27bfdc403348"), (U "photo-1571781926291-c477ebfd024b"))
  baby     = @((U "photo-1515488042361-ee00e93a0640"), (U "photo-1584515933487-779824d29309"), (U "photo-1604580864964-0463894433a1"))
  pet      = @((U "photo-1587300003388-59208cc962cb"), (U "photo-1450778868960-41d2d0862b01"), (U "photo-1514888286974-6c03e2ca1dba"))
  home     = @((U "photo-1556911220-e15b29be8c8f"), (U "photo-1556911220-bff31c812dba"), (U "photo-1586023492125-27b2c045efd7"))
  electric = @((U "photo-1498049794561-7780e7231661"), (U "photo-1587825140708-dfaf7ae4b1ea"), (U "photo-1625842268584-8f3296236761"))
  paan     = @((U "photo-1596040035228-793c8d5a1a2e"), (U "photo-1506368089636-6edb671bb0a2"))
  icecream = @((U "photo-1563805042-7684c019e1cb"), (U "photo-1497032628192-10f8174b4b7d"), (U "photo-1551024506-0bccd828d307"))
  choco    = @((U "photo-1511381939415-e44015466834"), (U "photo-1606312619070-d48f4b6c0a3a"), (U "photo-1549007953-2f2b2278470d"))
  mithai   = @((U "photo-1587241326561-10a86a0a8061"), (U "photo-1607922262131-0a1b515571a1"), (U "photo-1607922262131-0a1b515571a1"))
  noodles  = @((U "photo-1612929633738-8fe44f7ec841"), (U "photo-1569718212165-3a8278d5f624"), (U "photo-1585032226651-759b368d7246"))
  frozen   = @((U "photo-1626804475297-41608ea09ae5"), (U "photo-1606859035421-97575a49b581"), (U "photo-1585937421612-70a008356fbe"))
  dryfruit = @((U "photo-1599599810769-bcde5a160d32"), (U "photo-1606312619070-d48f4b6c0a3a"), (U "photo-1509440159596-0249088772ff"))
  hair     = @((U "photo-1522338242992-e1a54906a8ae"), (U "photo-1522335789203-aabd1fc54bc9"))
  skin     = @((U "photo-1571781926291-c477ebfd024b"), (U "photo-1556228578-0d85b1a4d571"))
  makeup   = @((U "photo-1596462502278-27bfdc403348"), (U "photo-1522335789203-aabd1fc54bc9"))
  hygiene  = @((U "photo-1608245449256-9c9a0e4a4f6a"), (U "photo-1556228578-0d85b1a4d571"))
  wellness = @((U "photo-1584308666744-24d5c474f2ae"), (U "photo-1571019614242-c5c5dee9f50e"))
  puja     = @(
    "https://cdn.pixabay.com/photo/2016/11/29/09/16/architecture-1868667_640.jpg",
    (U "photo-1506368089636-6edb671bb0a2"),
    (U "photo-1596040035228-793c8d5a1a2e")
  )
  toys     = @((U "photo-1558068712-88d4620342b0"), (U "photo-1515488042361-ee00e93a0640"))
  fashion  = @((U "photo-1445205170230-053b83016050"), (U "photo-1489987707025-afc232f7ea0f"))
  sports   = @((U "photo-1571019614242-c5c5dee9f50e"), (U "photo-1517836357463-d25dfeac3438"))
  generic  = @((U "photo-1542838132-92c53300491e"), (U "photo-1586201375761-83865001e31c"))
}

$CatIndexToPool = @{
  1 = 'veg'; 2 = 'fruit'; 3 = 'dairy'; 4 = 'staple'; 5 = 'oil'; 6 = 'masala'; 7 = 'snack'; 8 = 'sweet'
  9 = 'drink'; 10 = 'biscuit'; 11 = 'instant'; 12 = 'meat'; 13 = 'cereal'; 14 = 'sauce'; 15 = 'tea'
  16 = 'clean'; 17 = 'pharma'; 18 = 'bath'; 19 = 'beauty'; 20 = 'baby'; 21 = 'pet'; 22 = 'home'; 23 = 'electric'
  24 = 'paan'; 25 = 'icecream'; 26 = 'choco'; 27 = 'mithai'; 28 = 'noodles'; 29 = 'frozen'; 30 = 'dryfruit'
  31 = 'hair'; 32 = 'skin'; 33 = 'makeup'; 34 = 'hygiene'; 35 = 'wellness'; 36 = 'wellness'; 37 = 'puja'
  38 = 'toys'; 39 = 'fashion'; 40 = 'sports'
}

function Get-PoolKey([string]$CategoryId, [string]$CategoryName) {
  $idx = Get-CategoryIndex $CategoryId
  if ($CatIndexToPool.ContainsKey($idx)) { return $CatIndexToPool[$idx] }
  $n = $CategoryName.ToLowerInvariant()
  if ($n -match 'vegetable|vegetables') { return 'veg' }
  if ($n -match 'fruit') { return 'fruit' }
  if ($n -match 'dairy|milk|bread|egg') { return 'dairy' }
  if ($n -match 'atta|rice|dal|grocer') { return 'staple' }
  if ($n -match 'oil|ghee') { return 'oil' }
  if ($n -match 'masala|spice') { return 'masala' }
  if ($n -match 'chip|namkeen|snack|munch') { return 'snack' }
  if ($n -match 'sweet|mithai|dessert|chocolate') { return 'sweet' }
  if ($n -match 'drink|juice|tea|coffee') { return 'drink' }
  if ($n -match 'biscuit|cake') { return 'biscuit' }
  if ($n -match 'frozen|instant|noodle') { return 'instant' }
  if ($n -match 'meat|seafood|chicken|fish') { return 'meat' }
  if ($n -match 'clean|detergent|repellent') { return 'clean' }
  if ($n -match 'pharma|hygiene') { return 'pharma' }
  if ($n -match 'bath|body|hair') { return 'bath' }
  if ($n -match 'beauty|groom|makeup|skin') { return 'beauty' }
  if ($n -match 'baby') { return 'baby' }
  if ($n -match 'pet') { return 'pet' }
  if ($n -match 'home|kitchen|fancy') { return 'home' }
  if ($n -match 'electronic|appliance') { return 'electric' }
  if ($n -match 'paan') { return 'paan' }
  if ($n -match 'ice cream') { return 'icecream' }
  if ($n -match 'sport|fitness') { return 'sports' }
  if ($n -match 'puja') { return 'puja' }
  if ($n -match 'toy|stationery') { return 'toys' }
  if ($n -match 'fashion') { return 'fashion' }
  return 'generic'
}

$KeywordRules = @(
  @{ R = 'tomato'; U = (U "photo-1546094096-0df4bcaaa337") }
  @{ R = 'onion'; U = (U "photo-1508747703725-719777637510") }
  @{ R = 'potato'; U = (U "photo-1518977956812-cd3dbadaaf31") }
  @{ R = 'carrot'; U = (U "photo-1598170845058-32b9d6a5da37") }
  @{ R = 'chilli|chili'; U = (U "photo-1583663848850-46af132dc08e") }
  @{ R = 'lemon'; U = (U "photo-1590502593747-42a996133562") }
  @{ R = 'cucumber'; U = (U "photo-1604977042946-1eecc30f269e") }
  @{ R = 'capsicum|bell pepper'; U = (U "photo-1563565375-f3fdfdbefa83") }
  @{ R = 'spinach|coriander|ginger|garlic|cabbage|cauliflower|brinjal|okra|ladies finger'; U = (U "photo-1542838132-92c53300491e") }
  @{ R = 'banana'; U = (U "photo-1571771894821-ce9b6c11b08e") }
  @{ R = 'apple'; U = (U "photo-1560806887-1ff4b0d3a276") }
  @{ R = 'orange|mosambi'; U = (U "photo-1547514704-5c1391811480") }
  @{ R = 'grape'; U = (U "photo-1537640538966-79f369143b6f") }
  @{ R = 'mango'; U = (U "photo-1553279768-865861fa2447") }
  @{ R = 'watermelon|muskmelon|papaya|pineapple|pomegranate|guava|kiwi|pear'; U = (U "photo-1619563980362-43a561ae0361") }
  @{ R = 'milk|lassi|buttermilk|curd|paneer|cheese|butter|ghee|cream|bread|egg'; U = (U "photo-1563636619-e9143da7973b") }
  @{ R = 'rice|basmati|sona|poha|rava|atta|wheat|maida|besan|dal|toor|moong|urad|chana|masoor|rajma|chickpea|idli'; U = (U "photo-1586201375761-83865001e31c") }
  @{ R = 'oil|vanaspati|olive'; U = (U "photo-1608571423902-eed4a5ad8108") }
  @{ R = 'turmeric|chilli powder|masala|cumin|pepper|spice|salt|hing'; U = (U "photo-1596040035228-793c8d5a1a2e") }
  @{ R = 'chip|namkeen|murukku|bhujia|mixture|popcorn|peanut|khakhra|nachos'; U = (U "photo-1566478989037-eec170784d0b") }
  @{ R = 'chocolate|candy|toffee|wafer|lollipop|marshmallow'; U = (U "photo-1511381939415-e44015466834") }
  @{ R = 'cola|soda|soft drink|sprite|thums|water|juice|energy drink|coconut water|sparkling'; U = (U "photo-1554866585-cd94860890b7") }
  @{ R = 'tea|coffee|horlicks|boost|bournvita'; U = (U "photo-1564890369478-c89ca6d9cde9") }
  @{ R = 'biscuit|cookie|rusk|cracker|cake|cup cake|bun'; U = (U "photo-1558961363-fa8fdf82db35") }
  @{ R = 'noodle|maggi|pasta|vermicelli|macaroni|spaghetti|penne'; U = (U "photo-1612929633738-8fe44f7ec841") }
  @{ R = 'frozen|paratha|samosa|fries|momos|nugget|pizza|pulao|soup'; U = (U "photo-1626804475297-41608ea09ae5") }
  @{ R = 'chicken|mutton|fish|prawn|crab|seafood|egg brown'; U = (U "photo-1607623814075-e51df1bdc82f") }
  @{ R = 'corn flake|oats|muesli|cereal|granola|honey|peanut butter'; U = (U "photo-1517686469429-8bdb088706a5") }
  @{ R = 'ketchup|sauce|mayonnaise|jam|pickle|spread|vinegar'; U = (U "photo-1472476446867-f7abfbf929fe") }
  @{ R = 'detergent|dishwash|cleaner|toilet|mosquito|bleach|scrub'; U = (U "photo-1585421514284-efb74c3a69d5") }
  @{ R = 'sanitizer|bandage|paracetamol|mask|thermometer|syrup|antiseptic'; U = (U "photo-1584308666744-24d5c474f2ae") }
  @{ R = 'soap|shampoo|toothpaste|toothbrush|deodorant|lotion|razor'; U = (U "photo-1556228578-0d85b1a4d571") }
  @{ R = 'lipstick|kajal|compact|makeup|nail polish|perfume|cream fairness'; U = (U "photo-1596462502278-27bfdc403348") }
  @{ R = 'diaper|baby'; U = (U "photo-1515488042361-ee00e93a0640") }
  @{ R = 'dog|cat|pet'; U = (U "photo-1587300003388-59208cc962cb") }
  @{ R = 'pan|pressure|cook|knife|plate|bottle|lunch|bulb|kitchen'; U = (U "photo-1556911220-e15b29be8c8f") }
  @{ R = 'usb|power bank|earphone|kettle|iron|mixer|torch|fan|battery'; U = (U "photo-1498049794561-7780e7231661") }
  @{ R = 'almond|cashew|walnut|pistachio|raisin|dates|fig|dry fruit|makhana|seeds'; U = (U "photo-1599599810769-bcde5a160d32") }
  @{ R = 'ice cream|kulfi|sorbet|frozen yogurt'; U = (U "photo-1563805042-7684c019e1cb") }
  @{ R = 'gulab|rasgulla|laddu|barfi|jalebi|halwa|peda|mithai|soan'; U = (U "photo-1607922262131-0a1b515571a1") }
  @{ R = 'agarbatti|diya|puja|incense|camphor'; U = $Pools.puja[0] }
  @{ R = 'notebook|pen|pencil|toy|ball|block'; U = (U "photo-1558068712-88d4620342b0") }
  @{ R = 'sock|cap|belt|wallet|sunglass|slipper|dupatta|earring'; U = (U "photo-1445205170230-053b83016050") }
  @{ R = 'yoga|dumbbell|football|badminton|gym|cricket'; U = (U "photo-1517836357463-d25dfeac3438") }
  @{ R = 'paan|supari|fennel|gulkand|betel'; U = (U "photo-1506368089636-6edb671bb0a2") }
)

function Get-PrimaryUrl([string]$Name, [string]$PoolKey) {
  $lower = $Name.ToLowerInvariant()
  foreach ($rule in $KeywordRules) {
    if ($lower -match $rule.R) { return $rule.U }
  }
  $pool = $Pools[$PoolKey]
  if (-not $pool -or $pool.Count -eq 0) { $pool = $Pools.generic }
  $h = [Math]::Abs($Name.GetHashCode())
  return $pool[$h % $pool.Count]
}

function Get-ItemUrls([string]$Name, [string]$PoolKey, [int]$Count) {
  $primary = Get-PrimaryUrl $Name $PoolKey
  $pool = @($Pools[$PoolKey] | Where-Object { $_ -ne $primary })
  if (-not $pool -or $pool.Count -eq 0) { $pool = @($Pools.generic | Where-Object { $_ -ne $primary }) }
  $picked = New-Object System.Collections.Generic.List[string]
  $picked.Add($primary)
  $h = [Math]::Abs($Name.GetHashCode())
  for ($i = 0; $i -lt $pool.Count -and $picked.Count -lt $Count; $i++) {
    $c = $pool[($h + $i) % $pool.Count]
    if (-not ($picked -contains $c)) { $picked.Add($c) }
  }
  return ,$picked.ToArray()
}

# Category tile covers (wide crop)
$CategoryCoverByName = @{
  'fresh vegetables' = (UWide "photo-1542838132-92c53300491e")
  'vegetables' = (UWide "photo-1542838132-92c53300491e")
  'fresh fruits' = (UWide "photo-1619563980362-43a561ae0361")
  'fruits' = (UWide "photo-1619563980362-43a561ae0361")
  'dairy, bread and eggs' = (UWide "photo-1563636619-e9143da7973b")
  'dairy' = (UWide "photo-1563636619-e9143da7973b")
  'atta, rice and dal' = (UWide "photo-1586201375761-83865001e31c")
  'rice, atta and dals' = (UWide "photo-1586201375761-83865001e31c")
  'oils and ghee' = (UWide "photo-1608571423902-eed4a5ad8108")
  'masalas' = (UWide "photo-1596040035228-793c8d5a1a2e")
  'masalas and dry fruits' = (UWide "photo-1596040035228-793c8d5a1a2e")
  'chips and namkeens' = (UWide "photo-1566478989037-eec170784d0b")
  'munchies' = (UWide "photo-1566478989037-eec170784d0b")
  'snacks' = (UWide "photo-1566478989037-eec170784d0b")
  'sweet tooth' = (UWide "photo-1511381939415-e44015466834")
  'cold drinks and juices' = (UWide "photo-1554866585-cd94860890b7")
  'biscuits and cakes' = (UWide "photo-1558961363-fa8fdf82db35")
  'instant and frozen food' = (UWide "photo-1612929633738-8fe44f7ec841")
  'meat and seafood' = (UWide "photo-1607623814075-e51df1bdc82f")
  'cereals and breakfast' = (UWide "photo-1517686469429-8bdb088706a5")
  'sauces and spreads' = (UWide "photo-1472476446867-f7abfbf929fe")
  'tea, coffee and milk drinks' = (UWide "photo-1564890369478-c89ca6d9cde9")
  'tea, coffee and more' = (UWide "photo-1564890369478-c89ca6d9cde9")
  'cleaners and repellents' = (UWide "photo-1585421514284-efb74c3a69d5")
  'cleaning essentials' = (UWide "photo-1585421514284-efb74c3a69d5")
  'pharma and hygiene' = (UWide "photo-1584308666744-24d5c474f2ae")
  'bath and body' = (UWide "photo-1556228578-0d85b1a4d571")
  'bath, body and hair' = (UWide "photo-1556228578-0d85b1a4d571")
  'beauty and grooming' = (UWide "photo-1596462502278-27bfdc403348")
  'baby care' = (UWide "photo-1515488042361-ee00e93a0640")
  'pet supplies' = (UWide "photo-1587300003388-59208cc962cb")
  'home and kitchen' = (UWide "photo-1556911220-e15b29be8c8f")
  'electronics and appliances' = (UWide "photo-1498049794561-7780e7231661")
  'office and electricals' = (UWide "photo-1498049794561-7780e7231661")
  'paan corner' = (UWide "photo-1506368089636-6edb671bb0a2")
  'ice creams and frozen desserts' = (UWide "photo-1563805042-7684c019e1cb")
  'chocolates' = (UWide "photo-1511381939415-e44015466834")
  'sweet corner' = (UWide "photo-1607922262131-0a1b515571a1")
  'noodles, pasta, vermicelli' = (UWide "photo-1612929633738-8fe44f7ec841")
  'frozen food' = (UWide "photo-1626804475297-41608ea09ae5")
  'dry fruits and seeds mix' = (UWide "photo-1599599810769-bcde5a160d32")
  'hair care' = (UWide "photo-1522338242992-e1a54906a8ae")
  'skin care' = (UWide "photo-1571781926291-c477ebfd024b")
  'makeup' = (UWide "photo-1596462502278-27bfdc403348")
  'hygiene & personal care' = (UWide "photo-1608245449256-9c9a0e4a4f6a")
  'sexual wellness' = (UWide "photo-1587854691652-5c0a580e4817")
  'health and nutrition' = (UWide "photo-1571019614242-c5c5dee9f50e")
  'puja store' = (UWide "photo-1506368089636-6edb671bb0a2")
  'toys and stationery' = (UWide "photo-1558068712-88d4620342b0")
  'fashion' = (UWide "photo-1445205170230-053b83016050")
  'sports and fitness' = (UWide "photo-1517836357463-d25dfeac3438")
  'groceries' = (UWide "photo-1586201375761-83865001e31c")
  'fancy item' = (UWide "photo-1556911220-e15b29be8c8f")
}

function Get-CategoryCoverUrl([string]$Name, [string]$CategoryId) {
  $key = $Name.Trim().ToLowerInvariant()
  if ($CategoryCoverByName.ContainsKey($key)) { return $CategoryCoverByName[$key] }
  $poolKey = Get-PoolKey $CategoryId $Name
  $pool = $Pools[$poolKey]
  if ($pool -and $pool.Count -gt 0) { return $pool[0] }
  return $Pools.generic[0]
}

function Invoke-MediaInsert([string]$Url, [string]$Label, [string]$Context) {
  $mediaId = [guid]::NewGuid().ToString()
  $candidates = @($Url) + @($Pools.generic)
  foreach ($u in ($candidates | Select-Object -Unique)) {
    try {
      $meta = Get-ContentType $u
      $file = Join-Path $Storage "$mediaId$($meta.Ext)"
      Save-Image -Url $u -Dest $file
      $size = (Get-Item $file).Length
      $pathSql = $file.Replace("\", "\\").Replace("'", "''")
      $safeName = ($Label -replace "'", "''") + $meta.Ext
      $publicUrl = "/api/v1/media/$mediaId/content"
      return @{
        MediaId = $mediaId
        PublicUrl = $publicUrl
        Sql = "INSERT INTO media_files (id, original_name, content_type, size_bytes, storage_path, context, owner_user_id, public_url, scan_status) VALUES ('$mediaId', '$safeName', '$($meta.Type)', $size, E'$pathSql', '$Context', NULL, '$publicUrl', 'CLEAN') ON CONFLICT (id) DO NOTHING;"
      }
    } catch { }
  }
  throw "Failed to download image for $Label"
}

Write-Host "Loading categories and master items from postgres..."
$catRaw = docker exec hlm-postgres psql -U hyperlocalmart -d hyperlocalmart_catalog -t -A -F "`t" -c "SELECT id, name FROM categories ORDER BY name;"
$categories = @()
foreach ($line in ($catRaw -split "`n")) {
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  $p = $line -split "`t", 2
  if ($p.Count -lt 2) { continue }
  $categories += [pscustomobject]@{ Id = $p[0].Trim(); Name = $p[1].Trim() }
}

$mediaLines = New-Object System.Collections.Generic.List[string]
$catalogLines = New-Object System.Collections.Generic.List[string]

if ($ReplaceAll -and -not $CategoriesOnly) {
  $catalogLines.Add("DELETE FROM master_item_images;")
}

# --- Category covers ---
Write-Host ("Seeding category cover images ({0} categories)..." -f $categories.Count)
$coversOk = 0
foreach ($cat in $categories) {
  $coverUrl = Get-CategoryCoverUrl $cat.Name $cat.Id
  try {
    $m = Invoke-MediaInsert -Url $coverUrl -Label ("cat-" + ($cat.Name -replace '[^a-zA-Z0-9]+', '-')) -Context "CATALOG_CATEGORY"
    $mediaLines.Add($m.Sql)
    $safeName = ($cat.Name -replace "'", "''")
    $catalogLines.Add("UPDATE categories SET image_media_id = '$($m.MediaId)'::uuid, image_url = '$($m.PublicUrl)', updated_at = NOW() WHERE id = '$($cat.Id)'::uuid;")
    $coversOk++
    Start-Sleep -Milliseconds 80
  } catch {
    Write-Host ("  cover FAIL: {0}" -f $cat.Name)
  }
}
Write-Host ("Category covers OK: {0}/{1}" -f $coversOk, $categories.Count)

if ($CategoriesOnly) {
  if ($mediaLines.Count -eq 0) { throw "No category images downloaded." }
  $tmpMedia = Join-Path $env:TEMP "hlm_demo_media.sql"
  $tmpCatalog = Join-Path $env:TEMP "hlm_demo_catalog.sql"
  ($mediaLines -join "`n") | Set-Content -Path $tmpMedia -Encoding ascii
  ($catalogLines -join "`n") | Set-Content -Path $tmpCatalog -Encoding ascii
  Get-Content $tmpMedia | docker exec -i hlm-postgres psql -U hyperlocalmart -d hyperlocalmart_media -v ON_ERROR_STOP=1 | Out-Null
  Get-Content $tmpCatalog | docker exec -i hlm-postgres psql -U hyperlocalmart -d hyperlocalmart_catalog -v ON_ERROR_STOP=1 | Out-Null
  Write-Host "Done (categories only)."
  exit 0
}

$itemRaw = docker exec hlm-postgres psql -U hyperlocalmart -d hyperlocalmart_catalog -t -A -F "`t" -c @"
SELECT m.id, m.name, c.id, c.name,
  (SELECT COUNT(*) FROM master_item_images i WHERE i.master_item_id = m.id) AS img_count
FROM master_items m
JOIN categories c ON c.id = m.category_id
ORDER BY c.name, m.name;
"@

$items = @()
foreach ($line in ($itemRaw -split "`n")) {
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  $p = $line -split "`t", 5
  if ($p.Count -lt 5) { continue }
  $items += [pscustomobject]@{
    Id = $p[0].Trim()
    Name = $p[1].Trim()
    CategoryId = $p[2].Trim()
    CategoryName = $p[3].Trim()
    ImgCount = [int]$p[4].Trim()
  }
}

Write-Host ("Processing {0} master items ({1} images each, ReplaceAll={2})..." -f $items.Count, $ImagesPerItem, $ReplaceAll)
$totalOk = 0
$failed = New-Object System.Collections.Generic.List[string]
$n = 0

foreach ($item in $items) {
  $n++
  if (-not $ReplaceAll -and $item.ImgCount -ge $ImagesPerItem) { continue }

  $poolKey = Get-PoolKey $item.CategoryId $item.CategoryName
  $urls = Get-ItemUrls $item.Name $poolKey $ImagesPerItem
  $slotOk = 0

  for ($slot = 0; $slot -lt $urls.Count; $slot++) {
    try {
      $m = Invoke-MediaInsert -Url $urls[$slot] -Label ($item.Name + "-$slot") -Context "CATALOG_PRODUCT"
      $mediaLines.Add($m.Sql)
      $imgId = [guid]::NewGuid().ToString()
      if ($ReplaceAll) {
        $catalogLines.Add("INSERT INTO master_item_images (id, master_item_id, media_id, public_url, sort_order) VALUES ('$imgId', '$($item.Id)', '$($m.MediaId)', '$($m.PublicUrl)', $slot) ON CONFLICT (master_item_id, sort_order) DO UPDATE SET media_id = EXCLUDED.media_id, public_url = EXCLUDED.public_url;")
      } else {
        $catalogLines.Add("INSERT INTO master_item_images (id, master_item_id, media_id, public_url, sort_order) SELECT '$imgId', '$($item.Id)', '$($m.MediaId)', '$($m.PublicUrl)', $slot WHERE NOT EXISTS (SELECT 1 FROM master_item_images x WHERE x.master_item_id = '$($item.Id)' AND x.sort_order = $slot);")
      }
      $slotOk++
      $totalOk++
      Start-Sleep -Milliseconds 60
    } catch {
      Write-Host ("  slot {0} FAIL {1}" -f $slot, $item.Name)
    }
  }

  if ($slotOk -eq 0) {
    $failed.Add($item.Name)
    Write-Host ("[{0}/{1}] FAIL {2}" -f $n, $items.Count, $item.Name)
  } elseif ($n % 25 -eq 0 -or $slotOk -lt $ImagesPerItem) {
    Write-Host ("[{0}/{1}] OK {2}" -f $n, $items.Count, $item.Name)
  }
}

if ($mediaLines.Count -eq 0) { throw "No images downloaded." }

$tmpMedia = Join-Path $env:TEMP "hlm_demo_media.sql"
$tmpCatalog = Join-Path $env:TEMP "hlm_demo_catalog.sql"
($mediaLines -join "`n") | Set-Content -Path $tmpMedia -Encoding ascii
($catalogLines -join "`n") | Set-Content -Path $tmpCatalog -Encoding ascii

Write-Host "Applying media SQL ($($mediaLines.Count) rows)..."
Get-Content $tmpMedia | docker exec -i hlm-postgres psql -U hyperlocalmart -d hyperlocalmart_media -v ON_ERROR_STOP=1 | Out-Null
Write-Host "Applying catalog SQL ($($catalogLines.Count) rows)..."
Get-Content $tmpCatalog | docker exec -i hlm-postgres psql -U hyperlocalmart -d hyperlocalmart_catalog -v ON_ERROR_STOP=1 | Out-Null

Write-Host ("Done. Product images seeded: {0}. Failed: {1}" -f $totalOk, $(if ($failed.Count) { $failed -join ', ' } else { 'none' }))
