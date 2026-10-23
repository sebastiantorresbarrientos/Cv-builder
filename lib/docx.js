const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  AlignmentType,
  BorderStyle,
  ShadingType,
  TabStopType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  VerticalAlign,
  HeightRule,
} = require("docx");
const PDFDocument = require("pdfkit");
const { getTheme } = require("./themes");
const { parseSkills, getEstilo, DEFAULT_LEVEL } = require("./skills");

const RIGHT_TAB = 9900; // ancho útil aprox. en twips (A4 con márgenes ~1.8 cm)
const SIDE_W = 3300; // barra lateral en twips
const SIDE_PAD = 260;
const MAIN_PAD = 400;
const SIDE_PAGE_W = 11906 - 2 * 500; // ancho útil con márgenes chicos en plantillas laterales

const clean = (v) => (typeof v === "string" ? v.trim() : "");
const lines = (v) =>
  clean(v)
    .split("\n")
    .map((l) => l.replace(/^[\s•\-*]+/, "").trim())
    .filter(Boolean);

// t.width: ancho útil de la columna; t.ink: color del texto; t.track: color de niveles vacíos.
const widthOf = (t) => t.width || RIGHT_TAB;
const inkOf = (t) => t.ink || "000000";

// Medidas de texto con las métricas de Helvetica (pdfkit), ajustadas a la fuente del Word.
const medidor = new PDFDocument({ autoFirstPage: false });
const ANCHO_FUENTE = { Calibri: 0.9, Georgia: 1.05 };

// Tamaño en medios puntos para que el texto quepa en una línea de `twips` de ancho (mínimo 13 = 6,5 pt).
function fitHalfPts(t, text, twips, base, bold = false) {
  const factor = ANCHO_FUENTE[t.docFont] || 1;
  const pts = twips / 20;
  medidor.font(bold ? "Helvetica-Bold" : "Helvetica");
  let size = base;
  while (size > 13 && medidor.fontSize(size / 2).widthOfString(text) * factor > pts) size -= 1;
  return size;
}

function photoBuffer(cv) {
  const m = /^data:image\/(png|jpe?g);base64,(.+)$/.exec(clean(cv.foto));
  return m ? Buffer.from(m[2], "base64") : null;
}

function heading(t, text) {
  const run = new TextRun({
    text: text.toUpperCase(),
    bold: true,
    color: t.accent,
    size: 22,
    font: t.docFont,
    ...(t.headingStyle === "plain" ? { characterSpacing: 40 } : {}),
  });
  const opts = { spacing: { before: 240, after: 100 }, children: [run] };
  if (t.headingStyle === "line") {
    opts.border = { bottom: { style: BorderStyle.SINGLE, size: 6, color: t.accent, space: 2 } };
  } else if (t.headingStyle === "fill") {
    opts.shading = { type: ShadingType.CLEAR, fill: t.tint, color: "auto" };
    opts.indent = { left: 100, right: 100 };
  } else if (t.headingStyle === "bar") {
    opts.indent = { left: 160 };
    opts.border = { left: { style: BorderStyle.SINGLE, size: 24, color: t.accent, space: 6 } };
  }
  return new Paragraph(opts);
}

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = {
  top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER,
  insideHorizontal: NO_BORDER, insideVertical: NO_BORDER,
};

// Tabla sin bordes; `cells` es una lista de listas de párrafos, repartida en `cols` columnas.
function gridTable(cells, cols, total = RIGHT_TAB) {
  const colW = Math.floor(total / cols);
  const rows = [];
  for (let i = 0; i < cells.length; i += cols) {
    const row = cells.slice(i, i + cols);
    while (row.length < cols) row.push([new Paragraph("")]);
    rows.push(
      new TableRow({
        children: row.map(
          (children) =>
            new TableCell({
              width: { size: colW, type: WidthType.DXA },
              borders: NO_BORDERS,
              margins: { top: 30, bottom: 30, left: 0, right: cols > 1 ? 200 : 0 },
              children,
            })
        ),
      })
    );
  }
  return new Table({
    width: { size: colW * cols, type: WidthType.DXA },
    columnWidths: Array(cols).fill(colW),
    borders: NO_BORDERS,
    rows,
  });
}

