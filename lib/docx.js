const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
  ShadingType,
  TabStopType,
} = require("docx");
const { getTheme } = require("./themes");

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
  } else if (t.headingStyle === "bar") {
    opts.indent = { left: 160 };
    opts.border = { left: { style: BorderStyle.SINGLE, size: 24, color: t.accent, space: 6 } };
  }
  return new Paragraph(opts);
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
  const titleColor = t.band ? "D1FAE5" : t.muted;
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

  const skills = lines((cv.habilidades || "").replace(/,/g, "\n"));
  if (skills.length) {
    children.push(heading(t, "Habilidades"));
    children.push(new Paragraph({ children: [new TextRun({ text: skills.join("  ·  "), size: 20, font })] }));
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
