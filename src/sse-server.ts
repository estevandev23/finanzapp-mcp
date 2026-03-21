/**
 * Servidor SSE para FinanzApp MCP
 *
 * Implementa el transporte SSE del protocolo MCP,
 * permitiendo que clientes como n8n MCP Client Tool se conecten.
 * Cada conexion SSE crea su propia instancia de servidor MCP
 * con un ApiClient independiente para manejo de JWT per-session.
 */

import express, { Request, Response } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createMcpServer } from './index.js';
import { FinanzAppApiClient } from './api-client.js';
import { config } from './config.js';

const app = express();
const port = parseInt(process.env.MCP_SSE_PORT || process.env.MCP_HTTP_PORT || '3001', 10);

app.use(express.json());

interface SseSession {
  transport: SSEServerTransport;
  apiClient: FinanzAppApiClient;
}

const sessions = new Map<string, SseSession>();

app.get('/sse', async (req: Request, res: Response) => {
  const apiClient = new FinanzAppApiClient(config.apiBaseUrl, config.jwtToken);
  const transport = new SSEServerTransport('/messages', res);
  const sessionId = transport.sessionId;

  sessions.set(sessionId, { transport, apiClient });
  console.log(`Nueva sesion SSE: ${sessionId} (total: ${sessions.size})`);

  res.on('close', () => {
    sessions.delete(sessionId);
    console.log(`Sesion SSE cerrada: ${sessionId} (total: ${sessions.size})`);
  });

  const server = createMcpServer(apiClient);
  await server.connect(transport);
});

app.post('/messages', async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const session = sessions.get(sessionId);

  if (!session) {
    res.status(404).json({ error: 'Sesion no encontrada' });
    return;
  }

  await session.transport.handlePostMessage(req, res, req.body);
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    transport: 'sse',
    sessions: sessions.size,
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`FinanzApp MCP SSE Server escuchando en http://0.0.0.0:${port}/sse`);
});
