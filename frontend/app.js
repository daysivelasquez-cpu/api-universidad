const elemento = (id) => document.getElementById(id);
let vista = "inicio";
let usuario = null;
let cargaActual = 0;

async function consultar(ruta, opciones) {
  const respuesta = await fetch(`/api/v1${ruta}`, opciones);
  if (!respuesta.ok) {
    const error = await respuesta.json().catch(() => ({}));
    const detalle = Array.isArray(error.detail)
      ? error.detail.map((dato) => `${dato.loc.at(-1)}: ${dato.msg}`).join(". ")
      : error.detail;
    throw new Error(typeof detalle === "string" ? detalle : "No se pudo completar la solicitud.");
  }
  return respuesta.json();
}

async function cargarVista() {
  const destino = vista;
  const carga = ++cargaActual;
  elemento("mensaje").textContent = "Cargando...";
  elemento("dashboard").hidden = destino !== "inicio";
  elemento("materias").hidden = destino !== "asignaturas";
  elemento("personas").hidden = !["docentes", "estudiantes"].includes(destino);
  elemento("filas").replaceChildren();
  try {
    if (["docentes", "estudiantes"].includes(destino)) {
      await cargarPersonas(destino, () => usuario && vista === destino && carga === cargaActual);
      if (carga === cargaActual) elemento("mensaje").textContent = "";
    } else if (destino === "asignaturas") {
      const parametros = new URLSearchParams(new FormData(elemento("filtros")));
      const asignaturas = await consultar(`/asignaturas?${parametros}`);
      if (!usuario || vista !== destino || carga !== cargaActual) return;
      elemento("filas").replaceChildren();
      for (const asignatura of asignaturas) {
        const fila = document.createElement("tr");
        for (const valor of [asignatura.codigo, asignatura.nombre, asignatura.unidades_valorativas,
          asignatura.carrera_nombre, asignatura.requisito_codigo ?? "Sin requisito",
          asignatura.activo ? "Activa" : "Inactiva"]) {
          const celda = document.createElement("td");
          celda.textContent = valor;
          fila.append(celda);
        }
        elemento("filas").append(fila);
      }
      elemento("mensaje").textContent = asignaturas.length ? `${asignaturas.length} asignaturas encontradas.` : "No se encontraron asignaturas.";
    } else {
      const resumen = await consultar("/reportes/dashboard");
      if (!usuario || vista !== destino || carga !== cargaActual) return;
      elemento("dashboard").replaceChildren();
      for (const [campo, titulo] of Object.entries({ estudiantes_activos: "Estudiantes activos", docentes_activos: "Docentes activos",
        carreras_activas: "Carreras activas", asignaturas_activas: "Asignaturas activas",
        secciones_abiertas: "Secciones abiertas", matriculas_activas: "Matrículas activas" })) {
        const tarjeta = document.createElement("article");
        const cantidad = document.createElement("strong");
        cantidad.textContent = resumen[campo];
        tarjeta.append(cantidad, titulo);
        elemento("dashboard").append(tarjeta);
      }
      elemento("mensaje").textContent = `Período académico activo: ${resumen.periodo_activo ?? "Ninguno"}`;
    }
  } catch (error) {
    if (usuario && vista === destino && carga === cargaActual) elemento("mensaje").textContent = `Error: ${error.message} Puedes reintentar con Actualizar.`;
  }
}

elemento("login").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const boton = evento.submitter;
  boton.disabled = true;
  try {
    usuario = await consultar("/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(evento.currentTarget))),
    });
    elemento("saludo").textContent = `Hola, ${usuario.nombre_completo}`;
    elemento("login").reset();
    elemento("login").hidden = true;
    elemento("sistema").hidden = false;
    vista = "inicio";
    await cargarVista();
  } catch (error) {
    elemento("mensaje").textContent = error.message;
  } finally {
    boton.disabled = false;
  }
});
elemento("asignaturas").addEventListener("click", () => { vista = "asignaturas"; cargarVista(); });
elemento("inicio").addEventListener("click", () => { vista = "inicio"; cargarVista(); });
for (const modulo of ["docentes", "estudiantes"]) {
  elemento(modulo).addEventListener("click", () => { vista = modulo; cargarVista(); });
}
elemento("actualizar").addEventListener("click", cargarVista);
elemento("filtros").addEventListener("submit", (evento) => { evento.preventDefault(); cargarVista(); });
elemento("salir").addEventListener("click", () => {
  usuario = null;
  cargaActual++;
  reiniciarPersonas();
  elemento("sistema").hidden = true;
  elemento("login").hidden = false;
  elemento("mensaje").textContent = "";
  elemento("filas").replaceChildren();
  elemento("dashboard").replaceChildren();
  elemento("filtros").reset();
});
