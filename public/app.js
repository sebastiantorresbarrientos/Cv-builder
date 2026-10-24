(function () {
  const STORAGE_KEY = "cv-builder:v1";
  const form = document.getElementById("cv-form");
  const preview = document.getElementById("preview");

  const SCHEMAS = {
    experiencia: {
      empty: { cargo: "", empresa: "", lugar: "", desde: "", hasta: "", actual: false, descripcion: "" },
      render: (d) => `
        <div class="grid">
          <label>Cargo<input data-k="cargo" value="${esc(d.cargo)}" /></label>
          <label>Empresa<input data-k="empresa" value="${esc(d.empresa)}" /></label>
          <label>Lugar<input data-k="lugar" value="${esc(d.lugar)}" /></label>
          <label>Desde<input data-k="desde" placeholder="Ene 2020" value="${esc(d.desde)}" /></label>
          <label>Hasta<input data-k="hasta" placeholder="Dic 2023" value="${esc(d.hasta)}" ${d.actual ? "disabled" : ""} /></label>
        </div>
        <label>Logros / funciones (uno por línea)<textarea data-k="descripcion" rows="3">${esc(d.descripcion)}</textarea></label>
        <div class="row">
          <label class="check"><input type="checkbox" data-k="actual" ${d.actual ? "checked" : ""} /> Trabajo actual</label>
          <button type="button" class="remove">Quitar</button>
        </div>`,
    },
    educacion: {
      empty: { titulo: "", institucion: "", desde: "", hasta: "", descripcion: "" },
      render: (d) => `
        <div class="grid">
          <label>Título / carrera<input data-k="titulo" value="${esc(d.titulo)}" /></label>
          <label>Institución<input data-k="institucion" value="${esc(d.institucion)}" /></label>
          <label>Desde<input data-k="desde" value="${esc(d.desde)}" /></label>
          <label>Hasta<input data-k="hasta" value="${esc(d.hasta)}" /></label>
        </div>
        <label>Detalles (opcional, uno por línea)<textarea data-k="descripcion" rows="2">${esc(d.descripcion)}</textarea></label>
        <div class="row"><span></span><button type="button" class="remove">Quitar</button></div>`,
    },
    secciones: {
      empty: { titulo: "", tipo: "lista", contenido: "", items: [] },
      render: (d, idx, total) => `
        <div class="grid">
          <label>Título de la sección<input data-k="titulo" placeholder="Proyectos, Voluntariado, Publicaciones..." value="${esc(d.titulo)}" /></label>
          <label>Tipo de contenido
            <select data-k="tipo">
              <option value="lista" ${d.tipo === "lista" ? "selected" : ""}>Lista de puntos</option>
              <option value="texto" ${d.tipo === "texto" ? "selected" : ""}>Párrafo de texto</option>
              <option value="entradas" ${d.tipo === "entradas" ? "selected" : ""}>Entradas con fecha</option>
            </select>
          </label>
        </div>
        ${
          d.tipo === "entradas"
            ? `<div class="sub-list">${(d.items || []).map((e, j) => `
                <div class="sub-item" data-entry="${j}">
                  <div class="grid">
                    <label>Título<input data-k="titulo" value="${esc(e.titulo)}" /></label>
                    <label>Organización / detalle<input data-k="subtitulo" value="${esc(e.subtitulo)}" /></label>
                    <label>Desde<input data-k="desde" value="${esc(e.desde)}" /></label>
                    <label>Hasta<input data-k="hasta" value="${esc(e.hasta)}" /></label>
                  </div>
                  <label>Descripción (uno por línea)<textarea data-k="descripcion" rows="2">${esc(e.descripcion)}</textarea></label>
                  <div class="row"><span></span><button type="button" class="remove-entry">Quitar entrada</button></div>
                </div>`).join("")}
              </div>
              <button type="button" class="add" data-add-entry>+ Agregar entrada</button>`
            : `<label>${d.tipo === "texto" ? "Texto" : "Un punto por línea"}<textarea data-k="contenido" rows="3">${esc(d.contenido)}</textarea></label>`
        }
        <div class="row">
          <span class="move">
            <button type="button" class="icon" data-move="-1" ${idx === 0 ? "disabled" : ""} aria-label="Subir sección">↑</button>
            <button type="button" class="icon" data-move="1" ${idx === total - 1 ? "disabled" : ""} aria-label="Bajar sección">↓</button>
          </span>
          <button type="button" class="remove">Quitar sección</button>
        </div>`,
    },
    idiomas: {
      empty: { idioma: "", nivel: "" },
      render: (d) => `
        <div class="grid">
          <label>Idioma<input data-k="idioma" value="${esc(d.idioma)}" /></label>
          <label>Nivel<input data-k="nivel" placeholder="Nativo, B2, Avanzado..." value="${esc(d.nivel)}" /></label>
        </div>
        <div class="row"><span></span><button type="button" class="remove">Quitar</button></div>`,
    },
  };

  const state = {
    plantilla: "clasico",
    estiloHabilidades: "lista",
    nombre: "", titulo: "", email: "", telefono: "", ubicacion: "", linkedin: "", web: "",
    resumen: "", habilidades: "", adicional: "", foto: "",
    experiencia: [], educacion: [], idiomas: [], secciones: [],
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) Object.assign(state, JSON.parse(raw));
    } catch (_) {}
  }

  // Igual que lib/skills.js: "Excel: 4", "Excel - Avanzado", "Excel (80%)".
  const LEVEL_WORDS = { basico: 1, inicial: 1, principiante: 1, intermedio: 3, medio: 3, avanzado: 4, alto: 4, experto: 5, nativo: 5 };
  function toLevel(raw) {
    const s = String(raw || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (!s) return null;
    const n = parseFloat(s.replace(",", "."));
    if (!isNaN(n)) {
      if (s.includes("%") || n > 5) return Math.max(1, Math.min(5, Math.round(n / 20)));
      return Math.max(1, Math.min(5, Math.round(n)));
    }
    return LEVEL_WORDS[s] || null;
  }
  function parseSkills(text) {
    return String(text || "")
      .split(/[,\n]/)
      .map((s) => s.replace(/^[\s•\-*]+/, "").trim())
      .filter(Boolean)
      .map((s) => {
        const m = /^(.*?)\s*(?::|\s-\s|\()\s*([^()]+?)\)?\s*$/.exec(s);
        if (m && m[1]) {
          const level = toLevel(m[2]);
          if (level) return { name: m[1].trim(), level };
        }
        return { name: s, level: null };
      });
  }
  function skillsHtml(skills, estilo, narrow) {
    const lvl = (s) => s.level || 3;
    const grid = narrow ? "sk-grid one" : "sk-grid";
    switch (estilo) {
      case "etiquetas":
        return `<div class="sk-tags">${skills.map((s) => `<span class="fit">${esc(s.name)}</span>`).join("")}</div>`;
      case "columnas":
        return `<ul class="sk-cols${narrow ? " one" : ""}">${skills.map((s) => `<li class="fit">${esc(s.name)}</li>`).join("")}</ul>`;
      case "barras":
        return `<div class="${grid}">${skills
          .map((s) => `<div class="sk-bar"><div class="fit">${esc(s.name)}</div><i><b style="width:${lvl(s) * 20}%"></b></i></div>`)
          .join("")}</div>`;
      case "puntos":
      case "estrellas":
        return `<div class="${grid}">${skills
          .map((s) => {
            const n = lvl(s);
            let marks = "";
            for (let d = 0; d < 5; d++) {
              marks += estilo === "estrellas" ? `<i class="${d < n ? "on" : ""}">★</i>` : `<b class="${d < n ? "on" : ""}"></b>`;
            }
            return `<div class="sk-dots"><span class="fit">${esc(s.name)}</span><span class="marks">${marks}</span></div>`;
          })
          .join("")}</div>`;
      default:
        if (narrow) return `<ul>${skills.map((s) => `<li class="fit">${esc(s.name)}</li>`).join("")}</ul>`;
        return `<p>${skills.map((s) => esc(s.name)).join(" &nbsp;·&nbsp; ")}</p>`;
    }
  }

  function bulletList(text) {
    const items = String(text || "").split("\n").map((l) => l.replace(/^[\s•\-*]+/, "").trim()).filter(Boolean);
    return items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "";
  }
  function entryHtml(titulo, fechas, sub, descripcion) {
    return `<div class="entry"><div class="e-head">${esc(titulo)}<span>${esc(fechas)}</span></div>` +
      (sub ? `<div class="e-sub">${esc(sub)}</div>` : "") + bulletList(descripcion) + `</div>`;
  }
  function range(a, b, actual) {
    return [String(a || "").trim(), actual ? "Actualidad" : String(b || "").trim()].filter(Boolean).join(" - ");
  }

  // Plantillas de dos columnas (deben coincidir con las que tienen `sidebar` en lib/themes.js).
  const SIDEBAR_TEMPLATES = ["lateral", "lateralclaro"];

  function renderPreview() {
    preview.className = "paper tpl-" + state.plantilla;
    const sidebar = SIDEBAR_TEMPLATES.includes(state.plantilla);
    const contacto = [state.email, state.telefono, state.ubicacion, state.linkedin, state.web]
      .map((s) => String(s || "").trim()).filter(Boolean);
    const nombre = `<h1>${esc(state.nombre) || '<span class="empty">Tu nombre</span>'}</h1>` +
      (state.titulo ? `<div class="sub">${esc(state.titulo)}</div>` : "");
    const skills = parseSkills(state.habilidades);
    const idi = state.idiomas.filter((i) => i.idioma);

    let html = "";
    if (!sidebar) {
      html += `<div class="head">${nombre}`;
      if (contacto.length) html += `<div class="contact">${contacto.map(esc).join(" &nbsp;|&nbsp; ")}</div>`;
      html += `</div>`;
    } else {
      html += `<div class="head">${nombre}</div>`;
    }

    if (state.resumen.trim()) html += `<h3>Perfil profesional</h3><p>${esc(state.resumen)}</p>`;

    const exp = state.experiencia.filter((e) => e.cargo || e.empresa);
    if (exp.length) {
      html += `<h3>Experiencia laboral</h3>`;
      exp.forEach((e) => {
        html += entryHtml(e.cargo, range(e.desde, e.hasta, e.actual), [e.empresa, e.lugar].filter(Boolean).join(" · "), e.descripcion);
      });
    }
    const edu = state.educacion.filter((e) => e.titulo || e.institucion);
    if (edu.length) {
      html += `<h3>Educación</h3>`;
      edu.forEach((e) => {
        html += entryHtml(e.titulo, range(e.desde, e.hasta, false), e.institucion, e.descripcion);
      });
    }
    if (!sidebar) {
      if (skills.length) html += `<h3>Habilidades</h3>${skillsHtml(skills, state.estiloHabilidades)}`;
      if (idi.length) {
        html += `<h3>Idiomas</h3><p>${idi.map((i) => esc(i.idioma) + (i.nivel ? ` (${esc(i.nivel)})` : "")).join(" &nbsp;·&nbsp; ")}</p>`;
      }
    }
    state.secciones.forEach((sec) => {
      const titulo = String(sec.titulo || "").trim();
      if (!titulo) return;
      if (sec.tipo === "entradas") {
        const items = (sec.items || []).filter((e) => e.titulo || e.subtitulo);
        if (!items.length) return;
        html += `<h3>${esc(titulo)}</h3>`;
        items.forEach((e) => {
          html += entryHtml(e.titulo, range(e.desde, e.hasta, false), e.subtitulo, e.descripcion);
        });
      } else if (String(sec.contenido || "").trim()) {
        html += `<h3>${esc(titulo)}</h3>`;
        html += sec.tipo === "texto" ? `<p>${esc(sec.contenido.trim())}</p>` : bulletList(sec.contenido);
      }
    });
    if (state.adicional.trim()) html += `<h3>Información adicional</h3>${bulletList(state.adicional)}`;

    if (sidebar) {
      let side = "";
      if (state.foto) side += `<img class="photo" src="${esc(state.foto)}" alt="" />`;
      if (contacto.length) side += `<h3>Contacto</h3>${contacto.map((c) => `<div class="c-line fit">${esc(c)}</div>`).join("")}`;
      if (skills.length) side += `<h3>Habilidades</h3>${skillsHtml(skills, state.estiloHabilidades, true)}`;
      if (idi.length) {
        side += `<h3>Idiomas</h3>${idi
          .map((i) => `<div class="lang"><b class="fit">${esc(i.idioma)}</b>${i.nivel ? `<span class="fit">${esc(i.nivel)}</span>` : ""}</div>`)
          .join("")}`;
      }
      html = `<div class="cols"><aside class="side">${side}</aside><div class="main">${html}</div></div>`;
    }
    preview.innerHTML = html;
    fitSideText();
    fitPreview();
  }

  // En la barra lateral, el texto largo se achica para caber en una línea (igual que en el PDF y el Word).
  function fitSideText() {
    preview.querySelectorAll(".side .fit").forEach((el) => {
      el.style.fontSize = "";
      el.classList.remove("wrap");
      let size = parseFloat(getComputedStyle(el).fontSize);
      const min = 6;
      while (el.scrollWidth > el.clientWidth + 0.5 && size > min) {
        size -= 0.5;
        el.style.fontSize = size + "px";
      }
      // Si ni con la letra mínima cabe, se divide en líneas.
      if (el.scrollWidth > el.clientWidth + 0.5) el.classList.add("wrap");
    });
  }

  // Si el CV no cabe en una hoja A4 (848 px de alto a este ancho), marca dónde empieza cada página.
  // Igual que en el PDF, un ítem que no cabe al final de una hoja pasa entero a la siguiente
  // (con su título de sección si es el primero); aquí se simula con un espacio antes del ítem.
  const PAGE_HEIGHT = 848;
  const PAGE_PAD = 32;
  function topIn(el) {
    let y = 0;
    for (let n = el; n && n !== preview; n = n.offsetParent) y += n.offsetTop;
    return y;
  }
  function markPages() {
    const prev = preview.querySelectorAll(".pb-spacer");
    const prevKey = [...prev].map((s) => s.style.height).join();
    prev.forEach((s) => s.remove());
    preview.querySelectorAll(".entry").forEach((el) => {
      const top = topIn(el);
      const bottom = top + el.offsetHeight;
      const limit = Math.ceil((top + 1) / PAGE_HEIGHT) * PAGE_HEIGHT - PAGE_PAD;
      if (bottom <= limit || el.offsetHeight > PAGE_HEIGHT - 2 * PAGE_PAD) return;
      const h3 = el.previousElementSibling && el.previousElementSibling.tagName === "H3" ? el.previousElementSibling : null;
      const target = h3 || el;
      const spacer = document.createElement("div");
      spacer.className = "pb-spacer";
      spacer.style.height = Math.max(0, limit + 2 * PAGE_PAD - topIn(target)) + "px";
      target.before(spacer);
    });
    const pages = Math.max(1, Math.ceil(preview.scrollHeight / PAGE_HEIGHT - 0.02));
    const marks = preview.querySelectorAll(".page-break");
    const key = [...preview.querySelectorAll(".pb-spacer")].map((s) => s.style.height).join();
    if (marks.length === pages - 1 && key === prevKey) return;
    marks.forEach((m) => m.remove());
    for (let n = 2; n <= pages; n++) {
      const m = document.createElement("div");
      m.className = "page-break";
      m.style.top = (n - 1) * PAGE_HEIGHT + "px";
      m.innerHTML = `<span>Página ${n}</span>`;
      preview.appendChild(m);
    }
  }

  // Escala la hoja (ancho fijo de 600 px) al ancho disponible del panel.
  const stage = document.getElementById("preview-stage");
  function fitPreview() {
    markPages();
    const scale = Math.min(1, stage.clientWidth / preview.offsetWidth);
    preview.style.transform = scale < 1 ? `scale(${scale})` : "";
    stage.style.height = Math.ceil(preview.offsetHeight * scale) + "px";
  }
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(fitPreview);
    ro.observe(stage);
    ro.observe(preview);
  }
  window.addEventListener("resize", fitPreview);

  function renderList(name) {
    const host = document.getElementById("list-" + name);
    host.innerHTML = "";
    state[name].forEach((data, idx) => {
      const div = document.createElement("div");
      div.className = "item";
      div.dataset.list = name;
      div.dataset.idx = idx;
      div.innerHTML = SCHEMAS[name].render(data, idx, state[name].length);
      host.appendChild(div);
    });
  }

  function fillStatic() {
    form.querySelectorAll("[name]").forEach((el) => {
      if (el.type === "radio") el.checked = el.value === state[el.name];
      else if (state[el.name] !== undefined) el.value = state[el.name];
    });
  }

  // Eventos del formulario (campos simples y radios)
  form.addEventListener("input", (e) => {
    const el = e.target;
    const item = el.closest(".item");
    if (item) {
      const list = item.dataset.list;
      const idx = Number(item.dataset.idx);
      const k = el.dataset.k;
      if (!k) return;
      const sub = el.closest(".sub-item");
      if (sub) {
        state[list][idx].items[Number(sub.dataset.entry)][k] = el.value;
      } else if (list === "secciones" && k === "tipo") {
        state[list][idx].tipo = el.value;
        if (el.value === "entradas" && !state[list][idx].items.length) state[list][idx].items.push(emptyEntry());
        renderList(list);
      } else if (el.type === "checkbox") {
        state[list][idx][k] = el.checked;
        const hasta = item.querySelector('[data-k="hasta"]');
        if (hasta) hasta.disabled = el.checked;
      } else {
        state[list][idx][k] = el.value;
      }
    } else if (el.type === "radio") {
      if (el.checked) state[el.name] = el.value;
    } else if (el.name && state[el.name] !== undefined) {
      state[el.name] = el.value;
    }
    save();
    renderPreview();
  });

  function emptyEntry() {
    return { titulo: "", subtitulo: "", desde: "", hasta: "", descripcion: "" };
  }

  form.addEventListener("click", (e) => {
    const sec = e.target.closest('.item[data-list="secciones"]');
    if (sec) {
      const i = Number(sec.dataset.idx);
      const s = state.secciones[i];
      let changed = true;
      if (e.target.closest("[data-add-entry]")) {
        s.items.push(emptyEntry());
      } else if (e.target.closest(".remove-entry")) {
        s.items.splice(Number(e.target.closest(".sub-item").dataset.entry), 1);
      } else if (e.target.closest("[data-move]")) {
        const j = i + Number(e.target.closest("[data-move]").dataset.move);
        if (j < 0 || j >= state.secciones.length) return;
        [state.secciones[i], state.secciones[j]] = [state.secciones[j], s];
      } else {
        changed = false;
      }
      if (changed) {
        renderList("secciones");
        save();
        renderPreview();
        return;
      }
    }
    const add = e.target.closest("[data-add]");
    if (add) {
      const name = add.dataset.add;
      state[name].push(JSON.parse(JSON.stringify(SCHEMAS[name].empty)));
      renderList(name);
      save();
      const last = document.querySelector(`#list-${name} .item:last-child input`);
      if (last) last.focus();
      return;
    }
    const rm = e.target.closest(".remove");
    if (rm) {
      const item = rm.closest(".item");
      state[item.dataset.list].splice(Number(item.dataset.idx), 1);
      renderList(item.dataset.list);
      save();
      renderPreview();
    }
  });

  // Foto: se recorta al centro en un círculo de 300 px y se guarda como PNG (data URL).
  const fotoInput = document.getElementById("foto-input");
  const fotoThumb = document.getElementById("foto-thumb");
  const fotoQuitar = document.getElementById("foto-quitar");
  function renderFoto() {
    fotoThumb.style.backgroundImage = state.foto ? `url("${state.foto}")` : "";
    fotoThumb.classList.toggle("has", !!state.foto);
    fotoQuitar.hidden = !state.foto;
  }
  fotoInput.addEventListener("change", () => {
    const file = fotoInput.files && fotoInput.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const size = 300;
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const ctx = c.getContext("2d");
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
      const side = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      state.foto = c.toDataURL("image/png");
      URL.revokeObjectURL(img.src);
      fotoInput.value = "";
      save();
      renderFoto();
      renderPreview();
    };
    img.onerror = () => showToast("No se pudo leer la imagen");
    img.src = URL.createObjectURL(file);
  });
  fotoQuitar.addEventListener("click", () => {
    state.foto = "";
    save();
    renderFoto();
    renderPreview();
  });

  // Exportación
  const toast = document.getElementById("toast");
  function showToast(msg, ms = 3000) {
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => (toast.hidden = true), ms);
  }

  // Pagos: el servidor dice qué medios están activos. Un pago aprobado se guarda aquí y se envía como pagoId
  // (id de Mercado Pago, o "pp:<orden>" para PayPal).
  const PAGO_KEY = "cv-builder:pago";
  let pagoConfig = { pago: false, vigenciaHoras: 24, mercadopago: null, paypal: null };
  const payModal = document.getElementById("pay-modal");
  const btnMp = document.getElementById("btn-pagar-mp");
  const btnPp = document.getElementById("btn-pagar-pp");

  function getPago() {
    try {
      const p = JSON.parse(localStorage.getItem(PAGO_KEY) || "null");
      if (p && p.id && Date.now() - p.t < pagoConfig.vigenciaHoras * 3600 * 1000) return p.id;
    } catch (_) {}
    return null;
  }
  function setPago(id) {
    try {
      if (id) localStorage.setItem(PAGO_KEY, JSON.stringify({ id: String(id), t: Date.now() }));
      else localStorage.removeItem(PAGO_KEY);
    } catch (_) {}
  }
  function precioTexto({ precio, moneda }) {
    if (moneda === "CLP") return `$${Number(precio).toLocaleString("es-CL")} CLP`;
    if (moneda === "USD") return `US$${Number(precio).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
    return `${precio} ${moneda}`;
  }
  let pendiente = null; // descarga que espera la decisión del modal: { tipo, btn }
  function openPayModal(descarga) {
    pendiente = descarga || null;
    document.getElementById("btn-gratis").hidden = !pendiente;
    const { mercadopago, paypal } = pagoConfig;
    btnMp.hidden = !mercadopago;
    btnPp.hidden = !paypal;
    document.getElementById("codigo-form").hidden = !pagoConfig.codigo;
    if (mercadopago) btnMp.querySelector("b").textContent = precioTexto(mercadopago);
    if (paypal) btnPp.querySelector("b").textContent = precioTexto(paypal);
    document.getElementById("pay-horas").textContent = pagoConfig.vigenciaHoras;
    payModal.hidden = false;
    (mercadopago ? btnMp : btnPp).focus();
  }
  function closePayModal() {
    payModal.hidden = true;
  }
  payModal.addEventListener("click", (e) => {
    if (e.target === payModal || e.target.closest("[data-close]")) closePayModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !payModal.hidden) closePayModal();
  });

  // Pide al servidor el link del medio de pago y lleva al usuario allí.
  async function irAPagar(btn, endpoint, nombre) {
    const label = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = `Abriendo ${nombre}...`;
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Error " + res.status);
      save();
      location.href = data.url;
    } catch (err) {
      showToast("No se pudo iniciar el pago. Intenta de nuevo.");
      btn.disabled = false;
      btn.innerHTML = label;
    }
  }
  btnMp.addEventListener("click", () => irAPagar(btnMp, "/api/checkout", "Mercado Pago"));
  btnPp.addEventListener("click", () => irAPagar(btnPp, "/api/paypal/orden", "PayPal"));

  // Vuelta desde el medio de pago:
  //   Mercado Pago: /?pago=ok&payment_id=...&status=approved
  //   PayPal:       /?pago=paypal&token=<orden>  (hay que capturar la orden en el servidor)
  async function leerRetornoPago() {
    const q = new URLSearchParams(location.search);
    const resultado = q.get("pago");
    if (!resultado) return;
    history.replaceState(null, "", location.pathname);
    const ok = "¡Pago aprobado! Ya puedes descargar tu CV en PDF y Word.";

    if (resultado === "paypal" && q.get("token")) {
      showToast("Confirmando tu pago con PayPal...", 15000);
      try {
        const res = await fetch("/api/paypal/capturar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: q.get("token") }),
        });
        const data = await res.json();
        if (!res.ok || !data.pagoId) throw new Error(data.error);
        setPago(data.pagoId);
        showToast(ok, 6000);
      } catch (err) {
        showToast("El pago con PayPal no se completó. Puedes intentarlo de nuevo.", 6000);
      }
      return;
    }

    const id = q.get("payment_id") || q.get("collection_id");
    const status = q.get("status") || q.get("collection_status");
    if (resultado === "ok" && id && status === "approved") {
      setPago(id);
      showToast(ok, 6000);
    } else if (resultado === "pendiente" || status === "pending" || status === "in_process") {
      showToast("Tu pago está pendiente. Podrás descargar cuando Mercado Pago lo apruebe.", 6000);
    } else {
      showToast("El pago no se completó. Puedes intentarlo de nuevo.", 6000);
    }
  }

  const configLista = fetch("/api/config")
    .then((r) => r.json())
    .then((c) => {
      pagoConfig = { ...pagoConfig, ...c };
      document.getElementById("importar-card").hidden = !c.importar;
    })
    .catch(() => {});

  // Importar un CV existente: el servidor lo lee con IA y devuelve los campos del formulario.
  const importarInput = document.getElementById("importar-input");
  const importarBtn = document.getElementById("importar-btn");
  const tieneDatos = () =>
    ["nombre", "resumen", "habilidades"].some((k) => state[k].trim()) ||
    state.experiencia.some((e) => e.cargo || e.empresa);
  importarInput.addEventListener("change", async () => {
    const file = importarInput.files && importarInput.files[0];
    importarInput.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return showToast("El archivo es muy grande (máximo 5 MB)");
    if (tieneDatos() && !confirm("Esto reemplaza lo que ya escribiste en el formulario. ¿Continuar?")) return;
    const label = importarBtn.firstChild.textContent;
    importarBtn.classList.add("busy");
    importarBtn.firstChild.textContent = "Leyendo tu CV...";
    showToast("La IA está leyendo tu CV, puede tardar unos segundos...", 60000);
    try {
      const res = await fetch("/api/importar", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: file,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || (res.status === 413 ? "El archivo es muy grande (máximo 5 MB)" : ""));
      const { experiencia = [], educacion = [], idiomas = [], ...campos } = data;
      Object.keys(campos).forEach((k) => {
        if (typeof state[k] === "string" && typeof campos[k] === "string") state[k] = campos[k];
      });
      state.experiencia = experiencia.map((e) => ({ ...SCHEMAS.experiencia.empty, ...e }));
      state.educacion = educacion.map((e) => ({ ...SCHEMAS.educacion.empty, ...e }));
      state.idiomas = idiomas.map((e) => ({ ...SCHEMAS.idiomas.empty, ...e }));
      if (!state.experiencia.length) state.experiencia.push({ ...SCHEMAS.experiencia.empty });
      if (!state.educacion.length) state.educacion.push({ ...SCHEMAS.educacion.empty });
      save();
      fillStatic();
      ["experiencia", "educacion", "idiomas"].forEach(renderList);
      renderPreview();
      showToast("¡Listo! Revisa los datos y elige un formato.", 6000);
    } catch (err) {
      showToast(err.message || "No se pudo leer el CV. Intenta con otro archivo.", 6000);
    } finally {
      importarBtn.classList.remove("busy");
      importarBtn.firstChild.textContent = label;
    }
  });

  document.getElementById("btn-gratis").addEventListener("click", () => {
    const d = pendiente;
    closePayModal();
    if (d) descargar(d.tipo, d.btn, null);
  });

  // Código de descarga gratis: cuenta como un pago vigente.
  document.getElementById("codigo-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("codigo-input");
    const btn = e.target.querySelector("button");
    if (!input.value.trim()) return input.focus();
    btn.disabled = true;
    try {
      const res = await fetch("/api/codigo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: input.value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.pagoId) throw new Error(data.error || "Error " + res.status);
      setPago(data.pagoId);
      input.value = "";
      const d = pendiente;
      closePayModal();
      showToast("Código aplicado: esta descarga sale sin marca de agua");
      if (d) descargar(d.tipo, d.btn, data.pagoId);
    } catch (err) {
      showToast(err.message || "No se pudo usar el código");
    } finally {
      btn.disabled = false;
    }
  });

  async function exportar(tipo, btn) {
    if (!state.nombre.trim()) {
      showToast("Escribe al menos tu nombre antes de descargar");
      form.querySelector('[name="nombre"]').focus();
      return;
    }
    await configLista;
    const pagoId = getPago();
    if (pagoConfig.pago && !pagoId) {
      openPayModal({ tipo, btn });
      return;
    }
    descargar(tipo, btn, pagoId);
  }

  // Sin pagoId válido el servidor entrega el archivo con marca de agua.
  async function descargar(tipo, btn, pagoId) {
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Generando...";
    try {
      const res = await fetch(`/api/export/${tipo}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...state, pagoId }),
      });
      if (!res.ok) throw new Error("Error " + res.status);
      if (pagoId && res.headers.get("X-Marca-Agua")) {
        setPago(null);
        showToast("Tu pago ya no está vigente, así que el archivo salió con marca de agua.", 6000);
      } else if (String(pagoId || "").startsWith("cod:")) {
        setPago(null); // el código vale para una sola descarga
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const m = /filename="([^"]+)"/.exec(cd);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = m ? m[1] : `CV.${tipo}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (err) {
      showToast("No se pudo generar el archivo. Intenta de nuevo.");
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  }

  document.getElementById("btn-pdf").addEventListener("click", (e) => exportar("pdf", e.currentTarget));
  document.getElementById("btn-docx").addEventListener("click", (e) => exportar("docx", e.currentTarget));
  document.getElementById("btn-limpiar").addEventListener("click", () => {
    if (!confirm("¿Borrar todos los datos del formulario?")) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    location.reload();
  });

  // Inicio
  load();
  if (!state.experiencia.length) state.experiencia.push({ ...SCHEMAS.experiencia.empty });
  if (!state.educacion.length) state.educacion.push({ ...SCHEMAS.educacion.empty });
  fillStatic();
  renderFoto();
  leerRetornoPago();
  ["experiencia", "educacion", "idiomas", "secciones"].forEach(renderList);
  renderPreview();
})();
