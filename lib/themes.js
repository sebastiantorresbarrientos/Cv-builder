// Plantillas disponibles. Colores en hex sin "#".
// headingStyle: "line" (línea inferior), "bar" (barra lateral), "plain" (espaciado), "fill" (fondo de color).
// tint: color claro del acento, usado en etiquetas de habilidades y en títulos "fill".
const SANS = { regular: "Helvetica", bold: "Helvetica-Bold", italic: "Helvetica-Oblique" };
const SERIF = { regular: "Times-Roman", bold: "Times-Bold", italic: "Times-Italic" };

const THEMES = {
  clasico: {
    id: "clasico",
    nombre: "Clásico",
    accent: "1F3A5F",
    muted: "555555",
    tint: "E3EAF3",
    pdf: SANS,
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
    tint: "DDF1EE",
    bandSub: "D1FAE5",
    pdf: SANS,
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
    tint: "EEEEEE",
    pdf: SERIF,
    docFont: "Georgia",
    header: "center",
    band: false,
    headingStyle: "plain",
    nameSize: 22,
  },
  ejecutivo: {
    id: "ejecutivo",
    nombre: "Ejecutivo",
    accent: "1E293B",
    muted: "475569",
    tint: "E2E8F0",
    bandSub: "CBD5E1",
    pdf: SANS,
    docFont: "Calibri",
    header: "left",
    band: true,
    headingStyle: "line",
    nameSize: 26,
  },
  elegante: {
    id: "elegante",
    nombre: "Elegante",
    accent: "7F1D1D",
    muted: "57534E",
    tint: "F5E6E6",
    pdf: SERIF,
    docFont: "Georgia",
    header: "center",
    band: false,
    headingStyle: "line",
    nameSize: 26,
  },
  corporativo: {
    id: "corporativo",
    nombre: "Corporativo",
    accent: "1E40AF",
    muted: "4B5563",
    tint: "E0E7FA",
    pdf: SANS,
    docFont: "Calibri",
    header: "left",
    band: false,
    headingStyle: "bar",
    nameSize: 24,
  },
  compacto: {
    id: "compacto",
    nombre: "Compacto",
    accent: "374151",
    muted: "6B7280",
    tint: "ECEEF1",
    pdf: SANS,
    docFont: "Calibri",
    header: "left",
    band: false,
    headingStyle: "fill",
    nameSize: 22,
  },
};

function getTheme(id) {
  return THEMES[id] || THEMES.clasico;
}

module.exports = { THEMES, getTheme };
