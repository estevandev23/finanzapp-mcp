# FinanzApp MCP Server

> **Ubicación en el monorepo:** `proyecto-grado/finanzapp-mcp/`
> El `docker-compose.yml` unificado que orquesta este servicio junto con el backend y la base de datos se encuentra en `proyecto-grado/docker-compose.yml`.

Servidor MCP (Model Context Protocol) para el Asistente Financiero Personal de FinanzApp. Permite a Claude interactuar con el backend de finanzas mediante lenguaje natural.

## Docker

Este proyecto incluye un `Dockerfile` multi-stage (Node 20 Alpine):

```powershell
# Construir imagen individualmente
docker build -t finanzapp-mcp .

# O levantar todo el stack desde la carpeta padre (recomendado)
cd ..
docker compose up -d --build
```

## Características

- **Gestión de Ingresos**: Registrar y consultar ingresos por categoría y período
- **Gestión de Gastos**: Registrar gastos con categorización automática
- **Gestión de Ahorros**: Registrar ahorros y asociarlos a metas
- **Metas Financieras**: Crear metas y seguir el progreso
- **Balance y Reportes**: Consultar balance general y análisis financiero
- **Integración WhatsApp**: Soporte para interacción vía N8N

## Requisitos

- Node.js 18 o superior
- npm o yarn
- Backend FinanzApp corriendo (Spring Boot)

## Instalación

```bash
cd finanzapp-mcp
npm install
npm run build
```

## Configuración

El servidor utiliza variables de entorno para la configuración:

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `FINANZAPP_API_URL` | URL base del API | `http://localhost:8080/api/v1` |
| `FINANZAPP_JWT_TOKEN` | Token JWT para autenticación | - |
| `FINANZAPP_WHATSAPP_NUMBER` | Número de WhatsApp del usuario | - |
| `FINANZAPP_TIMEOUT` | Timeout para requests (ms) | `30000` |

## Herramientas Disponibles

### Ingresos
| Herramienta | Descripción |
|-------------|-------------|
| `crearIngreso` | Registra un nuevo ingreso |
| `obtenerIngresos` | Lista todos los ingresos |
| `obtenerIngresosPorPeriodo` | Ingresos en un rango de fechas |
| `obtenerTotalIngresos` | Total de ingresos |

### Gastos (Egresos)
| Herramienta | Descripción |
|-------------|-------------|
| `crearEgreso` | Registra un nuevo gasto |
| `obtenerGastos` | Lista todos los gastos |
| `obtenerGastosPorPeriodo` | Gastos en un rango de fechas |
| `obtenerGastosPorCategoria` | Gastos de una categoría |
| `obtenerTotalGastos` | Total de gastos |
| `obtenerDesgloseGastos` | Desglose por categoría |
| `obtenerDesgloseGastosPorPeriodo` | Desglose en período |

### Ahorros
| Herramienta | Descripción |
|-------------|-------------|
| `crearAhorro` | Registra un ahorro |
| `obtenerAhorros` | Lista todos los ahorros |
| `obtenerAhorrosPorPeriodo` | Ahorros en un rango de fechas |
| `obtenerTotalAhorros` | Total de ahorros |

### Metas Financieras
| Herramienta | Descripción |
|-------------|-------------|
| `crearMeta` | Crea una meta financiera |
| `obtenerMetas` | Lista todas las metas |
| `obtenerMetasActivas` | Metas en progreso |
| `registrarProgresoMeta` | Abona a una meta |

### Balance y Análisis
| Herramienta | Descripción |
|-------------|-------------|
| `obtenerBalance` | Balance general |
| `obtenerBalancePorPeriodo` | Balance en período |
| `obtenerResumenFinanciero` | Resumen completo |
| `obtenerAnalisisFinanciero` | Análisis detallado |
| `obtenerRegistros` | Todos los movimientos |

## Categorías Disponibles

### Categorías de Ingreso
- `TRABAJO_PRINCIPAL`
- `TRABAJO_EXTRA`
- `GANANCIAS_ADICIONALES`
- `INVERSIONES`
- `OTROS`

### Categorías de Gasto
- `COMIDA`
- `PAREJA`
- `COMPRAS`
- `TRANSPORTE`
- `SERVICIOS`
- `ENTRETENIMIENTO`
- `SALUD`
- `EDUCACION`
- `OTROS`

---

## Integración con Claude Desktop

### Paso 1: Compilar el servidor

```bash
cd finanzapp-mcp
npm install
npm run build
```

### Paso 2: Configurar Claude Desktop

Edita el archivo de configuración de Claude Desktop:

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

