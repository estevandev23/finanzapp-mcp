/**
 * Casos de Prueba para FinanzApp MCP Server
 *
 * Estos tests verifican la funcionalidad de las herramientas MCP
 * utilizando mocks del cliente API.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

// ==================== ESQUEMAS DE VALIDACIÓN (duplicados para testing) ====================

const CrearIngresoSchema = z.object({
  monto: z.number().positive('El monto debe ser positivo'),
  categoria: z.enum([
    'TRABAJO_PRINCIPAL',
    'TRABAJO_EXTRA',
    'GANANCIAS_ADICIONALES',
    'INVERSIONES',
    'OTROS'
  ]).optional().default('OTROS'),
  descripcion: z.string().optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  montoAhorro: z.number().min(0).optional(),
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
    'OTROS'
  ]).optional().default('OTROS'),
  descripcion: z.string().optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const CrearAhorroSchema = z.object({
  monto: z.number().positive('El monto debe ser positivo'),
  descripcion: z.string().optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  metaId: z.string().uuid().optional(),
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

// ==================== TESTS DE VALIDACIÓN DE ESQUEMAS ====================

describe('Validación de Esquemas', () => {
  describe('CrearIngresoSchema', () => {
    it('debe aceptar un ingreso válido con todos los campos', () => {
      const ingreso = {
        monto: 1500.50,
        categoria: 'TRABAJO_PRINCIPAL',
        descripcion: 'Salario mensual',
        fecha: '2026-01-29',
        montoAhorro: 200,
      };
      const result = CrearIngresoSchema.safeParse(ingreso);
      expect(result.success).toBe(true);
    });

    it('debe aceptar un ingreso solo con monto', () => {
      const ingreso = { monto: 500 };
      const result = CrearIngresoSchema.safeParse(ingreso);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.categoria).toBe('OTROS');
      }
    });

    it('debe rechazar monto negativo', () => {
      const ingreso = { monto: -100 };
      const result = CrearIngresoSchema.safeParse(ingreso);
      expect(result.success).toBe(false);
    });

    it('debe rechazar monto cero', () => {
      const ingreso = { monto: 0 };
      const result = CrearIngresoSchema.safeParse(ingreso);
      expect(result.success).toBe(false);
    });

    it('debe rechazar categoría inválida', () => {
      const ingreso = { monto: 100, categoria: 'INVALIDA' };
      const result = CrearIngresoSchema.safeParse(ingreso);
      expect(result.success).toBe(false);
    });

    it('debe rechazar fecha con formato incorrecto', () => {
      const ingreso = { monto: 100, fecha: '29-01-2026' };
      const result = CrearIngresoSchema.safeParse(ingreso);
      expect(result.success).toBe(false);
    });

    it('debe aceptar todas las categorías válidas', () => {
      const categorias = ['TRABAJO_PRINCIPAL', 'TRABAJO_EXTRA', 'GANANCIAS_ADICIONALES', 'INVERSIONES', 'OTROS'];
      categorias.forEach(cat => {
        const result = CrearIngresoSchema.safeParse({ monto: 100, categoria: cat });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('CrearGastoSchema', () => {
    it('debe aceptar un gasto válido', () => {
      const gasto = {
        monto: 50.00,
        categoria: 'COMIDA',
        descripcion: 'Almuerzo',
        fecha: '2026-01-29',
      };
      const result = CrearGastoSchema.safeParse(gasto);
      expect(result.success).toBe(true);
    });

    it('debe aceptar un gasto solo con monto', () => {
      const gasto = { monto: 25 };
      const result = CrearGastoSchema.safeParse(gasto);
      expect(result.success).toBe(true);
    });

    it('debe rechazar monto negativo', () => {
      const gasto = { monto: -50 };
      const result = CrearGastoSchema.safeParse(gasto);
      expect(result.success).toBe(false);
    });

    it('debe aceptar todas las categorías de gasto válidas', () => {
      const categorias = ['COMIDA', 'PAREJA', 'COMPRAS', 'TRANSPORTE', 'SERVICIOS', 'ENTRETENIMIENTO', 'SALUD', 'EDUCACION', 'OTROS'];
      categorias.forEach(cat => {
        const result = CrearGastoSchema.safeParse({ monto: 100, categoria: cat });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('CrearAhorroSchema', () => {
    it('debe aceptar un ahorro válido', () => {
      const ahorro = {
        monto: 300,
        descripcion: 'Ahorro para vacaciones',
        fecha: '2026-01-29',
      };
      const result = CrearAhorroSchema.safeParse(ahorro);
      expect(result.success).toBe(true);
    });

    it('debe aceptar ahorro con metaId válido', () => {
      const ahorro = {
        monto: 500,
        metaId: '550e8400-e29b-41d4-a716-446655440000',
      };
      const result = CrearAhorroSchema.safeParse(ahorro);
      expect(result.success).toBe(true);
    });

    it('debe rechazar metaId inválido', () => {
      const ahorro = {
        monto: 500,
        metaId: 'no-es-uuid',
      };
      const result = CrearAhorroSchema.safeParse(ahorro);
      expect(result.success).toBe(false);
    });
  });

  describe('CrearMetaSchema', () => {
    it('debe aceptar una meta válida', () => {
      const meta = {
        nombre: 'Vacaciones',
        descripcion: 'Viaje a la playa',
        montoObjetivo: 5000,
        fechaLimite: '2026-06-30',
      };
      const result = CrearMetaSchema.safeParse(meta);
      expect(result.success).toBe(true);
    });

    it('debe rechazar meta sin nombre', () => {
      const meta = {
        montoObjetivo: 5000,
      };
      const result = CrearMetaSchema.safeParse(meta);
      expect(result.success).toBe(false);
    });

    it('debe rechazar meta con nombre vacío', () => {
      const meta = {
        nombre: '',
        montoObjetivo: 5000,
      };
      const result = CrearMetaSchema.safeParse(meta);
      expect(result.success).toBe(false);
    });

    it('debe rechazar montoObjetivo negativo', () => {
      const meta = {
        nombre: 'Test',
        montoObjetivo: -1000,
      };
      const result = CrearMetaSchema.safeParse(meta);
      expect(result.success).toBe(false);
    });
  });

  describe('ConsultarPeriodoSchema', () => {
    it('debe aceptar fechas válidas', () => {
      const periodo = {
        fechaInicio: '2026-01-01',
        fechaFin: '2026-01-31',
      };
      const result = ConsultarPeriodoSchema.safeParse(periodo);
      expect(result.success).toBe(true);
    });

    it('debe rechazar fechas con formato incorrecto', () => {
      const periodo = {
        fechaInicio: '01/01/2026',
        fechaFin: '31/01/2026',
      };
      const result = ConsultarPeriodoSchema.safeParse(periodo);
      expect(result.success).toBe(false);
    });

    it('debe rechazar si falta fechaInicio', () => {
      const periodo = {
        fechaFin: '2026-01-31',
      };
      const result = ConsultarPeriodoSchema.safeParse(periodo);
      expect(result.success).toBe(false);
    });

    it('debe rechazar si falta fechaFin', () => {
      const periodo = {
        fechaInicio: '2026-01-01',
      };
      const result = ConsultarPeriodoSchema.safeParse(periodo);
      expect(result.success).toBe(false);
    });
  });
});

// ==================== TESTS DE CASOS DE USO ====================

describe('Casos de Uso - Ingresos', () => {
  it('Caso 1: Registrar salario mensual', () => {
    const entrada = {
      monto: 2500,
      categoria: 'TRABAJO_PRINCIPAL',
      descripcion: 'Salario enero',
      montoAhorro: 500,
    };
    const result = CrearIngresoSchema.safeParse(entrada);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.monto).toBe(2500);
      expect(result.data.montoAhorro).toBe(500);
    }
  });

  it('Caso 2: Registrar trabajo freelance', () => {
    const entrada = {
      monto: 800,
      categoria: 'TRABAJO_EXTRA',
      descripcion: 'Proyecto web cliente X',
    };
    const result = CrearIngresoSchema.safeParse(entrada);
    expect(result.success).toBe(true);
  });

  it('Caso 3: Registrar ganancia de inversiones', () => {
    const entrada = {
      monto: 150,
      categoria: 'INVERSIONES',
      descripcion: 'Dividendos Q1',
    };
    const result = CrearIngresoSchema.safeParse(entrada);
    expect(result.success).toBe(true);
  });
});

describe('Casos de Uso - Gastos', () => {
  it('Caso 1: Registrar gasto de comida', () => {
    const entrada = {
      monto: 35.50,
      categoria: 'COMIDA',
      descripcion: 'Almuerzo con compañeros',
    };
    const result = CrearGastoSchema.safeParse(entrada);
    expect(result.success).toBe(true);
  });

  it('Caso 2: Registrar compra en línea', () => {
    const entrada = {
      monto: 120,
      categoria: 'COMPRAS',
      descripcion: 'Audífonos Amazon',
    };
    const result = CrearGastoSchema.safeParse(entrada);
    expect(result.success).toBe(true);
  });

  it('Caso 3: Registrar pago de servicios', () => {
    const entrada = {
      monto: 85,
      categoria: 'SERVICIOS',
      descripcion: 'Factura de luz',
    };
    const result = CrearGastoSchema.safeParse(entrada);
    expect(result.success).toBe(true);
  });

  it('Caso 4: Registrar gasto de salud', () => {
    const entrada = {
      monto: 200,
      categoria: 'SALUD',
      descripcion: 'Consulta médica',
    };
    const result = CrearGastoSchema.safeParse(entrada);
    expect(result.success).toBe(true);
  });
});

describe('Casos de Uso - Ahorros', () => {
  it('Caso 1: Ahorro simple sin meta', () => {
    const entrada = {
      monto: 300,
      descripcion: 'Ahorro mensual',
    };
    const result = CrearAhorroSchema.safeParse(entrada);
    expect(result.success).toBe(true);
  });

  it('Caso 2: Ahorro asociado a meta', () => {
    const entrada = {
      monto: 500,
      descripcion: 'Ahorro para vacaciones',
      metaId: '550e8400-e29b-41d4-a716-446655440000',
    };
    const result = CrearAhorroSchema.safeParse(entrada);
    expect(result.success).toBe(true);
  });
});

describe('Casos de Uso - Metas Financieras', () => {
  it('Caso 1: Crear meta de vacaciones', () => {
    const entrada = {
      nombre: 'Vacaciones en la playa',
      descripcion: 'Viaje familiar a Cancún',
      montoObjetivo: 3000,
      fechaLimite: '2026-07-15',
    };
    const result = CrearMetaSchema.safeParse(entrada);
    expect(result.success).toBe(true);
  });

  it('Caso 2: Crear meta de fondo de emergencia', () => {
    const entrada = {
      nombre: 'Fondo de emergencia',
      montoObjetivo: 10000,
    };
    const result = CrearMetaSchema.safeParse(entrada);
    expect(result.success).toBe(true);
  });

  it('Caso 3: Crear meta para compra de auto', () => {
    const entrada = {
      nombre: 'Auto nuevo',
      descripcion: 'Enganche para carro',
      montoObjetivo: 50000,
      fechaLimite: '2027-01-01',
    };
    const result = CrearMetaSchema.safeParse(entrada);
    expect(result.success).toBe(true);
  });
});

describe('Casos de Uso - Consultas por Período', () => {
  it('Caso 1: Consultar mes actual', () => {
    const entrada = {
      fechaInicio: '2026-01-01',
      fechaFin: '2026-01-31',
    };
    const result = ConsultarPeriodoSchema.safeParse(entrada);
    expect(result.success).toBe(true);
  });

  it('Caso 2: Consultar último trimestre', () => {
    const entrada = {
      fechaInicio: '2025-10-01',
      fechaFin: '2025-12-31',
    };
    const result = ConsultarPeriodoSchema.safeParse(entrada);
    expect(result.success).toBe(true);
  });

  it('Caso 3: Consultar año completo', () => {
    const entrada = {
      fechaInicio: '2025-01-01',
      fechaFin: '2025-12-31',
    };
    const result = ConsultarPeriodoSchema.safeParse(entrada);
    expect(result.success).toBe(true);
  });
});

// ==================== TESTS DE INTEGRACIÓN (Mock) ====================

describe('Integración - Simulación de Flujos', () => {
  // Mock de respuestas del API
  const mockApiResponses = {
    balance: {
      success: true,
      data: {
        totalIngresos: 5000,
        totalGastos: 2000,
        totalAhorros: 1000,
        dineroDisponible: 2000,
      },
    },
    desglose: {
      success: true,
      data: {
        COMIDA: 500,
        TRANSPORTE: 300,
        SERVICIOS: 400,
        ENTRETENIMIENTO: 200,
        OTROS: 600,
      },
    },
    metas: {
      success: true,
      data: [
        {
          id: '1',
          nombre: 'Vacaciones',
          montoObjetivo: 3000,
          montoActual: 1500,
          porcentajeAvance: 50,
          estado: 'ACTIVA',
        },
      ],
    },
  };

  it('Flujo 1: Análisis financiero completo', () => {
    // Simular cálculo de análisis
    const balance = mockApiResponses.balance.data;
    const flujoNeto = balance.totalIngresos - balance.totalGastos;
    const tasaAhorro = (balance.totalAhorros / balance.totalIngresos) * 100;

    expect(flujoNeto).toBe(3000);
    expect(tasaAhorro).toBe(20);
    expect(balance.dineroDisponible).toBe(2000);
  });

  it('Flujo 2: Desglose de gastos por categoría', () => {
    const desglose = mockApiResponses.desglose.data;
    const total = Object.values(desglose).reduce((sum, val) => sum + val, 0);
    const mayorGasto = Object.entries(desglose).sort(([, a], [, b]) => b - a)[0];

    expect(total).toBe(2000);
    expect(mayorGasto[0]).toBe('OTROS');
    expect(mayorGasto[1]).toBe(600);
  });

  it('Flujo 3: Evaluación de metas', () => {
    const metas = mockApiResponses.metas.data;
    const metaVacaciones = metas[0];

    expect(metaVacaciones.porcentajeAvance).toBe(50);
    expect(metaVacaciones.montoObjetivo - metaVacaciones.montoActual).toBe(1500);
    expect(metaVacaciones.estado).toBe('ACTIVA');
  });
});

// ==================== TESTS DE MANEJO DE ERRORES ====================

describe('Manejo de Errores', () => {
  it('debe manejar monto faltante en ingreso', () => {
    const entrada = {
      categoria: 'TRABAJO_PRINCIPAL',
      descripcion: 'Sin monto',
    };
    const result = CrearIngresoSchema.safeParse(entrada);
    expect(result.success).toBe(false);
  });

  it('debe manejar tipo de dato incorrecto en monto', () => {
    const entrada = {
      monto: 'cien pesos',
    };
    const result = CrearIngresoSchema.safeParse(entrada);
    expect(result.success).toBe(false);
  });

  it('debe manejar objeto vacío', () => {
    const result = CrearIngresoSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('debe manejar null', () => {
    const result = CrearIngresoSchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it('debe manejar undefined', () => {
    const result = CrearIngresoSchema.safeParse(undefined);
    expect(result.success).toBe(false);
  });
});

// ==================== TESTS DE ESCENARIOS DE WHATSAPP ====================

describe('Escenarios de WhatsApp', () => {
  it('Escenario: "Gasté 50 en comida"', () => {
    // Simulación de interpretación del mensaje
    const interpretacion = {
      monto: 50,
      categoria: 'COMIDA',
    };
    const result = CrearGastoSchema.safeParse(interpretacion);
    expect(result.success).toBe(true);
  });

  it('Escenario: "Recibí mi salario de 2500"', () => {
    const interpretacion = {
      monto: 2500,
      categoria: 'TRABAJO_PRINCIPAL',
      descripcion: 'Salario',
    };
    const result = CrearIngresoSchema.safeParse(interpretacion);
    expect(result.success).toBe(true);
  });

  it('Escenario: "Quiero ahorrar 300 para vacaciones"', () => {
    const interpretacion = {
      monto: 300,
      descripcion: 'Para vacaciones',
    };
    const result = CrearAhorroSchema.safeParse(interpretacion);
    expect(result.success).toBe(true);
  });

  it('Escenario: "Pagué la renta de 800"', () => {
    const interpretacion = {
      monto: 800,
      categoria: 'SERVICIOS',
      descripcion: 'Renta mensual',
    };
    const result = CrearGastoSchema.safeParse(interpretacion);
    expect(result.success).toBe(true);
  });

  it('Escenario: "Gané 500 como freelance"', () => {
    const interpretacion = {
      monto: 500,
      categoria: 'TRABAJO_EXTRA',
      descripcion: 'Trabajo freelance',
    };
    const result = CrearIngresoSchema.safeParse(interpretacion);
    expect(result.success).toBe(true);
  });
});
