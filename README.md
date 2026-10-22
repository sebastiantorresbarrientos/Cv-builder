# Creador de CV

App web para crear un currículum vitae con un formulario, elegir el formato
(Clásico, Moderno, Minimalista, Ejecutivo, Elegante, Corporativo o Compacto) y descargarlo en PDF o Word.

Las habilidades se pueden mostrar como lista, etiquetas, columnas, barras de nivel o puntos de nivel.
El nivel va después de dos puntos (`Excel: 4`, `SQL: Avanzado`), del 1 al 5 o Básico / Intermedio / Avanzado / Experto.

- Vista previa en vivo mientras escribes.
- Los datos se guardan en tu navegador (localStorage); el servidor no almacena nada.
- Exportación en el servidor con `pdfkit` (PDF) y `docx` (Word).

## Correr en local

```bash
npm install
npm start
# http://localhost:3000
```

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
