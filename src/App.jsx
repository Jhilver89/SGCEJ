import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'

import Login from './pages/Login'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import { AuthProvider } from './context/AuthContext'
import AppLayout from './layouts/AppLayout'
import AdminLayout from './layouts/AdminLayout'

// ==========================
// ADMINISTRACIÓN
// ==========================
import DashboardAdmin from './pages/admin/DashboardAdmin'
import Institucion from './pages/admin/Institucion'
import AniosEscolares from './pages/admin/AniosEscolares'
import DetalleAnioEscolar from './pages/admin/DetalleAnioEscolar'
import GradosSecciones from './pages/admin/GradosSecciones'
import Estudiantes from './pages/admin/Estudiantes'
import Matriculas from './pages/admin/Matriculas'
import Docentes from './pages/admin/Docentes'
import Usuarios from './pages/admin/Usuarios'
import Reportes from './pages/admin/Reportes'

// ==========================
// ÁREA DEL DOCENTE / USUARIO
// ==========================
import Dashboard from './pages/app/Dashboard'
import Salidas from './pages/app/Salidas'
import Incidencias from './pages/app/Incidencias'
import Mensajes from './pages/app/Mensajes'


// ======================================================
// APP PRINCIPAL
// ======================================================

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* ==================================================
              LOGIN
          ================================================== */}

          <Route
            path="/login"
            element={<Login />}
          />


          {/* ==================================================
              ÁREA GENERAL DEL SISTEMA
          ================================================== */}

          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >

            {/* Dashboard docente */}
            <Route
              index
              element={<Dashboard />}
            />

            {/* ----------------------------------------------
                SALIDAS
            ---------------------------------------------- */}

            <Route
              path="salidas"
              element={<Salidas />}
            />

            {/* ----------------------------------------------
                INCIDENCIAS
            ---------------------------------------------- */}

            <Route
              path="incidencias"
              element={<Incidencias />}
            />

            {/* ----------------------------------------------
                MENSAJES
            ---------------------------------------------- */}

            <Route
              path="mensajes"
              element={<Mensajes />}
            />

          </Route>


          {/* ==================================================
              ÁREA EXCLUSIVA DEL ADMINISTRADOR
          ================================================== */}

          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >

            {/* Dashboard administrador */}
            <Route
              index
              element={<DashboardAdmin />}
            />

            {/* ----------------------------------------------
                INSTITUCIÓN
            ---------------------------------------------- */}

            <Route
              path="institucion"
              element={<Institucion />}
            />

            {/* ----------------------------------------------
                AÑOS ESCOLARES
            ---------------------------------------------- */}

            <Route
              path="anios-escolares"
              element={<AniosEscolares />}
            />

            {/* Detalle del año escolar */}
            <Route
              path="anios-escolares/:id"
              element={<DetalleAnioEscolar />}
            />

            {/* ----------------------------------------------
                GRADOS Y SECCIONES
            ---------------------------------------------- */}

            <Route
              path="grados-secciones"
              element={<GradosSecciones />}
            />

            {/* ----------------------------------------------
                ESTUDIANTES
            ---------------------------------------------- */}

            <Route
              path="estudiantes"
              element={<Estudiantes />}
            />

            {/* ----------------------------------------------
                MATRÍCULAS
            ---------------------------------------------- */}

            <Route
              path="matriculas"
              element={<Matriculas />}
            />

            {/* ----------------------------------------------
                DOCENTES
            ---------------------------------------------- */}

            <Route
              path="docentes"
              element={<Docentes />}
            />

            {/* ----------------------------------------------
                USUARIOS
            ---------------------------------------------- */}

            <Route
              path="usuarios"
              element={<Usuarios />}
            />

            {/* ----------------------------------------------
                REPORTES
            ---------------------------------------------- */}

            <Route
              path="reportes"
              element={<Reportes />}
            />

          </Route>


          {/* ==================================================
              RUTA INICIAL
          ================================================== */}

          <Route
            path="/"
            element={
              <Navigate
                to="/app"
                replace
              />
            }
          />


          {/* ==================================================
              RUTAS NO EXISTENTES
          ================================================== */}

          <Route
            path="*"
            element={
              <Navigate
                to="/app"
                replace
              />
            }
          />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App