const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
  ShadingType,
  TabStopType,
  Table,
  TableRow,
  TableCell,
  WidthType,
} = require("docx");
const { getTheme } = require("./themes");
const { parseSkills, getEstilo, DEFAULT_LEVEL } = require("./skills");

const RIGHT_TAB = 9900; // ancho útil aprox. en twips (A4 con márgenes ~1.8 cm)

const clean = (v) => (typeof v === "string" ? v.trim() : "");
const lines = (v) =>
  clean(v)
    .split("\n")
    .map((l) => l.replace(/^[\s•\-*]+/, "").trim())
    .filter(Boolean);

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
function gridTable(cells, cols) {
  const colW = Math.floor(RIGHT_TAB / cols);
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
              margins: { top: 30, bottom: 30, left: 0, right: 200 },
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

function skillsBlock(t, skills, estilo) {
  const font = t.docFont;
  const level = (s) => s.level || DEFAULT_LEVEL;

  if (estilo === "etiquetas") {
    const runs = [];
    skills.forEach((s, i) => {
      if (i) runs.push(new TextRun({ text: "   ", size: 20, font }));
      runs.push(
        new TextRun({
          text: `\u00A0${s.name}\u00A0`,
          size: 19,
          font,
          color: t.accent,
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
          new TextRun({ text: s.name, size: 20, font }),
        ],
      }),
    ]);
    return [gridTable(cells, 3)];
  }

  if (estilo === "barras") {
    // La barra es una fila de espacios con fondo de color; 30 espacios por nivel.
    const cells = skills.map((s) => {
      const filled = level(s) * 30;
      return [
        new Paragraph({ children: [new TextRun({ text: s.name, size: 20, font })] }),
        new Paragraph({
          spacing: { before: 40, after: 60 },
          children: [
            new TextRun({ text: "\u00A0".repeat(filled), size: 9, font: "Arial", shading: { type: ShadingType.CLEAR, fill: t.accent, color: "auto" } }),
            new TextRun({ text: "\u00A0".repeat(150 - filled), size: 9, font: "Arial", shading: { type: ShadingType.CLEAR, fill: "E5E7EB", color: "auto" } }),
          ],
        }),
      ];
    });
    return [gridTable(cells, 2)];
  }

  if (estilo === "puntos") {
    const cells = skills.map((s) => {
      const n = level(s);
      return [
        new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: Math.floor(RIGHT_TAB / 2) - 260 }],
          children: [
            new TextRun({ text: s.name, size: 20, font }),
            new TextRun({ text: "\t" + "●".repeat(n), color: t.accent, size: 22, font: "Arial" }),
            new TextRun({ text: "●".repeat(5 - n), color: "D9DCE1", size: 22, font: "Arial" }),
          ],
        }),
      ];
    });
    return [gridTable(cells, 2)];
  }

  return [new Paragraph({ children: [new TextRun({ text: skills.map((s) => s.name).join("  ·  "), size: 20, font })] })];
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
      tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
      children: [
        new TextRun({ text: title || "", bold: true, size: 21, font: t.docFont }),
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
        children: [new TextRun({ text: l, size: 20, font: t.docFont })],
      })
    );
  }
  return out;
}

async function buildDocx(cv) {
  const t = getTheme(cv.plantilla);
  const font = t.docFont;
  const children = [];
  const alignment = t.header === "center" ? AlignmentType.CENTER : AlignmentType.LEFT;
  const shading = t.band ? { type: ShadingType.CLEAR, fill: t.accent, color: "auto" } : undefined;
  const nameColor = t.band ? "FFFFFF" : t.accent;
  const titleColor = t.band ? t.bandSub || "FFFFFF" : t.muted;
  const contactColor = t.band ? "FFFFFF" : "000000";
  const pad = t.band ? 120 : 0;

  children.push(
    new Paragraph({
      alignment,
      shading,
      spacing: { before: pad, after: 0 },
      indent: t.band ? { left: 160, right: 160 } : undefined,
      children: [
        new TextRun({ text: clean(cv.nombre) || "Tu nombre", bold: true, size: t.nameSize * 2, color: nameColor, font }),
      ],
    })
  );
  if (clean(cv.titulo)) {
    children.push(
      new Paragraph({
        alignment,
        shading,
        indent: t.band ? { left: 160, right: 160 } : undefined,
        children: [new TextRun({ text: clean(cv.titulo), size: 24, color: titleColor, font })],
      })
    );
  }
  const contacto = [cv.email, cv.telefono, cv.ubicacion, cv.linkedin, cv.web].map(clean).filter(Boolean);
  if (contacto.length) {
    children.push(
      new Paragraph({
        alignment,
        shading,
        spacing: { before: 80, after: pad },
        indent: t.band ? { left: 160, right: 160 } : undefined,
        children: [new TextRun({ text: contacto.join("   |   "), size: 19, color: contactColor, font })],
      })
    );
  }

  if (clean(cv.resumen)) {
    children.push(heading(t, "Perfil profesional"));
    children.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        children: [new TextRun({ text: clean(cv.resumen), size: 20, font })],
      })
    );
  }

  const exp = (cv.experiencia || []).filter((e) => clean(e.cargo) || clean(e.empresa));
  if (exp.length) {
    children.push(heading(t, "Experiencia laboral"));
    exp.forEach((e) =>
      children.push(
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
    children.push(heading(t, "Educación"));
    edu.forEach((e) =>
      children.push(
        ...entry(t, {
          title: clean(e.titulo),
          subtitle: clean(e.institucion),
          date: dateRange(e.desde, e.hasta, false),
          description: e.descripcion,
        })
      )
    );
  }

  const skills = parseSkills(cv.habilidades);
  if (skills.length) {
    children.push(heading(t, "Habilidades"));
    children.push(...skillsBlock(t, skills, getEstilo(cv.estiloHabilidades)));
  }

  const idiomas = (cv.idiomas || []).filter((i) => clean(i.idioma));
  if (idiomas.length) {
    children.push(heading(t, "Idiomas"));
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: idiomas
              .map((i) => `${clean(i.idioma)}${clean(i.nivel) ? " (" + clean(i.nivel) + ")" : ""}`)
              .join("  ·  "),
            size: 20,
            font,
          }),
        ],
      })
    );
  }

  for (const sec of cv.secciones || []) {
    const titulo = clean(sec.titulo);
    if (!titulo) continue;
    if (sec.tipo === "entradas") {
      const items = (sec.items || []).filter((e) => clean(e.titulo) || clean(e.subtitulo));
      if (!items.length) continue;
      children.push(heading(t, titulo));
      items.forEach((e) =>
        children.push(
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
      children.push(heading(t, titulo));
      children.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          children: [new TextRun({ text: clean(sec.contenido), size: 20, font })],
        })
      );
    } else {
      const items = lines(sec.contenido);
      if (!items.length) continue;
      children.push(heading(t, titulo));
      items.forEach((l) =>
        children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: l, size: 20, font })] }))
      );
    }
  }

  const extra = lines(cv.adicional);
  if (extra.length) {
    children.push(heading(t, "Información adicional"));
    extra.forEach((l) =>
      children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: l, size: 20, font })] }))
    );
  }

  const doc = new Document({
    creator: "CV Builder",
    title: `CV ${clean(cv.nombre)}`.trim(),
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

module.exports = { buildDocx };
