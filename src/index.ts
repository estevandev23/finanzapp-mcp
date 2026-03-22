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
  metodoPago: z.enum(['EFECTIVO', 'NEQUI', 'BANCOLOMBIA', 'OTRO']).optional(),
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
  metodoPago: z.enum(['EFECTIVO', 'NEQUI', 'BANCOLOMBIA', 'OTRO']).optional(),
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
  categoria: z.enum([
    'COMIDA', 'PAREJA', 'COMPRAS', 'TRANSPORTE', 'SERVICIOS',
    'ENTRETENIMIENTO', 'SALUD', 'EDUCACION', 'INVERSIONES', 'ABONO', 'OTROS'
  ]).optional(),
  categoriaPersonalizadaId: z.string().uuid().optional(),
});

const AbonarDeudaSchema = z.object({
  deudaId: z.string().uuid('ID de deuda invalido'),
  monto: z.number().positive('El monto debe ser positivo'),
  descripcion: z.string().optional(),
  metodoPago: z.enum(['EFECTIVO', 'NEQUI', 'BANCOLOMBIA', 'OTRO']).default('EFECTIVO'),
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

const EditarIngresoSchema = z.object({
  id: z.string().describe('ID del ingreso a editar'),
  monto: z.number().optional().describe('Nuevo monto del ingreso'),
  categoria: z.enum(['TRABAJO_PRINCIPAL', 'TRABAJO_EXTRA', 'GANANCIAS_ADICIONALES', 'INVERSIONES', 'OTROS']).optional().describe('Nueva categoría'),
  descripcion: z.string().optional().describe('Nueva descripción'),
  fecha: z.string().optional().describe('Nueva fecha en formato YYYY-MM-DD'),
  metodoPago: z.enum(['EFECTIVO', 'NEQUI', 'BANCOLOMBIA', 'OTRO']).optional().describe('Nuevo método de pago'),
});

const EliminarRegistroSchema = z.object({
  id: z.string().describe('ID del registro a eliminar'),
});

const EditarGastoSchema = z.object({
  id: z.string().describe('ID del gasto a editar'),
  monto: z.number().optional().describe('Nuevo monto del gasto'),
  categoria: z.enum(['COMIDA', 'PAREJA', 'COMPRAS', 'TRANSPORTE', 'SERVICIOS', 'ENTRETENIMIENTO', 'SALUD', 'EDUCACION', 'INVERSIONES', 'ABONO', 'OTROS']).optional().describe('Nueva categoría'),
  descripcion: z.string().optional().describe('Nueva descripción'),
  fecha: z.string().optional().describe('Nueva fecha en formato YYYY-MM-DD'),
  metodoPago: z.enum(['EFECTIVO', 'NEQUI', 'BANCOLOMBIA', 'OTRO']).optional().describe('Nuevo método de pago'),
});

const EditarAhorroSchema = z.object({
  id: z.string().describe('ID del ahorro a editar'),
  monto: z.number().optional().describe('Nuevo monto del ahorro'),
  descripcion: z.string().optional().describe('Nueva descripción'),
  fecha: z.string().optional().describe('Nueva fecha en formato YYYY-MM-DD'),
  metaId: z.string().optional().describe('ID de la meta financiera a asociar'),
});

const EditarMetaSchema = z.object({
  id: z.string().describe('ID de la meta a editar'),
  nombre: z.string().optional().describe('Nuevo nombre de la meta'),
  montoObjetivo: z.number().optional().describe('Nuevo monto objetivo'),
  descripcion: z.string().optional().describe('Nueva descripción'),
  fechaLimite: z.string().optional().describe('Nueva fecha límite en formato YYYY-MM-DD'),
});

const EditarDeudaSchema = z.object({
  id: z.string().describe('ID de la deuda a editar'),
  descripcion: z.string().optional().describe('Nueva descripción'),
  entidad: z.string().optional().describe('Nueva persona o entidad'),
  montoTotal: z.number().optional().describe('Nuevo monto total'),
  fechaLimite: z.string().optional().describe('Nueva fecha límite en formato YYYY-MM-DD'),
});

// Schemas de autenticacion WhatsApp
const VerificarEstadoAuthSchema = z.object({
  telefonoWhatsapp: z.string().min(1, 'El telefono es requerido'),
});

const RegistrarUsuarioSchema = z.object({
  telefonoWhatsapp: z.string().min(1, 'El telefono es requerido'),
  nombre: z.string().min(1, 'El nombre es requerido'),
  email: z.string().email('Email invalido'),
  password: z.string().min(6, 'La password debe tener al menos 6 caracteres'),
});

const SolicitarCodigoSchema = z.object({
  telefonoWhatsapp: z.string().min(1, 'El telefono es requerido'),
});

const VerificarCodigoSchema = z.object({
  telefonoWhatsapp: z.string().min(1, 'El telefono es requerido'),
  codigo: z.string().length(6, 'El codigo debe tener 6 digitos'),
});

const GenerarLinkOAuthSchema = z.object({
  telefonoWhatsapp: z.string().min(1, 'El telefono es requerido'),
});

const CrearCategoriaPersonalizadaSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  tipo: z.enum(['INGRESO', 'GASTO']),
  color: z.string().optional(),
  icono: z.string().optional(),
});

const EditarCategoriaPersonalizadaSchema = z.object({
  id: z.string().min(1, 'El ID es requerido'),
  nombre: z.string().optional(),
  color: z.string().optional(),
  icono: z.string().optional(),
});

const EliminarCategoriaPersonalizadaSchema = z.object({
  id: z.string().min(1, 'El ID es requerido'),
});

