// Cobro por descarga con Mercado Pago (Checkout Pro) y PayPal (Checkout, Orders v2).
// Cada medio se activa solo si están sus credenciales; sin ninguno, las descargas son gratis y sin marca de agua.
// Un pago aprobado habilita descargar PDF y Word sin marca de agua durante VIGENCIA_HORAS.
// El cliente envía pagoId: el id numérico de Mercado Pago, o "pp:<orden>" para PayPal.

const crypto = require("crypto");

const VIGENCIA_HORAS = Number(process.env.VIGENCIA_HORAS || 24);

const MP = {
  token: process.env.MP_ACCESS_TOKEN || "",
  api: process.env.MP_API_URL || "https://api.mercadopago.com",
  precio: Number(process.env.PRECIO || 1900),
  moneda: process.env.MONEDA || "CLP",
};

const PP = {
  clientId: process.env.PAYPAL_CLIENT_ID || "",
  secret: process.env.PAYPAL_SECRET || "",
  api: process.env.PAYPAL_API_URL || "https://api-m.paypal.com",
  precio: Number(process.env.PAYPAL_PRECIO || 2),
  moneda: process.env.PAYPAL_MONEDA || "USD",
};

const mpActivo = () => Boolean(MP.token);
const ppActivo = () => Boolean(PP.clientId && PP.secret);
const activo = () => mpActivo() || ppActivo();

// Pagos ya verificados: id -> fecha de aprobación (ms). Se pierde al reiniciar; solo evita consultas repetidas.
const verificados = new Map();
const vence = (aprobado) => aprobado + VIGENCIA_HORAS * 3600 * 1000;

function config() {
  return {
    pago: activo(),
    vigenciaHoras: VIGENCIA_HORAS,
    contacto: process.env.CONTACTO_EMAIL || null,
    mercadopago: mpActivo() ? { precio: MP.precio, moneda: MP.moneda } : null,
    paypal: ppActivo() ? { precio: PP.precio, moneda: PP.moneda } : null,
  };
}

async function pedir(nombre, url, options) {
  const res = await fetch(url, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`${nombre} respondió ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

// URL pública del sitio, para que el medio de pago devuelva al usuario aquí.
function baseUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, "");
  const proto = (req.headers["x-forwarded-proto"] || req.protocol || "https").split(",")[0].trim();
  return `${proto}://${req.get("host")}`;
}

// ---------- Mercado Pago ----------

function mp(path, options = {}) {
  return pedir("Mercado Pago", MP.api + path, {
    ...options,
    headers: { Authorization: `Bearer ${MP.token}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
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
          unit_price: MP.precio,
          currency_id: MP.moneda,
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

async function mpAprobado(id) {
  try {
    const p = await mp(`/v1/payments/${id}`);
    const aprobado = Date.parse(p.date_approved || "");
    const ok = p.status === "approved" && p.currency_id === MP.moneda && Number(p.transaction_amount) >= MP.precio;
    return ok && !isNaN(aprobado) ? aprobado : null;
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

// ---------- PayPal ----------

let ppToken = { valor: "", vence: 0 };

async function paypalToken() {
  if (ppToken.valor && Date.now() < ppToken.vence) return ppToken.valor;
  const body = await pedir("PayPal", `${PP.api}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${PP.clientId}:${PP.secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  ppToken = { valor: body.access_token, vence: Date.now() + (Number(body.expires_in || 300) - 60) * 1000 };
  return ppToken.valor;
}

async function pp(path, options = {}) {
  const token = await paypalToken();
  return pedir("PayPal", PP.api + path, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
}

async function crearOrdenPaypal(req) {
  const base = baseUrl(req);
  const orden = await pp("/v2/checkout/orders", {
    method: "POST",
    headers: { "PayPal-Request-Id": crypto.randomUUID() },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          description: "Descarga de CV (PDF y Word)",
          amount: { currency_code: PP.moneda, value: PP.precio.toFixed(2) },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "CV Builder",
            locale: "es-CL",
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
            return_url: `${base}/?pago=paypal`,
            cancel_url: `${base}/?pago=error`,
          },
        },
      },
    }),
  });
  const link = (orden.links || []).find((l) => l.rel === "payer-action" || l.rel === "approve");
  return { url: link && link.href, id: orden.id };
}

// Fecha de captura (ms) si la orden está pagada por el monto correcto; null si no.
function ordenPagada(orden) {
  if (orden.status !== "COMPLETED") return null;
  const unidad = (orden.purchase_units || [])[0] || {};
  const captura = ((unidad.payments || {}).captures || []).find((c) => c.status === "COMPLETED");
  if (!captura) return null;
  const monto = captura.amount || {};
  if (monto.currency_code !== PP.moneda || Number(monto.value) < PP.precio) return null;
  const fecha = Date.parse(captura.create_time || captura.update_time || "");
  return isNaN(fecha) ? null : fecha;
}

const ordenValida = (id) => /^[A-Z0-9]{5,40}$/.test(String(id || ""));

// Captura la orden aprobada por el comprador (si aún no se capturó) y devuelve el pagoId para el cliente.
async function capturarPaypal(orderId) {
  if (!ordenValida(orderId)) return null;
  let orden;
  try {
    orden = await pp(`/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: { "PayPal-Request-Id": `captura-${orderId}` },
    });
  } catch (err) {
    // Ya capturada antes (p. ej. recarga de la página): se consulta su estado.
    if (err.status !== 422 && err.status !== 400) throw err;
    orden = await pp(`/v2/checkout/orders/${orderId}`);
  }
  const fecha = ordenPagada(orden);
  if (!fecha) return null;
  verificados.set(`pp:${orderId}`, fecha);
  return `pp:${orderId}`;
}

async function ppAprobado(orderId) {
  if (!ordenValida(orderId)) return null;
  try {
    return ordenPagada(await pp(`/v2/checkout/orders/${orderId}`));
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

// ---------- Verificación común ----------

// true si el pago existe, está aprobado, es por el monto y moneda correctos y sigue vigente.
async function pagoValido(id) {
  const pagoId = String(id || "").trim();
  const cache = verificados.get(pagoId);
  if (cache) return Date.now() < vence(cache);

  let aprobado = null;
  if (pagoId.startsWith("pp:")) {
    if (ppActivo()) aprobado = await ppAprobado(pagoId.slice(3));
  } else if (/^\d{1,20}$/.test(pagoId)) {
    if (mpActivo()) aprobado = await mpAprobado(pagoId);
  }
  if (!aprobado) return false;
  verificados.set(pagoId, aprobado);
  return Date.now() < vence(aprobado);
}

// Middleware para las rutas de exportación.
// Sin un pago aprobado la descarga sale igual, pero con marca de agua (req.marcaAgua).
function verificarPago(req, res, next) {
  req.marcaAgua = false;
  if (!activo()) return next();
  pagoValido(req.body && req.body.pagoId)
    .then((ok) => {
      req.marcaAgua = !ok;
      next();
    })
    .catch((err) => {
      console.error("Error verificando pago:", err.message, err.body || "");
      res.status(502).json({ error: "No se pudo verificar el pago. Intenta de nuevo." });
    });
}

module.exports = { config, crearPreferencia, crearOrdenPaypal, capturarPaypal, verificarPago, activo, mpActivo, ppActivo };
