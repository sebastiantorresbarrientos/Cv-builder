const PDFDocument = require("pdfkit");
const { getTheme } = require("./themes");
const { parseSkills, getEstilo, DEFAULT_LEVEL } = require("./skills");

const clean = (v) => (typeof v === "string" ? v.trim() : "");
const lines = (v) =>
  clean(v)
    .split("\n")
    .map((l) => l.replace(/^[\s•\-*]+/, "").trim())
    .filter(Boolean);

const PAGE_MARGINS = { top: 48, bottom: 48, left: 52, right: 52 };
const SIDEBAR_W = 190;

// Colores de texto: t.ink (texto), t.muted (secundario), t.track (fondo de barras/puntos vacíos).
const ink = (t) => "#" + (t.ink || "000000");
const track = (t) => "#" + (t.track || "E5E7EB");

// Ancho útil según los márgenes de la página actual (cambian en las plantillas con barra lateral).
function frame(doc) {
  const left = doc.page.margins.left;
  return { left, width: doc.page.width - left - doc.page.margins.right };
}

// Salta de página si no caben `h` puntos más.
function ensure(doc, h) {
  if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

// Foto de perfil enviada por el cliente como data URL (PNG o JPEG).
function photoBuffer(cv) {
  const m = /^data:image\/(png|jpe?g);base64,(.+)$/.exec(clean(cv.foto));
  return m ? Buffer.from(m[2], "base64") : null;
}

function section(doc, t, title) {
  const { left, width } = frame(doc);
  const right = left + width;
  const accent = "#" + t.accent;
  doc.moveDown(0.8);
  ensure(doc, 48);
  const y0 = doc.y;

  if (t.headingStyle === "fill") {
    doc.rect(left, y0 - 3, width, 18).fill("#" + t.tint);
    doc.font(t.pdf.bold).fontSize(10.5).fillColor(accent)
      .text(title.toUpperCase(), left + 7, y0 + 1, { width: width - 14, characterSpacing: 0.5 });
    doc.y = y0 + 17;
  } else if (t.headingStyle === "bar") {
    doc.rect(left, y0 - 1, 4, 13).fill(accent);
    doc.font(t.pdf.bold).fontSize(11).fillColor(accent)
      .text(title.toUpperCase(), left + 11, y0, { width: width - 11 });
  } else if (t.headingStyle === "plain") {
    doc.font(t.pdf.bold).fontSize(10.5).fillColor(accent)
      .text(title.toUpperCase(), left, y0, { width, characterSpacing: 2 });
  } else {
    doc.font(t.pdf.bold).fontSize(11).fillColor(accent)
      .text(title.toUpperCase(), left, y0, { width });
    const y = doc.y + 1;
    doc.moveTo(left, y).lineTo(right, y).lineWidth(0.8).strokeColor(accent).stroke();
  }
  doc.x = left;
  doc.moveDown(0.4);
  doc.fillColor(ink(t));
}

function entry(doc, t, { title, subtitle, date, description }) {
  const { left, width } = frame(doc);
  ensure(doc, 30);
  const startY = doc.y;
  const dateW = width > 400 ? 125 : 95;

  doc.font(t.pdf.bold).fontSize(10.5).fillColor(ink(t));
  doc.text(title || "", left, startY, { width: width - dateW - 5 });
  const afterTitle = doc.y;

  if (date) {
    doc.font(t.pdf.regular).fontSize(9.5).fillColor("#" + t.muted);
    doc.text(date, left + width - dateW, startY, { width: dateW, align: "right" });
  }
  doc.y = afterTitle;
  doc.x = left;

  if (subtitle) {
    doc.font(t.pdf.italic).fontSize(10).fillColor("#" + t.muted).text(subtitle, left, doc.y, { width });
  }

  doc.font(t.pdf.regular).fontSize(10).fillColor(ink(t));
  for (const l of lines(description)) {
    doc.text(`•  ${l}`, left + 6, doc.y + 1, { width: width - 6 });
  }
  doc.x = left;
  doc.moveDown(0.5);
}

function paragraph(doc, t, text) {
  const { left, width } = frame(doc);
  doc.font(t.pdf.regular).fontSize(10).fillColor(ink(t)).text(text, left, doc.y, { width, align: "justify" });
}

function bullets(doc, t, items) {
  const { left, width } = frame(doc);
  items.forEach((l) =>
    doc.font(t.pdf.regular).fontSize(10).fillColor(ink(t)).text(`•  ${l}`, left + 6, doc.y + 1, { width: width - 6 })
  );
}

function star(doc, cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  return doc.polygon(...pts);
}

// `cols`: columnas para barras/puntos/estrellas (1 en la barra lateral).
function renderSkills(doc, t, skills, estilo, cols = 2) {
  const { left, width } = frame(doc);
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
      if (y + h > doc.page.height - doc.page.margins.bottom) { doc.addPage(); y = doc.y; x = frame(doc).left; }
      doc.roundedRect(x, y, w, h, 4).fill("#" + t.tint);
      doc.fillColor("#" + (t.tagText || t.accent))
        .text(s.name, x + padX, y + 4.5, { width: w - padX * 2 + 4, lineBreak: false });
      x += w + gap;
    }
    doc.x = left;
    doc.y = y + h + 2;
    return;
  }

  if (estilo === "columnas") {
    const n = cols === 1 ? 1 : 3, colW = width / n, rowH = 15;
    for (let i = 0; i < skills.length; i += n) {
      ensure(doc, rowH);
      const y = doc.y;
      skills.slice(i, i + n).forEach((s, c) => {
        const x = left + c * colW;
        doc.circle(x + 3, y + 4.2, 1.8).fill(accent);
        doc.font(t.pdf.regular).fontSize(10).fillColor(ink(t))
          .text(s.name, x + 11, y, { width: colW - 16, lineBreak: false, ellipsis: true });
      });
      doc.x = left;
      doc.y = y + rowH;
    }
    return;
  }

  if (estilo === "barras" || estilo === "puntos" || estilo === "estrellas") {
    const gap = cols === 1 ? 0 : 28;
    const colW = (width - gap * (cols - 1)) / cols;
    const isStar = estilo === "estrellas";
    const r = isStar ? 4.6 : 3.4, step = isStar ? 11 : 10.5;
    const marksW = 4 * step + r * 2;
    const nameW = estilo === "barras" ? colW : colW - marksW - 8;
    doc.font(t.pdf.regular).fontSize(10);
    for (let i = 0; i < skills.length; i += cols) {
      const row = skills.slice(i, i + cols);
      // El nombre puede ocupar más de una línea en columnas angostas.
      const textH = Math.max(...row.map((s) => doc.heightOfString(s.name, { width: nameW })));
      const rowH = estilo === "barras" ? textH + 15 : Math.max(17, textH + 5);
      ensure(doc, rowH);
      const y = doc.y;
      row.forEach((s, c) => {
        const x = left + c * (colW + gap);
        const n = level(s);
        doc.font(t.pdf.regular).fontSize(10).fillColor(ink(t)).text(s.name, x, y, { width: nameW });
        if (estilo === "barras") {
          doc.roundedRect(x, y + textH + 3, colW, 5, 2.5).fill(track(t));
          doc.roundedRect(x, y + textH + 3, (colW * n) / 5, 5, 2.5).fill(accent);
        } else {
          for (let d = 0; d < 5; d++) {
            const cx = x + colW - marksW + r + d * step;
            (isStar ? star(doc, cx, y + 5, r) : doc.circle(cx, y + 5.5, r)).fill(d < n ? accent : track(t));
          }
        }
      });
      doc.x = left;
      doc.y = y + rowH;
    }
    return;
  }

  // lista: en la barra lateral, una por línea
  const { left: l2, width: w2 } = frame(doc);
  doc.font(t.pdf.regular).fontSize(10).fillColor(ink(t));
  if (cols === 1) bullets(doc, t, skills.map((s) => s.name));
  else doc.text(skills.map((s) => s.name).join("  ·  "), l2, doc.y, { width: w2 });
}

