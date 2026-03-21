/**
 * Cliente HTTP para comunicarse con el backend de FinanzApp
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from './config.js';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  usuarioId: string;
  nombre: string;
  email: string;
}

export interface GastoRequest {
  monto: number;
  categoria: string;
  categoriaPersonalizadaId?: string;
  descripcion?: string;
  fecha?: string;
  metodoPago?: string;
}

export interface IngresoRequest {
  monto: number;
  categoria: string;
  categoriaPersonalizadaId?: string;
  descripcion?: string;
  fecha?: string;
  montoAhorro?: number;
  metaId?: string;
  metodoPago?: string;
}

export interface AhorroRequest {
  monto: number;
  descripcion?: string;
  fecha?: string;
  metaId?: string;
  ingresoId?: string;
}

export interface MetaFinancieraRequest {
  nombre: string;
  descripcion?: string;
  montoObjetivo: number;
  fechaLimite?: string;
}

export interface BalanceResponse {
  totalIngresos: number;
  totalGastos: number;
  totalAhorros: number;
  totalDeudas: number;
  totalPrestamos: number;
  dineroDisponible: number;
}

export interface InversionRequest {
  nombre: string;
  descripcion?: string;
  monto: number;
  retornoEsperado?: number;
  fechaInversion?: string;
}

export interface RegistrarRetornoRequest {
  retornoReal: number;
  fechaRetorno?: string;
}

export interface DeudaRequest {
  tipo: string;
  descripcion: string;
  entidad?: string;
  montoTotal: number;
  fechaInicio?: string;
  fechaLimite?: string;
  categoria?: string;
  categoriaPersonalizadaId?: string;
}

export interface AbonoRequest {
  monto: number;
  descripcion?: string;
  metodoPago: string;
}

export interface DesgloseCategoriaResponse {
  [categoria: string]: number;
}

export class FinanzAppApiClient {
  private client: AxiosInstance;
  private token?: string;

  constructor(baseUrl: string = config.apiBaseUrl, token?: string) {
    this.token = token || config.jwtToken;
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Interceptor para agregar token JWT
    this.client.interceptors.request.use((reqConfig) => {
      if (this.token) {
        reqConfig.headers.Authorization = `Bearer ${this.token}`;
      }
      return reqConfig;
    });
  }

  setToken(token: string): void {
    this.token = token;
  }

  // ==================== AUTENTICACIÓN ====================

  async login(email: string, password: string): Promise<ApiResponse<LoginResponse>> {
    const response = await this.client.post<ApiResponse<LoginResponse>>('/auth/login', {
      email,
      password,
    });
    if (response.data.success && response.data.data.token) {
      this.token = response.data.data.token;
    }
    return response.data;
  }

  async loginWhatsapp(numeroWhatsapp: string, codigoVerificacion: string): Promise<ApiResponse<LoginResponse>> {
    const response = await this.client.post<ApiResponse<LoginResponse>>('/auth/login/whatsapp', {
      numeroWhatsapp,
      codigoVerificacion,
    });
    if (response.data.success && response.data.data.token) {
      this.token = response.data.data.token;
    }
    return response.data;
  }

  // ==================== INGRESOS ====================

  async crearIngreso(ingreso: IngresoRequest): Promise<ApiResponse<any>> {
    const response = await this.client.post<ApiResponse<any>>('/ingresos', ingreso);
    return response.data;
  }

  async obtenerIngresos(): Promise<ApiResponse<any[]>> {
    const response = await this.client.get<ApiResponse<any[]>>('/ingresos');
    return response.data;
  }

  async obtenerIngresosPorPeriodo(fechaInicio: string, fechaFin: string): Promise<ApiResponse<any[]>> {
    const response = await this.client.get<ApiResponse<any[]>>('/ingresos/periodo', {
      params: { fechaInicio, fechaFin },
    });
    return response.data;
  }

  async obtenerIngresosPorCategoria(categoria: string): Promise<ApiResponse<any[]>> {
    const response = await this.client.get<ApiResponse<any[]>>(`/ingresos/categoria/${categoria}`);
    return response.data;
  }

  async obtenerTotalIngresos(): Promise<ApiResponse<number>> {
    const response = await this.client.get<ApiResponse<number>>('/ingresos/total');
    return response.data;
  }

  async obtenerTotalIngresosPorPeriodo(fechaInicio: string, fechaFin: string): Promise<ApiResponse<number>> {
    const response = await this.client.get<ApiResponse<number>>('/ingresos/total/periodo', {
      params: { fechaInicio, fechaFin },
    });
    return response.data;
  }

  // ==================== GASTOS ====================

  async crearGasto(gasto: GastoRequest): Promise<ApiResponse<any>> {
    const response = await this.client.post<ApiResponse<any>>('/gastos', gasto);
    return response.data;
  }

  async obtenerGastos(): Promise<ApiResponse<any[]>> {
    const response = await this.client.get<ApiResponse<any[]>>('/gastos');
    return response.data;
  }

  async obtenerGastosPorPeriodo(fechaInicio: string, fechaFin: string): Promise<ApiResponse<any[]>> {
    const response = await this.client.get<ApiResponse<any[]>>('/gastos/periodo', {
      params: { fechaInicio, fechaFin },
    });
    return response.data;
  }

  async obtenerGastosPorCategoria(categoria: string): Promise<ApiResponse<any[]>> {
    const response = await this.client.get<ApiResponse<any[]>>(`/gastos/categoria/${categoria}`);
    return response.data;
  }

  async obtenerTotalGastos(): Promise<ApiResponse<number>> {
    const response = await this.client.get<ApiResponse<number>>('/gastos/total');
    return response.data;
  }

  async obtenerTotalGastosPorPeriodo(fechaInicio: string, fechaFin: string): Promise<ApiResponse<number>> {
    const response = await this.client.get<ApiResponse<number>>('/gastos/total/periodo', {
      params: { fechaInicio, fechaFin },
    });
    return response.data;
  }

  async obtenerDesgloseGastos(): Promise<ApiResponse<DesgloseCategoriaResponse>> {
    const response = await this.client.get<ApiResponse<DesgloseCategoriaResponse>>('/gastos/desglose');
    return response.data;
  }

  async obtenerDesgloseGastosPorPeriodo(fechaInicio: string, fechaFin: string): Promise<ApiResponse<DesgloseCategoriaResponse>> {
    const response = await this.client.get<ApiResponse<DesgloseCategoriaResponse>>('/gastos/desglose/periodo', {
      params: { fechaInicio, fechaFin },
    });
    return response.data;
  }

  // ==================== AHORROS ====================

  async crearAhorro(ahorro: AhorroRequest): Promise<ApiResponse<any>> {
    const response = await this.client.post<ApiResponse<any>>('/ahorros', ahorro);
    return response.data;
  }

  async obtenerAhorros(): Promise<ApiResponse<any[]>> {
    const response = await this.client.get<ApiResponse<any[]>>('/ahorros');
    return response.data;
  }

  async obtenerAhorrosPorPeriodo(fechaInicio: string, fechaFin: string): Promise<ApiResponse<any[]>> {
    const response = await this.client.get<ApiResponse<any[]>>('/ahorros/periodo', {
      params: { fechaInicio, fechaFin },
    });
    return response.data;
  }

  async obtenerAhorrosPorMeta(metaId: string): Promise<ApiResponse<any[]>> {
    const response = await this.client.get<ApiResponse<any[]>>(`/ahorros/meta/${metaId}`);
    return response.data;
  }

  async obtenerTotalAhorros(): Promise<ApiResponse<number>> {
    const response = await this.client.get<ApiResponse<number>>('/ahorros/total');
    return response.data;
  }

  async obtenerTotalAhorrosPorPeriodo(fechaInicio: string, fechaFin: string): Promise<ApiResponse<number>> {
    const response = await this.client.get<ApiResponse<number>>('/ahorros/total/periodo', {
      params: { fechaInicio, fechaFin },
    });
    return response.data;
  }

  // ==================== METAS FINANCIERAS ====================

  async crearMeta(meta: MetaFinancieraRequest): Promise<ApiResponse<any>> {
    const response = await this.client.post<ApiResponse<any>>('/metas', meta);
    return response.data;
  }

  async obtenerMetas(): Promise<ApiResponse<any[]>> {
    const response = await this.client.get<ApiResponse<any[]>>('/metas');
    return response.data;
  }

  async obtenerMetasPorEstado(estado: string): Promise<ApiResponse<any[]>> {
    const response = await this.client.get<ApiResponse<any[]>>(`/metas/estado/${estado}`);
    return response.data;
  }

  async registrarProgresoMeta(metaId: string, monto: number): Promise<ApiResponse<any>> {
    const response = await this.client.post<ApiResponse<any>>(`/metas/${metaId}/progreso`, null, {
      params: { monto },
    });
    return response.data;
  }

  async cambiarEstadoMeta(metaId: string, estado: string): Promise<ApiResponse<any>> {
    const response = await this.client.patch<ApiResponse<any>>(`/metas/${metaId}/estado`, null, {
      params: { estado },
    });
    return response.data;
  }

  // ==================== BALANCE ====================

  async obtenerBalance(): Promise<ApiResponse<BalanceResponse>> {
    const response = await this.client.get<ApiResponse<BalanceResponse>>('/balance');
    return response.data;
  }

  async obtenerBalancePorPeriodo(fechaInicio: string, fechaFin: string): Promise<ApiResponse<BalanceResponse>> {
    const response = await this.client.get<ApiResponse<BalanceResponse>>('/balance/periodo', {
      params: { fechaInicio, fechaFin },
    });
    return response.data;
  }

  async obtenerBalancePorMetodo(): Promise<ApiResponse<any>> {
    const response = await this.client.get<ApiResponse<any>>('/balance/metodos');
    return response.data;
  }

  // ==================== EDICIÓN Y ELIMINACIÓN ====================

  async actualizarIngreso(id: string, datos: Partial<IngresoRequest>): Promise<ApiResponse<any>> {
    const response = await this.client.put<ApiResponse<any>>(`/ingresos/${id}`, datos);
    return response.data;
  }

  async eliminarIngreso(id: string): Promise<ApiResponse<any>> {
    const response = await this.client.delete<ApiResponse<any>>(`/ingresos/${id}`);
    return response.data;
  }

  async actualizarGasto(id: string, datos: Partial<GastoRequest>): Promise<ApiResponse<any>> {
    const response = await this.client.put<ApiResponse<any>>(`/gastos/${id}`, datos);
    return response.data;
  }

  async eliminarGasto(id: string): Promise<ApiResponse<any>> {
    const response = await this.client.delete<ApiResponse<any>>(`/gastos/${id}`);
    return response.data;
  }

  async actualizarAhorro(id: string, datos: Partial<AhorroRequest>): Promise<ApiResponse<any>> {
    const response = await this.client.put<ApiResponse<any>>(`/ahorros/${id}`, datos);
    return response.data;
  }

  async eliminarAhorro(id: string): Promise<ApiResponse<any>> {
    const response = await this.client.delete<ApiResponse<any>>(`/ahorros/${id}`);
    return response.data;
  }

  async actualizarMeta(id: string, datos: Partial<MetaFinancieraRequest>): Promise<ApiResponse<any>> {
    const response = await this.client.put<ApiResponse<any>>(`/metas/${id}`, datos);
    return response.data;
  }

  async eliminarMeta(id: string): Promise<ApiResponse<any>> {
    const response = await this.client.delete<ApiResponse<any>>(`/metas/${id}`);
    return response.data;
  }

  async actualizarDeuda(id: string, datos: Partial<DeudaRequest>): Promise<ApiResponse<any>> {
    const response = await this.client.put<ApiResponse<any>>(`/deudas/${id}`, datos);
    return response.data;
  }

  async eliminarDeuda(id: string): Promise<ApiResponse<any>> {
    const response = await this.client.delete<ApiResponse<any>>(`/deudas/${id}`);
    return response.data;
  }

  // ==================== WHATSAPP (sin auth) ====================

  async registrarIngresoWhatsapp(numeroWhatsapp: string, monto: number, categoria: string, descripcion?: string): Promise<ApiResponse<any>> {
    const response = await this.client.post<ApiResponse<any>>('/whatsapp/ingreso', null, {
      params: { numeroWhatsapp, monto, categoria, descripcion },
    });
    return response.data;
  }

  async registrarGastoWhatsapp(numeroWhatsapp: string, monto: number, categoria: string, descripcion?: string): Promise<ApiResponse<any>> {
    const response = await this.client.post<ApiResponse<any>>('/whatsapp/gasto', null, {
      params: { numeroWhatsapp, monto, categoria, descripcion },
    });
    return response.data;
  }

  async registrarAhorroWhatsapp(numeroWhatsapp: string, monto: number, descripcion?: string, metaId?: string): Promise<ApiResponse<any>> {
    const response = await this.client.post<ApiResponse<any>>('/whatsapp/ahorro', null, {
      params: { numeroWhatsapp, monto, descripcion, metaId },
    });
    return response.data;
  }

  async obtenerBalanceWhatsapp(numeroWhatsapp: string): Promise<ApiResponse<BalanceResponse>> {
    const response = await this.client.get<ApiResponse<BalanceResponse>>('/whatsapp/balance', {
      params: { numeroWhatsapp },
    });
    return response.data;
  }

  async obtenerResumenMesWhatsapp(numeroWhatsapp: string): Promise<ApiResponse<any>> {
    const response = await this.client.get<ApiResponse<any>>('/whatsapp/resumen-mes', {
      params: { numeroWhatsapp },
    });
    return response.data;
  }

  async obtenerMetasWhatsapp(numeroWhatsapp: string): Promise<ApiResponse<any[]>> {
    const response = await this.client.get<ApiResponse<any[]>>('/whatsapp/metas', {
      params: { numeroWhatsapp },
    });
    return response.data;
  }

  // ==================== AUTENTICACION WHATSAPP ====================

  async verificarEstadoWhatsapp(telefono: string): Promise<ApiResponse<any>> {
    const response = await this.client.get<ApiResponse<any>>('/whatsapp/auth/estado', {
      params: { numeroWhatsapp: telefono },
    });
    return response.data;
  }

  async obtenerTokenWhatsapp(telefono: string): Promise<ApiResponse<any>> {
    const response = await this.client.get<ApiResponse<any>>('/whatsapp/auth/obtener-token', {
      params: { numeroWhatsapp: telefono },
    });
    return response.data;
  }

  async registrarUsuarioWhatsapp(telefono: string, nombre: string, email: string, password: string): Promise<ApiResponse<any>> {
    const response = await this.client.post<ApiResponse<any>>('/whatsapp/auth/registro', null, {
      params: { numeroWhatsapp: telefono, nombre, email, password },
    });
    return response.data;
  }

  async solicitarCodigoWhatsapp(telefono: string): Promise<ApiResponse<any>> {
    const response = await this.client.post<ApiResponse<any>>('/whatsapp/auth/solicitar-codigo', null, {
      params: { numeroWhatsapp: telefono },
    });
    return response.data;
  }

  async verificarCodigoWhatsapp(telefono: string, codigo: string): Promise<ApiResponse<any>> {
    const response = await this.client.post<ApiResponse<any>>('/whatsapp/auth/verificar-codigo', null, {
      params: { numeroWhatsapp: telefono, codigo },
    });
    return response.data;
  }

  async generarLinkOAuthWhatsapp(telefono: string): Promise<ApiResponse<any>> {
    const response = await this.client.post<ApiResponse<any>>('/whatsapp/auth/generar-link', null, {
      params: { numeroWhatsapp: telefono },
    });
    return response.data;
  }

  // ==================== CATEGORÍAS PERSONALIZADAS ====================

  async getCategorias(endpoint: string): Promise<ApiResponse<any[]>> {
    const response = await this.client.get<ApiResponse<any[]>>(endpoint);
    return response.data;
  }

  // ==================== DEUDAS Y PRÉSTAMOS ====================

  async crearDeuda(data: DeudaRequest): Promise<ApiResponse<any>> {
    const response = await this.client.post<ApiResponse<any>>('/deudas', data);
    return response.data;
  }

  async obtenerDeudasPorTipo(tipo: string): Promise<ApiResponse<any[]>> {
    const response = await this.client.get<ApiResponse<any[]>>(`/deudas/tipo/${tipo}`);
    return response.data;
  }

  async abonarDeuda(deudaId: string, data: AbonoRequest): Promise<ApiResponse<any>> {
    const response = await this.client.post<ApiResponse<any>>(`/deudas/${deudaId}/abonos`, data);
    return response.data;
  }

  async obtenerResumenDeudas(): Promise<ApiResponse<any>> {
    const response = await this.client.get<ApiResponse<any>>('/deudas/resumen');
    return response.data;
  }

  async obtenerAbonosDeuda(deudaId: string): Promise<ApiResponse<any[]>> {
    const response = await this.client.get<ApiResponse<any[]>>(`/deudas/${deudaId}/abonos`);
    return response.data;
  }

  async obtenerDeudasPorEstado(estado: string): Promise<ApiResponse<any[]>> {
    const response = await this.client.get<ApiResponse<any[]>>(`/deudas/estado/${estado}`);
    return response.data;
  }

  // ==================== INVERSIONES ====================

  async crearInversion(data: InversionRequest): Promise<ApiResponse<any>> {
    const response = await this.client.post<ApiResponse<any>>('/inversiones', data);
    return response.data;
  }

  async obtenerInversiones(estado?: string): Promise<ApiResponse<any[]>> {
    const params = estado ? { estado } : {};
    const response = await this.client.get<ApiResponse<any[]>>('/inversiones', { params });
    return response.data;
  }

  async obtenerInversionPorId(id: string): Promise<ApiResponse<any>> {
    const response = await this.client.get<ApiResponse<any>>(`/inversiones/${id}`);
    return response.data;
  }

  async registrarRetornoInversion(inversionId: string, data: RegistrarRetornoRequest): Promise<ApiResponse<any>> {
    const response = await this.client.post<ApiResponse<any>>(`/inversiones/${inversionId}/retorno`, data);
    return response.data;
  }

  async eliminarInversion(id: string): Promise<ApiResponse<any>> {
    const response = await this.client.delete<ApiResponse<any>>(`/inversiones/${id}`);
    return response.data;
  }
}

// Instancia singleton
export const apiClient = new FinanzAppApiClient();
