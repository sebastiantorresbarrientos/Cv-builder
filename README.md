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

## Cobro por descarga (Mercado Pago y PayPal)

Cada medio de pago se activa cuando están sus credenciales: `MP_ACCESS_TOKEN` para Mercado Pago (Checkout Pro)
y `PAYPAL_CLIENT_ID` + `PAYPAL_SECRET` para PayPal (Checkout). Con al menos uno activo, cada descarga exige un
pago aprobado, que el servidor verifica. Un pago habilita PDF y Word durante 24 horas. Sin credenciales, las descargas son gratis.

| Variable | Por defecto | Uso |
| --- | --- | --- |
| `MP_ACCESS_TOKEN` | (vacía) | Access Token de producción de Mercado Pago; activa el cobro |
| `PRECIO` | `1900` | Precio por descarga |
| `MONEDA` | `CLP` | Moneda de la cuenta de Mercado Pago |
| `VIGENCIA_HORAS` | `24` | Horas que dura un pago |
| `CONTACTO_EMAIL` | — | Correo de contacto que aparece en términos y privacidad |
| `PAYPAL_CLIENT_ID` / `PAYPAL_SECRET` | (vacías) | Credenciales Live de una app REST de PayPal; activan PayPal |
| `PAYPAL_PRECIO` | `2` | Precio en PayPal |
| `PAYPAL_MONEDA` | `USD` | Moneda en PayPal |
| `PUBLIC_URL` | (se deduce) | URL pública del sitio para la vuelta desde Mercado Pago |


## Importar un CV con IA

Con `ANTHROPIC_API_KEY` definida aparece la tarjeta **¿Ya tienes un CV?**: el usuario sube un PDF o Word (.docx) y
Claude lo ordena en los campos del formulario (`POST /api/importar`, en `lib/importar.js`). El archivo se procesa en
memoria y no se guarda. Sin la variable, la tarjeta no se muestra.

| Variable | Por defecto | Uso |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | (vacía) | API key de https://console.anthropic.com; activa la importación |
| `IMPORTAR_MODELO` | `claude-haiku-5-5` | Modelo que lee el CV |
| `IMPORTAR_LIMITE_HORA` | `10` | Importaciones por hora por IP (evita abusos que gasten la API) |

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
