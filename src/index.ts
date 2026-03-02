#!/usr/bin/env node

/**
 * Servidor MCP para FinanzApp - Asistente Financiero Personal
 *
 * Este servidor implementa el Model Context Protocol (MCP) para permitir
 * a Claude interactuar con el backend de FinanzApp mediante lenguaje natural.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { apiClient, FinanzAppApiClient } from './api-client.js';
import { config } from './config.js';

// ==================== ESQUEMAS DE VALIDACIÓN ====================

const CrearIngresoSchema = z.object({
  monto: z.number().positive('El monto debe ser positivo'),
  categoria: z.enum([
    'TRABAJO_PRINCIPAL',
    'TRABAJO_EXTRA',
    'GANANCIAS_ADICIONALES',
    'INVERSIONES',
    'OTROS'
  ]).optional(),
  categoriaPersonalizadaId: z.string().uuid().optional(),
  descripcion: z.string().optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  montoAhorro: z.number().min(0).optional(),
  metaId: z.string().uuid().optional(),
});

const CrearGastoSchema = z.object({
  monto: z.number().positive('El monto debe ser positivo'),
  categoria: z.enum([
    'COMIDA',
    'PAREJA',
    'COMPRAS',
    'TRANSPORTE',
    'SERVICIOS',
    'ENTRETENIMIENTO',
    'SALUD',
    'EDUCACION',
    'INVERSIONES',
    'ABONO',
    'OTROS'
  ]).optional(),
  categoriaPersonalizadaId: z.string().uuid().optional(),
  descripcion: z.string().optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const CrearAhorroSchema = z.object({
  monto: z.number().positive('El monto debe ser positivo'),
  descripcion: z.string().optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  metaId: z.string().uuid().optional(),
});

const CrearInversionSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  descripcion: z.string().optional(),
  monto: z.number().positive('El monto debe ser positivo'),
  retornoEsperado: z.number().positive().optional(),
  fechaInversion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const RegistrarRetornoInversionSchema = z.object({
  inversionId: z.string().uuid('ID de inversión inválido'),
  retornoReal: z.number().positive('El retorno debe ser positivo'),
  fechaRetorno: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const CrearMetaSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  descripcion: z.string().optional(),
  montoObjetivo: z.number().positive('El monto objetivo debe ser positivo'),
  fechaLimite: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const ConsultarPeriodoSchema = z.object({
  fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha: YYYY-MM-DD'),
  fechaFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha: YYYY-MM-DD'),
});

const ConsultarCategoriaSchema = z.object({
  categoria: z.string().min(1),
});

const RegistrarProgresoMetaSchema = z.object({
  metaId: z.string().uuid('ID de meta inválido'),
  monto: z.number().positive('El monto debe ser positivo'),
});

const CrearDeudaSchema = z.object({
  tipo: z.enum(['DEUDA', 'PRESTAMO']),
  descripcion: z.string().min(1, 'La descripcion es requerida'),
  entidad: z.string().optional(),
  montoTotal: z.number().positive('El monto debe ser positivo'),
  fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fechaLimite: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const AbonarDeudaSchema = z.object({
  deudaId: z.string().uuid('ID de deuda invalido'),
  monto: z.number().positive('El monto debe ser positivo'),
  descripcion: z.string().optional(),
});

const CambiarEstadoMetaSchema = z.object({
  metaId: z.string().uuid('ID de meta inválido'),
  estado: z.enum(['ACTIVA', 'COMPLETADA', 'CANCELADA']),
});

const ConsultarEstadoDeudaSchema = z.object({
  estado: z.enum(['PENDIENTE', 'COMPLETADA']),
});

const ObtenerAhorrosPorMetaSchema = z.object({
  metaId: z.string().uuid('ID de meta inválido'),
});

// ==================== DEFINICIÓN DE HERRAMIENTAS ====================

const tools: Tool[] = [
  // --- INGRESOS ---
  {
    name: 'crearIngreso',
    description: `Registra un nuevo ingreso de dinero para el usuario.
Categorías predeterminadas: TRABAJO_PRINCIPAL, TRABAJO_EXTRA, GANANCIAS_ADICIONALES, INVERSIONES, OTROS.
También se puede usar una categoría personalizada del usuario proporcionando su ID.
Opcionalmente se puede especificar un monto para ahorro que se descuenta del ingreso, y asociar a una meta financiera.`,
    inputSchema: {
      type: 'object',
      properties: {
        monto: { type: 'number', description: 'Monto del ingreso (obligatorio)' },
        categoria: {
          type: 'string',
          enum: ['TRABAJO_PRINCIPAL', 'TRABAJO_EXTRA', 'GANANCIAS_ADICIONALES', 'INVERSIONES', 'OTROS'],
          description: 'Categoría predeterminada del ingreso (usar solo si no se usa categoriaPersonalizadaId)'
        },
        categoriaPersonalizadaId: { type: 'string', description: 'ID de una categoría personalizada del usuario (alternativa a categoria)' },
        descripcion: { type: 'string', description: 'Descripción opcional del ingreso' },
        fecha: { type: 'string', description: 'Fecha en formato YYYY-MM-DD (por defecto hoy)' },
        montoAhorro: { type: 'number', description: 'Monto a destinar para ahorro (opcional)' },
        metaId: { type: 'string', description: 'ID de la meta financiera a la que asociar el ahorro (opcional)' },
      },
      required: ['monto'],
    },
  },
  {
    name: 'obtenerIngresos',
    description: 'Obtiene la lista de todos los ingresos registrados por el usuario.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'obtenerIngresosPorPeriodo',
    description: 'Obtiene los ingresos en un rango de fechas específico.',
    inputSchema: {
      type: 'object',
      properties: {
        fechaInicio: { type: 'string', description: 'Fecha inicial en formato YYYY-MM-DD' },
        fechaFin: { type: 'string', description: 'Fecha final en formato YYYY-MM-DD' },
      },
      required: ['fechaInicio', 'fechaFin'],
    },
  },
  {
    name: 'obtenerTotalIngresos',
    description: 'Obtiene el total de ingresos del usuario.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // --- GASTOS (EGRESOS) ---
  {
    name: 'crearEgreso',
    description: `Registra un nuevo gasto/egreso para el usuario.
Categorías predeterminadas: COMIDA, PAREJA, COMPRAS, TRANSPORTE, SERVICIOS, ENTRETENIMIENTO, SALUD, EDUCACION, OTROS.
También se puede usar una categoría personalizada del usuario proporcionando su ID.`,
    inputSchema: {
      type: 'object',
      properties: {
        monto: { type: 'number', description: 'Monto del gasto (obligatorio)' },
        categoria: {
          type: 'string',
          enum: ['COMIDA', 'PAREJA', 'COMPRAS', 'TRANSPORTE', 'SERVICIOS', 'ENTRETENIMIENTO', 'SALUD', 'EDUCACION', 'INVERSIONES', 'ABONO', 'OTROS'],
          description: 'Categoría predeterminada del gasto (usar solo si no se usa categoriaPersonalizadaId)'
        },
        categoriaPersonalizadaId: { type: 'string', description: 'ID de una categoría personalizada del usuario (alternativa a categoria)' },
        descripcion: { type: 'string', description: 'Descripción opcional del gasto' },
        fecha: { type: 'string', description: 'Fecha en formato YYYY-MM-DD (por defecto hoy)' },
      },
      required: ['monto'],
    },
  },
  {
    name: 'obtenerGastos',
    description: 'Obtiene la lista de todos los gastos registrados por el usuario.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'obtenerGastosPorPeriodo',
    description: 'Obtiene los gastos en un rango de fechas específico.',
    inputSchema: {
      type: 'object',
      properties: {
        fechaInicio: { type: 'string', description: 'Fecha inicial en formato YYYY-MM-DD' },
        fechaFin: { type: 'string', description: 'Fecha final en formato YYYY-MM-DD' },
      },
      required: ['fechaInicio', 'fechaFin'],
    },
  },
  {
    name: 'obtenerGastosPorCategoria',
    description: 'Obtiene los gastos de una categoría específica.',
    inputSchema: {
      type: 'object',
      properties: {
        categoria: {
          type: 'string',
          enum: ['COMIDA', 'PAREJA', 'COMPRAS', 'TRANSPORTE', 'SERVICIOS', 'ENTRETENIMIENTO', 'SALUD', 'EDUCACION', 'OTROS'],
          description: 'Categoría a consultar'
        },
      },
      required: ['categoria'],
    },
  },
  {
    name: 'obtenerTotalGastos',
    description: 'Obtiene el total de gastos del usuario.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'obtenerDesgloseGastos',
    description: 'Obtiene un desglose de gastos por categoría, mostrando cuánto se ha gastado en cada una.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'obtenerDesgloseGastosPorPeriodo',
    description: 'Obtiene un desglose de gastos por categoría en un período específico.',
    inputSchema: {
      type: 'object',
      properties: {
        fechaInicio: { type: 'string', description: 'Fecha inicial en formato YYYY-MM-DD' },
        fechaFin: { type: 'string', description: 'Fecha final en formato YYYY-MM-DD' },
      },
      required: ['fechaInicio', 'fechaFin'],
    },
  },

  // --- AHORROS ---
  {
    name: 'crearAhorro',
    description: 'Registra un nuevo ahorro. Opcionalmente puede asociarse a una meta financiera.',
    inputSchema: {
      type: 'object',
      properties: {
        monto: { type: 'number', description: 'Monto a ahorrar (obligatorio)' },
        descripcion: { type: 'string', description: 'Descripción del ahorro' },
        fecha: { type: 'string', description: 'Fecha en formato YYYY-MM-DD (por defecto hoy)' },
        metaId: { type: 'string', description: 'ID de la meta financiera a la cual asociar el ahorro (opcional)' },
      },
      required: ['monto'],
    },
  },
  {
    name: 'obtenerAhorros',
    description: 'Obtiene la lista de todos los ahorros registrados por el usuario.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'obtenerAhorrosPorPeriodo',
    description: 'Obtiene los ahorros en un rango de fechas específico.',
    inputSchema: {
      type: 'object',
      properties: {
        fechaInicio: { type: 'string', description: 'Fecha inicial en formato YYYY-MM-DD' },
        fechaFin: { type: 'string', description: 'Fecha final en formato YYYY-MM-DD' },
      },
      required: ['fechaInicio', 'fechaFin'],
    },
  },
  {
    name: 'obtenerTotalAhorros',
    description: 'Obtiene el total de ahorros del usuario.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // --- METAS FINANCIERAS ---
  {
    name: 'crearMeta',
    description: 'Crea una nueva meta financiera con un objetivo de ahorro.',
    inputSchema: {
      type: 'object',
      properties: {
        nombre: { type: 'string', description: 'Nombre de la meta (obligatorio)' },
        descripcion: { type: 'string', description: 'Descripción de la meta' },
        montoObjetivo: { type: 'number', description: 'Monto objetivo a alcanzar (obligatorio)' },
        fechaLimite: { type: 'string', description: 'Fecha límite en formato YYYY-MM-DD (opcional)' },
      },
      required: ['nombre', 'montoObjetivo'],
    },
  },
  {
    name: 'obtenerMetas',
    description: 'Obtiene todas las metas financieras del usuario con su progreso.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'obtenerMetasActivas',
    description: 'Obtiene las metas financieras activas (en progreso) del usuario.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'registrarProgresoMeta',
    description: 'Registra un progreso (abono) hacia una meta financiera.',
    inputSchema: {
      type: 'object',
      properties: {
        metaId: { type: 'string', description: 'ID de la meta' },
        monto: { type: 'number', description: 'Monto a abonar' },
      },
      required: ['metaId', 'monto'],
    },
  },
  {
    name: 'cambiarEstadoMeta',
    description: 'Cambia el estado de una meta financiera a ACTIVA, COMPLETADA o CANCELADA.',
    inputSchema: {
      type: 'object',
      properties: {
        metaId: { type: 'string', description: 'ID de la meta financiera' },
        estado: {
          type: 'string',
          enum: ['ACTIVA', 'COMPLETADA', 'CANCELADA'],
          description: 'Nuevo estado de la meta',
        },
      },
      required: ['metaId', 'estado'],
    },
  },
  {
    name: 'obtenerAhorrosPorMeta',
    description: 'Obtiene todos los ahorros asociados a una meta financiera específica.',
    inputSchema: {
      type: 'object',
      properties: {
        metaId: { type: 'string', description: 'ID de la meta financiera' },
      },
      required: ['metaId'],
    },
  },

  // --- BALANCE Y RESUMEN ---
  {
    name: 'obtenerBalance',
    description: 'Obtiene el balance general del usuario: total de ingresos, gastos, ahorros y dinero disponible.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'obtenerBalancePorPeriodo',
    description: 'Obtiene el balance del usuario en un período específico.',
    inputSchema: {
      type: 'object',
      properties: {
        fechaInicio: { type: 'string', description: 'Fecha inicial en formato YYYY-MM-DD' },
        fechaFin: { type: 'string', description: 'Fecha final en formato YYYY-MM-DD' },
      },
      required: ['fechaInicio', 'fechaFin'],
    },
  },
  {
    name: 'obtenerResumenFinanciero',
    description: `Obtiene un resumen financiero completo del usuario incluyendo:
- Balance general (ingresos, gastos, ahorros, disponible)
- Desglose de gastos por categoría
- Estado de metas activas
Ideal para tener una visión completa de la situación financiera.`,
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'obtenerAnalisisFinanciero',
    description: `Realiza un análisis financiero del usuario comparando ingresos vs gastos,
identificando patrones de gasto y evaluando el cumplimiento de metas.
Útil para dar recomendaciones personalizadas.`,
    inputSchema: {
      type: 'object',
      properties: {
        fechaInicio: { type: 'string', description: 'Fecha inicial para el análisis (opcional)' },
        fechaFin: { type: 'string', description: 'Fecha final para el análisis (opcional)' },
      },
    },
  },

  // --- REGISTROS GENERALES ---
  {
    name: 'obtenerRegistros',
    description: `Obtiene todos los registros financieros (ingresos, gastos, ahorros) en un período.
Útil para consultas generales como "¿qué movimientos tuve este mes?".`,
    inputSchema: {
      type: 'object',
      properties: {
        fechaInicio: { type: 'string', description: 'Fecha inicial en formato YYYY-MM-DD' },
        fechaFin: { type: 'string', description: 'Fecha final en formato YYYY-MM-DD' },
        tipo: {
          type: 'string',
          enum: ['TODOS', 'INGRESOS', 'GASTOS', 'AHORROS', 'INVERSIONES'],
          description: 'Tipo de registros a consultar (por defecto TODOS)'
        },
      },
      required: ['fechaInicio', 'fechaFin'],
    },
  },

  // --- CATEGORÍAS PERSONALIZADAS ---
  {
    name: 'obtenerCategoriasPersonalizadas',
    description: `Obtiene las categorías personalizadas del usuario, opcionalmente filtradas por tipo (INGRESO o GASTO).
Útil para saber qué categorías personalizadas tiene disponibles el usuario antes de registrar un ingreso o gasto.`,
    inputSchema: {
      type: 'object',
      properties: {
        tipo: {
          type: 'string',
          enum: ['INGRESO', 'GASTO'],
          description: 'Filtrar por tipo de categoría (opcional, sin filtro devuelve todas)'
        },
      },
    },
  },

  // --- DEUDAS Y PRÉSTAMOS ---
  {
    name: 'crearDeuda',
    description: `Registra una nueva deuda (dinero que el usuario debe) o prestamo (dinero que le deben al usuario).
DEUDA: reduce el dinero disponible del usuario.
PRESTAMO: dinero prestado a alguien, los abonos recibidos suman al capital.`,
    inputSchema: {
      type: 'object',
      properties: {
        tipo: {
          type: 'string',
          enum: ['DEUDA', 'PRESTAMO'],
          description: 'DEUDA = dinero que debo, PRESTAMO = dinero que me deben',
        },
        descripcion: { type: 'string', description: 'Descripcion de la deuda o prestamo' },
        entidad: { type: 'string', description: 'Persona o entidad involucrada' },
        montoTotal: { type: 'number', description: 'Monto total de la deuda o prestamo' },
        fechaInicio: { type: 'string', description: 'Fecha de inicio en formato YYYY-MM-DD' },
        fechaLimite: { type: 'string', description: 'Fecha limite de pago en formato YYYY-MM-DD' },
      },
      required: ['tipo', 'descripcion', 'montoTotal'],
    },
  },
  {
    name: 'obtenerDeudas',
    description: 'Obtiene las deudas del usuario (dinero que debe). Incluye monto total, abonado, restante y porcentaje de avance.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'obtenerPrestamos',
    description: 'Obtiene los prestamos del usuario (dinero que le deben). Incluye monto total, abonado, restante y porcentaje de avance.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'abonarDeuda',
    description: `Registra un abono/pago a una deuda o prestamo existente.
El abono no puede superar el monto restante.
Cuando el monto restante llega a 0, se marca como COMPLETADA automaticamente.`,
    inputSchema: {
      type: 'object',
      properties: {
        deudaId: { type: 'string', description: 'ID de la deuda o prestamo' },
        monto: { type: 'number', description: 'Monto del abono' },
        descripcion: { type: 'string', description: 'Descripcion del abono (opcional)' },
      },
      required: ['deudaId', 'monto'],
    },
  },
  {
    name: 'obtenerResumenDeudas',
    description: 'Obtiene un resumen con el total de deudas pendientes, total de prestamos pendientes y abonos recibidos.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'obtenerAbonosDeuda',
    description: 'Obtiene el historial de abonos de una deuda o prestamo especifico.',
    inputSchema: {
      type: 'object',
      properties: {
        deudaId: { type: 'string', description: 'ID de la deuda o prestamo' },
      },
      required: ['deudaId'],
    },
  },
  {
    name: 'obtenerDeudasPorEstado',
    description: 'Obtiene deudas o préstamos filtrados por estado: PENDIENTE (activos) o COMPLETADA (saldados).',
    inputSchema: {
      type: 'object',
      properties: {
        estado: {
          type: 'string',
          enum: ['PENDIENTE', 'COMPLETADA'],
          description: 'Estado a filtrar',
        },
      },
      required: ['estado'],
    },
  },
  {
    name: 'crearInversion',
    description: 'Crea una nueva inversión. Al crearse, se registra automáticamente un gasto por el monto invertido. Se puede indicar el retorno esperado como referencia, sin que afecte el balance.',
    inputSchema: {
      type: 'object',
      properties: {
        nombre: { type: 'string', description: 'Nombre o descripción de la inversión (ej: "Acciones de Apple", "CDT Bancolombia")' },
        descripcion: { type: 'string', description: 'Descripción detallada opcional' },
        monto: { type: 'number', description: 'Monto invertido' },
        retornoEsperado: { type: 'number', description: 'Retorno esperado en valor absoluto (opcional, solo referencial)' },
        fechaInversion: { type: 'string', description: 'Fecha de la inversión en formato YYYY-MM-DD (opcional, por defecto hoy)' },
      },
      required: ['nombre', 'monto'],
    },
  },
  {
    name: 'obtenerInversiones',
    description: 'Lista las inversiones del usuario. Puede filtrarse por estado: ACTIVA (en curso) o FINALIZADA (con retorno registrado).',
    inputSchema: {
      type: 'object',
      properties: {
        estado: { type: 'string', enum: ['ACTIVA', 'FINALIZADA'], description: 'Filtrar por estado (opcional)' },
      },
    },
  },
  {
    name: 'registrarRetornoInversion',
    description: 'Registra el retorno real de una inversión. Esto crea automáticamente un ingreso por el monto del retorno y marca la inversión como FINALIZADA. Muestra si hubo ganancia o pérdida.',
    inputSchema: {
      type: 'object',
      properties: {
        inversionId: { type: 'string', description: 'ID de la inversión' },
        retornoReal: { type: 'number', description: 'Monto real obtenido como retorno' },
        fechaRetorno: { type: 'string', description: 'Fecha del retorno en formato YYYY-MM-DD (opcional, por defecto hoy)' },
      },
      required: ['inversionId', 'retornoReal'],
    },
  },
];

// ==================== MANEJADORES DE HERRAMIENTAS ====================

async function handleToolCall(name: string, args: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      // --- INGRESOS ---
      case 'crearIngreso': {
        const validated = CrearIngresoSchema.parse(args);
        if (!validated.categoria && !validated.categoriaPersonalizadaId) {
          validated.categoria = 'OTROS';
        }
        const result = await apiClient.crearIngreso({
          monto: validated.monto,
          categoria: validated.categoria || 'OTROS',
          descripcion: validated.descripcion,
          fecha: validated.fecha,
          montoAhorro: validated.montoAhorro,
          categoriaPersonalizadaId: validated.categoriaPersonalizadaId,
          metaId: validated.metaId,
        });
        if (result.success) {
          return `Ingreso registrado exitosamente:
- Monto: $${validated.monto.toLocaleString()}
- Categoría: ${validated.categoriaPersonalizadaId ? 'Personalizada' : validated.categoria}
- Descripción: ${validated.descripcion || 'Sin descripción'}
${validated.montoAhorro ? `- Monto destinado a ahorro: $${validated.montoAhorro.toLocaleString()}` : ''}
${validated.metaId ? `- Asociado a meta: ${validated.metaId}` : ''}`;
        }
        return `Error al registrar ingreso: ${result.message}`;
      }

      case 'obtenerIngresos': {
        const result = await apiClient.obtenerIngresos();
        if (result.success && result.data.length > 0) {
          const ingresos = result.data.map((i: any) =>
            `- ${i.fecha}: $${i.monto.toLocaleString()} (${i.categoria}) ${i.descripcion ? `- ${i.descripcion}` : ''}`
          ).join('\n');
          return `Ingresos registrados:\n${ingresos}`;
        }
        return 'No hay ingresos registrados.';
      }

      case 'obtenerIngresosPorPeriodo': {
        const validated = ConsultarPeriodoSchema.parse(args);
        const result = await apiClient.obtenerIngresosPorPeriodo(validated.fechaInicio, validated.fechaFin);
        if (result.success && result.data.length > 0) {
          const total = result.data.reduce((sum: number, i: any) => sum + i.monto, 0);
          const ingresos = result.data.map((i: any) =>
            `- ${i.fecha}: $${i.monto.toLocaleString()} (${i.categoria})`
          ).join('\n');
          return `Ingresos del ${validated.fechaInicio} al ${validated.fechaFin}:\n${ingresos}\n\nTotal: $${total.toLocaleString()}`;
        }
        return `No hay ingresos en el período ${validated.fechaInicio} a ${validated.fechaFin}.`;
      }

      case 'obtenerTotalIngresos': {
        const result = await apiClient.obtenerTotalIngresos();
        return result.success
          ? `Total de ingresos: $${result.data.toLocaleString()}`
          : `Error al obtener total: ${result.message}`;
      }

      // --- GASTOS ---
      case 'crearEgreso': {
        const validated = CrearGastoSchema.parse(args);
        if (!validated.categoria && !validated.categoriaPersonalizadaId) {
          validated.categoria = 'OTROS';
        }
        const result = await apiClient.crearGasto({
          monto: validated.monto,
          categoria: validated.categoria || 'OTROS',
          descripcion: validated.descripcion,
          fecha: validated.fecha,
          categoriaPersonalizadaId: validated.categoriaPersonalizadaId,
        });
        if (result.success) {
          return `Gasto registrado exitosamente:
- Monto: $${validated.monto.toLocaleString()}
- Categoría: ${validated.categoriaPersonalizadaId ? 'Personalizada' : validated.categoria}
- Descripción: ${validated.descripcion || 'Sin descripción'}`;
        }
        return `Error al registrar gasto: ${result.message}`;
      }

      case 'obtenerGastos': {
        const result = await apiClient.obtenerGastos();
        if (result.success && result.data.length > 0) {
          const gastos = result.data.map((g: any) =>
            `- ${g.fecha}: $${g.monto.toLocaleString()} (${g.categoria}) ${g.descripcion ? `- ${g.descripcion}` : ''}`
          ).join('\n');
          return `Gastos registrados:\n${gastos}`;
        }
        return 'No hay gastos registrados.';
      }

      case 'obtenerGastosPorPeriodo': {
        const validated = ConsultarPeriodoSchema.parse(args);
        const result = await apiClient.obtenerGastosPorPeriodo(validated.fechaInicio, validated.fechaFin);
        if (result.success && result.data.length > 0) {
          const total = result.data.reduce((sum: number, g: any) => sum + g.monto, 0);
          const gastos = result.data.map((g: any) =>
            `- ${g.fecha}: $${g.monto.toLocaleString()} (${g.categoria})`
          ).join('\n');
          return `Gastos del ${validated.fechaInicio} al ${validated.fechaFin}:\n${gastos}\n\nTotal: $${total.toLocaleString()}`;
        }
        return `No hay gastos en el período ${validated.fechaInicio} a ${validated.fechaFin}.`;
      }

      case 'obtenerGastosPorCategoria': {
        const validated = ConsultarCategoriaSchema.parse(args);
        const result = await apiClient.obtenerGastosPorCategoria(validated.categoria);
        if (result.success && result.data.length > 0) {
          const total = result.data.reduce((sum: number, g: any) => sum + g.monto, 0);
          const gastos = result.data.map((g: any) =>
            `- ${g.fecha}: $${g.monto.toLocaleString()} ${g.descripcion ? `- ${g.descripcion}` : ''}`
          ).join('\n');
          return `Gastos en ${validated.categoria}:\n${gastos}\n\nTotal: $${total.toLocaleString()}`;
        }
        return `No hay gastos en la categoría ${validated.categoria}.`;
      }

      case 'obtenerTotalGastos': {
        const result = await apiClient.obtenerTotalGastos();
        return result.success
          ? `Total de gastos: $${result.data.toLocaleString()}`
          : `Error al obtener total: ${result.message}`;
      }

      case 'obtenerDesgloseGastos': {
        const result = await apiClient.obtenerDesgloseGastos();
        if (result.success && Object.keys(result.data).length > 0) {
          const desglose = Object.entries(result.data)
            .map(([cat, monto]) => `- ${cat}: $${(monto as number).toLocaleString()}`)
            .join('\n');
          const total = Object.values(result.data).reduce((sum, m) => sum + (m as number), 0);
          return `Desglose de gastos por categoría:\n${desglose}\n\nTotal: $${total.toLocaleString()}`;
        }
        return 'No hay gastos registrados para mostrar el desglose.';
      }

      case 'obtenerDesgloseGastosPorPeriodo': {
        const validated = ConsultarPeriodoSchema.parse(args);
        const result = await apiClient.obtenerDesgloseGastosPorPeriodo(validated.fechaInicio, validated.fechaFin);
        if (result.success && Object.keys(result.data).length > 0) {
          const desglose = Object.entries(result.data)
            .map(([cat, monto]) => `- ${cat}: $${(monto as number).toLocaleString()}`)
            .join('\n');
          const total = Object.values(result.data).reduce((sum, m) => sum + (m as number), 0);
          return `Desglose de gastos (${validated.fechaInicio} a ${validated.fechaFin}):\n${desglose}\n\nTotal: $${total.toLocaleString()}`;
        }
        return `No hay gastos en el período ${validated.fechaInicio} a ${validated.fechaFin}.`;
      }

      // --- AHORROS ---
      case 'crearAhorro': {
        const validated = CrearAhorroSchema.parse(args);
        const result = await apiClient.crearAhorro({
          monto: validated.monto,
          descripcion: validated.descripcion,
          fecha: validated.fecha,
          metaId: validated.metaId,
        });
        if (result.success) {
          return `Ahorro registrado exitosamente:
- Monto: $${validated.monto.toLocaleString()}
- Descripción: ${validated.descripcion || 'Sin descripción'}
${validated.metaId ? '- Asociado a una meta financiera' : ''}`;
        }
        return `Error al registrar ahorro: ${result.message}`;
      }

      case 'obtenerAhorros': {
        const result = await apiClient.obtenerAhorros();
        if (result.success && result.data.length > 0) {
          const ahorros = result.data.map((a: any) =>
            `- ${a.fecha}: $${a.monto.toLocaleString()} ${a.descripcion ? `- ${a.descripcion}` : ''}`
          ).join('\n');
          return `Ahorros registrados:\n${ahorros}`;
        }
        return 'No hay ahorros registrados.';
      }

      case 'obtenerAhorrosPorPeriodo': {
        const validated = ConsultarPeriodoSchema.parse(args);
        const result = await apiClient.obtenerAhorrosPorPeriodo(validated.fechaInicio, validated.fechaFin);
        if (result.success && result.data.length > 0) {
          const total = result.data.reduce((sum: number, a: any) => sum + a.monto, 0);
          const ahorros = result.data.map((a: any) =>
            `- ${a.fecha}: $${a.monto.toLocaleString()}`
          ).join('\n');
          return `Ahorros del ${validated.fechaInicio} al ${validated.fechaFin}:\n${ahorros}\n\nTotal: $${total.toLocaleString()}`;
        }
        return `No hay ahorros en el período ${validated.fechaInicio} a ${validated.fechaFin}.`;
      }

      case 'obtenerTotalAhorros': {
        const result = await apiClient.obtenerTotalAhorros();
        return result.success
          ? `Total de ahorros: $${result.data.toLocaleString()}`
          : `Error al obtener total: ${result.message}`;
      }

      // --- METAS ---
      case 'crearMeta': {
        const validated = CrearMetaSchema.parse(args);
        const result = await apiClient.crearMeta({
          nombre: validated.nombre,
          descripcion: validated.descripcion,
          montoObjetivo: validated.montoObjetivo,
          fechaLimite: validated.fechaLimite,
        });
        if (result.success) {
          return `Meta financiera creada exitosamente:
- Nombre: ${validated.nombre}
- Objetivo: $${validated.montoObjetivo.toLocaleString()}
${validated.descripcion ? `- Descripción: ${validated.descripcion}` : ''}
${validated.fechaLimite ? `- Fecha límite: ${validated.fechaLimite}` : ''}`;
        }
        return `Error al crear meta: ${result.message}`;
      }

      case 'obtenerMetas': {
        const result = await apiClient.obtenerMetas();
        if (result.success && result.data.length > 0) {
          const metas = result.data.map((m: any) =>
            `- ${m.nombre}: $${m.montoActual?.toLocaleString() || 0}/$${m.montoObjetivo.toLocaleString()} (${m.porcentajeAvance?.toFixed(1) || 0}%) - Estado: ${m.estado}`
          ).join('\n');
          return `Metas financieras:\n${metas}`;
        }
        return 'No hay metas financieras registradas.';
      }

      case 'obtenerMetasActivas': {
        const result = await apiClient.obtenerMetasPorEstado('ACTIVA');
        if (result.success && result.data.length > 0) {
          const metas = result.data.map((m: any) =>
            `- ${m.nombre}: $${m.montoActual?.toLocaleString() || 0}/$${m.montoObjetivo.toLocaleString()} (${m.porcentajeAvance?.toFixed(1) || 0}%) - Restante: $${m.montoRestante?.toLocaleString() || m.montoObjetivo}`
          ).join('\n');
          return `Metas activas:\n${metas}`;
        }
        return 'No hay metas activas actualmente.';
      }

      case 'registrarProgresoMeta': {
        const validated = RegistrarProgresoMetaSchema.parse(args);
        const result = await apiClient.registrarProgresoMeta(validated.metaId, validated.monto);
        if (result.success) {
          return `Progreso registrado: $${validated.monto.toLocaleString()} abonados a la meta.`;
        }
        return `Error al registrar progreso: ${result.message}`;
      }

      case 'cambiarEstadoMeta': {
        const validated = CambiarEstadoMetaSchema.parse(args);
        const result = await apiClient.cambiarEstadoMeta(validated.metaId, validated.estado);
        if (result.success) {
          return `Estado de la meta actualizado a ${validated.estado} correctamente.`;
        }
        return `Error al cambiar estado: ${result.message}`;
      }

      case 'obtenerAhorrosPorMeta': {
        const validated = ObtenerAhorrosPorMetaSchema.parse(args);
        const result = await apiClient.obtenerAhorrosPorMeta(validated.metaId);
        if (result.success && result.data.length > 0) {
          const total = result.data.reduce((sum: number, a: any) => sum + a.monto, 0);
          const ahorros = result.data.map((a: any) =>
            `- ${a.fecha}: $${a.monto.toLocaleString()}${a.descripcion ? ` — ${a.descripcion}` : ''}`
          ).join('\n');
          return `Ahorros asociados a la meta:\n${ahorros}\n\nTotal ahorrado: $${total.toLocaleString()}`;
        }
        return 'No hay ahorros asociados a esta meta.';
      }

      // --- BALANCE ---
      case 'obtenerBalance': {
        const result = await apiClient.obtenerBalance();
        if (result.success) {
          const b = result.data;
          return `Balance general:
- Total ingresos: $${b.totalIngresos.toLocaleString()}
- Total gastos: $${b.totalGastos.toLocaleString()}
- Total ahorros: $${b.totalAhorros.toLocaleString()}
- Dinero disponible: $${b.dineroDisponible.toLocaleString()}`;
        }
        return `Error al obtener balance: ${result.message}`;
      }

      case 'obtenerBalancePorPeriodo': {
        const validated = ConsultarPeriodoSchema.parse(args);
        const result = await apiClient.obtenerBalancePorPeriodo(validated.fechaInicio, validated.fechaFin);
        if (result.success) {
          const b = result.data;
          return `Balance (${validated.fechaInicio} a ${validated.fechaFin}):
- Total ingresos: $${b.totalIngresos.toLocaleString()}
- Total gastos: $${b.totalGastos.toLocaleString()}
- Total ahorros: $${b.totalAhorros.toLocaleString()}
- Dinero disponible: $${b.dineroDisponible.toLocaleString()}`;
        }
        return `Error al obtener balance: ${result.message}`;
      }

      // --- RESUMEN Y ANÁLISIS ---
      case 'obtenerResumenFinanciero': {
        // Obtener balance, desglose, metas, resumen de deudas e inversiones
        const [balanceRes, desgloseRes, metasRes, deudasRes, inversionesRes] = await Promise.all([
          apiClient.obtenerBalance(),
          apiClient.obtenerDesgloseGastos(),
          apiClient.obtenerMetasPorEstado('ACTIVA'),
          apiClient.obtenerResumenDeudas(),
          apiClient.obtenerInversiones('ACTIVA'),
        ]);

        let resumen = '📊 RESUMEN FINANCIERO\n\n';

        if (balanceRes.success) {
          const b = balanceRes.data;
          resumen += `💰 Balance General:\n`;
          resumen += `- Ingresos totales: $${b.totalIngresos.toLocaleString()}\n`;
          resumen += `- Gastos totales: $${b.totalGastos.toLocaleString()}\n`;
          resumen += `- Ahorros: $${b.totalAhorros.toLocaleString()}\n`;
          resumen += `- Disponible: $${b.dineroDisponible.toLocaleString()}\n\n`;
        }

        if (desgloseRes.success && Object.keys(desgloseRes.data).length > 0) {
          resumen += `📈 Desglose de Gastos:\n`;
          Object.entries(desgloseRes.data).forEach(([cat, monto]) => {
            resumen += `- ${cat}: $${(monto as number).toLocaleString()}\n`;
          });
          resumen += '\n';
        }

        if (metasRes.success && metasRes.data.length > 0) {
          resumen += `🎯 Metas Activas:\n`;
          metasRes.data.forEach((m: any) => {
            resumen += `- ${m.nombre}: ${m.porcentajeAvance?.toFixed(1) || 0}% completado ($${m.montoActual?.toLocaleString() || 0}/$${m.montoObjetivo.toLocaleString()})\n`;
          });
          resumen += '\n';
        }

        if (deudasRes.success) {
          const r = deudasRes.data;
          const totalPendiente = (r.totalDeudas || 0) + (r.totalPrestamos || 0);
          if (totalPendiente > 0) {
            resumen += `💳 Deudas y Préstamos:\n`;
            if (r.totalDeudas > 0) resumen += `- Deudas pendientes: $${r.totalDeudas.toLocaleString()}\n`;
            if (r.totalPrestamos > 0) resumen += `- Préstamos por cobrar: $${r.totalPrestamos.toLocaleString()}\n`;
            resumen += '\n';
          }
        }

        if (inversionesRes.success && inversionesRes.data.length > 0) {
          const totalInvertido = inversionesRes.data.reduce((sum: number, i: any) => sum + Number(i.monto), 0);
          resumen += `📊 Inversiones Activas: ${inversionesRes.data.length} inversión(es) por $${totalInvertido.toLocaleString()}\n`;
        }

        return resumen;
      }

      case 'obtenerAnalisisFinanciero': {
        const fechaInicio = (args.fechaInicio as string) || getFirstDayOfMonth();
        const fechaFin = (args.fechaFin as string) || getToday();

        const [balanceRes, desgloseRes, metasRes] = await Promise.all([
          apiClient.obtenerBalancePorPeriodo(fechaInicio, fechaFin),
          apiClient.obtenerDesgloseGastosPorPeriodo(fechaInicio, fechaFin),
          apiClient.obtenerMetasPorEstado('ACTIVA'),
        ]);

        let analisis = `📊 ANÁLISIS FINANCIERO (${fechaInicio} a ${fechaFin})\n\n`;

        if (balanceRes.success) {
          const b = balanceRes.data;
          const balance = b.totalIngresos - b.totalGastos;

          analisis += `💵 Flujo de Dinero:\n`;
          analisis += `- Ingresos: $${b.totalIngresos.toLocaleString()}\n`;
          analisis += `- Gastos: $${b.totalGastos.toLocaleString()}\n`;
          analisis += `- Balance: $${balance.toLocaleString()} ${balance >= 0 ? '✅' : '⚠️'}\n\n`;

          if (balance < 0) {
            analisis += `⚠️ Alerta: Estás gastando más de lo que ganas.\n\n`;
          } else if (b.totalAhorros > 0) {
            const tasaAhorro = (b.totalAhorros / b.totalIngresos * 100).toFixed(1);
            analisis += `💪 Tasa de ahorro: ${tasaAhorro}%\n\n`;
          }
        }

        if (desgloseRes.success && Object.keys(desgloseRes.data).length > 0) {
          const total = Object.values(desgloseRes.data).reduce((sum, m) => sum + (m as number), 0);
          analisis += `📈 Distribución de Gastos:\n`;
          Object.entries(desgloseRes.data)
            .sort(([,a], [,b]) => (b as number) - (a as number))
            .forEach(([cat, monto]) => {
              const porcentaje = ((monto as number) / total * 100).toFixed(1);
              analisis += `- ${cat}: $${(monto as number).toLocaleString()} (${porcentaje}%)\n`;
            });

          const maxCat = Object.entries(desgloseRes.data)
            .sort(([,a], [,b]) => (b as number) - (a as number))[0];
          if (maxCat) {
            analisis += `\n💡 Mayor gasto: ${maxCat[0]} representa el gasto principal.\n`;
          }
        }

        if (metasRes.success && metasRes.data.length > 0) {
          analisis += `\n🎯 Progreso de Metas:\n`;
          metasRes.data.forEach((m: any) => {
            const estado = m.porcentajeAvance >= 75 ? '🟢' : m.porcentajeAvance >= 50 ? '🟡' : '🔴';
            analisis += `${estado} ${m.nombre}: ${m.porcentajeAvance?.toFixed(1) || 0}%\n`;
          });
        }

        return analisis;
      }

      case 'obtenerRegistros': {
        const fechaInicio = args.fechaInicio as string;
        const fechaFin = args.fechaFin as string;
        const tipo = (args.tipo as string) || 'TODOS';

        const registros: string[] = [];

        if (tipo === 'TODOS' || tipo === 'INGRESOS') {
          const result = await apiClient.obtenerIngresosPorPeriodo(fechaInicio, fechaFin);
          if (result.success && result.data.length > 0) {
            result.data.forEach((i: any) => {
              registros.push(`[INGRESO] ${i.fecha}: +$${i.monto.toLocaleString()} (${i.categoria})${i.descripcion ? ` — ${i.descripcion}` : ''}`);
            });
          }
        }

        if (tipo === 'TODOS' || tipo === 'GASTOS') {
          const result = await apiClient.obtenerGastosPorPeriodo(fechaInicio, fechaFin);
          if (result.success && result.data.length > 0) {
            result.data.forEach((g: any) => {
              registros.push(`[GASTO] ${g.fecha}: -$${g.monto.toLocaleString()} (${g.categoria})${g.descripcion ? ` — ${g.descripcion}` : ''}`);
            });
          }
        }

        if (tipo === 'TODOS' || tipo === 'AHORROS') {
          const result = await apiClient.obtenerAhorrosPorPeriodo(fechaInicio, fechaFin);
          if (result.success && result.data.length > 0) {
            result.data.forEach((a: any) => {
              registros.push(`[AHORRO] ${a.fecha}: $${a.monto.toLocaleString()}${a.descripcion ? ` — ${a.descripcion}` : ''}`);
            });
          }
        }

        if (tipo === 'TODOS' || tipo === 'INVERSIONES') {
          const result = await apiClient.obtenerInversiones();
          if (result.success && result.data.length > 0) {
            result.data
              .filter((i: any) => i.fechaInversion >= fechaInicio && i.fechaInversion <= fechaFin)
              .forEach((i: any) => {
                registros.push(`[INVERSION] ${i.fechaInversion}: -$${Number(i.monto).toLocaleString()} — ${i.nombre} [${i.estado}]`);
                if (i.retornoReal && i.fechaRetorno >= fechaInicio && i.fechaRetorno <= fechaFin) {
                  registros.push(`[RETORNO] ${i.fechaRetorno}: +$${Number(i.retornoReal).toLocaleString()} — ${i.nombre}`);
                }
              });
          }
        }

        if (registros.length === 0) {
          return `No hay registros en el período ${fechaInicio} a ${fechaFin}.`;
        }

        registros.sort();
        return `Registros del ${fechaInicio} al ${fechaFin}:\n${registros.join('\n')}`;
      }

      // --- CATEGORÍAS PERSONALIZADAS ---
      case 'obtenerCategoriasPersonalizadas': {
        const tipo = args.tipo as string | undefined;
        const endpoint = tipo ? `/categorias/tipo/${tipo}` : '/categorias';
        const result = await apiClient.getCategorias(endpoint);
        if (result.success && result.data.length > 0) {
          const categorias = result.data.map((c: any) =>
            `- ${c.nombre} (${c.tipo})${c.color ? ` [${c.color}]` : ''} — ID: ${c.id}`
          ).join('\n');
          return `Categorías personalizadas:\n${categorias}`;
        }
        return tipo
          ? `No hay categorías personalizadas de tipo ${tipo}.`
          : 'No hay categorías personalizadas registradas.';
      }

      // --- DEUDAS Y PRÉSTAMOS ---
      case 'crearDeuda': {
        const validated = CrearDeudaSchema.parse(args);
        const result = await apiClient.crearDeuda(validated);
        if (result.success) {
          const tipoLabel = validated.tipo === 'DEUDA' ? 'Deuda' : 'Prestamo';
          return `${tipoLabel} registrada exitosamente:
- Monto: $${validated.montoTotal.toLocaleString()}
- Descripcion: ${validated.descripcion}
${validated.entidad ? `- Entidad: ${validated.entidad}` : ''}
${validated.fechaLimite ? `- Fecha limite: ${validated.fechaLimite}` : ''}`;
        }
        return `Error al registrar: ${result.message}`;
      }

      case 'obtenerDeudas': {
        const result = await apiClient.obtenerDeudasPorTipo('DEUDA');
        if (result.success && result.data.length > 0) {
          const lista = result.data.map((d: any) =>
            `- ${d.descripcion}${d.entidad ? ` (${d.entidad})` : ''}: $${d.montoAbonado?.toLocaleString() || 0}/$${d.montoTotal.toLocaleString()} — ${d.porcentajeAvance?.toFixed(1) || 0}% [${d.estado}] — ID: ${d.id}`
          ).join('\n');
          return `Deudas registradas:\n${lista}`;
        }
        return 'No hay deudas registradas.';
      }

      case 'obtenerPrestamos': {
        const result = await apiClient.obtenerDeudasPorTipo('PRESTAMO');
        if (result.success && result.data.length > 0) {
          const lista = result.data.map((d: any) =>
            `- ${d.descripcion}${d.entidad ? ` (a ${d.entidad})` : ''}: $${d.montoAbonado?.toLocaleString() || 0}/$${d.montoTotal.toLocaleString()} — ${d.porcentajeAvance?.toFixed(1) || 0}% [${d.estado}] — ID: ${d.id}`
          ).join('\n');
          return `Prestamos registrados:\n${lista}`;
        }
        return 'No hay prestamos registrados.';
      }

      case 'abonarDeuda': {
        const validated = AbonarDeudaSchema.parse(args);
        const result = await apiClient.abonarDeuda(validated.deudaId, {
          monto: validated.monto,
          descripcion: validated.descripcion,
        });
        if (result.success) {
          return `Abono registrado: $${validated.monto.toLocaleString()} aplicado correctamente.`;
        }
        return `Error al registrar abono: ${result.message}`;
      }

      case 'obtenerResumenDeudas': {
        const result = await apiClient.obtenerResumenDeudas();
        if (result.success) {
          const r = result.data;
          return `Resumen de deudas y prestamos:
- Total deudas pendientes: $${r.totalDeudas?.toLocaleString() || 0}
- Total prestamos pendientes: $${r.totalPrestamos?.toLocaleString() || 0}
- Abonos recibidos: $${r.abonosRecibidos?.toLocaleString() || 0}`;
        }
        return `Error al obtener resumen: ${result.message}`;
      }

      case 'obtenerAbonosDeuda': {
        const deudaId = args.deudaId as string;
        if (!deudaId) return 'Error: Se requiere el ID de la deuda.';
        const result = await apiClient.obtenerAbonosDeuda(deudaId);
        if (result.success && result.data.length > 0) {
          const abonos = result.data.map((a: any) =>
            `- ${a.fechaAbono}: $${a.monto.toLocaleString()}${a.descripcion ? ` — ${a.descripcion}` : ''}`
          ).join('\n');
          return `Historial de abonos:\n${abonos}`;
        }
        return 'No hay abonos registrados para esta deuda.';
      }

      case 'obtenerDeudasPorEstado': {
        const validated = ConsultarEstadoDeudaSchema.parse(args);
        const result = await apiClient.obtenerDeudasPorEstado(validated.estado);
        if (result.success && result.data.length > 0) {
          const lista = result.data.map((d: any) =>
            `- [${d.tipo}] ${d.descripcion}${d.entidad ? ` (${d.entidad})` : ''}: $${d.montoAbonado?.toLocaleString() || 0}/$${d.montoTotal.toLocaleString()} — ID: ${d.id}`
          ).join('\n');
          return `Deudas/préstamos en estado ${validated.estado}:\n${lista}`;
        }
        return `No hay deudas en estado ${validated.estado}.`;
      }

      // --- INVERSIONES ---
      case 'crearInversion': {
        const validated = CrearInversionSchema.parse(args);
        const result = await apiClient.crearInversion({
          nombre: validated.nombre,
          descripcion: validated.descripcion,
          monto: validated.monto,
          retornoEsperado: validated.retornoEsperado,
          fechaInversion: validated.fechaInversion,
        });
        if (result.success) {
          return `Inversión registrada exitosamente:
- Nombre: ${validated.nombre}
- Monto invertido: $${validated.monto.toLocaleString()}
${validated.retornoEsperado ? `- Retorno esperado: $${validated.retornoEsperado.toLocaleString()}` : ''}
- Estado: ACTIVA
- Se generó un gasto automático por el monto invertido.`;
        }
        return `Error al crear inversión: ${result.message}`;
      }

      case 'obtenerInversiones': {
        const estado = args.estado as string | undefined;
        const result = await apiClient.obtenerInversiones(estado);
        if (result.success && result.data.length > 0) {
          const inversiones = result.data.map((inv: any) => {
            const ganancia = inv.ganancia != null
              ? ` | Ganancia/Pérdida: $${Number(inv.ganancia).toLocaleString()}`
              : '';
            return `- [${inv.estado}] ${inv.nombre}: $${Number(inv.monto).toLocaleString()} (${inv.fechaInversion})${ganancia}`;
          }).join('\n');
          return `Inversiones:\n${inversiones}`;
        }
        return 'No hay inversiones registradas.';
      }

      case 'registrarRetornoInversion': {
        const validated = RegistrarRetornoInversionSchema.parse(args);
        const result = await apiClient.registrarRetornoInversion(validated.inversionId, {
          retornoReal: validated.retornoReal,
          fechaRetorno: validated.fechaRetorno,
        });
        if (result.success) {
          const inv = result.data;
          const ganancia = inv.ganancia != null ? Number(inv.ganancia) : null;
          const resGanancia = ganancia != null
            ? ganancia >= 0
              ? `Ganancia: $${ganancia.toLocaleString()}`
              : `Pérdida: $${Math.abs(ganancia).toLocaleString()}`
            : '';
          return `Retorno registrado exitosamente:
- Inversión: ${inv.nombre}
- Monto invertido: $${Number(inv.monto).toLocaleString()}
- Retorno real: $${Number(inv.retornoReal).toLocaleString()}
${resGanancia ? `- ${resGanancia}` : ''}
- Estado: FINALIZADA
- Se generó un ingreso automático por el retorno.`;
        }
        return `Error al registrar retorno: ${result.message}`;
      }


      default:
        return `Herramienta desconocida: ${name}`;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return `Error de validación: ${error.errors.map(e => e.message).join(', ')}`;
    }
    if (error instanceof Error) {
      return `Error: ${error.message}`;
    }
    return `Error desconocido al ejecutar ${name}`;
  }
}

// ==================== UTILIDADES ====================

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function getFirstDayOfMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

// ==================== SERVIDOR MCP ====================

const server = new Server(
  {
    name: 'finanzapp-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Listar herramientas disponibles
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Ejecutar herramienta
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const result = await handleToolCall(name, args as Record<string, unknown>);

  return {
    content: [
      {
        type: 'text',
        text: result,
      },
    ],
  };
});

// Iniciar servidor
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('FinanzApp MCP Server iniciado');
}

main().catch((error) => {
  console.error('Error fatal:', error);
  process.exit(1);
});