**macOS:**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Linux:**
```
~/.config/Claude/claude_desktop_config.json
```

### Paso 3: Agregar el servidor MCP

Agrega la siguiente configuración al archivo JSON:

```json
{
  "mcpServers": {
    "finanzapp": {
      "command": "node",
      "args": ["C:/Users/esteb/dev/proyecto-grado/finanzapp-mcp/dist/index.js"],
      "env": {
        "FINANZAPP_API_URL": "http://localhost:8080/api/v1",
        "FINANZAPP_JWT_TOKEN": "tu-token-jwt-aqui"
      }
    }
  }
}
```

**Nota para Windows:** Usa barras inclinadas hacia adelante (`/`) o barras dobles (`\\`) en las rutas.

### Paso 4: Obtener el Token JWT

1. Inicia sesión en la aplicación o mediante la API:

```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "tu@email.com", "password": "tu-password"}'
```

2. Copia el token de la respuesta y agrégalo a la configuración.

### Paso 5: Reiniciar Claude Desktop

Cierra y vuelve a abrir Claude Desktop para que cargue la configuración.

### Paso 6: Verificar la integración

En Claude Desktop, deberías ver el servidor "finanzapp" en la lista de herramientas disponibles. Puedes probar con:

> "¿Cuál es mi balance actual?"

> "Registra un gasto de 50 pesos en comida"

> "¿Cuánto he gastado este mes?"

---

## Integración con Claude Code (CLI)

### Opción 1: Archivo de configuración local

Crea un archivo `.claude/settings.local.json` en tu proyecto:

```json
{
  "mcpServers": {
    "finanzapp": {
      "command": "node",
      "args": ["./finanzapp-mcp/dist/index.js"],
      "env": {
        "FINANZAPP_API_URL": "http://localhost:8080/api/v1",
        "FINANZAPP_JWT_TOKEN": "tu-token-jwt"
      }
    }
  }
}
```

### Opción 2: Configuración global

Edita `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "finanzapp": {
      "command": "node",
      "args": ["/ruta/completa/finanzapp-mcp/dist/index.js"],
      "env": {
        "FINANZAPP_API_URL": "http://localhost:8080/api/v1",
        "FINANZAPP_JWT_TOKEN": "tu-token-jwt"
      }
    }
  }
}
```

---

## Uso con MCP Inspector

Para depurar y probar las herramientas:

```bash
npm run inspector
```

Esto abrirá una interfaz web donde puedes:
- Ver todas las herramientas disponibles
- Probar herramientas con diferentes parámetros
- Ver las respuestas del servidor

---

## Ejecutar Tests

```bash
# Ejecutar todos los tests
npm test

# Ejecutar con watch mode
npm run test:watch
```

---

## Ejemplos de Uso

### Registrar un ingreso
```
Usuario: "Recibí mi salario de 2500 pesos"
Claude: [Usa crearIngreso con monto=2500, categoria=TRABAJO_PRINCIPAL]
```

### Registrar un gasto
```
Usuario: "Gasté 80 pesos en el supermercado"
Claude: [Usa crearEgreso con monto=80, categoria=COMIDA]
```

### Consultar balance
```
Usuario: "¿Cuánto dinero tengo disponible?"
Claude: [Usa obtenerBalance]
```

### Crear una meta
```
Usuario: "Quiero ahorrar 5000 para vacaciones"
Claude: [Usa crearMeta con nombre="Vacaciones", montoObjetivo=5000]
```

### Análisis financiero
```
Usuario: "¿Cómo van mis finanzas este mes?"
Claude: [Usa obtenerAnalisisFinanciero]
```

---

## Arquitectura

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Claude Desktop │────▶│  MCP Server     │────▶│  Backend API    │
│  o Claude Code  │◀────│  (Node.js)      │◀────│  (Spring Boot)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │                       │                       │
   Lenguaje              Herramientas              REST API
   Natural               MCP                       + JWT
```

---

## Troubleshooting

### El servidor no aparece en Claude Desktop
1. Verifica que el archivo de configuración esté en la ubicación correcta
2. Asegúrate de que el JSON sea válido
3. Reinicia completamente Claude Desktop

### Error de conexión al API
1. Verifica que el backend esté corriendo en el puerto correcto
2. Comprueba la URL en `FINANZAPP_API_URL`
3. Verifica que el token JWT sea válido y no haya expirado

### Error de autenticación (401)
1. Regenera el token JWT
2. Actualiza la configuración con el nuevo token
3. Reinicia Claude Desktop

### Los cambios no se reflejan
1. Ejecuta `npm run build` después de modificar el código
2. Reinicia Claude Desktop

---

## Licencia

MIT
