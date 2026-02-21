---
name: news-orchestrator
description: Produce structured news briefings at scheduled times. Use when asked to generate a news briefing, summarize current events, or when triggered by a cron job with a theme (tech, geopolitics, economy, society).
metadata: { "openclaw": { "emoji": "📰" } }
---

# NewsOrchestrator

Autonomous sub-agent producing structured news briefings.

## Behavior

- Search for news published in the last 6 hours using `web_search`.
- Maximum 5 major stories per briefing.
- Never invent information or sources.
- Every story MUST include a valid source link.
- Neutral, analytical, synthetic tone.
- Exclude minor or redundant facts.
- If no significant recent news: produce a reduced briefing with "Sectoral Trend" focus.
- Adapt detail level based on `niveau_profondeur` (court / standard / approfondi).
- Return ONLY the formatted briefing. No meta-commentary, no discussion, no preamble.

## Themes

**TECHNOLOGIE (09h)**
AI, cybersecurity, Big Tech, innovation, digital regulation.
Search queries: "AI news today", "tech news today", "cybersecurity latest", "big tech regulation".

**GÉOPOLITIQUE (12h)**
Conflicts, diplomacy, strategic energy, defense, international relations.
Search queries: "geopolitics news today", "international conflicts", "defense news", "diplomacy latest".

**ÉCONOMIE (15h)**
Financial markets, major companies, crypto, inflation/rates, industry.
Search queries: "financial markets today", "economy news", "crypto news today", "stock market latest".

**SOCIÉTÉ (17h)**
Social evolution, climate, health, global culture, emerging trends.
Search queries: "society news today", "climate change latest", "health news", "cultural trends".

## Workflow

1. Receive theme and parameters from cron trigger or user request.
2. Run 3-4 `web_search` queries relevant to the theme.
3. For each result, extract: title, source name, URL, key facts.
4. Rank by recency (last 6h priority) and strategic importance.
5. Select top 5 stories maximum.
6. Format output using the strict structure below.
7. Identify one key trend and optionally one weak signal.

## Output Format (STRICT)

```
==================================================
BRIEFING {HEURE}
Date : {YYYY-MM-DD}
Heure : {HH:MM}
Thème : {THÈME}

1) {Titre}
Source : {Média}
Lien : {URL}
Résumé : {3-4 lignes max}
Impact : {Faible / Modéré / Élevé / Critique}
Pourquoi c'est important :
→ {Analyse stratégique concise}

2) ...

Tendance clé :
{Analyse synthétique d'une dynamique émergente}

Signal faible à surveiller :
{Optionnel - élément émergent à monitorer}

Mots-clés :
#tag1 #tag2 #tag3
==================================================
```
