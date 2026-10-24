// Importar un CV existente (PDF o Word): la IA lo ordena en los campos del formulario.
// Se activa con ANTHROPIC_API_KEY. El archivo se procesa en memoria y no se guarda.

const Anthropic = require("@anthropic-ai/sdk");
const mammoth = require("mammoth");

const MODELO = process.env.IMPORTAR_MODELO || "claude-haiku-5-5";
const MAX_BYTES = 5 * 1024 * 1024;
const LIMITE_POR_HORA = Number(process.env.IMPORTAR_LIMITE_HORA || 10);

const activo = () => Boolean(process.env.ANTHROPIC_API_KEY);
let client = null;
const cliente = () => (client ||= new Anthropic());

const texto = { type: "string" };
const SCHEMA = {
  type: "object",
  properties: {
    nombre: texto, titulo: texto, email: texto, telefono: texto, ubicacion: texto, linkedin: texto, web: texto,
    resumen: texto, habilidades: texto, adicional: texto,
    experiencia: {
      type: "array",
      items: {
        type: "object",
        properties: {
          cargo: texto, empresa: texto, lugar: texto, desde: texto, hasta: texto,
          actual: { type: "boolean" }, descripcion: texto,
        },
        required: ["cargo", "empresa", "lugar", "desde", "hasta", "actual", "descripcion"],
        additionalProperties: false,
      },
    },
    educacion: {
      type: "array",
      items: {
        type: "object",
        properties: { titulo: texto, institucion: texto, desde: texto, hasta: texto, descripcion: texto },
        required: ["titulo", "institucion", "desde", "hasta", "descripcion"],
        additionalProperties: false,
      },
    },
    idiomas: {
      type: "array",
      items: {
        type: "object",
        properties: { idioma: texto, nivel: texto },
        required: ["idioma", "nivel"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "nombre", "titulo", "email", "telefono", "ubicacion", "linkedin", "web",
    "resumen", "habilidades", "adicional", "experiencia", "educacion", "idiomas",
  ],
  additionalProperties: false,
};

const SISTEMA = `Recibes un currículum y debes pasar su contenido a los campos de un formulario.
- Usa solo información que esté en el documento; no inventes datos. Deja "" en lo que no aparezca.
- Corrige ortografía y redacción para que suene profesional, en el mismo idioma del CV, sin cambiar los hechos.
- Fechas cortas como "Ene 2020" o "2019". Si el trabajo sigue vigente, actual = true y hasta = "".
- descripcion, adicional: un punto por línea, sin viñetas al inicio.
- habilidades: separadas por coma; si el CV indica nivel, escríbelo como "Excel: Avanzado".
- resumen: 2 a 4 líneas. Si el CV no tiene uno, redáctalo a partir de la experiencia.
- adicional: cursos, certificaciones, licencias y otros datos que no calcen en las demás secciones.`;

// PDF va directo a Claude; Word se convierte a texto con mammoth.
async function contenido(buffer) {
  if (buffer.subarray(0, 4).toString("latin1") === "%PDF") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") } };
  }
  if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
    const { value } = await mammoth.extractRawText({ buffer });
    if (value.trim()) return { type: "text", text: `<curriculum>\n${value}\n</curriculum>` };
  }
  return null;
}

async function importar(buffer) {
  const doc = await contenido(buffer);
  if (!doc) {
    const err = new Error("Formato no soportado");
    err.status = 415;
    throw err;
  }
  const response = await cliente().messages.create({
    model: MODELO,
    max_tokens: 16000,
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system: SISTEMA,
    messages: [{ role: "user", content: [doc, { type: "text", text: "Pasa este currículum a los campos del formulario." }] }],
  });
  if (response.stop_reason !== "end_turn") throw new Error(`La IA terminó con ${response.stop_reason}`);
  const bloque = response.content.find((b) => b.type === "text");
  return JSON.parse(bloque.text);
}

// Límite simple por IP para que nadie gaste la API sin control. Se reinicia con el servidor.
const usos = new Map();
function permitido(ip) {
  const ahora = Date.now();
  const recientes = (usos.get(ip) || []).filter((t) => ahora - t < 3600 * 1000);
  if (recientes.length >= LIMITE_POR_HORA) return false;
  recientes.push(ahora);
  usos.set(ip, recientes);
  return true;
}

module.exports = { activo, importar, permitido, MAX_BYTES };
