# 🏛️ Alexandria MCP Server

MCP server para Alexandria. Expone tres tools:
- `alexandria_query` — busca contexto con árbitro de ranking
- `alexandria_save` — guarda signals desde el chat
- `alexandria_suggest_model` — sugiere modelo y skill

## Setup

```bash
cd mcp/
npm install
npm run build
```

## Configuración por cliente

### Claude Desktop

Edita `%APPDATA%\Claude\claude_desktop_config.json` (Windows) o `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac):

```json
{
  "mcpServers": {
    "alexandria": {
      "command": "node",
      "args": ["C:/Users/TU_USUARIO/Documents/alexandria/mcp/dist/index.js"]
    }
  }
}
```

### Gemini CLI

Edita `~/.gemini/settings.json`:

```json
{
  "mcpServers": [
    {
      "name": "alexandria",
      "command": "node",
      "args": ["/Users/TU_USUARIO/Documents/alexandria/mcp/dist/index.js"]
    }
  ]
}
```

### ChatGPT (requiere ngrok)

```bash
# 1. Instala ngrok: https://ngrok.com
# 2. El MCP server necesita modo HTTP para ChatGPT
# (próximamente — requiere adapter HTTP adicional)
```

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
- **combined** — query compuesta con dos temas distintos, entrega máximo 2
- **none** — score bajo, no inyecta contexto
