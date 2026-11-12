# NEXPRICE — Comparador Multi-Proveedor y Generador de Listas de Venta

Sistema web para búsqueda automatizada de productos en múltiples proveedores en paralelo, análisis comparativo del proveedor más barato (contemplando impuestos y costos logísticos) y generación de listas de venta para clientes exportables a **PDF**, **Excel (`.xlsx`)** y **CSV**.

## Características Principales

- **Buscador Masivo Multi-Proveedor en Paralelo:** Ingresá una lista de productos una sola vez y consultá en simultáneo múltiples catálogos online (Carrefour, Día Online, Changomás, Vea, Disco, Jumbo) sin navegar página por página.
- **Extractor por Links Directos:** Extracción automática de todos los productos presentes en páginas de catálogo o búsqueda (soporte para VTEX `__STATE__`, JSON-LD y tarjetas HTML, incluyendo cálculo de precios unitarios promocionales como `2do al 50%`, `2x1`, `3x2`).
- **Comparador de Proveedor Más Barato:** Agrupación automática por producto buscado, cálculo de impuestos y flete, detección del proveedor ganador y cálculo de ahorro.
- **Generador de Listas de Venta para Clientes:** Navegador multi-proveedor con filtro de productos más baratos en 1 clic, márgenes configurables por segmento (`Distribuidor`, `Mayorista`, `Minorista`) y exportación a PDF, Excel y CSV.
- **Gestión de Cartera de Clientes:** Alta, edición y validación automática contra duplicados por razón social, CUIT o correo electrónico.

## Instalación y Uso Local

```bash
npm install
npm run dev
```
