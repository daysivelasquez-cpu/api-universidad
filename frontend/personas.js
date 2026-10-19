const camposComunes = [
  { nombre: "nombres", etiqueta: "Nombres", min: 2, max: 80 },
  { nombre: "apellidos", etiqueta: "Apellidos", min: 2, max: 80 },
  { nombre: "correo", etiqueta: "Correo", tipo: "email" },
];
const modulosPersonas = {
  docentes: {
    titulo: "Docentes",
    campos: [
      { nombre: "numero_empleado", etiqueta: "Número de empleado", min: 3, max: 20 },
      ...camposComunes,
      { nombre: "especialidad", etiqueta: "Especialidad", min: 3, max: 120 },
      { nombre: "estado", etiqueta: "Estado", opciones: ["ACTIVO", "INACTIVO"] },
    ],
  },
  estudiantes: {
    titulo: "Estudiantes",
    campos: [
      { nombre: "cuenta", etiqueta: "Número de cuenta", min: 5, max: 20 },
      ...camposComunes,
      { nombre: "telefono", etiqueta: "Teléfono", tipo: "tel", max: 25, opcional: true },
      { nombre: "fecha_nacimiento", etiqueta: "Fecha de nacimiento", tipo: "date" },
      { nombre: "carrera_id", etiqueta: "Carrera", opciones: [] },
      { nombre: "estado", etiqueta: "Estado", opciones: ["ACTIVO", "INACTIVO", "GRADUADO"] },
    ],
  },
};
let moduloPersonas = null;
let editandoPersona = null;
let paginaPersonas = 0;
let carrerasPersonas = [];
let operacionPersona = false;

function reiniciarPersonas() {
  moduloPersonas = null;
  editandoPersona = null;
  paginaPersonas = 0;
  elemento("editar-persona").reset();
  elemento("buscar-personas").reset();
  elemento("campos-persona").replaceChildren();
  elemento("filas-personas").replaceChildren();
  elemento("mensaje-personas").textContent = "";
}

function construirEditor() {
  const contenedor = elemento("campos-persona");
  contenedor.replaceChildren();
  for (const campo of modulosPersonas[moduloPersonas].campos) {
    const etiqueta = document.createElement("label");
    etiqueta.textContent = campo.etiqueta;
    const entrada = document.createElement(campo.opciones ? "select" : "input");
    entrada.name = campo.nombre;
    entrada.required = !campo.opcional;
    if (campo.opciones) {
      const opciones = campo.nombre === "carrera_id"
        ? [{ valor: "", texto: "Seleccione una carrera" }, ...carrerasPersonas.map((carrera) => ({
          valor: carrera.id, texto: `${carrera.nombre}${carrera.activo ? "" : " (inactiva)"}`,
        }))]
        : campo.opciones.map((valor) => ({ valor, texto: valor }));
      for (const opcion of opciones) entrada.add(new Option(opcion.texto, opcion.valor));
    } else {
      entrada.type = campo.tipo ?? "text";
      if (campo.min) entrada.minLength = campo.min;
      if (campo.max) entrada.maxLength = campo.max;
    }
    etiqueta.append(entrada);
    contenedor.append(etiqueta);
  }
  cancelarEdicionPersona();
}

function cancelarEdicionPersona() {
  editandoPersona = null;
  elemento("editar-persona").reset();
  elemento("titulo-editor").textContent = "Nuevo registro";
  elemento("guardar-persona").textContent = "Guardar";
}