// `cols`: columnas para barras/puntos/estrellas (1 en la barra lateral).
function skillsBlock(t, skills, estilo, cols = 2) {
  const font = t.docFont;
  const ink = inkOf(t);
  const trackColor = t.track || "E5E7EB";
  const level = (s) => s.level || DEFAULT_LEVEL;
  const W = widthOf(t);

  if (estilo === "etiquetas") {
    const runs = [];
    skills.forEach((s, i) => {
      if (i) runs.push(new TextRun({ text: "   ", size: 20, font }));
      runs.push(
        new TextRun({
          text: ` ${s.name} `,
          size: 19,
          font,
          color: t.tagText || t.accent,
          shading: { type: ShadingType.CLEAR, fill: t.tint, color: "auto" },
        })
      );
    });
    return [new Paragraph({ spacing: { line: 360 }, children: runs })];
  }

  if (estilo === "columnas") {
    const cells = skills.map((s) => [
      new Paragraph({
        children: [
          new TextRun({ text: "•  ", bold: true, color: t.accent, size: 20, font }),
          new TextRun({ text: s.name, size: cols === 1 ? fitHalfPts(t, s.name, W - 200, 20) : 20, font, color: ink }),
        ],
      }),
    ]);
    return [gridTable(cells, cols === 1 ? 1 : 3, W)];
  }

  if (estilo === "barras") {
    // La barra es una fila de espacios con fondo de color: 30 espacios por nivel (15 en la barra lateral).
    const per = cols === 1 ? 14 : 30;
    const cells = skills.map((s) => {
      const filled = level(s) * per;
      return [
        new Paragraph({ children: [new TextRun({ text: s.name, size: cols === 1 ? fitHalfPts(t, s.name, W, 20) : 20, font, color: ink })] }),
        new Paragraph({
          spacing: { before: 40, after: 60 },
          children: [
            new TextRun({ text: " ".repeat(filled), size: 9, font: "Arial", shading: { type: ShadingType.CLEAR, fill: t.accent, color: "auto" } }),
            new TextRun({ text: " ".repeat(per * 5 - filled), size: 9, font: "Arial", shading: { type: ShadingType.CLEAR, fill: trackColor, color: "auto" } }),
          ],
        }),
      ];
    });
    return [gridTable(cells, cols, W)];
  }

  if (estilo === "puntos" || estilo === "estrellas") {
    const mark = estilo === "estrellas" ? "★" : "●";
    const cells = skills.map((s) => {
      const n = level(s);
      return [
        new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: Math.floor(W / cols) - (cols > 1 ? 260 : 40) }],
          children: [
            new TextRun({ text: s.name, size: cols === 1 ? fitHalfPts(t, s.name, W - 940, 20) : 20, font, color: ink }),
            new TextRun({ text: "\t" + mark.repeat(n), color: t.accent, size: 22, font: "Arial" }),
            new TextRun({ text: mark.repeat(5 - n), color: trackColor, size: 22, font: "Arial" }),
          ],
        }),
      ];
    });
    return [gridTable(cells, cols, W)];
  }

  if (cols === 1) {
    return skills.map(
      (s) =>
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun({ text: s.name, size: fitHalfPts(t, s.name, W - 720, 20), font, color: ink })],
        })
    );
  }
  return [new Paragraph({ children: [new TextRun({ text: skills.map((s) => s.name).join("  ·  "), size: 20, font, color: ink })] })];
}

function dateRange(a, b, actual) {
  const from = clean(a);
  const to = actual ? "Actualidad" : clean(b);
  return [from, to].filter(Boolean).join(" - ");
}

function entry(t, { title, subtitle, date, description }) {
  const out = [];
  out.push(
    new Paragraph({
      spacing: { before: 80 },
      tabStops: [{ type: TabStopType.RIGHT, position: widthOf(t) }],
      children: [
        new TextRun({ text: title || "", bold: true, size: 21, font: t.docFont, color: inkOf(t) }),
        ...(date ? [new TextRun({ text: `\t${date}`, color: t.muted, size: 19, font: t.docFont })] : []),
      ],
    })
  );
  if (subtitle) {
    out.push(
      new Paragraph({
        children: [new TextRun({ text: subtitle, italics: true, color: t.muted, size: 20, font: t.docFont })],
      })
    );
  }
  for (const l of lines(description)) {
    out.push(
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: l, size: 20, font: t.docFont, color: inkOf(t) })],
      })
    );
  }
  return out;
}

const text = (t, s, extra = {}) => new TextRun({ text: s, size: 20, font: t.docFont, color: inkOf(t), ...extra });
const paragraph = (t, s) => new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: [text(t, s)] });
const bullet = (t, s) => new Paragraph({ bullet: { level: 0 }, children: [text(t, s)] });

