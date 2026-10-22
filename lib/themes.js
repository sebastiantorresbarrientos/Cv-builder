// Plantillas disponibles. Colores en hex sin "#".
const THEMES = {
  clasico: {
    id: "clasico",
    nombre: "Clásico",
    accent: "1F3A5F",
    muted: "555555",
    pdf: { regular: "Helvetica", bold: "Helvetica-Bold", italic: "Helvetica-Oblique" },
    docFont: "Calibri",
    header: "left",
    band: false,
    headingStyle: "line",
    nameSize: 24,
  },
  moderno: {
    id: "moderno",
    nombre: "Moderno",
    accent: "0F766E",
    muted: "4B5563",
    pdf: { regular: "Helvetica", bold: "Helvetica-Bold", italic: "Helvetica-Oblique" },
    docFont: "Calibri",
    header: "left",
    band: true,
    headingStyle: "bar",
    nameSize: 26,
  },
  minimalista: {
    id: "minimalista",
    nombre: "Minimalista",
    accent: "222222",
    muted: "666666",
    pdf: { regular: "Times-Roman", bold: "Times-Bold", italic: "Times-Italic" },
    docFont: "Georgia",
    header: "center",
    band: false,
    headingStyle: "plain",
    nameSize: 22,
  },
};

function getTheme(id) {
  return THEMES[id] || THEMES.clasico;
}

module.exports = { THEMES, getTheme };
