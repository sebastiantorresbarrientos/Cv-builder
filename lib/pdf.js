const PDFDocument = require("pdfkit");
const { getTheme } = require("./themes");
const { parseSkills, getEstilo, DEFAULT_LEVEL } = require("./skills");

const clean = (v) => (typeof v === "string" ? v.trim() : "");
const lines = (v) =>
  clean(v)
    .split("\n")
    .map((l) => l.replace(/^[\s•\-*]+/, "").trim())
    .filter(Boolean);

// Salta de página si no caben `h` puntos más.
function ensure(doc, h) {
  if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

function section(doc, t, title) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const accent = "#" + t.accent;
  doc.moveDown(0.8);
  ensure(doc, 48);
  const y0 = doc.y;

  if (t.headingStyle === "fill") {
    doc.rect(left, y0 - 3, right - left, 18).fill("#" + t.tint);
    doc.font(t.pdf.bold).fontSize(10.5).fillColor(accent)
      .text(title.toUpperCase(), left + 7, y0 + 1, { width: right - left - 14, characterSpacing: 0.5 });
    doc.y = y0 + 17;
  } else if (t.headingStyle === "bar") {
    doc.rect(left, y0 - 1, 4, 13).fill(accent);
    doc.font(t.pdf.bold).fontSize(11).fillColor(accent)
      .text(title.toUpperCase(), left + 11, y0, { width: right - left - 11 });
  } else if (t.headingStyle === "plain") {
    doc.font(t.pdf.bold).fontSize(10.5).fillColor(accent)
      .text(title.toUpperCase(), left, y0, { width: right - left, characterSpacing: 2 });
  } else {
    doc.font(t.pdf.bold).fontSize(11).fillColor(accent)
      .text(title.toUpperCase(), left, y0, { width: right - left });
    const y = doc.y + 1;
    doc.moveTo(left, y).lineTo(right, y).lineWidth(0.8).strokeColor(accent).stroke();
  }
  doc.x = left;
  doc.moveDown(0.4);
  doc.fillColor("black");
}

function entry(doc, t, { title, subtitle, date, description }) {
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const startY = doc.y;

  doc.font(t.pdf.bold).fontSize(10.5).fillColor("black");
  doc.text(title || "", left, startY, { width: width - 130 });
  const afterTitle = doc.y;

  if (date) {
    doc.font(t.pdf.regular).fontSize(9.5).fillColor("#" + t.muted);
    doc.text(date, left + width - 125, startY, { width: 125, align: "right" });
  }
  doc.y = afterTitle;
  doc.x = left;

  if (subtitle) {
    doc.font(t.pdf.italic).fontSize(10).fillColor("#" + t.muted).text(subtitle, left, doc.y, { width });
  }

  doc.font(t.pdf.regular).fontSize(10).fillColor("black");
  for (const l of lines(description)) {
    doc.text(`•  ${l}`, left + 6, doc.y + 1, { width: width - 6 });
  }
  doc.x = left;
  doc.moveDown(0.5);
}

function renderSkills(doc, t, skills, estilo) {
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const accent = "#" + t.accent;
  const level = (s) => s.level || DEFAULT_LEVEL;

  if (estilo === "etiquetas") {
    const h = 17, padX = 7, gap = 6;
    doc.font(t.pdf.regular).fontSize(9.5);
    let x = left;
    let y = doc.y + 2;
    for (const s of skills) {
      const w = Math.min(doc.widthOfString(s.name) + padX * 2, width);
      if (x + w > left + width) { x = left; y += h + gap; }
      if (y + h > doc.page.height - doc.page.margins.bottom) { doc.addPage(); y = doc.y; x = left; }
      doc.roundedRect(x, y, w, h, 4).fill("#" + t.tint);
      doc.fillColor(accent).text(s.name, x + padX, y + 4.5, { width: w - padX * 2 + 4, lineBreak: false });
      x += w + gap;
    }
    doc.x = left;
    doc.y = y + h + 2;
    return;
  }

  if (estilo === "columnas") {
    const cols = 3, colW = width / cols, rowH = 15;
    doc.font(t.pdf.regular).fontSize(10).fillColor("black");
    for (let i = 0; i < skills.length; i += cols) {
      ensure(doc, rowH);
      const y = doc.y;
      skills.slice(i, i + cols).forEach((s, c) => {
        const x = left + c * colW;
        doc.circle(x + 3, y + 4.2, 1.8).fill(accent);
        doc.fillColor("black").text(s.name, x + 11, y, { width: colW - 16, lineBreak: false, ellipsis: true });
      });
      doc.x = left;
      doc.y = y + rowH;
    }
    return;
  }

  if (estilo === "barras" || estilo === "puntos") {
    const gap = 28, colW = (width - gap) / 2;
    const rowH = estilo === "barras" ? 27 : 17;
    for (let i = 0; i < skills.length; i += 2) {
      ensure(doc, rowH);
      const y = doc.y;
      skills.slice(i, i + 2).forEach((s, c) => {
        const x = left + c * (colW + gap);
        const n = level(s);
        doc.font(t.pdf.regular).fontSize(10).fillColor("black");
        if (estilo === "barras") {
          doc.text(s.name, x, y, { width: colW, lineBreak: false, ellipsis: true });
          doc.roundedRect(x, y + 14, colW, 5, 2.5).fill("#E5E7EB");
          doc.roundedRect(x, y + 14, (colW * n) / 5, 5, 2.5).fill(accent);
        } else {
          const dots = 5, r = 3.4, step = 10.5;
          const dotsW = (dots - 1) * step + r * 2;
          doc.text(s.name, x, y, { width: colW - dotsW - 8, lineBreak: false, ellipsis: true });
          for (let d = 0; d < dots; d++) {
            doc.circle(x + colW - dotsW + r + d * step, y + 5.5, r).fill(d < n ? accent : "#E5E7EB");
          }
        }
      });
      doc.x = left;
      doc.y = y + rowH;
    }
    return;
  }

  // lista
  doc.font(t.pdf.regular).fontSize(10).fillColor("black")
    .text(skills.map((s) => s.name).join("  ·  "), left, doc.y, { width });
}

