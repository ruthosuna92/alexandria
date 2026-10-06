const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // /api/mcp imports the MCP server from ../mcp, outside this package.
    externalDir: true,
    // Trace files from the repo root so ../mcp ends up in the deployed function.
    outputFileTracingRoot: path.join(__dirname, '..'),
  },
  webpack(config) {
    // mcp/ is ESM and imports its own .ts files with a .js extension.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.js'],
    }
    return config
  },
}

module.exports = nextConfig