function contactList(cv) {
  return [cv.email, cv.telefono, cv.ubicacion, cv.linkedin, cv.web].map(clean).filter(Boolean);
}

// Secciones del cuerpo. Con `withSkills` en false, habilidades e idiomas van en la barra lateral.
function bodyBlocks(t, cv, { withSkills }) {
  const out = [];
  if (clean(cv.resumen)) out.push(heading(t, "Perfil profesional"), paragraph(t, clean(cv.resumen)));

  const exp = (cv.experiencia || []).filter((e) => clean(e.cargo) || clean(e.empresa));
  if (exp.length) {
    out.push(heading(t, "Experiencia laboral"));
    exp.forEach((e) =>
      out.push(
        ...entry(t, {
          title: clean(e.cargo),
          subtitle: [clean(e.empresa), clean(e.lugar)].filter(Boolean).join(" · "),
          date: dateRange(e.desde, e.hasta, e.actual),
          description: e.descripcion,
        })
      )
    );
  }

  const edu = (cv.educacion || []).filter((e) => clean(e.titulo) || clean(e.institucion));
  if (edu.length) {
    out.push(heading(t, "Educación"));
    edu.forEach((e) =>
      out.push(
        ...entry(t, {
          title: clean(e.titulo),
          subtitle: clean(e.institucion),
          date: dateRange(e.desde, e.hasta, false),
          description: e.descripcion,
        })
      )
    );
  }

  if (withSkills) {
    const skills = parseSkills(cv.habilidades);
    if (skills.length) out.push(heading(t, "Habilidades"), ...skillsBlock(t, skills, getEstilo(cv.estiloHabilidades)));

    const idiomas = (cv.idiomas || []).filter((i) => clean(i.idioma));
    if (idiomas.length) {
      out.push(heading(t, "Idiomas"));
      out.push(
        new Paragraph({
          children: [
            text(t, idiomas.map((i) => `${clean(i.idioma)}${clean(i.nivel) ? " (" + clean(i.nivel) + ")" : ""}`).join("  ·  ")),
          ],
        })
      );
    }
  }

  for (const sec of cv.secciones || []) {
    const titulo = clean(sec.titulo);
    if (!titulo) continue;
    if (sec.tipo === "entradas") {
      const items = (sec.items || []).filter((e) => clean(e.titulo) || clean(e.subtitulo));
      if (!items.length) continue;
      out.push(heading(t, titulo));
      items.forEach((e) =>
        out.push(
          ...entry(t, {
            title: clean(e.titulo),
            subtitle: clean(e.subtitulo),
            date: dateRange(e.desde, e.hasta, false),
            description: e.descripcion,
          })
        )
      );
    } else if (sec.tipo === "texto") {
      if (!clean(sec.contenido)) continue;
      out.push(heading(t, titulo), paragraph(t, clean(sec.contenido)));
    } else {
      const items = lines(sec.contenido);
      if (!items.length) continue;
      out.push(heading(t, titulo), ...items.map((l) => bullet(t, l)));
    }
  }

  const extra = lines(cv.adicional);
  if (extra.length) out.push(heading(t, "Información adicional"), ...extra.map((l) => bullet(t, l)));
  return out;
}

function standardChildren(t, cv) {
  const font = t.docFont;
  const children = [];
  const alignment = t.header === "center" ? AlignmentType.CENTER : AlignmentType.LEFT;
  const shading = t.band ? { type: ShadingType.CLEAR, fill: t.accent, color: "auto" } : undefined;
  const nameColor = t.band ? "FFFFFF" : t.accent;
  const titleColor = t.band ? t.bandSub || "FFFFFF" : t.muted;
  const contactColor = t.band ? "FFFFFF" : "000000";
  const pad = t.band ? 120 : 0;
  const indent = t.band ? { left: 160, right: 160 } : undefined;

  children.push(
    new Paragraph({
      alignment,
      shading,
      spacing: { before: pad, after: 0 },
      indent,
      children: [
        new TextRun({ text: clean(cv.nombre) || "Tu nombre", bold: true, size: t.nameSize * 2, color: nameColor, font }),
      ],
    })
  );
  if (clean(cv.titulo)) {
    children.push(
      new Paragraph({ alignment, shading, indent, children: [new TextRun({ text: clean(cv.titulo), size: 24, color: titleColor, font })] })
    );
  }
  const contacto = contactList(cv);
  if (contacto.length) {
    children.push(
      new Paragraph({
        alignment,
        shading,
        spacing: { before: 80, after: pad },
        indent,
        children: [new TextRun({ text: contacto.join("   |   "), size: 19, color: contactColor, font })],
      })
    );
  }
  children.push(...bodyBlocks(t, cv, { withSkills: true }));
  return children;
}

