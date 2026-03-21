/**
 * Servidor HTTP Streamable para FinanzApp MCP
 *
 * Implementa el transporte Streamable HTTP del protocolo MCP,
 * permitiendo que clientes como N8N se conecten via HTTP
 * en lugar del transporte stdio tradicional.
 */

import express, { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from './index.js';

const app = express();
const port = parseInt(process.env.MCP_HTTP_PORT || '3001', 10);

app.use(express.json());

const transports = new Map<string, StreamableHTTPServerTransport>();

app.post('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (sessionId && transports.has(sessionId)) {
    const transport = transports.get(sessionId)!;
    await transport.handleRequest(req, res, req.body);
    return;
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (id: string) => {
      transports.set(id, transport);
    },
  });

  transport.onclose = () => {
    const sid = transport.sessionId;
    if (sid) {
      transports.delete(sid);
    }
  };

  const server = createMcpServer();
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !transports.has(sessionId)) {
    res.status(400).json({ error: 'Session ID invalido o ausente' });
    return;
  }
  const transport = transports.get(sessionId)!;
  await transport.handleRequest(req, res);
});

app.delete('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (sessionId && transports.has(sessionId)) {
    const transport = transports.get(sessionId)!;
    await transport.handleRequest(req, res);
    transports.delete(sessionId);
    return;
  }
  res.status(200).json({ message: 'Sesion cerrada' });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', transport: 'streamable-http', sessions: transports.size });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`FinanzApp MCP HTTP Server escuchando en http://0.0.0.0:${port}/mcp`);
});
