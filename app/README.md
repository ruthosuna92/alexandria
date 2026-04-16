# 🏛️ Alexandria

> Context that survives the next chat.

RAG local para tus conversaciones de IA. Guarda señales de tus chats, vectoriza con embeddings multilingües, recupera quirúrgicamente lo que necesitas.

## Setup

### Requisitos
- Node.js v18+
- npm

### Instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Seed del lexicon inicial (20 grupos multilingüe)
npm run seed

# 3. Arrancar
npm run dev
```

Abre [http://localhost:3001](http://localhost:3001)

Los datos se guardan en:
- **Windows:** `C:\Users\TuUsuario\Documents\alexandria\data\`
- **Mac:** `~/Documents/alexandria/data/`

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
- **Xenova/transformers** — embeddings `paraphrase-multilingual-MiniLM-L12-v2` (local, sin API)
- **Vectra** — vector store local en disco
- **better-sqlite3** — DB local SQLite
- **AES-256-GCM** — encriptación ligada a la máquina

## Roadmap
- [ ] Adapter para Supabase (pgvector) — sync entre dispositivos
- [ ] Exportar/importar signals
- [ ] Routing table editable desde UI
- [ ] Versión Tauri (instalador .exe / .dmg)
