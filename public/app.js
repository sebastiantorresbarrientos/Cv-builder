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
    resumen: "", habilidades: "", adicional: "",
    experiencia: [], educacion: [], idiomas: [],
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
  function skillsHtml(skills, estilo) {
    const lvl = (s) => s.level || 3;
    switch (estilo) {
      case "etiquetas":
        return `<div class="sk-tags">${skills.map((s) => `<span>${esc(s.name)}</span>`).join("")}</div>`;
      case "columnas":
        return `<ul class="sk-cols">${skills.map((s) => `<li>${esc(s.name)}</li>`).join("")}</ul>`;
      case "barras":
        return `<div class="sk-grid">${skills
          .map((s) => `<div class="sk-bar"><div>${esc(s.name)}</div><i><b style="width:${lvl(s) * 20}%"></b></i></div>`)
          .join("")}</div>`;
      case "puntos":
        return `<div class="sk-grid">${skills
          .map((s) => {
            const n = lvl(s);
            let dots = "";
            for (let d = 0; d < 5; d++) dots += `<b class="${d < n ? "on" : ""}"></b>`;
            return `<div class="sk-dots"><span>${esc(s.name)}</span><span>${dots}</span></div>`;
          })
          .join("")}</div>`;
      default:
        return `<p>${skills.map((s) => esc(s.name)).join(" &nbsp;·&nbsp; ")}</p>`;
    }
  }

  function bulletList(text) {
    const items = String(text || "").split("\n").map((l) => l.replace(/^[\s•\-*]+/, "").trim()).filter(Boolean);
    return items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "";
  }
  function range(a, b, actual) {
    return [String(a || "").trim(), actual ? "Actualidad" : String(b || "").trim()].filter(Boolean).join(" - ");
  }

  function renderPreview() {
    preview.className = "paper tpl-" + state.plantilla;
    const contacto = [state.email, state.telefono, state.ubicacion, state.linkedin, state.web]
      .map((s) => String(s || "").trim()).filter(Boolean);
    let html = `<div class="head"><h1>${esc(state.nombre) || '<span class="empty">Tu nombre</span>'}</h1>`;
    if (state.titulo) html += `<div class="sub">${esc(state.titulo)}</div>`;
    if (contacto.length) html += `<div class="contact">${contacto.map(esc).join(" &nbsp;|&nbsp; ")}</div>`;
    html += `</div>`;

    if (state.resumen.trim()) html += `<h3>Perfil profesional</h3><p>${esc(state.resumen)}</p>`;

    const exp = state.experiencia.filter((e) => e.cargo || e.empresa);
    if (exp.length) {
      html += `<h3>Experiencia laboral</h3>`;
      exp.forEach((e) => {
        html += `<div class="e-head">${esc(e.cargo)}<span>${esc(range(e.desde, e.hasta, e.actual))}</span></div>`;
        const sub = [e.empresa, e.lugar].filter(Boolean).join(" · ");
        if (sub) html += `<div class="e-sub">${esc(sub)}</div>`;
        html += bulletList(e.descripcion);
      });
    }
    const edu = state.educacion.filter((e) => e.titulo || e.institucion);
    if (edu.length) {
      html += `<h3>Educación</h3>`;
      edu.forEach((e) => {
        html += `<div class="e-head">${esc(e.titulo)}<span>${esc(range(e.desde, e.hasta, false))}</span></div>`;
        if (e.institucion) html += `<div class="e-sub">${esc(e.institucion)}</div>`;
        html += bulletList(e.descripcion);
      });
    }
    const skills = parseSkills(state.habilidades);
    if (skills.length) html += `<h3>Habilidades</h3>${skillsHtml(skills, state.estiloHabilidades)}`;

    const idi = state.idiomas.filter((i) => i.idioma);
    if (idi.length) {
      html += `<h3>Idiomas</h3><p>${idi.map((i) => esc(i.idioma) + (i.nivel ? ` (${esc(i.nivel)})` : "")).join(" &nbsp;·&nbsp; ")}</p>`;
    }
    if (state.adicional.trim()) html += `<h3>Información adicional</h3>${bulletList(state.adicional)}`;

    preview.innerHTML = html;
  }

  function renderList(name) {
    const host = document.getElementById("list-" + name);
    host.innerHTML = "";
    state[name].forEach((data, idx) => {
      const div = document.createElement("div");
      div.className = "item";
      div.dataset.list = name;
      div.dataset.idx = idx;
      div.innerHTML = SCHEMAS[name].render(data);
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
      if (el.type === "checkbox") {
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

  form.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (add) {
      const name = add.dataset.add;
      state[name].push({ ...SCHEMAS[name].empty });
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

  // Exportación
  const toast = document.getElementById("toast");
  function showToast(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => (toast.hidden = true), 3000);
  }

  async function exportar(tipo, btn) {
    if (!state.nombre.trim()) {
      showToast("Escribe al menos tu nombre antes de descargar");
      form.querySelector('[name="nombre"]').focus();
      return;
    }
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Generando...";
    try {
      const res = await fetch(`/api/export/${tipo}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      if (!res.ok) throw new Error("Error " + res.status);
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
  ["experiencia", "educacion", "idiomas"].forEach(renderList);
  renderPreview();
})();