const ObtenerInversionPorIdSchema = z.object({
  id: z.string().min(1, 'El ID de la inversión es requerido'),
});

const EliminarInversionSchema = z.object({
  id: z.string().min(1, 'El ID de la inversión es requerido'),
});

// ==================== DEFINICIÓN DE HERRAMIENTAS ====================

const tools: Tool[] = [
  // --- INGRESOS ---
  {
    name: 'crearIngreso',
    description: `Registra un nuevo ingreso de dinero para el usuario.
Categorías predeterminadas: TRABAJO_PRINCIPAL, TRABAJO_EXTRA, GANANCIAS_ADICIONALES, INVERSIONES, OTROS.
También se puede usar una categoría personalizada del usuario proporcionando su ID.
Opcionalmente se puede especificar un monto para ahorro que se descuenta del ingreso, y asociar a una meta financiera.
Se puede indicar el método de pago: EFECTIVO, NEQUI, BANCOLOMBIA, OTRO (por defecto EFECTIVO).`,
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
        metodoPago: {
          type: 'string',
          enum: ['EFECTIVO', 'NEQUI', 'BANCOLOMBIA', 'OTRO'],
          description: 'Método de pago por el que se recibió el ingreso (por defecto EFECTIVO)'
        },
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
  {
    name: 'editarIngreso',
    description: 'Edita un ingreso existente. Todos los campos son opcionales excepto el ID.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID del ingreso a editar' },
        monto: { type: 'number', description: 'Nuevo monto del ingreso' },
        categoria: { type: 'string', enum: ['TRABAJO_PRINCIPAL', 'TRABAJO_EXTRA', 'GANANCIAS_ADICIONALES', 'INVERSIONES', 'OTROS'], description: 'Nueva categoría' },
        descripcion: { type: 'string', description: 'Nueva descripción' },
        fecha: { type: 'string', description: 'Nueva fecha en formato YYYY-MM-DD' },
        metodoPago: { type: 'string', enum: ['EFECTIVO', 'NEQUI', 'BANCOLOMBIA', 'OTRO'], description: 'Nuevo método de pago' },
      },
      required: ['id'],
    },
  },
  {
    name: 'eliminarIngreso',
    description: 'Elimina un ingreso por su ID.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID del ingreso a eliminar' },
      },
      required: ['id'],
    },
  },
  {
    name: 'obtenerIngresosPorCategoria',
    description: 'Obtiene los ingresos filtrados por una categoría específica.',
    inputSchema: {
      type: 'object',
      properties: {
        categoria: {
          type: 'string',
          enum: ['TRABAJO_PRINCIPAL', 'TRABAJO_EXTRA', 'GANANCIAS_ADICIONALES', 'INVERSIONES', 'OTROS'],
          description: 'Categoría a consultar',
        },
      },
      required: ['categoria'],
    },
  },
  {
    name: 'obtenerTotalIngresosPorPeriodo',
    description: 'Obtiene el total de ingresos en un rango de fechas específico.',
    inputSchema: {
      type: 'object',
      properties: {
        fechaInicio: { type: 'string', description: 'Fecha inicial en formato YYYY-MM-DD' },
        fechaFin: { type: 'string', description: 'Fecha final en formato YYYY-MM-DD' },
      },
      required: ['fechaInicio', 'fechaFin'],
    },
  },

  // --- GASTOS (EGRESOS) ---
  {
    name: 'crearEgreso',
    description: `Registra un nuevo gasto/egreso para el usuario.
Categorías predeterminadas: COMIDA, PAREJA, COMPRAS, TRANSPORTE, SERVICIOS, ENTRETENIMIENTO, SALUD, EDUCACION, OTROS.
También se puede usar una categoría personalizada del usuario proporcionando su ID.
Se puede indicar el método de pago: EFECTIVO, NEQUI, BANCOLOMBIA, OTRO (por defecto EFECTIVO).`,
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
        metodoPago: {
          type: 'string',
          enum: ['EFECTIVO', 'NEQUI', 'BANCOLOMBIA', 'OTRO'],
          description: 'Método de pago utilizado para el gasto (por defecto EFECTIVO)'
        },
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
    name: 'obtenerTotalGastosPorPeriodo',
    description: 'Obtiene el total de gastos en un rango de fechas específico.',
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
  {
    name: 'editarEgreso',
    description: 'Edita un gasto/egreso existente. Todos los campos son opcionales excepto el ID.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID del gasto a editar' },
        monto: { type: 'number', description: 'Nuevo monto del gasto' },
        categoria: { type: 'string', enum: ['COMIDA', 'PAREJA', 'COMPRAS', 'TRANSPORTE', 'SERVICIOS', 'ENTRETENIMIENTO', 'SALUD', 'EDUCACION', 'INVERSIONES', 'ABONO', 'OTROS'], description: 'Nueva categoría' },
        descripcion: { type: 'string', description: 'Nueva descripción' },
        fecha: { type: 'string', description: 'Nueva fecha en formato YYYY-MM-DD' },
        metodoPago: { type: 'string', enum: ['EFECTIVO', 'NEQUI', 'BANCOLOMBIA', 'OTRO'], description: 'Nuevo método de pago' },
      },
      required: ['id'],
    },
  },
  {
    name: 'eliminarEgreso',
    description: 'Elimina un gasto/egreso por su ID.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID del gasto a eliminar' },
      },
      required: ['id'],
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
  {
    name: 'obtenerTotalAhorrosPorPeriodo',
    description: 'Obtiene el total de ahorros en un rango de fechas específico.',
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
    name: 'editarAhorro',
    description: 'Edita un ahorro existente. Todos los campos son opcionales excepto el ID.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID del ahorro a editar' },
        monto: { type: 'number', description: 'Nuevo monto del ahorro' },
        descripcion: { type: 'string', description: 'Nueva descripción' },
        fecha: { type: 'string', description: 'Nueva fecha en formato YYYY-MM-DD' },
        metaId: { type: 'string', description: 'ID de la meta financiera a asociar' },
      },
      required: ['id'],
    },
  },
  {
    name: 'eliminarAhorro',
    description: 'Elimina un ahorro por su ID.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID del ahorro a eliminar' },
      },
      required: ['id'],
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
  {
    name: 'editarMeta',
    description: 'Edita una meta financiera existente. Todos los campos son opcionales excepto el ID.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID de la meta a editar' },
        nombre: { type: 'string', description: 'Nuevo nombre de la meta' },
        montoObjetivo: { type: 'number', description: 'Nuevo monto objetivo' },
        descripcion: { type: 'string', description: 'Nueva descripción' },
        fechaLimite: { type: 'string', description: 'Nueva fecha límite en formato YYYY-MM-DD' },
      },
      required: ['id'],
    },
  },
  {
    name: 'eliminarMeta',
    description: 'Elimina una meta financiera por su ID.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID de la meta a eliminar' },
      },
      required: ['id'],
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
    name: 'obtenerBalancePorMetodo',
    description: `Obtiene el balance desglosado por método de pago (EFECTIVO, NEQUI, BANCOLOMBIA, OTRO).
Para cada método muestra: total ingresos, total gastos y balance neto.
Útil para saber cuánto dinero tiene el usuario en cada medio de pago.`,
    inputSchema: {
      type: 'object',
      properties: {},
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
  {
    name: 'crearCategoriaPersonalizada',
    description: 'Crea una nueva categoría personalizada para el usuario. Puede ser de tipo INGRESO o GASTO.',
    inputSchema: {
      type: 'object',
      properties: {
        nombre: { type: 'string', description: 'Nombre de la categoría (obligatorio)' },
        tipo: { type: 'string', enum: ['INGRESO', 'GASTO'], description: 'Tipo de categoría: INGRESO o GASTO' },
        color: { type: 'string', description: 'Color en formato hex (opcional, ej: #FF5733)' },
        icono: { type: 'string', description: 'Nombre del icono (opcional)' },
      },
      required: ['nombre', 'tipo'],
    },
  },
  {
    name: 'editarCategoriaPersonalizada',
    description: 'Edita una categoría personalizada existente. El nombre, color e icono son opcionales.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID de la categoría a editar' },
        nombre: { type: 'string', description: 'Nuevo nombre de la categoría' },
        color: { type: 'string', description: 'Nuevo color en formato hex' },
        icono: { type: 'string', description: 'Nuevo icono' },
      },
      required: ['id'],
    },
  },
  {
    name: 'eliminarCategoriaPersonalizada',
    description: 'Elimina una categoría personalizada por su ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID de la categoría a eliminar' },
      },
      required: ['id'],
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
        categoria: {
          type: 'string',
          enum: ['COMIDA', 'PAREJA', 'COMPRAS', 'TRANSPORTE', 'SERVICIOS', 'ENTRETENIMIENTO', 'SALUD', 'EDUCACION', 'INVERSIONES', 'ABONO', 'OTROS'],
          description: 'Categoria predeterminada de la deuda (usar solo si no se usa categoriaPersonalizadaId)'
        },
        categoriaPersonalizadaId: { type: 'string', description: 'ID de una categoria personalizada del usuario (alternativa a categoria)' },
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
        metodoPago: {
          type: 'string',
          enum: ['EFECTIVO', 'NEQUI', 'BANCOLOMBIA', 'OTRO'],
          description: 'Metodo de pago utilizado para el abono (default: EFECTIVO)'
        },
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
    name: 'editarDeuda',
    description: 'Edita una deuda o préstamo existente. Todos los campos son opcionales excepto el ID.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID de la deuda a editar' },
        descripcion: { type: 'string', description: 'Nueva descripción' },
        entidad: { type: 'string', description: 'Nueva persona o entidad' },
        montoTotal: { type: 'number', description: 'Nuevo monto total' },
        fechaLimite: { type: 'string', description: 'Nueva fecha límite en formato YYYY-MM-DD' },
      },
      required: ['id'],
    },
  },
  {
    name: 'eliminarDeuda',
    description: 'Elimina una deuda o préstamo por su ID.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID de la deuda a eliminar' },
      },
      required: ['id'],
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
  {
    name: 'obtenerInversionPorId',
    description: 'Obtiene los detalles de una inversión específica por su ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID de la inversión a consultar' },
      },
      required: ['id'],
    },
  },
  {
    name: 'eliminarInversion',
    description: 'Elimina una inversión por su ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID de la inversión a eliminar' },
      },
      required: ['id'],
    },
  },
  // ==================== AUTENTICACION WHATSAPP ====================
  {
    name: 'verificarEstadoAuth',
    description: 'Verifica el estado de autenticacion de un usuario de WhatsApp. DEBE llamarse SIEMPRE antes de cualquier operacion financiera. Si la sesion esta activa, configura automaticamente la autenticacion para las demas herramientas.',
    inputSchema: {
      type: 'object',
      properties: {
        telefonoWhatsapp: { type: 'string', description: 'Numero de WhatsApp del usuario (ej: 573167324940)' },
      },
      required: ['telefonoWhatsapp'],
    },
  },
  {
    name: 'registrarUsuario',
    description: 'Registra un nuevo usuario desde WhatsApp. Crea la cuenta y genera un codigo OTP de verificacion.',
    inputSchema: {
      type: 'object',
      properties: {
        telefonoWhatsapp: { type: 'string', description: 'Numero de WhatsApp del usuario' },
        nombre: { type: 'string', description: 'Nombre completo del usuario' },
        email: { type: 'string', description: 'Email del usuario' },
        password: { type: 'string', description: 'Password para la cuenta' },
      },
      required: ['telefonoWhatsapp', 'nombre', 'email', 'password'],
    },
  },
  {
    name: 'solicitarCodigo',
    description: 'Solicita un codigo OTP de verificacion para un usuario ya registrado.',
    inputSchema: {
      type: 'object',
      properties: {
        telefonoWhatsapp: { type: 'string', description: 'Numero de WhatsApp del usuario' },
      },
      required: ['telefonoWhatsapp'],
    },
  },
  {
    name: 'verificarCodigo',
    description: 'Verifica el codigo OTP ingresado por el usuario. Si es correcto, activa la sesion y configura la autenticacion automaticamente.',
    inputSchema: {
      type: 'object',
      properties: {
        telefonoWhatsapp: { type: 'string', description: 'Numero de WhatsApp del usuario' },
        codigo: { type: 'string', description: 'Codigo OTP de 6 digitos' },
      },
      required: ['telefonoWhatsapp', 'codigo'],
    },
  },
  {
    name: 'generarLinkOAuth',
    description: 'Genera un enlace de autenticacion OAuth para que el usuario se autentique desde el navegador web.',
    inputSchema: {
      type: 'object',
      properties: {
        telefonoWhatsapp: { type: 'string', description: 'Numero de WhatsApp del usuario' },
      },
      required: ['telefonoWhatsapp'],
    },
  },
];