function dateRange(a, b, actual) {
  const from = clean(a);
  const to = actual ? "Actualidad" : clean(b);
  return [from, to].filter(Boolean).join(" - ");
}

function contactList(cv) {
  return [cv.email, cv.telefono, cv.ubicacion, cv.linkedin, cv.web].map(clean).filter(Boolean);
}

function idiomasText(cv) {
  return (cv.idiomas || [])
    .filter((i) => clean(i.idioma))
    .map((i) => `${clean(i.idioma)}${clean(i.nivel) ? " (" + clean(i.nivel) + ")" : ""}`);
}

// Secciones del cuerpo. Con `withSkills` en false, habilidades e idiomas van en la barra lateral.
function renderBody(doc, t, cv, { withSkills }) {
  if (clean(cv.resumen)) {
    section(doc, t, "Perfil profesional");
    paragraph(doc, t, clean(cv.resumen));
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

  if (withSkills) {
    const skills = parseSkills(cv.habilidades);
    if (skills.length) {
      section(doc, t, "Habilidades");
      renderSkills(doc, t, skills, getEstilo(cv.estiloHabilidades));
    }
    const idiomas = idiomasText(cv);
    if (idiomas.length) {
      section(doc, t, "Idiomas");
      const { left, width } = frame(doc);
      doc.font(t.pdf.regular).fontSize(10).fillColor(ink(t)).text(idiomas.join("  ·  "), left, doc.y, { width });
    }
  }

  for (const sec of cv.secciones || []) {
    const titulo = clean(sec.titulo);
    if (!titulo) continue;
    if (sec.tipo === "entradas") {
      const items = (sec.items || []).filter((e) => clean(e.titulo) || clean(e.subtitulo));
      if (!items.length) continue;
      section(doc, t, titulo);
      items.forEach((e) =>
        entry(doc, t, {
          title: clean(e.titulo),
          subtitle: clean(e.subtitulo),
          date: dateRange(e.desde, e.hasta, false),
          description: e.descripcion,
        })
      );
    } else if (sec.tipo === "texto") {
      if (!clean(sec.contenido)) continue;
      section(doc, t, titulo);
      paragraph(doc, t, clean(sec.contenido));
    } else {
      const items = lines(sec.contenido);
      if (!items.length) continue;
      section(doc, t, titulo);
      bullets(doc, t, items);
    }
  }

  const extra = lines(cv.adicional);
  if (extra.length) {
    section(doc, t, "Información adicional");
    bullets(doc, t, extra);
  }
}

function buildStandard(doc, t, cv) {
  const { left, width } = frame(doc);
  const align = t.header === "center" ? "center" : "left";
  const accent = "#" + t.accent;

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
  const contacto = contactList(cv);
  if (contacto.length) {
    doc.moveDown(0.3);
    doc.font(t.pdf.regular).fontSize(9.5).fillColor(contactColor)
      .text(contacto.join("   |   "), left, doc.y, { width, align });
  }
  if (t.band) doc.y = Math.max(doc.y + 10, 128 + 4);
  doc.x = left;

  renderBody(doc, t, cv, { withSkills: true });
}

// Dos columnas: barra lateral de color (foto, contacto, habilidades, idiomas) y cuerpo a la derecha.
function buildSidebar(doc, t, cv) {
  const sb = t.sidebar;
  const pageW = doc.page.width;
  const sideMargins = { top: 40, bottom: 40, left: 22, right: pageW - SIDEBAR_W + 22 };
  const mainMargins = { top: 44, bottom: 44, left: SIDEBAR_W + 28, right: 40 };
  const paintSidebar = () => {
    doc.save().rect(0, 0, SIDEBAR_W, doc.page.height).fill("#" + sb.bg).restore();
  };
  // Tema de la barra lateral: mismos tipos de letra, colores propios.
  const ts = {
    ...t,
    accent: sb.head,
    muted: sb.muted,
    ink: sb.text,
    tint: sb.tag,
    tagText: sb.text,
    track: sb.track,
    headingStyle: "line",
  };

  paintSidebar();
  doc.on("pageAdded", () => {
    paintSidebar();
    doc.page.margins = { ...mainMargins };
    doc.x = mainMargins.left;
    doc.y = mainMargins.top;
  });

  // Barra lateral
  doc.page.margins = { ...sideMargins };
  let { left, width } = frame(doc);
  doc.y = sideMargins.top;
  const foto = photoBuffer(cv);
  if (foto) {
    const size = 112;
    try {
      doc.image(foto, left + (width - size) / 2, doc.y, { width: size, height: size });
      doc.y += size + 6;
    } catch (_) {
      // imagen dañada: se omite
    }
  }

  const contacto = contactList(cv);
  if (contacto.length) {
    section(doc, ts, "Contacto");
    contacto.forEach((c) =>
      doc.font(t.pdf.regular).fontSize(9.5).fillColor(ink(ts)).text(c, left, doc.y + 2, { width })
    );
  }
  const skills = parseSkills(cv.habilidades);
  if (skills.length) {
    section(doc, ts, "Habilidades");
    renderSkills(doc, ts, skills, getEstilo(cv.estiloHabilidades), 1);
  }
  const idiomas = (cv.idiomas || []).filter((i) => clean(i.idioma));
  if (idiomas.length) {
    section(doc, ts, "Idiomas");
    idiomas.forEach((i) => {
      doc.font(t.pdf.bold).fontSize(10).fillColor(ink(ts)).text(clean(i.idioma), left, doc.y + 2, { width });
      if (clean(i.nivel)) doc.font(t.pdf.regular).fontSize(9.5).fillColor("#" + ts.muted).text(clean(i.nivel), left, doc.y, { width });
    });
  }

  // Cuerpo
  doc.switchToPage(0);
  doc.page.margins = { ...mainMargins };
  ({ left, width } = frame(doc));
  doc.y = mainMargins.top;
  doc.font(t.pdf.bold).fontSize(t.nameSize).fillColor("#" + t.accent)
    .text(clean(cv.nombre) || "Tu nombre", left, doc.y, { width });
  if (clean(cv.titulo)) {
    doc.font(t.pdf.regular).fontSize(12.5).fillColor("#" + t.muted).text(clean(cv.titulo), left, doc.y + 2, { width });
  }
  doc.x = left;
  renderBody(doc, t, cv, { withSkills: false });
}

function buildPdf(cv, stream) {
  const t = getTheme(cv.plantilla);
  const doc = new PDFDocument({ size: "A4", margins: PAGE_MARGINS, bufferPages: true });
  doc.pipe(stream);
  if (t.sidebar) buildSidebar(doc, t, cv);
  else buildStandard(doc, t, cv);
  doc.end();
}

module.exports = { buildPdf };
