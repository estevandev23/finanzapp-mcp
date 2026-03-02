/**
 * Configuración del servidor MCP para FinanzApp
 */

export interface Config {
  apiBaseUrl: string;
  jwtToken?: string;
  numeroWhatsapp?: string;
  timeout: number;
}

export function loadConfig(): Config {
  return {
    apiBaseUrl: process.env.FINANZAPP_API_URL || 'http://localhost:8080/api/v1',
    jwtToken: process.env.FINANZAPP_JWT_TOKEN,
    numeroWhatsapp: process.env.FINANZAPP_WHATSAPP_NUMBER,
    timeout: parseInt(process.env.FINANZAPP_TIMEOUT || '30000', 10),
  };
}

export const config = loadConfig();
