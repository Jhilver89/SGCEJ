import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Download,
  FileSpreadsheet,
  Pencil,
  Plus,
  Search,
  Upload,
  UserCheck,
  UserX,
  Users,
  X,
  Save,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import * as XLSX from 'xlsx'

import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import './Docentes.css'

const COLUMNAS = [
  'DNI',
  'Nombres',
  'Apellidos',
  'Especialidad',
  'Telefono',
  'Correo',
  'Activo',
]

const NORMALIZAR = {
  DNI: 'dni',
  Nombres: 'nombres',
  Apellidos: 'apellidos',
  Especialidad: 'especialidad',
  Telefono: 'telefono',
  Correo: 'correo',
  Activo: 'activo',
}

function Docentes() {
  const { profile } = useAuth()
  const inputExcelRef = useRef(null)

  const [docentes, setDocentes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [importando, setImportando] = useState(false)

  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('activos')

  const [modalAbierto, setModalAbierto] = useState(false)
  const [docenteEditando, setDocenteEditando] = useState(null)

  const [formulario, setFormulario] = useState({
    dni: '',
    nombres: '',
    apellidos: '',
    especialidad: '',
    telefono: '',
    correo: '',
    activo: true,
  })

  const [modalImportacion, setModalImportacion] = useState(false)
  const [filasExcel, setFilasExcel] = useState([])
  const [archivoNombre, setArchivoNombre] = useState('')
  const [erroresExcel, setErroresExcel] = useState([])
  const [resultadoImportacion, setResultadoImportacion] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const [tipoMensaje, setTipoMensaje] = useState('')

  const mostrarMensaje = (texto, tipo = 'success') => {
    setMensaje(texto)
    setTipoMensaje(tipo)
    window.setTimeout(() => {
      setMensaje('')
      setTipoMensaje('')
    }, 4000)
  }

  const cargarDocentes = async () => {
    if (!profile?.institucion_id) return
    setCargando(true)

    const { data, error } = await supabase
      .from('docentes')
      .select(`
        id,
        institucion_id,
        perfil_id,
        dni,
        nombres,
        apellidos,
        especialidad,
        telefono,
        correo,
        activo,
        created_at
      `)
      .eq('institucion_id', profile.institucion_id)
      .order('apellidos', { ascending: true })
      .order('nombres', { ascending: true })

    if (error) {
      console.error(error)
      mostrarMensaje('No se pudieron cargar los docentes.', 'error')
    } else {
      setDocentes(data || [])
    }

    setCargando(false)
  }

  useEffect(() => {
    cargarDocentes()
  }, [profile?.institucion_id])

  const docentesFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()

    return docentes.filter((docente) => {
      const coincideEstado =
        filtroEstado === 'todos' ||
        (filtroEstado === 'activos' && docente.activo) ||
        (filtroEstado === 'inactivos' && !docente.activo)

      if (!coincideEstado) return false
      if (!texto) return true

      return [
        docente.dni,
        docente.nombres,
        docente.apellidos,
        docente.especialidad,
        docente.telefono,
        docente.correo,
      ].some((valor) => String(valor || '').toLowerCase().includes(texto))
    })
  }, [docentes, busqueda, filtroEstado])

  const totalActivos = docentes.filter((d) => d.activo).length
  const totalInactivos = docentes.filter((d) => !d.activo).length

  const abrirNuevo = () => {
    setDocenteEditando(null)
    setFormulario({
      dni: '',
      nombres: '',
      apellidos: '',
      especialidad: '',
      telefono: '',
      correo: '',
      activo: true,
    })
    setModalAbierto(true)
  }

  const abrirEditar = (docente) => {
    setDocenteEditando(docente)
    setFormulario({
      dni: docente.dni || '',
      nombres: docente.nombres || '',
      apellidos: docente.apellidos || '',
      especialidad: docente.especialidad || '',
      telefono: docente.telefono || '',
      correo: docente.correo || '',
      activo: docente.activo,
    })
    setModalAbierto(true)
  }

  const cerrarModal = () => {
    if (guardando) return
    setModalAbierto(false)
    setDocenteEditando(null)
  }

  const guardarDocente = async (e) => {
    e.preventDefault()

    const datos = {
      dni: formulario.dni.trim(),
      nombres: formulario.nombres.trim(),
      apellidos: formulario.apellidos.trim(),
      especialidad: formulario.especialidad.trim() || null,
      telefono: formulario.telefono.trim() || null,
      correo: formulario.correo.trim() || null,
      activo: formulario.activo,
      institucion_id: profile.institucion_id,
    }

    if (!datos.dni || !datos.nombres || !datos.apellidos) {
      mostrarMensaje('DNI, nombres y apellidos son obligatorios.', 'error')
      return
    }

    setGuardando(true)

    const query = docenteEditando
      ? supabase.from('docentes').update(datos).eq('id', docenteEditando.id).eq('institucion_id', profile.institucion_id)
      : supabase.from('docentes').insert(datos)

    const { error } = await query

    setGuardando(false)

    if (error) {
      console.error(error)
      mostrarMensaje(
        error.code === '23505'
          ? 'Ya existe un docente con ese DNI en la institución.'
          : error.message || 'No se pudo guardar el docente.',
        'error'
      )
      return
    }

    cerrarModal()
    mostrarMensaje(docenteEditando ? 'Docente actualizado correctamente.' : 'Docente registrado correctamente.')
    await cargarDocentes()
  }

  const cambiarEstado = async (docente) => {
    const nuevoEstado = !docente.activo
    const confirmar = window.confirm(
      nuevoEstado
        ? `¿Deseas activar a ${docente.nombres} ${docente.apellidos}?`
        : `¿Deseas desactivar a ${docente.nombres} ${docente.apellidos}?`
    )

    if (!confirmar) return

    const { error } = await supabase
      .from('docentes')
      .update({ activo: nuevoEstado })
      .eq('id', docente.id)
      .eq('institucion_id', profile.institucion_id)

    if (error) {
      console.error(error)
      mostrarMensaje('No se pudo cambiar el estado del docente.', 'error')
      return
    }

    mostrarMensaje(nuevoEstado ? 'Docente activado correctamente.' : 'Docente desactivado correctamente.')
    await cargarDocentes()
  }

  const descargarPlantilla = () => {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([
      COLUMNAS,
      ['', '', '', '', '', '', 'SI'],
    ])

    ws['!cols'] = [
      { wch: 16 }, { wch: 25 }, { wch: 30 }, { wch: 25 },
      { wch: 16 }, { wch: 32 }, { wch: 12 },
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Docentes')

    const instrucciones = XLSX.utils.aoa_to_sheet([
      ['PLANTILLA DE IMPORTACIÓN DE DOCENTES - SGCE'],
      [''],
      ['Campos obligatorios'],
      ['DNI', 'Documento de identidad del docente.'],
      ['Nombres', 'Nombres del docente.'],
      ['Apellidos', 'Apellidos del docente.'],
      ['Activo', 'Usar SI para docente activo o NO para docente inactivo.'],
      [''],
      ['Campos opcionales'],
      ['Especialidad', 'Especialidad o área del docente.'],
      ['Telefono', 'Número telefónico.'],
      ['Correo', 'Correo electrónico.'],
      [''],
      ['Importante'],
      ['No modificar los nombres de las columnas.'],
      ['No repetir el DNI de un docente dentro de la institución.'],
      ['La institución se asignará automáticamente según el administrador.'],
    ])
    instrucciones['!cols'] = [{ wch: 28 }, { wch: 85 }]
    XLSX.utils.book_append_sheet(wb, instrucciones, 'Instrucciones')

    const ejemplo = XLSX.utils.aoa_to_sheet([
      COLUMNAS,
      ['12345678', 'Juan Carlos', 'Pérez García', 'Matemática', '987654321', 'juan.perez@ejemplo.com', 'SI'],
    ])
    ejemplo['!cols'] = ws['!cols']
    XLSX.utils.book_append_sheet(wb, ejemplo, 'Ejemplo')

    XLSX.writeFile(wb, 'Plantilla_Importacion_Docentes_SGCE.xlsx')
  }

  const normalizarActivo = (valor) => {
    if (typeof valor === 'boolean') return valor
    const texto = String(valor ?? '').trim().toLowerCase()
    if (['si', 'sí', 's', 'true', '1', 'activo'].includes(texto)) return true
    if (['no', 'n', 'false', '0', 'inactivo'].includes(texto)) return false
    return null
  }

  const procesarArchivoExcel = async (file) => {
    setArchivoNombre(file.name)
    setErroresExcel([])
    setResultadoImportacion(null)
    setFilasExcel([])

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
      const nombreHoja = workbook.SheetNames.find((n) => n.toLowerCase() === 'docentes') || workbook.SheetNames[0]

      if (!nombreHoja) {
        throw new Error('El archivo no contiene hojas.')
      }

      const hoja = workbook.Sheets[nombreHoja]
      const filas = XLSX.utils.sheet_to_json(hoja, { defval: '', raw: false })

      if (!filas.length) {
        throw new Error('La hoja no contiene registros.')
      }

      const columnasArchivo = Object.keys(filas[0])
      const faltantes = COLUMNAS.filter((col) => !columnasArchivo.includes(col))

      if (faltantes.length) {
        throw new Error(`Faltan columnas obligatorias: ${faltantes.join(', ')}`)
      }

      const procesadas = []
      const errores = []
      const dnisEnArchivo = new Map()

      filas.forEach((fila, indice) => {
        const filaExcel = indice + 2
        const datos = {
          dni: String(fila.DNI || '').trim(),
          nombres: String(fila.Nombres || '').trim(),
          apellidos: String(fila.Apellidos || '').trim(),
          especialidad: String(fila.Especialidad || '').trim(),
          telefono: String(fila.Telefono || '').trim(),
          correo: String(fila.Correo || '').trim(),
          activo: normalizarActivo(fila.Activo),
        }

        const erroresFila = []

        if (!datos.dni) erroresFila.push('DNI vacío')
        if (!datos.nombres) erroresFila.push('Nombres vacío')
        if (!datos.apellidos) erroresFila.push('Apellidos vacío')
        if (datos.activo === null) erroresFila.push('Activo debe ser SI o NO')

        const dniClave = datos.dni.toLowerCase()
        if (datos.dni && dnisEnArchivo.has(dniClave)) {
          erroresFila.push(`DNI duplicado en fila ${dnisEnArchivo.get(dniClave)}`)
        } else if (datos.dni) {
          dnisEnArchivo.set(dniClave, filaExcel)
        }

        if (datos.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo)) {
          erroresFila.push('Correo no válido')
        }

        procesadas.push({
          fila: filaExcel,
          ...datos,
          valido: erroresFila.length === 0,
          errores: erroresFila,
        })
      })

      setFilasExcel(procesadas)
      setErroresExcel(errores)

      if (!procesadas.length) {
        throw new Error('No se encontraron registros válidos para revisar.')
      }

      setModalImportacion(true)
    } catch (error) {
      console.error(error)
      mostrarMensaje(error.message || 'No se pudo leer el archivo Excel.', 'error')
      setModalImportacion(false)
    }
  }

  const seleccionarExcel = () => inputExcelRef.current?.click()

  const manejarArchivo = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls'].includes(extension)) {
      mostrarMensaje('Selecciona un archivo Excel .xlsx o .xls.', 'error')
      return
    }

    procesarArchivoExcel(file)
  }

  const importarValidos = async () => {
    const validos = filasExcel.filter((fila) => fila.valido)

    if (!validos.length) {
      mostrarMensaje('No hay filas válidas para importar.', 'error')
      return
    }

    setImportando(true)

    const { data, error } = await supabase.rpc('importar_docentes_excel', {
      p_institucion_id: profile.institucion_id,
      p_docentes: validos.map((fila) => ({
        dni: fila.dni,
        nombres: fila.nombres,
        apellidos: fila.apellidos,
        especialidad: fila.especialidad || null,
        telefono: fila.telefono || null,
        correo: fila.correo || null,
        activo: fila.activo,
      })),
    })

    setImportando(false)

    if (error) {
      console.error(error)
      mostrarMensaje(error.message || 'No se pudo importar el archivo.', 'error')
      return
    }

    setResultadoImportacion(data)
    await cargarDocentes()
  }

  const cerrarImportacion = () => {
    if (importando) return
    setModalImportacion(false)
    setFilasExcel([])
    setArchivoNombre('')
    setResultadoImportacion(null)
  }

  return (
    <div className="docentes-page">
      <input
        ref={inputExcelRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={manejarArchivo}
        style={{ display: 'none' }}
      />

      <div className="docentes-page-header">
        <div className="docentes-title-row">
          <div className="docentes-title-icon"><Users size={24} /></div>
          <div>
            <h1>Docentes</h1>
            <p>Gestión del personal docente de la institución</p>
          </div>
        </div>

        <div className="docentes-header-actions">
          <button type="button" className="docentes-outline-button" onClick={descargarPlantilla}>
            <Download size={18} />
            Descargar plantilla
          </button>

          <button type="button" className="docentes-outline-button" onClick={seleccionarExcel}>
            <Upload size={18} />
            Importar Excel
          </button>

          <button type="button" className="docentes-primary-button" onClick={abrirNuevo}>
            <Plus size={19} />
            Nuevo docente
          </button>
        </div>
      </div>

      {mensaje && (
        <div className={`docentes-message ${tipoMensaje}`}>
          {tipoMensaje === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          {mensaje}
        </div>
      )}

      <div className="docentes-stats">
        <div className="docentes-stat-card">
          <div className="docentes-stat-icon total"><Users size={21} /></div>
          <div><span>Total docentes</span><strong>{docentes.length}</strong></div>
        </div>
        <div className="docentes-stat-card">
          <div className="docentes-stat-icon activos"><UserCheck size={21} /></div>
          <div><span>Activos</span><strong>{totalActivos}</strong></div>
        </div>
        <div className="docentes-stat-card">
          <div className="docentes-stat-icon inactivos"><UserX size={21} /></div>
          <div><span>Inactivos</span><strong>{totalInactivos}</strong></div>
        </div>
      </div>

      <div className="docentes-card">
        <div className="docentes-toolbar">
          <div className="docentes-search">
            <Search size={18} />
            <input
              type="text"
              placeholder="Buscar por DNI, nombres, apellidos o especialidad..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <div className="docentes-filters">
            {[
              ['activos', 'Activos'],
              ['inactivos', 'Inactivos'],
              ['todos', 'Todos'],
            ].map(([valor, texto]) => (
              <button
                key={valor}
                type="button"
                className={filtroEstado === valor ? 'active' : ''}
                onClick={() => setFiltroEstado(valor)}
              >
                {texto}
              </button>
            ))}
          </div>
        </div>

        <div className="docentes-table-wrapper">
          {cargando ? (
            <div className="docentes-empty">Cargando docentes...</div>
          ) : docentesFiltrados.length === 0 ? (
            <div className="docentes-empty">
              <Users size={38} />
              <strong>No hay docentes para mostrar</strong>
              <span>Prueba otro filtro o registra un nuevo docente.</span>
            </div>
          ) : (
            <table className="docentes-table">
              <thead>
                <tr>
                  <th>DNI</th>
                  <th>Apellidos y nombres</th>
                  <th>Especialidad</th>
                  <th>Teléfono</th>
                  <th>Correo</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {docentesFiltrados.map((docente) => (
                  <tr key={docente.id}>
                    <td className="docentes-dni">{docente.dni}</td>
                    <td>
                      <div className="docente-name">
                        <div className="docente-avatar">
                          {(docente.nombres?.[0] || '')}{(docente.apellidos?.[0] || '')}
                        </div>
                        <strong>{docente.apellidos}, {docente.nombres}</strong>
                      </div>
                    </td>
                    <td>{docente.especialidad || <span className="docentes-muted">Sin especificar</span>}</td>
                    <td>{docente.telefono || <span className="docentes-muted">—</span>}</td>
                    <td>{docente.correo || <span className="docentes-muted">—</span>}</td>
                    <td>
                      <span className={`docentes-status ${docente.activo ? 'activo' : 'inactivo'}`}>
                        {docente.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div className="docentes-actions">
                        <button type="button" title="Editar" onClick={() => abrirEditar(docente)}>
                          <Pencil size={17} />
                        </button>
                        <button type="button" title={docente.activo ? 'Desactivar' : 'Activar'} onClick={() => cambiarEstado(docente)}>
                          {docente.activo ? <UserX size={17} /> : <UserCheck size={17} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!cargando && (
          <div className="docentes-table-footer">
            Mostrando {docentesFiltrados.length} de {docentes.length} docentes
          </div>
        )}
      </div>

      {modalAbierto && (
        <div className="docentes-modal-overlay">
          <div className="docentes-modal">
            <div className="docentes-modal-header">
              <div>
                <h2>{docenteEditando ? 'Editar docente' : 'Nuevo docente'}</h2>
                <p>{docenteEditando ? 'Actualiza los datos del docente.' : 'Registra los datos del docente.'}</p>
              </div>
              <button type="button" onClick={cerrarModal} disabled={guardando}><X size={20} /></button>
            </div>

            <form onSubmit={guardarDocente}>
              <div className="docentes-form-grid">
                {[
                  ['dni', 'DNI', true],
                  ['nombres', 'Nombres', true],
                  ['apellidos', 'Apellidos', true],
                  ['especialidad', 'Especialidad', false],
                  ['telefono', 'Teléfono', false],
                  ['correo', 'Correo', false],
                ].map(([campo, etiqueta, requerido]) => (
                  <div className="docentes-field" key={campo}>
                    <label>{etiqueta} {requerido && <span>*</span>}</label>
                    <input
                      type={campo === 'correo' ? 'email' : 'text'}
                      value={formulario[campo]}
                      onChange={(e) => setFormulario({ ...formulario, [campo]: e.target.value })}
                      required={requerido}
                    />
                  </div>
                ))}

                <div className="docentes-field docentes-field-full">
                  <label className="docentes-checkbox">
                    <input
                      type="checkbox"
                      checked={formulario.activo}
                      onChange={(e) => setFormulario({ ...formulario, activo: e.target.checked })}
                    />
                    <span>Docente activo</span>
                  </label>
                </div>
              </div>

              <div className="docentes-modal-footer">
                <button type="button" className="docentes-secondary-button" onClick={cerrarModal} disabled={guardando}>
                  Cancelar
                </button>
                <button type="submit" className="docentes-primary-button" disabled={guardando}>
                  <Save size={18} />
                  {guardando ? 'Guardando...' : 'Guardar docente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalImportacion && (
        <div className="docentes-modal-overlay">
          <div className="docentes-modal docentes-import-modal">
            <div className="docentes-modal-header">
              <div>
                <h2><FileSpreadsheet size={21} /> Importar docentes</h2>
                <p>{archivoNombre}</p>
              </div>
              <button type="button" onClick={cerrarImportacion} disabled={importando}><X size={20} /></button>
            </div>

            {!resultadoImportacion ? (
              <>
                <div className="docentes-import-summary">
                  <div><strong>{filasExcel.length}</strong><span>Filas leídas</span></div>
                  <div className="ok"><strong>{filasExcel.filter((f) => f.valido).length}</strong><span>Válidas</span></div>
                  <div className="bad"><strong>{filasExcel.filter((f) => !f.valido).length}</strong><span>Con errores</span></div>
                </div>

                <div className="docentes-import-table-wrapper">
                  <table className="docentes-table docentes-import-table">
                    <thead>
                      <tr>
                        <th>Fila</th>
                        <th>DNI</th>
                        <th>Apellidos y nombres</th>
                        <th>Especialidad</th>
                        <th>Activo</th>
                        <th>Resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filasExcel.slice(0, 100).map((fila) => (
                        <tr key={fila.fila}>
                          <td>{fila.fila}</td>
                          <td>{fila.dni || '—'}</td>
                          <td>{fila.apellidos}, {fila.nombres}</td>
                          <td>{fila.especialidad || '—'}</td>
                          <td>{fila.activo === true ? 'Sí' : fila.activo === false ? 'No' : '—'}</td>
                          <td>
                            {fila.valido ? (
                              <span className="docentes-status activo">Válido</span>
                            ) : (
                              <span className="docentes-error-text">{fila.errores.join('; ')}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filasExcel.length > 100 && (
                    <div className="docentes-preview-note">Vista previa limitada a las primeras 100 filas.</div>
                  )}
                </div>

                <div className="docentes-modal-footer">
                  <button type="button" className="docentes-secondary-button" onClick={cerrarImportacion} disabled={importando}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="docentes-primary-button"
                    onClick={importarValidos}
                    disabled={importando || !filasExcel.some((f) => f.valido)}
                  >
                    <Upload size={18} />
                    {importando ? 'Importando...' : `Importar ${filasExcel.filter((f) => f.valido).length} docentes válidos`}
                  </button>
                </div>
              </>
            ) : (
              <div className="docentes-import-result">
                <CheckCircle2 size={48} />
                <h3>Importación terminada</h3>
                <p>Los docentes válidos fueron procesados.</p>

                <div className="docentes-result-grid">
                  <div><strong>{resultadoImportacion.importados ?? 0}</strong><span>Importados</span></div>
                  <div><strong>{resultadoImportacion.ya_existian ?? 0}</strong><span>Ya existían</span></div>
                  <div><strong>{resultadoImportacion.errores ?? 0}</strong><span>Con error</span></div>
                </div>

                {Array.isArray(resultadoImportacion.detalles) && resultadoImportacion.detalles.length > 0 && (
                  <div className="docentes-result-errors">
                    {resultadoImportacion.detalles.slice(0, 20).map((detalle, index) => (
                      <div key={index}>
                        <strong>{detalle.dni || 'Registro'}:</strong> {detalle.mensaje || detalle.error || 'Error'}
                      </div>
                    ))}
                  </div>
                )}

                <div className="docentes-modal-footer">
                  <button type="button" className="docentes-primary-button" onClick={cerrarImportacion}>
                    Cerrar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Docentes
