// Completa las páginas legales con la vigencia y el correo de contacto configurados en el servidor.
fetch("/api/config")
  .then((r) => r.json())
  .then((cfg) => {
    document.querySelectorAll("[data-horas]").forEach((el) => (el.textContent = cfg.vigenciaHoras));
    if (!cfg.contacto) return;
    document.querySelectorAll("[data-contacto-texto]").forEach((el) => {
      const a = document.createElement("a");
      a.href = "mailto:" + cfg.contacto;
      a.textContent = cfg.contacto;
      el.append(" a ", a);
    });
  })
  .catch(() => {});
