import { resolve } from 'node:path';

export function getConfig(env = process.env) {
  const int = (key, fallback, max) => Math.min(max, Math.max(1, Number.parseInt(env[key], 10) || fallback));
  const provider = env.AI_PROVIDER && env.AI_PROVIDER !== 'auto' ? env.AI_PROVIDER : env.OPENROUTER_API_KEY ? 'openrouter' : 'deepseek';
  if (!['openrouter', 'deepseek'].includes(provider)) throw new Error('AI_PROVIDER must be auto, openrouter, or deepseek.');
  const searchProvider = env.SEARCH_PROVIDER || 'auto';
  if (!['auto','model','tavily'].includes(searchProvider)) throw new Error('SEARCH_PROVIDER must be auto, model, or tavily.');
  return {
    provider,
    apiKey: provider === 'openrouter' ? env.OPENROUTER_API_KEY : env.DEEPSEEK_API_KEY,
    model: provider === 'openrouter' ? env.OPENROUTER_MODEL || 'deepseek/deepseek-v4.1-flash-1017' : env.DEEPSEEK_MODEL || 'deepseek-flash',
    apiBase: provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.deepseek.com',
    searchEngine: env.OPENROUTER_SEARCH_ENGINE || 'exa',
    searchProvider, tavilyApiKey: env.TAVILY_API_KEY || '',
    maxTavilyRequests: int('MAX_TAVILY_REQUESTS', 6, 20),
    retrievalTimeoutMs: int('RETRIEVAL_TIMEOUT_MS', 35000, 60000),
    coverageSearches: int('COVERAGE_SEARCHES', 2, 4),
    coveragePages: int('COVERAGE_PAGES', 3, 6),
    port: int('PORT', 3000, 65535), host: env.HOST || '127.0.0.1',
    dataDir: resolve(env.DATA_DIR || './data'),
    timeoutMs: int('RESEARCH_TIMEOUT_MS', 600000, 900000),
    modelTimeoutMs: int('MODEL_TIMEOUT_MS', 300000, 600000),
    fallbackModel: provider === 'openrouter' && env.OPENROUTER_FALLBACK_MODEL !== 'none' ? env.OPENROUTER_FALLBACK_MODEL || 'qwen/qwen3.6-flash' : '',
    modelAttempts: int('MODEL_MAX_ATTEMPTS', 2, 3),
    maxModelRequests: int('MAX_MODEL_REQUESTS', 32, 64),
    maxFallbackRequests: int('MAX_FALLBACK_REQUESTS', 16, 32),
    maxSearches: int('MAX_SEARCHES', 4, 12), maxPages: int('MAX_PAGES', 8, 24),
    maxTurns: int('MAX_AGENT_TURNS', 8, 16), password: env.RESEARCH_PASSWORD || '',
  };
}

export class AppError extends Error {
  constructor(message, code = 'research_error', status = 500) {
    super(message); this.name = 'AppError'; this.code = code; this.status = status;
  }
}
