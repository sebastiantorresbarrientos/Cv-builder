const express = require("express");
const path = require("path");
const { buildPdf } = require("./lib/pdf");
const { buildDocx } = require("./lib/docx");
const pagos = require("./lib/pagos");
const importador = require("./lib/importar");

const app = express();
app.set("trust proxy", true);
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

function fileName(cv) {
  const base = (cv.nombre || "curriculum")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `CV_${base || "curriculum"}`;
}

// Texto del pie en las descargas sin pagar, p. ej. "Hecho con cvlisto.cl".
function marcaAgua(req) {
  if (!req.marcaAgua) return null;
  if (process.env.MARCA_AGUA) return process.env.MARCA_AGUA;
  const host = process.env.PUBLIC_URL ? new URL(process.env.PUBLIC_URL).host : req.get("host");
  return `Hecho con ${host.replace(/^www\./, "")}`;
}

app.get("/api/config", (_req, res) => res.json({ ...pagos.config(), importar: importador.activo() }));

// Recibe el archivo tal cual (PDF o Word) y devuelve los campos del formulario. No se guarda nada.
app.post(
  "/api/importar",
  express.raw({ type: () => true, limit: importador.MAX_BYTES }),
  async (req, res) => {
    if (!importador.activo()) return res.status(400).json({ error: "La importación no está activada" });
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: "No llegó ningún archivo" });
    if (!importador.permitido(req.ip)) {
      return res.status(429).json({ error: "Alcanzaste el límite de importaciones por hora. Intenta más tarde." });
    }
    try {
      res.json(await importador.importar(req.body));
    } catch (err) {
      if (err.status === 415) return res.status(415).json({ error: "Sube un archivo PDF o Word (.docx)" });
      console.error("Error importando el CV:", err.message);
      res.status(502).json({ error: "No se pudo leer el CV" });
    }
  }
);

app.post("/api/checkout", async (req, res) => {
  if (!pagos.mpActivo()) return res.status(400).json({ error: "Mercado Pago no está activado" });
  try {
    res.json(await pagos.crearPreferencia(req));
  } catch (err) {
    console.error("Error creando el pago:", err.message, err.body || "");
    res.status(502).json({ error: "No se pudo iniciar el pago" });
  }
});

app.post("/api/paypal/orden", async (req, res) => {
  if (!pagos.ppActivo()) return res.status(400).json({ error: "PayPal no está activado" });
  try {
    res.json(await pagos.crearOrdenPaypal(req));
  } catch (err) {
    console.error("Error creando la orden de PayPal:", err.message, JSON.stringify(err.body || ""));
    res.status(502).json({ error: "No se pudo iniciar el pago con PayPal" });
  }
});

app.post("/api/paypal/capturar", async (req, res) => {
  if (!pagos.ppActivo()) return res.status(400).json({ error: "PayPal no está activado" });
  try {
    const pagoId = await pagos.capturarPaypal(req.body && req.body.orderId);
    if (!pagoId) return res.status(402).json({ error: "El pago de PayPal no se completó" });
    res.json({ pagoId });
  } catch (err) {
    console.error("Error capturando PayPal:", err.message, JSON.stringify(err.body || ""));
    res.status(502).json({ error: "No se pudo confirmar el pago con PayPal" });
  }
});

app.post("/api/export/pdf", pagos.verificarPago, (req, res) => {
  try {
    const cv = req.body || {};
    if (req.marcaAgua) res.setHeader("X-Marca-Agua", "1");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName(cv)}.pdf"`);
    buildPdf(cv, res, marcaAgua(req));
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: "No se pudo generar el PDF" });
  }
});

app.post("/api/export/docx", pagos.verificarPago, async (req, res) => {
  try {
    const cv = req.body || {};
    const buffer = await buildDocx(cv, marcaAgua(req));
    if (req.marcaAgua) res.setHeader("X-Marca-Agua", "1");
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName(cv)}.docx"`);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo generar el documento Word" });
  }
});

app.get("/health", (_req, res) => res.send("ok"));

app.listen(PORT, "0.0.0.0", () =>
  console.log(
    `CV Builder escuchando en puerto ${PORT} (Mercado Pago ${pagos.mpActivo() ? "activo" : "inactivo"}, ` +
      `PayPal ${pagos.ppActivo() ? "activo" : "inactivo"}, importar con IA ${importador.activo() ? "activo" : "inactivo"})`
  )
);