// ==================== MANEJADORES DE HERRAMIENTAS ====================

async function handleToolCall(name: string, args: Record<string, unknown>, client: FinanzAppApiClient = apiClient): Promise<string> {
  try {
    switch (name) {
      // --- INGRESOS ---
      case 'crearIngreso': {
        const validated = CrearIngresoSchema.parse(args);
        if (!validated.categoria && !validated.categoriaPersonalizadaId) {
          validated.categoria = 'OTROS';
        }
        const result = await client.crearIngreso({
          monto: validated.monto,
          categoria: validated.categoria || 'OTROS',
          descripcion: validated.descripcion,
          fecha: validated.fecha,
          montoAhorro: validated.montoAhorro,
          categoriaPersonalizadaId: validated.categoriaPersonalizadaId,
          metaId: validated.metaId,
          metodoPago: validated.metodoPago,
        });
        if (result.success) {
          return `Ingreso registrado exitosamente:
- Monto: $${validated.monto.toLocaleString()}
- Categoría: ${validated.categoriaPersonalizadaId ? 'Personalizada' : validated.categoria}
- Método de pago: ${validated.metodoPago || 'EFECTIVO'}
- Descripción: ${validated.descripcion || 'Sin descripción'}
${validated.montoAhorro ? `- Monto destinado a ahorro: $${validated.montoAhorro.toLocaleString()}` : ''}
${validated.metaId ? `- Asociado a meta: ${validated.metaId}` : ''}`;
        }
        return `Error al registrar ingreso: ${result.message}`;
      }

      case 'obtenerIngresos': {
        const result = await client.obtenerIngresos();
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
        const result = await client.obtenerIngresosPorPeriodo(validated.fechaInicio, validated.fechaFin);
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
        const result = await client.obtenerTotalIngresos();
        return result.success
          ? `Total de ingresos: $${result.data.toLocaleString()}`
          : `Error al obtener total: ${result.message}`;
      }

      case 'editarIngreso': {
        const validatedEdit = EditarIngresoSchema.parse(args);
        const { id, ...datos } = validatedEdit;
        const result = await client.actualizarIngreso(id, datos);
        return result.success
          ? `Ingreso actualizado exitosamente.`
          : `Error al actualizar ingreso: ${result.message}`;
      }

      case 'eliminarIngreso': {
        const validatedDel = EliminarRegistroSchema.parse(args);
        const result = await client.eliminarIngreso(validatedDel.id);
        return result.success
          ? `Ingreso eliminado exitosamente.`
          : `Error al eliminar ingreso: ${result.message}`;
      }

      case 'obtenerIngresosPorCategoria': {
        const { categoria } = args as { categoria: string };
        const result = await client.obtenerIngresosPorCategoria(categoria);
        if (result.success && result.data) {
          if (result.data.length === 0) {
            return `No hay ingresos registrados en la categoría ${categoria}.`;
          }
          const lista = result.data.map((i: any) =>
            `- $${i.monto?.toLocaleString()} | ${i.descripcion || 'Sin descripción'} | ${i.fecha}`
          ).join('\n');
          return `Ingresos en categoría ${categoria} (${result.data.length}):\n${lista}`;
        }
        return `Error al obtener ingresos por categoría: ${result.message}`;
      }

      case 'obtenerTotalIngresosPorPeriodo': {
        const { fechaInicio, fechaFin } = args as { fechaInicio: string; fechaFin: string };
        const result = await client.obtenerTotalIngresosPorPeriodo(fechaInicio, fechaFin);
        if (result.success) {
          return `Total de ingresos del ${fechaInicio} al ${fechaFin}: $${result.data?.toLocaleString() || 0}`;
        }
        return `Error al obtener total de ingresos por período: ${result.message}`;
      }

      // --- GASTOS ---
      case 'crearEgreso': {
        const validated = CrearGastoSchema.parse(args);
        if (!validated.categoria && !validated.categoriaPersonalizadaId) {
          validated.categoria = 'OTROS';
        }
        const result = await client.crearGasto({
          monto: validated.monto,
          categoria: validated.categoria || 'OTROS',
          descripcion: validated.descripcion,
          fecha: validated.fecha,
          categoriaPersonalizadaId: validated.categoriaPersonalizadaId,
          metodoPago: validated.metodoPago,
        });
        if (result.success) {
          return `Gasto registrado exitosamente:
- Monto: $${validated.monto.toLocaleString()}
- Categoría: ${validated.categoriaPersonalizadaId ? 'Personalizada' : validated.categoria}
- Método de pago: ${validated.metodoPago || 'EFECTIVO'}
- Descripción: ${validated.descripcion || 'Sin descripción'}`;
        }
        return `Error al registrar gasto: ${result.message}`;
      }

      case 'obtenerGastos': {
        const result = await client.obtenerGastos();
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
        const result = await client.obtenerGastosPorPeriodo(validated.fechaInicio, validated.fechaFin);
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
        const result = await client.obtenerGastosPorCategoria(validated.categoria);
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
        const result = await client.obtenerTotalGastos();
        return result.success
          ? `Total de gastos: $${result.data.toLocaleString()}`
          : `Error al obtener total: ${result.message}`;
      }

      case 'obtenerTotalGastosPorPeriodo': {
        const { fechaInicio, fechaFin } = args as { fechaInicio: string; fechaFin: string };
        const result = await client.obtenerTotalGastosPorPeriodo(fechaInicio, fechaFin);
        if (result.success) {
          return `Total de gastos del ${fechaInicio} al ${fechaFin}: $${result.data?.toLocaleString() || 0}`;
        }
        return `Error al obtener total de gastos por período: ${result.message}`;
      }

      case 'obtenerDesgloseGastos': {
        const result = await client.obtenerDesgloseGastos();
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
        const result = await client.obtenerDesgloseGastosPorPeriodo(validated.fechaInicio, validated.fechaFin);
        if (result.success && Object.keys(result.data).length > 0) {
          const desglose = Object.entries(result.data)
            .map(([cat, monto]) => `- ${cat}: $${(monto as number).toLocaleString()}`)
            .join('\n');
          const total = Object.values(result.data).reduce((sum, m) => sum + (m as number), 0);
          return `Desglose de gastos (${validated.fechaInicio} a ${validated.fechaFin}):\n${desglose}\n\nTotal: $${total.toLocaleString()}`;
        }
        return `No hay gastos en el período ${validated.fechaInicio} a ${validated.fechaFin}.`;
      }

      case 'editarEgreso': {
        const validatedEditGasto = EditarGastoSchema.parse(args);
        const { id, ...datos } = validatedEditGasto;
        const result = await client.actualizarGasto(id, datos);
        return result.success
          ? `Gasto actualizado exitosamente.`
          : `Error al actualizar gasto: ${result.message}`;
      }

      case 'eliminarEgreso': {
        const validatedDelGasto = EliminarRegistroSchema.parse(args);
        const result = await client.eliminarGasto(validatedDelGasto.id);
        return result.success
          ? `Gasto eliminado exitosamente.`
          : `Error al eliminar gasto: ${result.message}`;
      }

      // --- AHORROS ---
      case 'crearAhorro': {
        const validated = CrearAhorroSchema.parse(args);
        const result = await client.crearAhorro({
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
        const result = await client.obtenerAhorros();
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
        const result = await client.obtenerAhorrosPorPeriodo(validated.fechaInicio, validated.fechaFin);
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
        const result = await client.obtenerTotalAhorros();
        return result.success
          ? `Total de ahorros: $${result.data.toLocaleString()}`
          : `Error al obtener total: ${result.message}`;
      }

      case 'obtenerTotalAhorrosPorPeriodo': {
        const { fechaInicio, fechaFin } = args as { fechaInicio: string; fechaFin: string };
        const result = await client.obtenerTotalAhorrosPorPeriodo(fechaInicio, fechaFin);
        if (result.success) {
          return `Total de ahorros del ${fechaInicio} al ${fechaFin}: $${result.data?.toLocaleString() || 0}`;
        }
        return `Error al obtener total de ahorros por período: ${result.message}`;
      }

      case 'editarAhorro': {
        const validatedEditAhorro = EditarAhorroSchema.parse(args);
        const { id, ...datos } = validatedEditAhorro;
        const result = await client.actualizarAhorro(id, datos);
        return result.success
          ? `Ahorro actualizado exitosamente.`
          : `Error al actualizar ahorro: ${result.message}`;
      }

      case 'eliminarAhorro': {
        const validatedDelAhorro = EliminarRegistroSchema.parse(args);
        const result = await client.eliminarAhorro(validatedDelAhorro.id);
        return result.success
          ? `Ahorro eliminado exitosamente.`
          : `Error al eliminar ahorro: ${result.message}`;
      }

      // --- METAS ---
      case 'crearMeta': {
        const validated = CrearMetaSchema.parse(args);
        const result = await client.crearMeta({
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
        const result = await client.obtenerMetas();
        if (result.success && result.data.length > 0) {
          const metas = result.data.map((m: any) =>
            `- ${m.nombre}: $${m.montoActual?.toLocaleString() || 0}/$${m.montoObjetivo.toLocaleString()} (${m.porcentajeAvance?.toFixed(1) || 0}%) - Estado: ${m.estado}`
          ).join('\n');
          return `Metas financieras:\n${metas}`;
        }
        return 'No hay metas financieras registradas.';
      }

      case 'obtenerMetasActivas': {
        const result = await client.obtenerMetasPorEstado('ACTIVA');
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
        const result = await client.registrarProgresoMeta(validated.metaId, validated.monto);
        if (result.success) {
          return `Progreso registrado: $${validated.monto.toLocaleString()} abonados a la meta.`;
        }
        return `Error al registrar progreso: ${result.message}`;
      }

      case 'cambiarEstadoMeta': {
        const validated = CambiarEstadoMetaSchema.parse(args);
        const result = await client.cambiarEstadoMeta(validated.metaId, validated.estado);
        if (result.success) {
          return `Estado de la meta actualizado a ${validated.estado} correctamente.`;
        }
        return `Error al cambiar estado: ${result.message}`;
      }

      case 'obtenerAhorrosPorMeta': {
        const validated = ObtenerAhorrosPorMetaSchema.parse(args);
        const result = await client.obtenerAhorrosPorMeta(validated.metaId);
        if (result.success && result.data.length > 0) {
          const total = result.data.reduce((sum: number, a: any) => sum + a.monto, 0);
          const ahorros = result.data.map((a: any) =>
            `- ${a.fecha}: $${a.monto.toLocaleString()}${a.descripcion ? ` — ${a.descripcion}` : ''}`
          ).join('\n');
          return `Ahorros asociados a la meta:\n${ahorros}\n\nTotal ahorrado: $${total.toLocaleString()}`;
        }
        return 'No hay ahorros asociados a esta meta.';
      }

      case 'editarMeta': {
        const validatedEditMeta = EditarMetaSchema.parse(args);
        const { id, ...datos } = validatedEditMeta;
        const result = await client.actualizarMeta(id, datos);
        return result.success
          ? `Meta actualizada exitosamente.`
          : `Error al actualizar meta: ${result.message}`;
      }

      case 'eliminarMeta': {
        const validatedDelMeta = EliminarRegistroSchema.parse(args);
        const result = await client.eliminarMeta(validatedDelMeta.id);
        return result.success
          ? `Meta eliminada exitosamente.`
          : `Error al eliminar meta: ${result.message}`;
      }

      // --- BALANCE ---
      case 'obtenerBalance': {
        const result = await client.obtenerBalance();
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
        const result = await client.obtenerBalancePorPeriodo(validated.fechaInicio, validated.fechaFin);
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

      case 'obtenerBalancePorMetodo': {
        const result = await client.obtenerBalancePorMetodo();
        if (result.success) {
          const metodos = result.data.metodos;
          const lineas = metodos.map((m: any) =>
            `- ${m.metodo}: Ingresos $${m.totalIngresos.toLocaleString()} | Gastos $${m.totalGastos.toLocaleString()} | Balance $${m.balance.toLocaleString()}`
          ).join('\n');
          return `Balance por método de pago:\n${lineas}`;
        }
        return `Error al obtener balance por método: ${result.message}`;
      }

      // --- RESUMEN Y ANÁLISIS ---
      case 'obtenerResumenFinanciero': {
        // Obtener balance, desglose, metas, resumen de deudas e inversiones
        const [balanceRes, desgloseRes, metasRes, deudasRes, inversionesRes] = await Promise.all([
          client.obtenerBalance(),
          client.obtenerDesgloseGastos(),
          client.obtenerMetasPorEstado('ACTIVA'),
          client.obtenerResumenDeudas(),
          client.obtenerInversiones('ACTIVA'),
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
          client.obtenerBalancePorPeriodo(fechaInicio, fechaFin),
          client.obtenerDesgloseGastosPorPeriodo(fechaInicio, fechaFin),
          client.obtenerMetasPorEstado('ACTIVA'),
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
          const result = await client.obtenerIngresosPorPeriodo(fechaInicio, fechaFin);
          if (result.success && result.data.length > 0) {
            result.data.forEach((i: any) => {
              registros.push(`[INGRESO] ${i.fecha}: +$${i.monto.toLocaleString()} (${i.categoria})${i.descripcion ? ` — ${i.descripcion}` : ''}`);
            });
          }
        }

        if (tipo === 'TODOS' || tipo === 'GASTOS') {
          const result = await client.obtenerGastosPorPeriodo(fechaInicio, fechaFin);
          if (result.success && result.data.length > 0) {
            result.data.forEach((g: any) => {
              registros.push(`[GASTO] ${g.fecha}: -$${g.monto.toLocaleString()} (${g.categoria})${g.descripcion ? ` — ${g.descripcion}` : ''}`);
            });
          }
        }

        if (tipo === 'TODOS' || tipo === 'AHORROS') {
          const result = await client.obtenerAhorrosPorPeriodo(fechaInicio, fechaFin);
          if (result.success && result.data.length > 0) {
            result.data.forEach((a: any) => {
              registros.push(`[AHORRO] ${a.fecha}: $${a.monto.toLocaleString()}${a.descripcion ? ` — ${a.descripcion}` : ''}`);
            });
          }
        }

        if (tipo === 'TODOS' || tipo === 'INVERSIONES') {
          const result = await client.obtenerInversiones();
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
        const result = await client.getCategorias(endpoint);
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

      case 'crearCategoriaPersonalizada': {
        const validated = CrearCategoriaPersonalizadaSchema.parse(args);
        const result = await client.crearCategoriaPersonalizada(validated.nombre, validated.tipo, validated.color, validated.icono);
        if (result.success) {
          return `Categoría personalizada creada exitosamente:
- Nombre: ${validated.nombre}
- Tipo: ${validated.tipo}${validated.color ? `\n- Color: ${validated.color}` : ''}`;
        }
        return `Error al crear categoría: ${result.message}`;
      }

      case 'editarCategoriaPersonalizada': {
        const validated = EditarCategoriaPersonalizadaSchema.parse(args);
        const { id, ...datos } = validated;
        const result = await client.actualizarCategoriaPersonalizada(id, datos);
        return result.success
          ? `Categoría personalizada actualizada exitosamente.`
          : `Error al actualizar categoría: ${result.message}`;
      }

      case 'eliminarCategoriaPersonalizada': {
        const validated = EliminarCategoriaPersonalizadaSchema.parse(args);
        const result = await client.eliminarCategoriaPersonalizada(validated.id);
        return result.success
          ? `Categoría personalizada eliminada exitosamente.`
          : `Error al eliminar categoría: ${result.message}`;
      }

      // --- DEUDAS Y PRÉSTAMOS ---
      case 'crearDeuda': {
        const validated = CrearDeudaSchema.parse(args);
        if (!validated.categoria && !validated.categoriaPersonalizadaId) {
          validated.categoria = 'OTROS';
        }
        const result = await client.crearDeuda({
          ...validated,
          categoriaPersonalizadaId: validated.categoriaPersonalizadaId,
        });
        if (result.success) {
          const tipoLabel = validated.tipo === 'DEUDA' ? 'Deuda' : 'Prestamo';
          return `${tipoLabel} registrada exitosamente:
- Monto: $${validated.montoTotal.toLocaleString()}
- Descripcion: ${validated.descripcion}
- Categoria: ${validated.categoriaPersonalizadaId ? 'Personalizada' : validated.categoria}
${validated.entidad ? `- Entidad: ${validated.entidad}` : ''}
${validated.fechaLimite ? `- Fecha limite: ${validated.fechaLimite}` : ''}`;
        }
        return `Error al registrar: ${result.message}`;
      }

      case 'obtenerDeudas': {
        const result = await client.obtenerDeudasPorTipo('DEUDA');
        if (result.success && result.data.length > 0) {
          const lista = result.data.map((d: any) =>
            `- ${d.descripcion}${d.entidad ? ` (${d.entidad})` : ''}${d.categoriaDescripcion ? ` [${d.categoriaDescripcion}]` : ''}: $${d.montoAbonado?.toLocaleString() || 0}/$${d.montoTotal.toLocaleString()} — ${d.porcentajeAvance?.toFixed(1) || 0}% [${d.estado}] — ID: ${d.id}`
          ).join('\n');
          return `Deudas registradas:\n${lista}`;
        }
        return 'No hay deudas registradas.';
      }

      case 'obtenerPrestamos': {
        const result = await client.obtenerDeudasPorTipo('PRESTAMO');
        if (result.success && result.data.length > 0) {
          const lista = result.data.map((d: any) =>
            `- ${d.descripcion}${d.entidad ? ` (a ${d.entidad})` : ''}${d.categoriaDescripcion ? ` [${d.categoriaDescripcion}]` : ''}: $${d.montoAbonado?.toLocaleString() || 0}/$${d.montoTotal.toLocaleString()} — ${d.porcentajeAvance?.toFixed(1) || 0}% [${d.estado}] — ID: ${d.id}`
          ).join('\n');
          return `Prestamos registrados:\n${lista}`;
        }
        return 'No hay prestamos registrados.';
      }

      case 'abonarDeuda': {
        const validated = AbonarDeudaSchema.parse(args);
        const result = await client.abonarDeuda(validated.deudaId, {
          monto: validated.monto,
          descripcion: validated.descripcion,
          metodoPago: validated.metodoPago,
        });
        if (result.success) {
          return `Abono registrado: $${validated.monto.toLocaleString()} aplicado correctamente.`;
        }
        return `Error al registrar abono: ${result.message}`;
      }

      case 'obtenerResumenDeudas': {
        const result = await client.obtenerResumenDeudas();
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
        const result = await client.obtenerAbonosDeuda(deudaId);
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
        const result = await client.obtenerDeudasPorEstado(validated.estado);
        if (result.success && result.data.length > 0) {
          const lista = result.data.map((d: any) =>
            `- [${d.tipo}] ${d.descripcion}${d.entidad ? ` (${d.entidad})` : ''}: $${d.montoAbonado?.toLocaleString() || 0}/$${d.montoTotal.toLocaleString()} — ID: ${d.id}`
          ).join('\n');
          return `Deudas/préstamos en estado ${validated.estado}:\n${lista}`;
        }
        return `No hay deudas en estado ${validated.estado}.`;
      }

      case 'editarDeuda': {
        const validatedEditDeuda = EditarDeudaSchema.parse(args);
        const { id, ...datos } = validatedEditDeuda;
        const result = await client.actualizarDeuda(id, datos);
        return result.success
          ? `Deuda actualizada exitosamente.`
          : `Error al actualizar deuda: ${result.message}`;
      }

      case 'eliminarDeuda': {
        const validatedDelDeuda = EliminarRegistroSchema.parse(args);
        const result = await client.eliminarDeuda(validatedDelDeuda.id);
        return result.success
          ? `Deuda eliminada exitosamente.`
          : `Error al eliminar deuda: ${result.message}`;
      }

      // --- INVERSIONES ---
      case 'crearInversion': {
        const validated = CrearInversionSchema.parse(args);
        const result = await client.crearInversion({
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
        const result = await client.obtenerInversiones(estado);
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
        const result = await client.registrarRetornoInversion(validated.inversionId, {
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

      case 'obtenerInversionPorId': {
        const validated = ObtenerInversionPorIdSchema.parse(args);
        const result = await client.obtenerInversionPorId(validated.id);
        if (result.success && result.data) {
          const inv = result.data;
          return `Inversión encontrada:
- Nombre: ${inv.nombre}
- Monto invertido: $${Number(inv.monto).toLocaleString()}
- Retorno esperado: ${inv.retornoEsperado ? `$${Number(inv.retornoEsperado).toLocaleString()}` : 'No definido'}
- Estado: ${inv.estado}
- Fecha: ${inv.fechaInversion}${inv.retornoReal ? `\n- Retorno real: $${Number(inv.retornoReal).toLocaleString()}` : ''}`;
        }
        return `Error al obtener inversión: ${result.message}`;
      }

      case 'eliminarInversion': {
        const validated = EliminarInversionSchema.parse(args);
        const result = await client.eliminarInversion(validated.id);
        return result.success
          ? `Inversión eliminada exitosamente.`
          : `Error al eliminar inversión: ${result.message}`;
      }

      // --- AUTENTICACION WHATSAPP ---
      case 'verificarEstadoAuth': {
        const validated = VerificarEstadoAuthSchema.parse(args);
        const estadoResult = await client.verificarEstadoWhatsapp(validated.telefonoWhatsapp);
        if (estadoResult.success && estadoResult.data?.sesionActiva) {
          const tokenResult = await client.obtenerTokenWhatsapp(validated.telefonoWhatsapp);
          if (tokenResult.success && tokenResult.data?.token) {
            client.setToken(tokenResult.data.token);
          }
        }
        const estado = estadoResult.data || {};
        return `Estado de autenticacion:
- Sesion activa: ${estado.sesionActiva ? 'Si' : 'No'}
- Cuenta existe: ${estado.cuentaExiste ? 'Si' : 'No'}
- Dispositivo registrado: ${estado.dispositivoRegistrado ? 'Si' : 'No'}
${estado.mensaje ? `- Mensaje: ${estado.mensaje}` : ''}
${estado.sesionActiva ? 'La sesion esta configurada. Puedes proceder con operaciones financieras.' : ''}`;
      }

      case 'registrarUsuario': {
        const validated = RegistrarUsuarioSchema.parse(args);
        const result = await client.registrarUsuarioWhatsapp(validated.telefonoWhatsapp, validated.nombre, validated.email, validated.password);
        if (result.success) {
          return `Usuario registrado exitosamente. ${result.data?.codigoVerificacion ? 'Se ha enviado un codigo de verificacion.' : ''} ${result.message || ''}`;
        }
        return `Error al registrar usuario: ${result.message}`;
      }

      case 'solicitarCodigo': {
        const validated = SolicitarCodigoSchema.parse(args);
        const result = await client.solicitarCodigoWhatsapp(validated.telefonoWhatsapp);
        if (result.success) {
          return `Codigo de verificacion enviado. ${result.message || 'Por favor ingresa el codigo de 6 digitos.'}`;
        }
        return `Error al solicitar codigo: ${result.message}`;
      }

      case 'verificarCodigo': {
        const validated = VerificarCodigoSchema.parse(args);
        const result = await client.verificarCodigoWhatsapp(validated.telefonoWhatsapp, validated.codigo);
        if (result.success) {
          const tokenResult = await client.obtenerTokenWhatsapp(validated.telefonoWhatsapp);
          if (tokenResult.success && tokenResult.data?.token) {
            client.setToken(tokenResult.data.token);
          }
          return 'Codigo verificado exitosamente. La sesion esta activa y configurada. Puedes proceder con operaciones financieras.';
        }
        return `Error al verificar codigo: ${result.message}`;
      }

      case 'generarLinkOAuth': {
        const validated = GenerarLinkOAuthSchema.parse(args);
        const result = await client.generarLinkOAuthWhatsapp(validated.telefonoWhatsapp);
        if (result.success) {
          return `Enlace de autenticacion generado: ${result.data?.urlFrontend || result.data?.url || 'URL no disponible'}`;
        }
        return `Error al generar enlace: ${result.message}`;
      }

      default:
        return `Herramienta desconocida: ${name}`;
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return `Error de validacion: ${error.errors.map(e => e.message).join(', ')}`;
    }

    // Detectar errores HTTP 401/403 para indicar falta de autenticacion
    const status = error?.response?.status;
    if (status === 401 || status === 403) {
      return `Error de autenticacion (HTTP ${status}): No tienes sesion activa. DEBES llamar a 'verificarEstadoAuth' con el numero de WhatsApp del usuario antes de usar cualquier herramienta financiera.`;
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

/**
 * Crea y configura una instancia del servidor MCP con todos los handlers registrados.
 * Permite reutilizar la misma configuracion tanto en modo stdio como en modo HTTP.
 */
export function createMcpServer(client?: FinanzAppApiClient): Server {
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

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    console.error(`[MCP Tool] Llamando: ${name} args=${JSON.stringify(args)}`);
    const startTime = Date.now();

    try {
      const result = await handleToolCall(name, args as Record<string, unknown>, client || apiClient);
      const elapsed = Date.now() - startTime;
      console.error(`[MCP Tool] ${name} completado en ${elapsed}ms (${result.length} chars)`);

      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
      };
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      console.error(`[MCP Tool] ${name} ERROR en ${elapsed}ms: ${error.message}`);
      return {
        content: [
          {
            type: 'text',
            text: `Error al ejecutar ${name}: ${error.message}`,
          },
        ],
      };
    }
  });

  return server;
}

// Solo iniciar en modo stdio si no se solicita transporte HTTP o SSE
const transportMode = process.env.MCP_TRANSPORT;
if (transportMode !== 'http' && transportMode !== 'sse') {
  const server = createMcpServer();
  const stdioTransport = new StdioServerTransport();
  server.connect(stdioTransport).then(() => {
    console.error('FinanzApp MCP Server iniciado (stdio)');
  }).catch((error) => {
    console.error('Error fatal:', error);
    process.exit(1);
  });
}
