const express = require("express");
const path = require("path");
const { buildPdf } = require("./lib/pdf");
const { buildDocx } = require("./lib/docx");
const pagos = require("./lib/pagos");

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

app.get("/api/config", (_req, res) => res.json(pagos.config()));

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

app.post("/api/export/pdf", pagos.exigirPago, (req, res) => {
  try {
    const cv = req.body || {};
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName(cv)}.pdf"`);
    buildPdf(cv, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: "No se pudo generar el PDF" });
  }
});

app.post("/api/export/docx", pagos.exigirPago, async (req, res) => {
  try {
    const cv = req.body || {};
    const buffer = await buildDocx(cv);
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
      `PayPal ${pagos.ppActivo() ? "activo" : "inactivo"})`
  )
);
