from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app


class ModulosPersonasTest(unittest.TestCase):
    def setUp(self):
        self.carpeta = tempfile.TemporaryDirectory()
        self.addCleanup(self.carpeta.cleanup)
        self.parche = patch("app.database.DB_PATH", Path(self.carpeta.name) / "prueba.db")
        self.parche.start()
        self.addCleanup(self.parche.stop)
        self.cliente = self.enterContext(TestClient(app))

    def comprobar_crud(self, modulo, datos, identificador):
        ruta = f"/api/v1/{modulo}"
        respuesta = self.cliente.post(ruta, json=datos)
        self.assertEqual(respuesta.status_code, 201, respuesta.text)
        registro_id = respuesta.json()["id"]
        self.assertEqual(self.cliente.post(ruta, json=datos).status_code, 409)
        datos["nombres"] = "Nombre actualizado"
        self.assertEqual(self.cliente.put(f"{ruta}/{registro_id}", json=datos).status_code, 200)
        guardado = self.cliente.get(f"{ruta}/{registro_id}").json()
        self.assertEqual(guardado["nombres"], "Nombre actualizado")
        encontrados = self.cliente.get(ruta, params={"buscar": datos[identificador]}).json()
        self.assertEqual([fila["id"] for fila in encontrados], [registro_id])
        self.assertEqual(self.cliente.delete(f"{ruta}/{registro_id}").status_code, 200)
        self.assertEqual(self.cliente.get(f"{ruta}/{registro_id}").status_code, 404)

    def test_docentes(self):
        self.comprobar_crud("docentes", {
            "numero_empleado": "PRUEBA123", "nombres": "Docente prueba",
            "apellidos": "Hernandez", "correo": "docente.prueba@example.com",
            "especialidad": "Matematicas", "estado": "ACTIVO",
        }, "numero_empleado")
        docentes = self.cliente.get("/api/v1/docentes").json()
        self.assertEqual(self.cliente.delete(f"/api/v1/docentes/{docentes[0]['id']}").status_code, 409)

    def test_estudiantes(self):
        carrera = self.cliente.get("/api/v1/carreras?solo_activas=true").json()[0]
        datos = {
            "cuenta": "PRUEBA123", "nombres": "Estudiante prueba",
            "apellidos": "Hernandez", "correo": "estudiante.prueba@example.com",
            "telefono": None, "fecha_nacimiento": "2003-01-02",
            "carrera_id": carrera["id"], "estado": "ACTIVO",
        }
        self.comprobar_crud("estudiantes", datos, "cuenta")
        datos["fecha_nacimiento"] = "2999-01-01"
        self.assertEqual(self.cliente.post("/api/v1/estudiantes", json=datos).status_code, 422)
        pagina = self.cliente.get("/api/v1/estudiantes?limite=1").json()
        siguiente = self.cliente.get("/api/v1/estudiantes?limite=1&desplazamiento=1").json()
        self.assertNotEqual(pagina[0]["id"], siguiente[0]["id"])
        estudiantes = self.cliente.get("/api/v1/estudiantes").json()
        estados = [self.cliente.delete(f"/api/v1/estudiantes/{e['id']}").status_code for e in estudiantes]
        self.assertIn(409, estados)

    def test_archivo_frontend(self):
        self.assertEqual(self.cliente.get("/personas.js").status_code, 200)
