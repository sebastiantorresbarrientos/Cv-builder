// Plantillas disponibles. Colores en hex sin "#".
// headingStyle: "line" (línea inferior), "bar" (barra lateral), "plain" (espaciado), "fill" (fondo de color).
// tint: color claro del acento, usado en etiquetas de habilidades y en títulos "fill".
// sidebar: si existe, el CV usa dos columnas; la barra lateral lleva contacto, habilidades e idiomas.
//   side: "right" pone la barra a la derecha; claro: true la pinta con el color claro del acento.
// timeline: experiencia y educación con una línea de tiempo a la izquierda.
// photoHeader: la foto va en el encabezado, a la izquierda del nombre.
// El color de cualquier plantilla se puede cambiar con la paleta (ver conColor y public/app.js).
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
  lateral: {
    id: "lateral",
    nombre: "Lateral",
    accent: "1F3A5F",
    muted: "555555",
    tint: "E3EAF3",
    pdf: SANS,
    docFont: "Calibri",
    header: "left",
    band: false,
    headingStyle: "line",
    nameSize: 26,
    sidebar: { bg: "1F3A5F", text: "FFFFFF", muted: "C7D3E3", head: "FFFFFF", tag: "2E4F7A", track: "3B5A82" },
  },
  lateralclaro: {
    id: "lateralclaro",
    nombre: "Lateral claro",
    accent: "0E7490",
    muted: "4B5563",
    tint: "DDF0F5",
    pdf: SANS,
    docFont: "Calibri",
    header: "left",
    band: false,
    headingStyle: "bar",
    nameSize: 26,
    sidebar: { claro: true, bg: "EEF2F6", text: "1F2937", muted: "4B5563", head: "0E7490", tag: "DDF0F5", track: "D5DCE4" },
  },
  cronologico: {
    id: "cronologico",
    nombre: "Cronológico",
    accent: "4D7C0F",
    muted: "57534E",
    tint: "ECF3E2",
    pdf: SANS,
    docFont: "Calibri",
    header: "left",
    band: false,
    headingStyle: "line",
    nameSize: 26,
    timeline: true,
  },
  dobleColumna: {
    id: "dobleColumna",
    nombre: "Doble columna",
    accent: "9B3016",
    muted: "57534E",
    tint: "F6E9E5",
    pdf: SANS,
    docFont: "Calibri",
    header: "left",
    band: false,
    headingStyle: "line",
    nameSize: 26,
    sidebar: { side: "right", claro: true, bg: "F6E9E5", text: "1F2937", muted: "57534E", head: "9B3016", tag: "FFFFFF", track: "E7D3CC" },
  },
  conFoto: {
    id: "conFoto",
    nombre: "Con foto",
    accent: "8C3C4B",
    muted: "57534E",
    tint: "F4E7EA",
    bandSub: "F1D9DE",
    pdf: SANS,
    docFont: "Calibri",
    header: "left",
    band: true,
    headingStyle: "line",
    nameSize: 26,
    photoHeader: true,
  },
};

// Colores que se pueden elegir para cualquier plantilla.
const PALETA = [
  { id: "marino", nombre: "Azul marino", hex: "1F3A5F" },
  { id: "azul", nombre: "Azul", hex: "1E40AF" },
  { id: "petroleo", nombre: "Petróleo", hex: "0E7490" },
  { id: "verde", nombre: "Verde", hex: "0F766E" },
  { id: "oliva", nombre: "Oliva", hex: "4D7C0F" },
  { id: "burdeo", nombre: "Burdeo", hex: "8C3C4B" },
  { id: "terracota", nombre: "Terracota", hex: "9B3016" },
  { id: "violeta", nombre: "Violeta", hex: "5B21B6" },
  { id: "grafito", nombre: "Grafito", hex: "1E293B" },
];

// Mezcla dos colores hex: t = 0 da `a`, t = 1 da `b`.
function mezcla(a, b, t) {
  const ca = a.match(/../g).map((h) => parseInt(h, 16));
  const cb = b.match(/../g).map((h) => parseInt(h, 16));
  return ca.map((v, i) => Math.round(v + (cb[i] - v) * t).toString(16).padStart(2, "0")).join("").toUpperCase();
}

// La plantilla con otro color de acento: tonos claros y barra lateral se derivan de él.
function conColor(t, hex) {
  const accent = hex.toUpperCase();
  const out = { ...t, accent, tint: mezcla(accent, "FFFFFF", 0.88), bandSub: mezcla(accent, "FFFFFF", 0.78) };
  if (t.sidebar) {
    out.sidebar = t.sidebar.claro
      ? { ...t.sidebar, bg: out.tint, head: accent, tag: "FFFFFF", track: mezcla(accent, "FFFFFF", 0.75) }
      : { ...t.sidebar, bg: accent, tag: mezcla(accent, "FFFFFF", 0.15), track: mezcla(accent, "FFFFFF", 0.25), muted: mezcla(accent, "FFFFFF", 0.75) };
  }
  return out;
}

// `color`: id de la paleta; sin color (o uno desconocido) se usa el de la plantilla.
function getTheme(id, color) {
  const t = THEMES[id] || THEMES.clasico;
  const c = PALETA.find((p) => p.id === color);
  return c ? conColor(t, c.hex) : t;
}

module.exports = { THEMES, PALETA, getTheme };