async function cargarPersonas(modulo, vigente) {
  if (moduloPersonas !== modulo) {
    moduloPersonas = modulo;
    paginaPersonas = 0;
    elemento("buscar-personas").reset();
    elemento("campos-persona").replaceChildren();
    elemento("titulo-personas").textContent = modulosPersonas[modulo].titulo;
    if (modulo === "estudiantes") {
      const carreras = await consultar("/carreras");
      if (!vigente()) return;
      carrerasPersonas = carreras;
    }
    construirEditor();
  } else if (!elemento("campos-persona").children.length) {
    // Permite reintentar si la carga inicial de carreras falló.
    moduloPersonas = null;
    return cargarPersonas(modulo, vigente);
  }
  const parametros = new URLSearchParams(new FormData(elemento("buscar-personas")));
  if (modulo === "estudiantes") {
    parametros.set("limite", "50");
    parametros.set("desplazamiento", String(paginaPersonas * 50));
  }
  elemento("filas-personas").replaceChildren();
  const registros = await consultar(`/${modulo}?${parametros}`);
  if (!vigente()) return;
  const campos = modulosPersonas[modulo].campos;
  const cabecera = document.createElement("tr");
  for (const titulo of [...campos.map((campo) => campo.etiqueta), "Acciones"]) {
    const celda = document.createElement("th");
    celda.textContent = titulo;
    cabecera.append(celda);
  }
  elemento("cabecera-personas").replaceChildren(cabecera);
  for (const registro of registros) {
    const fila = document.createElement("tr");
    for (const campo of campos) {
      const celda = document.createElement("td");
      celda.textContent = campo.nombre === "carrera_id" ? registro.carrera_nombre : registro[campo.nombre] ?? "—";
      fila.append(celda);
    }
    const acciones = document.createElement("td");
    for (const accion of ["Editar", "Eliminar"]) {
      const boton = document.createElement("button");
      boton.type = "button";
      boton.textContent = accion;
      boton.disabled = operacionPersona;
      boton.addEventListener("click", () => {
        if (operacionPersona) return;
        if (accion === "Editar") {
          editandoPersona = registro.id;
          for (const campo of campos) elemento("editar-persona").elements[campo.nombre].value = registro[campo.nombre] ?? "";
          elemento("titulo-editor").textContent = `Editar: ${registro.nombres} ${registro.apellidos}`;
          elemento("guardar-persona").textContent = "Guardar cambios";
          elemento("editar-persona").elements[0].focus();
        } else {
          eliminarPersona(modulo, registro);
        }
      });
      acciones.append(boton);
    }
    fila.append(acciones);
    elemento("filas-personas").append(fila);
  }
  elemento("mensaje-personas").textContent = registros.length ? `${registros.length} registros en esta página.` : "No se encontraron registros.";
  elemento("paginas-personas").hidden = modulo !== "estudiantes";
  elemento("pagina-personas").textContent = `Página ${paginaPersonas + 1}`;
  elemento("anterior-personas").disabled = paginaPersonas === 0;
  elemento("siguiente-personas").disabled = registros.length < 50;
}

async function guardarPersona(evento) {
  evento.preventDefault();
  if (operacionPersona) return;
  const modulo = moduloPersonas;
  const id = editandoPersona;
  const datos = Object.fromEntries(new FormData(evento.currentTarget));
  if (modulo === "estudiantes") {
    datos.carrera_id = Number(datos.carrera_id);
    datos.telefono = datos.telefono.trim() || null;
  }
  await ejecutarCambioPersona(modulo, async () => {
    await consultar(`/${modulo}${id ? `/${id}` : ""}`, {
      method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos),
    });
  }, "Registro guardado correctamente.");
}

async function eliminarPersona(modulo, registro) {
  if (!window.confirm(`¿Eliminar a ${registro.nombres} ${registro.apellidos}?`)) return;
  await ejecutarCambioPersona(modulo, () => consultar(`/${modulo}/${registro.id}`, { method: "DELETE" }), "Registro eliminado correctamente.");
}

async function ejecutarCambioPersona(modulo, accion, mensaje) {
  if (operacionPersona) return;
  operacionPersona = true;
  elemento("guardar-persona").disabled = true;
  try {
    await accion();
    if (!usuario || vista !== modulo) return;
    cancelarEdicionPersona();
    await cargarVista();
    if (usuario && vista === modulo) elemento("mensaje-personas").textContent += ` ${mensaje}`;
  } catch (error) {
    if (usuario && vista === modulo) elemento("mensaje-personas").textContent = `Error: ${error.message}`;
  } finally {
    operacionPersona = false;
    elemento("guardar-persona").disabled = false;
    elemento("filas-personas").querySelectorAll("button").forEach((boton) => { boton.disabled = false; });
  }
}

document.getElementById("editar-persona").addEventListener("submit", guardarPersona);
document.getElementById("cancelar-persona").addEventListener("click", cancelarEdicionPersona);
document.getElementById("buscar-personas").addEventListener("submit", (evento) => {
  evento.preventDefault(); paginaPersonas = 0; cargarVista();
});
for (const [id, cambio] of [["anterior-personas", -1], ["siguiente-personas", 1]]) {
  document.getElementById(id).addEventListener("click", () => { paginaPersonas += cambio; cargarVista(); });
}
