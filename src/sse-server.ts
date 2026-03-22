/**
 * Servidor MCP multi-transporte para FinanzApp
 *
 * Soporta dos transportes del protocolo MCP:
 * - Streamable HTTP (POST /mcp): transporte principal para n8n
 * - SSE (GET /sse + POST /messages): transporte legacy para compatibilidad
 *
 * Cada conexion crea su propia instancia de servidor MCP
 * con un ApiClient independiente para manejo de JWT per-session.
 */

import express, { Request, Response } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from './index.js';
import { FinanzAppApiClient } from './api-client.js';
import { config } from './config.js';

const app = express();
const port = parseInt(process.env.MCP_SSE_PORT || process.env.MCP_HTTP_PORT || '3001', 10);

app.use(express.json());

// Request logging para debug
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} headers: ${JSON.stringify({
    'mcp-session-id': req.headers['mcp-session-id'],
    'accept': req.headers['accept'],
    'content-type': req.headers['content-type'],
  })}`);
  next();
});

// ==================== Streamable HTTP Transport ====================

const streamableSessions = new Map<string, {
  transport: StreamableHTTPServerTransport;
  apiClient: FinanzAppApiClient;
}>();

app.post('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (sessionId && streamableSessions.has(sessionId)) {
    const session = streamableSessions.get(sessionId)!;
    await session.transport.handleRequest(req, res, req.body);
    return;
  }

  const apiClient = new FinanzAppApiClient(config.apiBaseUrl, config.jwtToken);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    onsessioninitialized: (newSessionId) => {
      streamableSessions.set(newSessionId, { transport, apiClient });
      console.log(`Nueva sesion Streamable HTTP: ${newSessionId} (total: ${streamableSessions.size})`);
    },
  });

  transport.onclose = () => {
    const id = findSessionId(transport);
    if (id) {
      streamableSessions.delete(id);
      console.log(`Sesion Streamable HTTP cerrada: ${id} (total: ${streamableSessions.size})`);
    }
  };

  const server = createMcpServer(apiClient);
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  // Sesion existente: delegar al transport
  if (sessionId && streamableSessions.has(sessionId)) {
    const session = streamableSessions.get(sessionId)!;
    await session.transport.handleRequest(req, res);
    return;
  }

  // Sin session: n8n envía GET antes de POST initialize.
  // El SDK rechaza GET sin sesion inicializada (400).
  // Retornamos un SSE stream vacío para que n8n proceda con POST.
  console.log('GET /mcp sin sesion - abriendo SSE stream pendiente');
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
  });
  res.write(':ok\n\n');
  res.flushHeaders();

  const keepAlive = setInterval(() => {
    if (!res.writableEnded) {
      res.write(':ping\n\n');
    }
  }, 15000);

  res.on('close', () => {
    clearInterval(keepAlive);
    console.log('SSE stream pendiente cerrada');
  });
});

app.delete('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId || !streamableSessions.has(sessionId)) {
    res.status(400).json({ error: 'Session ID requerido o invalido' });
    return;
  }

  const session = streamableSessions.get(sessionId)!;
  await session.transport.handleRequest(req, res);
  streamableSessions.delete(sessionId);
  console.log(`Sesion Streamable HTTP eliminada: ${sessionId} (total: ${streamableSessions.size})`);
});

function findSessionId(transport: StreamableHTTPServerTransport): string | undefined {
  for (const [id, session] of streamableSessions) {
    if (session.transport === transport) return id;
  }
  return undefined;
}

// ==================== SSE Transport (Legacy) ====================

interface SseSession {
  transport: SSEServerTransport;
  apiClient: FinanzAppApiClient;
}

const sseSessions = new Map<string, SseSession>();

app.get('/sse', async (req: Request, res: Response) => {
  const sseApiClient = new FinanzAppApiClient(config.apiBaseUrl, config.jwtToken);
  const transport = new SSEServerTransport('/messages', res);
  const sessionId = transport.sessionId;

  sseSessions.set(sessionId, { transport, apiClient: sseApiClient });
  console.log(`Nueva sesion SSE: ${sessionId} (total: ${sseSessions.size})`);

  res.on('close', () => {
    sseSessions.delete(sessionId);
    console.log(`Sesion SSE cerrada: ${sessionId} (total: ${sseSessions.size})`);
  });

  const server = createMcpServer(sseApiClient);
  await server.connect(transport);
});

app.post('/messages', async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const session = sseSessions.get(sessionId);

  if (!session) {
    res.status(404).json({ error: 'Sesion no encontrada' });
    return;
  }

  await session.transport.handlePostMessage(req, res, req.body);
});

// ==================== Health Check ====================

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    transports: ['streamable-http', 'sse'],
    sessions: {
      streamableHttp: streamableSessions.size,
      sse: sseSessions.size,
    },
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`FinanzApp MCP Server escuchando en http://0.0.0.0:${port}`);
  console.log(`  Streamable HTTP: POST /mcp`);
  console.log(`  SSE (legacy):    GET  /sse`);
  console.log(`  Health:          GET  /health`);
});
