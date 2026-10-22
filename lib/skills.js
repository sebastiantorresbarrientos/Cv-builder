// Habilidades: texto separado por coma o salto de línea.
// Cada habilidad puede llevar un nivel opcional: "Excel: 4", "Excel - Avanzado", "Excel (80%)".
// Mantener en sincronía con parseSkills() de public/app.js.

const ESTILOS = ["lista", "etiquetas", "columnas", "barras", "puntos", "estrellas"];
const DEFAULT_LEVEL = 3;

const WORDS = {
  basico: 1, inicial: 1, principiante: 1,
  intermedio: 3, medio: 3,
  avanzado: 4, alto: 4,
  experto: 5, nativo: 5,
};

function toLevel(raw) {
  const s = String(raw || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!s) return null;
  const n = parseFloat(s.replace(",", "."));
  if (!isNaN(n)) {
    if (s.includes("%") || n > 5) return Math.max(1, Math.min(5, Math.round(n / 20)));
    return Math.max(1, Math.min(5, Math.round(n)));
  }
  return WORDS[s] || null;
}

function parseSkills(text) {
  return String(text || "")
    .split(/[,\n]/)
    .map((s) => s.replace(/^[\s•\-*]+/, "").trim())
    .filter(Boolean)
    .map((s) => {
      // "Nombre: nivel", "Nombre - nivel", "Nombre (nivel)"
      const m = /^(.*?)\s*(?::|\s-\s|\()\s*([^()]+?)\)?\s*$/.exec(s);
      if (m && m[1]) {
        const level = toLevel(m[2]);
        if (level) return { name: m[1].trim(), level };
      }
      return { name: s, level: null };
    });
}

function getEstilo(id) {
  return ESTILOS.includes(id) ? id : "lista";
}

module.exports = { parseSkills, getEstilo, ESTILOS, DEFAULT_LEVEL };