function dateRange(a, b, actual) {
  const from = clean(a);
  const to = actual ? "Actualidad" : clean(b);
  return [from, to].filter(Boolean).join(" - ");
}

function buildPdf(cv, stream) {
  const t = getTheme(cv.plantilla);
  const doc = new PDFDocument({ size: "A4", margins: { top: 48, bottom: 48, left: 52, right: 52 } });
  doc.pipe(stream);

  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const align = t.header === "center" ? "center" : "left";
  const accent = "#" + t.accent;

  // Encabezado
  let nameColor = accent;
  let titleColor = "#" + t.muted;
  let contactColor = "black";
  if (t.band) {
    doc.rect(0, 0, doc.page.width, 128).fill(accent);
    doc.y = 34;
    nameColor = "#FFFFFF";
    titleColor = "#" + (t.bandSub || "FFFFFF");
    contactColor = "#FFFFFF";
  }

  doc.font(t.pdf.bold).fontSize(t.nameSize).fillColor(nameColor)
    .text(clean(cv.nombre) || "Tu nombre", left, doc.y, { width, align });
  if (clean(cv.titulo)) {
    doc.font(t.pdf.regular).fontSize(12).fillColor(titleColor).text(clean(cv.titulo), left, doc.y, { width, align });
  }
  const contacto = [cv.email, cv.telefono, cv.ubicacion, cv.linkedin, cv.web].map(clean).filter(Boolean);
  if (contacto.length) {
    doc.moveDown(0.3);
    doc.font(t.pdf.regular).fontSize(9.5).fillColor(contactColor)
      .text(contacto.join("   |   "), left, doc.y, { width, align });
  }
  if (t.band) doc.y = Math.max(doc.y + 10, 128 + 4);
  doc.x = left;

  if (clean(cv.resumen)) {
    section(doc, t, "Perfil profesional");
    doc.font(t.pdf.regular).fontSize(10).fillColor("black")
      .text(clean(cv.resumen), left, doc.y, { width, align: "justify" });
  }

  const exp = (cv.experiencia || []).filter((e) => clean(e.cargo) || clean(e.empresa));
  if (exp.length) {
    section(doc, t, "Experiencia laboral");
    exp.forEach((e) =>
      entry(doc, t, {
        title: clean(e.cargo),
        subtitle: [clean(e.empresa), clean(e.lugar)].filter(Boolean).join(" · "),
        date: dateRange(e.desde, e.hasta, e.actual),
        description: e.descripcion,
      })
    );
  }

  const edu = (cv.educacion || []).filter((e) => clean(e.titulo) || clean(e.institucion));
  if (edu.length) {
    section(doc, t, "Educación");
    edu.forEach((e) =>
      entry(doc, t, {
        title: clean(e.titulo),
        subtitle: clean(e.institucion),
        date: dateRange(e.desde, e.hasta, false),
        description: e.descripcion,
      })
    );
  }

  const skills = parseSkills(cv.habilidades);
  if (skills.length) {
    section(doc, t, "Habilidades");
    renderSkills(doc, t, skills, getEstilo(cv.estiloHabilidades));
  }

  const idiomas = (cv.idiomas || []).filter((i) => clean(i.idioma));
  if (idiomas.length) {
    section(doc, t, "Idiomas");
    doc.font(t.pdf.regular).fontSize(10).fillColor("black").text(
      idiomas.map((i) => `${clean(i.idioma)}${clean(i.nivel) ? " (" + clean(i.nivel) + ")" : ""}`).join("  ·  "),
      left,
      doc.y,
      { width }
    );
  }

  const extra = lines(cv.adicional);
  if (extra.length) {
    section(doc, t, "Información adicional");
    extra.forEach((l) =>
      doc.font(t.pdf.regular).fontSize(10).fillColor("black").text(`•  ${l}`, left + 6, doc.y + 1, { width: width - 6 })
    );
  }

  doc.end();
}

module.exports = { buildPdf };
