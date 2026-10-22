# Creador de CV

App web para crear un currículum vitae con un formulario, elegir el formato
(Clásico, Moderno, Minimalista, Ejecutivo, Elegante, Corporativo, Compacto, Lateral o Lateral claro) y descargarlo en PDF o Word.

Las plantillas Lateral usan dos columnas y pueden llevar foto de perfil.
Las habilidades se pueden mostrar como lista, etiquetas, columnas, barras, puntos o estrellas de nivel.
Se pueden agregar secciones personalizadas (lista, párrafo o entradas con fecha) y reordenarlas.
El nivel de una habilidad va después de dos puntos (`Excel: 4`, `SQL: Avanzado`), del 1 al 5 o Básico / Intermedio / Avanzado / Experto.

- Vista previa en vivo mientras escribes.
- Los datos se guardan en tu navegador (localStorage); el servidor no almacena nada.
- Exportación en el servidor con `pdfkit` (PDF) y `docx` (Word).

## Correr en local

```bash
npm install
npm start
# http://localhost:3000
```

## Cobro por descarga (Mercado Pago)

Si existe la variable `MP_ACCESS_TOKEN`, cada descarga exige un pago aprobado en Mercado Pago (Checkout Pro).
Un pago habilita PDF y Word durante 24 horas. Sin la variable, las descargas son gratis.

| Variable | Por defecto | Uso |
| --- | --- | --- |
| `MP_ACCESS_TOKEN` | (vacía) | Access Token de producción de Mercado Pago; activa el cobro |
| `PRECIO` | `1900` | Precio por descarga |
| `MONEDA` | `CLP` | Moneda de la cuenta de Mercado Pago |
| `VIGENCIA_HORAS` | `24` | Horas que dura un pago |
| `PUBLIC_URL` | (se deduce) | URL pública del sitio para la vuelta desde Mercado Pago |


## Desplegar en Render (plan Free)

1. En https://render.com → **New** → **Blueprint** y elige este repo (usa `render.yaml`).
2. Render ejecuta `npm install` y `npm start`, y revisa `/health`.
3. La URL pública queda como `https://cv-builder-xxxx.onrender.com`.

En el plan Free el servicio se duerme tras 15 min sin uso; la primera visita después tarda unos 30–60 s.

## Desplegar en Railway

1. Sube esta carpeta a un repositorio de GitHub.
2. En https://railway.com → **New Project** → **Deploy from GitHub repo** y elige el repo.
3. Railway detecta Node automáticamente (usa `railway.json` y `npm start`).
4. En el servicio: **Settings → Networking → Generate Domain** para obtener la URL pública.

No necesita variables de entorno: Railway define `PORT` y la app lo usa.

Con la CLI también sirve:

```bash
npm i -g @railway/cli
railway login
railway init
railway up
railway domain
```
