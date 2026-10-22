// Cobro por descarga con Mercado Pago (Checkout Pro).
// Se activa solo si existe MP_ACCESS_TOKEN; sin él, las descargas son gratis.
// Un pago aprobado habilita descargar PDF y Word durante VIGENCIA_HORAS.

const crypto = require("crypto");

const TOKEN = process.env.MP_ACCESS_TOKEN || "";
const API = process.env.MP_API_URL || "https://api.mercadopago.com";
const PRECIO = Number(process.env.PRECIO || 1900);
const MONEDA = process.env.MONEDA || "CLP";
const VIGENCIA_HORAS = Number(process.env.VIGENCIA_HORAS || 24);

const activo = () => Boolean(TOKEN);

// Pagos ya verificados: id -> fecha de aprobación (ms). Se pierde al reiniciar; solo evita consultas repetidas.
const verificados = new Map();

function config() {
  return { pago: activo(), precio: PRECIO, moneda: MONEDA, vigenciaHoras: VIGENCIA_HORAS };
}

async function mp(path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Mercado Pago respondió ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

// URL pública del sitio, para que Mercado Pago devuelva al usuario aquí.
function baseUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, "");
  const proto = (req.headers["x-forwarded-proto"] || req.protocol || "https").split(",")[0].trim();
  return `${proto}://${req.get("host")}`;
}

async function crearPreferencia(req) {
  const base = baseUrl(req);
  const pref = await mp("/checkout/preferences", {
    method: "POST",
    headers: { "X-Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({
      items: [
        {
          id: "cv-descarga",
          title: "Descarga de CV (PDF y Word)",
          quantity: 1,
          unit_price: PRECIO,
          currency_id: MONEDA,
        },
      ],
      back_urls: { success: `${base}/?pago=ok`, failure: `${base}/?pago=error`, pending: `${base}/?pago=pendiente` },
      auto_return: "approved",
      external_reference: crypto.randomUUID(),
      statement_descriptor: "CV BUILDER",
    }),
  });
  return { url: pref.init_point, id: pref.id };
}

// true si el pago existe, está aprobado, es por el monto y moneda correctos y sigue vigente.
async function pagoValido(id) {
  const pagoId = String(id || "").trim();
  if (!/^\d{1,20}$/.test(pagoId)) return false;
  const vence = (aprobado) => aprobado + VIGENCIA_HORAS * 3600 * 1000;

  const cache = verificados.get(pagoId);
  if (cache) return Date.now() < vence(cache);

  try {
    const p = await mp(`/v1/payments/${pagoId}`);
    const aprobado = Date.parse(p.date_approved || "");
    const ok =
      p.status === "approved" &&
      p.currency_id === MONEDA &&
      Number(p.transaction_amount) >= PRECIO &&
      !isNaN(aprobado);
    if (!ok) return false;
    verificados.set(pagoId, aprobado);
    return Date.now() < vence(aprobado);
  } catch (err) {
    if (err.status === 404) return false;
    throw err;
  }
}

// Middleware para las rutas de exportación: responde 402 si falta un pago válido.
function exigirPago(req, res, next) {
  if (!activo()) return next();
  pagoValido(req.body && req.body.pagoId)
    .then((ok) => (ok ? next() : res.status(402).json({ error: "Se requiere un pago aprobado para descargar" })))
    .catch((err) => {
      console.error("Error verificando pago:", err.message, err.body || "");
      res.status(502).json({ error: "No se pudo verificar el pago. Intenta de nuevo." });
    });
}

module.exports = { config, crearPreferencia, exigirPago, activo };
