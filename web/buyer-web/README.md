# Buyer web (Vite + React + TypeScript)

Shop local as a buyer. Same stack as vendor / delivery portals.

## Run

```powershell
$env:Path = "C:\Tools\node;" + $env:Path
cd D:\LocalHyperMart\LocalHyperMart\web\buyer-web
npm install
npm run dev
```

Open **http://localhost:5175**

Requires gateway on `http://localhost:8080`.

## What works in v0.1

- Register / login (sets default town to Narsaraopet)
- Browse + search catalog
- Add / remove cart items
- Add delivery address
- Place **COD** order
- View my orders

## Full UI demo (all three portals)

| Step | App | URL |
|---|---|---|
| 1. Buy | Buyer | http://localhost:5175 |
| 2. Mark ready | Vendor | http://localhost:5173 (`9876500001`) |
| 3. Assign + deliver | Hub / agent | http://localhost:5174 |
