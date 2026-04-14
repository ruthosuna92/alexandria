/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', '@xenova/transformers', 'machine-id']
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'sharp$': false,
      'onnxruntime-node$': false,
    }
    return config
  }
}

module.exports = nextConfig
