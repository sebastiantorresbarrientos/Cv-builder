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

// `next`: alto del primer ítem, para que el título no quede solo al final de una hoja.
function section(doc, t, title, next = 0) {
  const { left, width } = frame(doc);
  const right = left + width;
  const accent = "#" + t.accent;
  doc.moveDown(0.8);
  const headH = t.headingStyle === "fill" ? 22 : 17; // alto del título con su espacio inferior
  ensure(doc, next && headH + next <= USABLE(doc) ? headH + next : 48);
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

const USABLE = (doc) => doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
const DATE_W = (width) => (width > 400 ? 125 : 95);

// Alto que ocupa un ítem completo, para no cortarlo entre dos páginas.
function entryHeight(doc, t, { title, subtitle, description }) {
  const { width } = frame(doc);
  let h = doc.font(t.pdf.bold).fontSize(10.5).heightOfString(title || " ", { width: width - DATE_W(width) - 5 });
  if (subtitle) h += doc.font(t.pdf.italic).fontSize(10).heightOfString(subtitle, { width });
  doc.font(t.pdf.regular).fontSize(10);
  for (const l of lines(description)) h += doc.heightOfString(l, { width: width - 16 }) + 1;
  return h;
}

function entry(doc, t, item) {
  const { title, subtitle, date, description } = item;
  const { left, width } = frame(doc);
  // El ítem pasa entero a la hoja siguiente si no cabe; solo se corta si es más largo que una hoja.
  const h = entryHeight(doc, t, item);
  ensure(doc, h <= USABLE(doc) ? h : 30);
  const startY = doc.y;
  const dateW = DATE_W(width);

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

  for (const l of lines(description)) bulletLine(doc, t, l, left, width);
  doc.x = left;
  doc.moveDown(0.5);
}

// Viñeta con el texto justificado (igual que los párrafos) y sangría colgante.
// Si un ítem es más largo que una hoja, el corte cae entre viñetas, nunca dentro de una.
function bulletLine(doc, t, text, left, width) {
  doc.font(t.pdf.regular).fontSize(10).fillColor(ink(t));
  ensure(doc, doc.heightOfString(text, { width: width - 16 }) + 1);
  const y = doc.y + 1;
  doc.text("•", left + 6, y, { width: 10, lineBreak: false });
  doc.text(text, left + 16, y, { width: width - 16, align: "justify" });
  doc.x = left;
}

function paragraph(doc, t, text) {
  const { left, width } = frame(doc);
  doc.font(t.pdf.regular).fontSize(10).fillColor(ink(t)).text(text, left, doc.y, { width, align: "justify" });
}

function bullets(doc, t, items) {
  const { left, width } = frame(doc);
  items.forEach((l) => bulletLine(doc, t, l, left, width));
}

// Tamaño de letra para que el texto quepa en una línea, desde `base` hasta `min`.
const MIN_FIT = 6;
function fitSize(doc, font, text, width, base, min = MIN_FIT) {
  let size = base;
  while (size > min && doc.font(font).fontSize(size).widthOfString(text) > width) size -= 0.25;
  return size;
}

// Escribe el texto en una línea, achicando la letra si no cabe. Si ni así cabe, se divide en líneas.
function fitLine(doc, font, text, x, y, width, base) {
  const size = fitSize(doc, font, text, width, base);
  doc.font(font).fontSize(size);
  const fits = doc.widthOfString(text) <= width;
  doc.text(text, x, y, { width: fits ? width + 2 : width, lineBreak: !fits });
  return size;
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
      const size = fitSize(doc, t.pdf.regular, s.name, width - padX * 2, 9.5);
      doc.font(t.pdf.regular).fontSize(size);
      const w = Math.min(doc.widthOfString(s.name) + padX * 2, width);
      if (x + w > left + width) { x = left; y += h + gap; }
      if (y + h > doc.page.height - doc.page.margins.bottom) { doc.addPage(); y = doc.y; x = frame(doc).left; }
      doc.roundedRect(x, y, w, h, 4).fill("#" + t.tint);
      doc.fillColor("#" + (t.tagText || t.accent))
        .text(s.name, x + padX, y + 4.5 + (9.5 - size) * 0.4, { width: w - padX * 2 + 4, lineBreak: false });
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
        doc.fillColor(ink(t));
        if (cols === 1) fitLine(doc, t.pdf.regular, s.name, x + 11, y, colW - 11, 10);
        else doc.font(t.pdf.regular).fontSize(10).text(s.name, x + 11, y, { width: colW - 16, lineBreak: false, ellipsis: true });
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
    // En la barra lateral las marcas son más chicas para dejar más espacio al nombre.
    const r = isStar ? (cols === 1 ? 4 : 4.6) : cols === 1 ? 2.9 : 3.4;
    const step = isStar ? (cols === 1 ? 9.6 : 11) : cols === 1 ? 8.6 : 10.5;
    const marksW = 4 * step + r * 2;
    const nameW = estilo === "barras" ? colW : colW - marksW - 8;
    doc.font(t.pdf.regular).fontSize(10);
    for (let i = 0; i < skills.length; i += cols) {
      const row = skills.slice(i, i + cols);
      // El nombre puede ocupar más de una línea en columnas angostas.
      // En la barra lateral (cols 1) la letra se achica para que el nombre quepa en una línea.
      const sizes = row.map((s) => (cols === 1 ? fitSize(doc, t.pdf.regular, s.name, nameW, 10) : 10));
      const textH = Math.max(...row.map((s, k) => doc.font(t.pdf.regular).fontSize(sizes[k]).heightOfString(s.name, { width: nameW })));
      const rowH = estilo === "barras" ? textH + 15 : Math.max(17, textH + 5);
      ensure(doc, rowH);
      const y = doc.y;
      row.forEach((s, c) => {
        const x = left + c * (colW + gap);
        const n = level(s);
        // Nombres achicados: centrados en la altura de la fila.
        const dy = estilo === "barras" ? 0 : Math.max(0, (10 - sizes[c]) * 0.45);
        doc.font(t.pdf.regular).fontSize(sizes[c]).fillColor(ink(t)).text(s.name, x, y + dy, { width: nameW });
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
  if (cols === 1) {
    skills.forEach((s) => {
      doc.font(t.pdf.regular).fontSize(10).fillColor(ink(t)).text("•", l2 + 6, doc.y + 1, { lineBreak: false });
      const y = doc.y;
      fitLine(doc, t.pdf.regular, s.name, l2 + 16, y, w2 - 16, 10);
      doc.y = Math.max(doc.y, y + 12);
    });
    doc.x = l2;
  }
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

// Sección de ítems (experiencia, educación…): el título va en la misma hoja que el primer ítem.
function entries(doc, t, title, items) {
  section(doc, t, title, entryHeight(doc, t, items[0]));
  items.forEach((item) => entry(doc, t, item));
}

// Secciones del cuerpo. Con `withSkills` en false, habilidades e idiomas van en la barra lateral.
function renderBody(doc, t, cv, { withSkills }) {
  if (clean(cv.resumen)) {
    section(doc, t, "Perfil profesional");
    paragraph(doc, t, clean(cv.resumen));
  }

  const exp = (cv.experiencia || []).filter((e) => clean(e.cargo) || clean(e.empresa));
  if (exp.length) {
    entries(doc, t, "Experiencia laboral", exp.map((e) => ({
      title: clean(e.cargo),
      subtitle: [clean(e.empresa), clean(e.lugar)].filter(Boolean).join(" · "),
      date: dateRange(e.desde, e.hasta, e.actual),
      description: e.descripcion,
    })));
  }

  const edu = (cv.educacion || []).filter((e) => clean(e.titulo) || clean(e.institucion));
  if (edu.length) {
    entries(doc, t, "Educación", edu.map((e) => ({
      title: clean(e.titulo),
      subtitle: clean(e.institucion),
      date: dateRange(e.desde, e.hasta, false),
      description: e.descripcion,
    })));
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
      entries(doc, t, titulo, items.map((e) => ({
        title: clean(e.titulo),
        subtitle: clean(e.subtitulo),
        date: dateRange(e.desde, e.hasta, false),
        description: e.descripcion,
      })));
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
    // Al pintar la barra el color de relleno queda en el de la barra: el texto que sigue en la hoja nueva vuelve al color normal.
    doc.fillColor(ink(t));
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
    contacto.forEach((c) => {
      doc.fillColor(ink(ts));
      fitLine(doc, t.pdf.regular, c, left, doc.y + 2, width, 9.5);
    });
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
      doc.fillColor(ink(ts));
      fitLine(doc, t.pdf.bold, clean(i.idioma), left, doc.y + 2, width, 10);
      if (clean(i.nivel)) {
        doc.fillColor("#" + ts.muted);
        fitLine(doc, t.pdf.regular, clean(i.nivel), left, doc.y, width, 9.5);
      }
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

// Pie de página discreto en cada hoja (descargas sin pagar).
function drawMarca(doc, t, texto) {
  const { start, count } = doc.bufferedPageRange();
  for (let i = start; i < start + count; i++) {
    doc.switchToPage(i);
    const left = t.sidebar ? SIDEBAR_W : 0;
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font("Helvetica").fontSize(8).fillColor("#9CA3AF")
      .text(texto, left, doc.page.height - 24, { width: doc.page.width - left, align: "center", lineBreak: false });
    doc.page.margins.bottom = bottom;
  }
}

function buildPdf(cv, stream, marca) {
  const t = getTheme(cv.plantilla);
  const doc = new PDFDocument({ size: "A4", margins: PAGE_MARGINS, bufferPages: true });
  doc.pipe(stream);
  if (t.sidebar) buildSidebar(doc, t, cv);
  else buildStandard(doc, t, cv);
  if (marca) drawMarca(doc, t, marca);
  doc.end();
}

module.exports = { buildPdf };
