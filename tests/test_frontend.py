from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app


class FlujoAsignaturasTest(unittest.TestCase):
    def test_login_listado_y_busqueda(self):
        with tempfile.TemporaryDirectory() as carpeta:
            ruta = Path(carpeta) / "prueba.db"
            with patch("app.database.DB_PATH", ruta), TestClient(app) as cliente:
                self.assertEqual(cliente.get("/").status_code, 200)
                self.assertEqual(cliente.get("/app.js").status_code, 200)
                self.assertEqual(cliente.get("/styles.css").status_code, 200)
                login = cliente.post("/api/v1/auth/login", json={
                    "usuario": "admin", "clave": "admin123",
                })
                self.assertEqual(login.status_code, 200)
                self.assertEqual(login.json()["rol"], "ADMIN")
                self.assertEqual(cliente.post("/api/v1/auth/login", json={
                    "usuario": "admin", "clave": "incorrecta",
                }).status_code, 401)
                respuesta = cliente.get("/api/v1/asignaturas")
                self.assertEqual(respuesta.status_code, 200)
                asignaturas = respuesta.json()
                self.assertGreater(len(asignaturas), 0)
                primera = asignaturas[0]
                filtradas = cliente.get("/api/v1/asignaturas", params={
                    "buscar": primera["codigo"],
                }).json()
                self.assertIn(primera, filtradas)
                self.assertEqual(cliente.get("/api/v1/asignaturas", params={
                    "buscar": "SIN_RESULTADOS_987654",
                }).json(), [])
                resumen = cliente.get("/api/v1/reportes/dashboard")
                self.assertEqual(resumen.status_code, 200)
                self.assertEqual(resumen.json()["asignaturas_activas"],
                                 sum(a["activo"] for a in asignaturas))


if __name__ == "__main__":
    unittest.main()
