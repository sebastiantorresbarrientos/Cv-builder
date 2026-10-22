const express = require("express");
const path = require("path");
const { buildPdf } = require("./lib/pdf");
const { buildDocx } = require("./lib/docx");

const app = express();
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

app.post("/api/export/pdf", (req, res) => {
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

app.post("/api/export/docx", async (req, res) => {
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

app.listen(PORT, "0.0.0.0", () => console.log(`CV Builder escuchando en puerto ${PORT}`));
