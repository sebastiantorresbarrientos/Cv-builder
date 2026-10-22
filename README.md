# Creador de CV

App web para crear un currículum vitae con un formulario, elegir el formato
(Clásico, Moderno o Minimalista) y descargarlo en PDF o Word.

- Vista previa en vivo mientras escribes.
- Los datos se guardan en tu navegador (localStorage); el servidor no almacena nada.
- Exportación en el servidor con `pdfkit` (PDF) y `docx` (Word).

## Correr en local

```bash
npm install
npm start
# http://localhost:3000
```

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
