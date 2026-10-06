# 🏛️ Alexandria

> Context that survives the next chat.

RAG personal para tus conversaciones de IA. Guarda señales de tus chats en Supabase, vectoriza con embeddings de OpenAI, recupera quirúrgicamente lo que necesitas.

## Setup

### Requisitos
- Node.js v18+
- Un proyecto de Supabase con las tablas de Alexandria y la función `match_signals`
- API key de OpenAI

### Instalación

```bash
# 1. Crear .env con:
#    NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY, OPENAI_API_KEY,
#    ALEXANDRIA_USER y ALEXANDRIA_PASSWORD (login de la app; sin ellas la app responde 500)

# 2. Instalar dependencias
npm install

# 3. Arrancar
npm run dev
```

Abre [http://localhost:3001](http://localhost:3001)

Los datos viven en Supabase. El MCP server (`../mcp`) usa la misma base.

## Uso

### 1. Copia el prompt template
En el tab `_ save` copia el prompt y pégalo al final de cualquier conversación en Claude, ChatGPT o Gemini.

### 2. Pega el JSON resultante
El chat te devuelve un JSON. Pégalo en el textarea y dale a **vectorize + save**.

### 3. Consulta cuando necesites contexto
En `/ query` escribe lo que buscas — en español, inglés, o mezclado. La búsqueda es híbrida: texto plano + semántica multilingüe.

### 4. Copia el contexto
El bloque generado lo pegas al inicio de tu próximo chat.

## Stack
- **Next.js 14** + TypeScript
- **Supabase** — Postgres + pgvector
- **OpenAI** — embeddings `text-embedding-3-small`

## Roadmap
- [x] Adapter para Supabase (pgvector) — sync entre dispositivos
- [ ] Exportar/importar signals
- [ ] Routing table editable desde UI
- [ ] Versión Tauri (instalador .exe / .dmg)
