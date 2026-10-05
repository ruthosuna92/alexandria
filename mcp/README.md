# 🏛️ Alexandria MCP Server

MCP server para Alexandria. Lee y escribe directamente en la misma base de Supabase que usa la app, con embeddings de OpenAI (`text-embedding-3-small`).

Expone cuatro tools:
- `alexandria_query` — busca contexto con árbitro de ranking
- `alexandria_save` — guarda signals desde el chat
- `alexandria_suggest_model` — sugiere modelo y skill
- `alexandria_regenerate_overview` — regenera el overview de un proyecto

## Setup

```bash
cd mcp/
npm install
npm run build
```

## Variables de entorno

El server no lee ningún `.env`: las variables se pasan en el bloque `env` de la config del cliente MCP.

| Variable | Valor |
|---|---|
| `SUPABASE_URL` | URL del proyecto de Supabase (la misma que `NEXT_PUBLIC_SUPABASE_URL` de la app) |
| `SUPABASE_SERVICE_KEY` | Service role key de Supabase |
| `OPENAI_API_KEY` | API key de OpenAI, para los embeddings |

Si falta alguna, la tool responde con un error que dice cuál.

## Configuración por cliente

### Claude Code

```bash
claude mcp add alexandria \
  -e SUPABASE_URL=... \
  -e SUPABASE_SERVICE_KEY=... \
  -e OPENAI_API_KEY=... \
  -- node /Users/TU_USUARIO/alexandria/mcp/dist/index.js
```

### Claude Desktop

Edita `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "alexandria": {
      "command": "node",
      "args": ["/Users/TU_USUARIO/alexandria/mcp/dist/index.js"],
      "env": {
        "SUPABASE_URL": "...",
        "SUPABASE_SERVICE_KEY": "...",
        "OPENAI_API_KEY": "..."
      }
    }
  }
}
```

### Gemini CLI

Edita `~/.gemini/settings.json` con el mismo `command`, `args` y `env`.

## Uso en el chat

```
// Buscar contexto antes de trabajar
"busca en alexandria: race condition y viewer initialization"

// Guardar al terminar (después del prompt compactador)
"guarda en alexandria: { ...json generado... }"

// Sugerir modelo
"alexandria, qué modelo uso para un bug en Next.js?"
```

## Árbitro de ranking

El árbitro analiza la query y decide:
- **single** — un ganador claro, entrega ese solo
- **combined** — query compuesta con dos temas distintos (unidos por "y", "and", "además"…), entrega máximo 2
- **none** — score bajo, no inyecta contexto

## Overviews

Cada 3 signals de un proyecto se regenera automáticamente su overview: una fila en `signals` con `contexto = 'overview'` que resume stack, decisiones y preferencias. También se puede regenerar a mano con `alexandria_regenerate_overview`.

## Nombres de proyecto

Al guardar, el nombre del proyecto se compara sin distinguir mayúsculas contra los existentes: si ya existe "Spybee", `spybee` se guarda como "Spybee".
