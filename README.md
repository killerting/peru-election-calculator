# 🗳️ Peru 2026 Election Calculator

An interactive election results calculator for Peru's 2026 presidential second round (segunda vuelta) between Keiko Fujimori and Roberto Sánchez.

## Features

- **Live data** – Fetches the latest official ONPE vote counts automatically
- **Auto-refresh** – Updates every 5 minutes (pause/resume button)
- **Manual refresh** – Instant update on demand
- **Mathematical lock detector** – Tells you exactly when it's impossible for the trailing candidate to win
- **Scenario simulator** – Drag a slider to model different vote distributions in remaining ballots
- **Breakeven calculator** – Shows exactly what % of remaining votes the trailer needs to overturn the result

## How to Use

1. Click **Actualizar** to load the latest ONPE data automatically
2. Or enter vote totals manually from [resultadosegundavuelta.onpe.gob.pe](https://resultadosegundavuelta.onpe.gob.pe/main/resumen)
3. Toggle **Auto (5 min)** to keep it refreshing hands-free
4. Use the scenario slider to explore "what if" outcomes

## Stack

- React (single-file JSX)
- Anthropic Claude API (web search for live data fetching)
- Zero dependencies beyond React

## Data Source

Official results from [ONPE](https://www.onpe.gob.pe) — Oficina Nacional de Procesos Electorales.

---

*For informational use only. Not affiliated with ONPE or any political party.*
