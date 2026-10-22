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
  if (!pagos.activo()) return res.status(400).json({ error: "Los pagos no están activados" });
  try {
    res.json(await pagos.crearPreferencia(req));
  } catch (err) {
    console.error("Error creando el pago:", err.message, err.body || "");
    res.status(502).json({ error: "No se pudo iniciar el pago" });
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
  console.log(`CV Builder escuchando en puerto ${PORT} (pagos ${pagos.activo() ? "activados" : "desactivados"})`)
);
