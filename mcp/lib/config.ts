// Env vars are passed by the MCP client (the `env` block in Claude Code /
// Claude Desktop config), not read from a file in the repo.

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing env var ${name}. Add it to the "env" block of the alexandria MCP server config.`)
  }
  return value
}

export const config = {
  get supabaseUrl()        { return requireEnv('SUPABASE_URL') },
  get supabaseServiceKey() { return requireEnv('SUPABASE_SERVICE_KEY') },
  get openaiApiKey()       { return requireEnv('OPENAI_API_KEY') },
}