// Dos columnas en una tabla: barra lateral sombreada (foto, contacto, habilidades, idiomas) y cuerpo.
function sidebarChildren(t, cv) {
  const sb = t.sidebar;
  const font = t.docFont;
  const mainW = SIDE_PAGE_W - SIDE_W;
  const ts = {
    ...t,
    accent: sb.head,
    muted: sb.muted,
    ink: sb.text,
    tint: sb.tag,
    tagText: sb.text,
    track: sb.track,
    headingStyle: "line",
    width: SIDE_W - 2 * SIDE_PAD,
  };
  const tm = { ...t, width: mainW - 2 * MAIN_PAD };

  const side = [];
  const foto = photoBuffer(cv);
  if (foto) {
    side.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 60 },
        children: [new ImageRun({ data: foto, transformation: { width: 130, height: 130 } })],
      })
    );
  }
  const contacto = contactList(cv);
  if (contacto.length) {
    side.push(heading(ts, "Contacto"));
    contacto.forEach((c) => side.push(new Paragraph({ spacing: { after: 40 }, children: [text(ts, c, { size: fitHalfPts(ts, c, ts.width, 18) })] })));
  }
  const skills = parseSkills(cv.habilidades);
  if (skills.length) side.push(heading(ts, "Habilidades"), ...skillsBlock(ts, skills, getEstilo(cv.estiloHabilidades), 1));
  const idiomas = (cv.idiomas || []).filter((i) => clean(i.idioma));
  if (idiomas.length) {
    side.push(heading(ts, "Idiomas"));
    idiomas.forEach((i) => {
      side.push(new Paragraph({ children: [text(ts, clean(i.idioma), { bold: true, size: fitHalfPts(ts, clean(i.idioma), ts.width, 20, true) })] }));
      if (clean(i.nivel)) side.push(new Paragraph({ spacing: { after: 60 }, children: [text(ts, clean(i.nivel), { size: fitHalfPts(ts, clean(i.nivel), ts.width, 18), color: ts.muted })] }));
    });
  }
  if (!side.length) side.push(new Paragraph(""));

  const main = [
    new Paragraph({
      spacing: { before: 120 },
      children: [new TextRun({ text: clean(cv.nombre) || "Tu nombre", bold: true, size: t.nameSize * 2, color: t.accent, font })],
    }),
  ];
  if (clean(cv.titulo)) main.push(new Paragraph({ children: [new TextRun({ text: clean(cv.titulo), size: 25, color: t.muted, font })] }));
  main.push(...bodyBlocks(tm, cv, { withSkills: false }));

  return [
    new Table({
      width: { size: SIDE_PAGE_W, type: WidthType.DXA },
      columnWidths: [SIDE_W, mainW],
      borders: NO_BORDERS,
      rows: [
        new TableRow({
          // Alto mínimo de una página para que la barra lateral llegue al pie.
          height: { value: 16838 - 2 * 500 - 120, rule: HeightRule.ATLEAST },
          children: [
            new TableCell({
              width: { size: SIDE_W, type: WidthType.DXA },
              borders: NO_BORDERS,
              shading: { type: ShadingType.CLEAR, fill: sb.bg, color: "auto" },
              margins: { top: 200, bottom: 200, left: SIDE_PAD, right: SIDE_PAD },
              verticalAlign: VerticalAlign.TOP,
              children: side,
            }),
            new TableCell({
              width: { size: mainW, type: WidthType.DXA },
              borders: NO_BORDERS,
              margins: { top: 200, bottom: 200, left: MAIN_PAD, right: MAIN_PAD },
              children: main,
            }),
          ],
        }),
      ],
    }),
  ];
}

async function buildDocx(cv) {
  const t = getTheme(cv.plantilla);
  const margin = t.sidebar ? 500 : 1000;
  const doc = new Document({
    creator: "CV Builder",
    title: `CV ${clean(cv.nombre)}`.trim(),
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: margin, bottom: margin, left: margin, right: margin },
          },
        },
        children: t.sidebar ? sidebarChildren(t, cv) : standardChildren(t, cv),
      },
    ],
  });

  return Packer.toBuffer(doc);
}

module.exports = { buildDocx };
