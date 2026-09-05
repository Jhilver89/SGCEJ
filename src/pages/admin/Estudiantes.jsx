import { useEffect, useState } from 'react'
import { Plus, Search, Pencil, X, UserRound, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import './Estudiantes.css'

const formularioInicial = {
  dni: '',
  nombres: '',
  apellidos: '',
  fecha_nacimiento: '',
  sexo: '',
  direccion: '',
  telefono: '',
  correo: '',
  apoderado_nombre: '',
  apoderado_telefono: '',
  activo: true,
}

function Estudiantes() {
  const [estudiantes, setEstudiantes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(formularioInicial)

  const [showImport, setShowImport] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState('')
  const [importMessage, setImportMessage] = useState('')
  const [importRows, setImportRows] = useState([])
  const [importFileName, setImportFileName] = useState('')
  const [importStats, setImportStats] = useState(null)
  const [importPagina, setImportPagina] = useState(1)
  const importPorPagina = 50

  const cargarEstudiantes = async () => {
    setLoading(true)
    setError('')

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError
      if (!user) {
        throw new Error('No se encontró el usuario autenticado.')
      }

      const { data: perfil, error: perfilError } = await supabase
        .from('perfiles')
        .select('institucion_id')
        .eq('id', user.id)
        .single()

      if (perfilError) throw perfilError

      const { data, error: estudiantesError } = await supabase
        .from('estudiantes')
        .select(`
          id,
          dni,
          nombres,
          apellidos,
          fecha_nacimiento,
          sexo,
          direccion,
          telefono,
          correo,
          apoderado_nombre,
          apoderado_telefono,
          activo,
          created_at
        `)
        .eq('institucion_id', perfil.institucion_id)
        .order('apellidos', { ascending: true })

      if (estudiantesError) throw estudiantesError

      setEstudiantes(data || [])
    } catch (err) {
      console.error(err)
      setError(
        err.message || 'No se pudieron cargar los estudiantes.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarEstudiantes()
  }, [])

  const abrirNuevo = () => {
    setEditando(null)
    setForm({ ...formularioInicial })
    setError('')
    setMensaje('')
    setShowForm(true)
  }

  const abrirEditar = (estudiante) => {
    setEditando(estudiante)

    setForm({
      dni: estudiante.dni || '',
      nombres: estudiante.nombres || '',
      apellidos: estudiante.apellidos || '',
      fecha_nacimiento: estudiante.fecha_nacimiento || '',
      sexo: estudiante.sexo || '',
      direccion: estudiante.direccion || '',
      telefono: estudiante.telefono || '',
      correo: estudiante.correo || '',
      apoderado_nombre: estudiante.apoderado_nombre || '',
      apoderado_telefono: estudiante.apoderado_telefono || '',
      activo: estudiante.activo ?? true,
    })

    setError('')
    setMensaje('')
    setShowForm(true)
  }

  const cerrarFormulario = () => {
    if (saving) return

    setShowForm(false)
    setEditando(null)
    setForm({ ...formularioInicial })
    setError('')
    setMensaje('')
  }

  const cambiarCampo = (e) => {
    const { name, value, type, checked } = e.target

    setForm((actual) => ({
      ...actual,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const guardarEstudiante = async (e) => {
    e.preventDefault()

    setError('')
    setMensaje('')

    if (!form.dni.trim()) {
      setError('El DNI es obligatorio.')
      return
    }

    if (!/^\d{8}$/.test(form.dni.trim())) {
      setError('El DNI debe tener exactamente 8 dígitos.')
      return
    }

    if (!form.nombres.trim()) {
      setError('Los nombres son obligatorios.')
      return
    }

    if (!form.apellidos.trim()) {
      setError('Los apellidos son obligatorios.')
      return
    }

    setSaving(true)

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError

      if (!user) {
        throw new Error('No se encontró el usuario autenticado.')
      }

      const { data: perfil, error: perfilError } = await supabase
        .from('perfiles')
        .select('institucion_id')
        .eq('id', user.id)
        .single()

      if (perfilError) throw perfilError

      const datos = {
        institucion_id: perfil.institucion_id,
        dni: form.dni.trim(),
        nombres: form.nombres.trim().toUpperCase(),
        apellidos: form.apellidos.trim().toUpperCase(),
        fecha_nacimiento: form.fecha_nacimiento || null,
        sexo: form.sexo || null,
        direccion: form.direccion.trim() || null,
        telefono: form.telefono.trim() || null,
        correo: form.correo.trim() || null,
        apoderado_nombre: form.apoderado_nombre.trim() || null,
        apoderado_telefono:
          form.apoderado_telefono.trim() || null,
        activo: form.activo,
      }

      if (editando) {
        const { error: updateError } = await supabase
          .from('estudiantes')
          .update(datos)
          .eq('id', editando.id)

        if (updateError) {
          if (updateError.code === '23505') {
            throw new Error(
              'Ya existe otro estudiante con ese DNI.'
            )
          }

          throw updateError
        }

        setMensaje('Estudiante actualizado correctamente.')
      } else {
        const { error: insertError } = await supabase
          .from('estudiantes')
          .insert(datos)

        if (insertError) {
          if (insertError.code === '23505') {
            throw new Error(
              'Ya existe un estudiante con ese DNI.'
            )
          }

          throw insertError
        }

        setMensaje('Estudiante registrado correctamente.')
      }

      await cargarEstudiantes()

      setTimeout(() => {
        cerrarFormulario()
      }, 700)
    } catch (err) {
      console.error(err)
      setError(
        err.message || 'No se pudo guardar el estudiante.'
      )
    } finally {
      setSaving(false)
    }
  }

  const normalizarEncabezado = (valor) => {
    return String(valor ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\s_-]+/g, '')
  }

  const valorTexto = (valor) => {
    if (valor === null || valor === undefined) return ''
    return String(valor).trim()
  }

  const convertirFechaExcel = (valor) => {
    if (!valor) return ''
    if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
      return valor.toISOString().slice(0, 10)
    }
    if (typeof valor === 'number') {
      const fecha = XLSX.SSF.parse_date_code(valor)
      if (fecha?.y && fecha?.m && fecha?.d) {
        return `${fecha.y}-${String(fecha.m).padStart(2, '0')}-${String(fecha.d).padStart(2, '0')}`
      }
    }
    const texto = valorTexto(valor)
    if (!texto) return ''
    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto
    const m = texto.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/)
    if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
    return texto
  }

  const abrirImportador = () => {
    setImportError('')
    setImportMessage('')
    setImportRows([])
    setImportStats(null)
    setImportPagina(1)
    setImportFileName('')
    setShowImport(true)
  }

  const cerrarImportador = () => {
    if (importLoading) return
    setShowImport(false)
    setImportError('')
    setImportMessage('')
    setImportRows([])
    setImportStats(null)
    setImportPagina(1)
    setImportFileName('')
  }

  const procesarExcel = async (event) => {
    const archivo = event.target.files?.[0]
    event.target.value = ''
    if (!archivo) return

    setImportLoading(true)
    setImportError('')
    setImportMessage('')
    setImportRows([])
    setImportStats(null)
    setImportPagina(1)
    setImportFileName(archivo.name)

    try {
      const buffer = await archivo.arrayBuffer()
      const libro = XLSX.read(buffer, { type: 'array', cellDates: true })
      const nombreHoja = libro.SheetNames[0]
      if (!nombreHoja) throw new Error('El archivo Excel no contiene hojas.')

      const hoja = libro.Sheets[nombreHoja]
      const matriz = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '' })
      if (!matriz.length) throw new Error('La hoja está vacía.')

      const filaEncabezados = matriz.findIndex((fila) =>
        fila.some((celda) => normalizarEncabezado(celda) === 'dni')
      )
      if (filaEncabezados < 0) {
        throw new Error('No se encontró la columna DNI. Usa la plantilla de importación del SGCE.')
      }

      const encabezados = matriz[filaEncabezados].map(normalizarEncabezado)
      const indice = {}
      encabezados.forEach((nombre, i) => {
        if (nombre && indice[nombre] === undefined) indice[nombre] = i
      })

      const requeridos = [
        ['dni', 'DNI'],
        ['nombres', 'Nombres'],
        ['apellidos', 'Apellidos'],
      ]
      const faltantes = requeridos.filter(([clave]) => indice[normalizarEncabezado(clave)] === undefined)
      if (faltantes.length) {
        throw new Error(`Faltan columnas obligatorias: ${faltantes.map(([, nombre]) => nombre).join(', ')}.`)
      }

      const get = (fila, ...nombres) => {
        for (const nombre of nombres) {
          const i = indice[normalizarEncabezado(nombre)]
          if (i !== undefined) return fila[i]
        }
        return ''
      }

      const filas = []
      for (let i = filaEncabezados + 1; i < matriz.length; i += 1) {
        const fila = matriz[i]
        const vacia = fila.every((celda) => valorTexto(celda) === '')
        if (vacia) continue

        const numeroFila = i + 1
        const dni = valorTexto(get(fila, 'DNI')).replace(/\.0$/, '')
        const nombres = valorTexto(get(fila, 'Nombres'))
        const apellidos = valorTexto(get(fila, 'Apellidos'))
        const sexo = valorTexto(get(fila, 'Sexo')).toUpperCase()
        const fecha = convertirFechaExcel(get(fila, 'Fecha_nacimiento', 'Fecha nacimiento'))
        const errores = []

        if (!/^\d{8}$/.test(dni)) errores.push('DNI inválido: debe tener 8 dígitos.')
        if (!nombres) errores.push('Faltan los nombres.')
        if (!apellidos) errores.push('Faltan los apellidos.')
        if (sexo && !['M', 'F'].includes(sexo)) errores.push('Sexo inválido: usa M o F.')
        if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) errores.push('Fecha de nacimiento inválida.')

        filas.push({
          fila: numeroFila,
          dni,
          nombres: nombres.toUpperCase(),
          apellidos: apellidos.toUpperCase(),
          fecha_nacimiento: fecha || '',
          sexo: sexo || '',
          direccion: valorTexto(get(fila, 'Direccion', 'Dirección')),
          telefono: valorTexto(get(fila, 'Telefono', 'Teléfono')),
          correo: valorTexto(get(fila, 'Correo')),
          apoderado_nombre: valorTexto(get(fila, 'Apoderado_nombres', 'Apoderado_nombre', 'Apoderado nombres')),
          apoderado_telefono: valorTexto(get(fila, 'Apoderado_telefono', 'Apoderado teléfono')),
          año_escolar: valorTexto(get(fila, 'Año_escolar', 'Año escolar')),
          nivel: valorTexto(get(fila, 'Nivel')),
          grado: valorTexto(get(fila, 'Grado')),
          seccion: valorTexto(get(fila, 'Seccion', 'Sección')),
          estado_matricula: valorTexto(get(fila, 'Estado_matricula', 'Estado matrícula')) || 'matriculado',
          errores,
          estado: errores.length ? 'error' : 'valido',
        })
      }

      const vistos = new Set()
      filas.forEach((row) => {
        if (!row.dni) return
        if (vistos.has(row.dni)) {
          row.errores.push('DNI repetido dentro del archivo.')
          row.estado = 'error'
        } else {
          vistos.add(row.dni)
        }
      })

      const dnis = [...new Set(filas.map((row) => row.dni).filter(Boolean))]
      if (dnis.length) {
        const { data: existentes, error: existentesError } = await supabase
          .from('estudiantes')
          .select('dni')
          .in('dni', dnis)

        if (existentesError) throw existentesError
        const dnisExistentes = new Set((existentes ?? []).map((item) => item.dni))
        filas.forEach((row) => {
          if (dnisExistentes.has(row.dni) && row.estado === 'valido') {
            row.errores.push('El estudiante ya existe en la institución.')
            row.estado = 'existente'
          }
        })
      }

      const validos = filas.filter((row) => row.estado === 'valido').length
      const errores = filas.filter((row) => row.estado === 'error').length
      const existentes = filas.filter((row) => row.estado === 'existente').length
      setImportRows(filas)
      setImportStats({ total: filas.length, validos, errores, existentes })
    } catch (err) {
      console.error(err)
      setImportError(err.message || 'No se pudo procesar el archivo Excel.')
    } finally {
      setImportLoading(false)
    }
  }

  const confirmarImportacion = async () => {
    const validos = importRows.filter((row) => row.estado === 'valido')
    if (!validos.length) {
      setImportError('No hay estudiantes nuevos y válidos para importar.')
      return
    }

    setImportLoading(true)
    setImportError('')
    setImportMessage('')

    try {
      const datosImportacion = validos.map((row) => ({
        dni: row.dni,
        nombres: row.nombres,
        apellidos: row.apellidos,
        fecha_nacimiento: row.fecha_nacimiento || null,
        sexo: row.sexo || null,
        direccion: row.direccion || null,
        telefono: row.telefono || null,
        correo: row.correo || null,
        apoderado_nombre: row.apoderado_nombre || null,
        apoderado_telefono: row.apoderado_telefono || null,
        año_escolar: row.año_escolar || '',
        nivel: row.nivel || '',
        grado: row.grado || '',
        seccion: row.seccion || '',
        estado_matricula: row.estado_matricula || 'matriculado',
      }))

      const { data: resultado, error: importErrorRpc } = await supabase
        .rpc('importar_estudiantes_excel', {
          p_estudiantes: datosImportacion,
        })

      if (importErrorRpc) {
        if (importErrorRpc.code === '23505') {
          throw new Error('Uno o más DNI ya fueron registrados. Vuelve a procesar el Excel para actualizar la vista previa.')
        }
        throw importErrorRpc
      }

      const cantidad = resultado?.importados ?? validos.length
      const propuestas = resultado?.propuestas_matricula ?? cantidad

      setImportMessage(
        `${cantidad} estudiante${cantidad !== 1 ? 's' : ''} importado${cantidad !== 1 ? 's' : ''} correctamente. Se conservaron sus datos de año, nivel, grado y sección para Matrículas (${propuestas} propuesta${propuestas !== 1 ? 's' : ''}).`
      )

      await cargarEstudiantes()
      setImportRows((actual) => actual.map((row) =>
        row.estado === 'valido' ? { ...row, estado: 'importado' } : row
      ))
      setImportStats((actual) => actual
        ? { ...actual, importados: cantidad, propuestas, validos: 0 }
        : actual
      )
    } catch (err) {
      console.error(err)
      setImportError(err.message || 'No se pudo completar la importación.')
    } finally {
      setImportLoading(false)
    }
  }

  const estudiantesFiltrados = estudiantes.filter((estudiante) => {
    const texto = busqueda.toLowerCase().trim()

    if (!texto) return true

    return (
      estudiante.dni?.toLowerCase().includes(texto) ||
      estudiante.nombres?.toLowerCase().includes(texto) ||
      estudiante.apellidos?.toLowerCase().includes(texto)
    )
  })

  const importTotalPaginas = Math.max(1, Math.ceil(importRows.length / importPorPagina))
  const importPaginaActual = Math.min(importPagina, importTotalPaginas)
  const importInicio = (importPaginaActual - 1) * importPorPagina
  const importFilasPagina = importRows.slice(importInicio, importInicio + importPorPagina)

  const formatearFecha = (fecha) => {
    if (!fecha) return '-'

    const [anio, mes, dia] = fecha.split('-')

    if (!anio || !mes || !dia) return fecha

    return `${dia}/${mes}/${anio}`
  }

  return (
    <div className="estudiantes-page">

      <div className="estudiantes-header">
        <div className="titulo-con-icono">
          <div className="titulo-icono">
            <UserRound size={22} />
          </div>

          <div>
            <h2>Estudiantes</h2>
            <p>
              Gestión de estudiantes de la institución educativa.
            </p>
          </div>
        </div>

        <div className="acciones-header">
          <button
            className="btn-secundario"
            type="button"
            onClick={abrirImportador}
          >
            <Upload size={18} />
            Importar Excel
          </button>

          <button
            className="btn-principal"
            type="button"
            onClick={abrirNuevo}
          >
            <Plus size={18} />
            Nuevo estudiante
          </button>
        </div>
      </div>

      {error && !showForm && (
        <div className="alerta alerta-error">
          {error}
        </div>
      )}

      <div className="estudiantes-card">

        <div className="barra-herramientas">
          <div className="buscador">
            <Search size={18} />

            <input
              type="text"
              placeholder="Buscar por DNI, nombres o apellidos..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <div className="contador-estudiantes">
            {estudiantesFiltrados.length} estudiante
            {estudiantesFiltrados.length !== 1 ? 's' : ''}
          </div>
        </div>

        {loading ? (
          <div className="estado-vacio">
            Cargando estudiantes...
          </div>
        ) : estudiantesFiltrados.length === 0 ? (
          <div className="estado-vacio">
            <UserRound size={42} />

            <h3>No hay estudiantes</h3>

            {busqueda ? (
              <p>
                No se encontraron resultados para la búsqueda.
              </p>
            ) : (
              <p>
                Registra el primer estudiante para comenzar.
              </p>
            )}

            {!busqueda && (
              <button
                className="btn-principal"
                type="button"
                onClick={abrirNuevo}
              >
                <Plus size={18} />
                Registrar estudiante
              </button>
            )}
          </div>
        ) : (
          <div className="tabla-contenedor">
            <table className="tabla-estudiantes">
              <thead>
                <tr>
                  <th>DNI</th>
                  <th>Apellidos y nombres</th>
                  <th>Fecha nacimiento</th>
                  <th>Sexo</th>
                  <th>Teléfono</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {estudiantesFiltrados.map((estudiante) => (
                  <tr key={estudiante.id}>

                    <td>
                      <strong>{estudiante.dni || '-'}</strong>
                    </td>

                    <td>
                      <div className="nombre-estudiante">
                        {estudiante.apellidos},{' '}
                        {estudiante.nombres}
                      </div>
                    </td>

                    <td>
                      {formatearFecha(
                        estudiante.fecha_nacimiento
                      )}
                    </td>

                    <td>
                      {estudiante.sexo || '-'}
                    </td>

                    <td>
                      {estudiante.telefono || '-'}
                    </td>

                    <td>
                      <span
                        className={
                          estudiante.activo
                            ? 'estado-badge activo'
                            : 'estado-badge inactivo'
                        }
                      >
                        {estudiante.activo
                          ? 'Activo'
                          : 'Inactivo'}
                      </span>
                    </td>

                    <td>
                      <button
                        className="btn-icono"
                        type="button"
                        title="Editar estudiante"
                        onClick={() =>
                          abrirEditar(estudiante)
                        }
                      >
                        <Pencil size={17} />
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showImport && (
        <div className="modal-fondo">
          <div className="modal-estudiante modal-importacion">
            <div className="modal-header">
              <div>
                <h3>Importar estudiantes desde Excel</h3>
                <p>Selecciona el archivo, revisa la validación y confirma la importación.</p>
              </div>
              <button className="btn-cerrar" type="button" onClick={cerrarImportador} disabled={importLoading}>
                <X size={20} />
              </button>
            </div>

            {importError && <div className="alerta alerta-error">{importError}</div>}
            {importMessage && <div className="alerta alerta-exito">{importMessage}</div>}

            <div className="importacion-carga">
              <FileSpreadsheet size={32} />
              <div>
                <strong>Selecciona tu archivo Excel</strong>
                <p>Se aceptan .xlsx, .xls y .csv. Los datos académicos quedarán preparados para Matrículas.</p>
              </div>
              <label className="btn-principal boton-archivo">
                <Upload size={18} />
                Seleccionar archivo
                <input type="file" accept=".xlsx,.xls,.csv" onChange={procesarExcel} disabled={importLoading} hidden />
              </label>
            </div>

            {importFileName && <div className="archivo-seleccionado">Archivo: <strong>{importFileName}</strong></div>}

            {importLoading && <div className="estado-vacio">Procesando...</div>}

            {importStats && !importLoading && (
              <>
                <div className="importacion-resumen">
                  <div className="resumen-item"><strong className="resumen-numero">{importStats.total}</strong><span className="resumen-label">Total</span></div>
                  <div className="resumen-item"><strong className="resumen-numero">{importStats.validos}</strong><span className="resumen-label">Nuevos válidos</span></div>
                  <div className="resumen-item"><strong className="resumen-numero">{importStats.existentes}</strong><span className="resumen-label">Ya existentes</span></div>
                  <div className="resumen-item"><strong className="resumen-numero">{importStats.errores}</strong><span className="resumen-label">Con errores</span></div>
                  {importStats.importados !== undefined && <div className="resumen-item"><strong className="resumen-numero">{importStats.importados}</strong><span className="resumen-label">Importados</span></div>}
                </div>

                <div className="importacion-nota">
                  <AlertTriangle size={17} />
                  Los estudiantes existentes y los registros con errores se omiten. Año, nivel, grado y sección se guardarán como propuesta de matrícula para revisarlos y confirmarlos posteriormente.
                </div>

                <div className="tabla-importacion">
                  <div className="tabla-importacion-scroll">
                    <table className="tabla-estudiantes">
                      <thead>
                        <tr><th>Fila</th><th>DNI</th><th>Apellidos y nombres</th><th>Año</th><th>Nivel</th><th>Grado</th><th>Sección</th><th>Resultado</th></tr>
                      </thead>
                      <tbody>
                        {importFilasPagina.map((row) => (
                          <tr key={`${row.fila}-${row.dni}`}>
                            <td>{row.fila}</td>
                            <td><strong>{row.dni || '-'}</strong></td>
                            <td>{row.apellidos}, {row.nombres}</td>
                            <td>{row.año_escolar || '-'}</td>
                            <td>{row.nivel || '-'}</td>
                            <td>{row.grado || '-'}</td>
                            <td>{row.seccion || '-'}</td>
                            <td>
                              {row.estado === 'valido' && <span className="import-resultado valido"><CheckCircle2 size={15} /> Válido</span>}
                              {row.estado === 'existente' && <span className="import-resultado existente">Ya existe</span>}
                              {row.estado === 'importado' && <span className="import-resultado valido"><CheckCircle2 size={15} /> Importado</span>}
                              {row.estado === 'error' && <span className="import-resultado error"><AlertTriangle size={15} /> {row.errores.join(' ')}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {importRows.length > importPorPagina && (
                    <div className="importacion-paginacion">
                      <span className="paginacion-info">
                        Mostrando {importInicio + 1}-{Math.min(importInicio + importPorPagina, importRows.length)} de {importRows.length} registros
                      </span>
                      <div className="paginacion-controles">
                        <button
                          type="button"
                          className="paginacion-boton"
                          onClick={() => setImportPagina((pagina) => Math.max(1, pagina - 1))}
                          disabled={importPaginaActual === 1}
                        >
                          Anterior
                        </button>
                        <span className="paginacion-pagina">
                          Página {importPaginaActual} de {importTotalPaginas}
                        </span>
                        <button
                          type="button"
                          className="paginacion-boton"
                          onClick={() => setImportPagina((pagina) => Math.min(importTotalPaginas, pagina + 1))}
                          disabled={importPaginaActual === importTotalPaginas}
                        >
                          Siguiente
                        </button>
                      </div>
                    </div>
                  )}

                  {importRows.length > 0 && (
                    <div className="importacion-validacion-total">
                      La validación se realizó sobre los {importRows.length} registros completos del archivo.
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="modal-footer">
              <button className="btn-cancelar" type="button" onClick={cerrarImportador} disabled={importLoading}>Cerrar</button>
              <button className="btn-principal" type="button" onClick={confirmarImportacion} disabled={importLoading || !importStats?.validos}>
                {importLoading ? 'Importando...' : `Importar ${importStats?.validos || 0} estudiantes`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-fondo">
          <div className="modal-estudiante">

            <div className="modal-header">
              <div>
                <h3>
                  {editando
                    ? 'Editar estudiante'
                    : 'Nuevo estudiante'}
                </h3>

                <p>
                  {editando
                    ? 'Actualiza los datos del estudiante.'
                    : 'Ingresa los datos del estudiante.'}
                </p>
              </div>

              <button
                className="btn-cerrar"
                type="button"
                onClick={cerrarFormulario}
                disabled={saving}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={guardarEstudiante}>

              {error && (
                <div className="alerta alerta-error">
                  {error}
                </div>
              )}

              {mensaje && (
                <div className="alerta alerta-exito">
                  {mensaje}
                </div>
              )}

              <div className="form-grid">

                <div className="campo">
                  <label htmlFor="dni">
                    DNI *
                  </label>

                  <input
                    id="dni"
                    name="dni"
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    value={form.dni}
                    onChange={cambiarCampo}
                    placeholder="12345678"
                    disabled={saving}
                  />
                </div>

                <div className="campo">
                  <label htmlFor="fecha_nacimiento">
                    Fecha de nacimiento
                  </label>

                  <input
                    id="fecha_nacimiento"
                    name="fecha_nacimiento"
                    type="date"
                    value={form.fecha_nacimiento}
                    onChange={cambiarCampo}
                    disabled={saving}
                  />
                </div>

                <div className="campo campo-completo">
                  <label htmlFor="nombres">
                    Nombres *
                  </label>

                  <input
                    id="nombres"
                    name="nombres"
                    type="text"
                    value={form.nombres}
                    onChange={cambiarCampo}
                    placeholder="Nombres del estudiante"
                    disabled={saving}
                  />
                </div>

                <div className="campo campo-completo">
                  <label htmlFor="apellidos">
                    Apellidos *
                  </label>

                  <input
                    id="apellidos"
                    name="apellidos"
                    type="text"
                    value={form.apellidos}
                    onChange={cambiarCampo}
                    placeholder="Apellidos del estudiante"
                    disabled={saving}
                  />
                </div>

                <div className="campo">
                  <label htmlFor="sexo">
                    Sexo
                  </label>

                  <select
                    id="sexo"
                    name="sexo"
                    value={form.sexo}
                    onChange={cambiarCampo}
                    disabled={saving}
                  >
                    <option value="">
                      Seleccionar
                    </option>
                    <option value="M">
                      Masculino
                    </option>
                    <option value="F">
                      Femenino
                    </option>
                  </select>
                </div>

                <div className="campo">
                  <label htmlFor="telefono">
                    Teléfono
                  </label>

                  <input
                    id="telefono"
                    name="telefono"
                    type="text"
                    value={form.telefono}
                    onChange={cambiarCampo}
                    placeholder="987654321"
                    disabled={saving}
                  />
                </div>

                <div className="campo campo-completo">
                  <label htmlFor="correo">
                    Correo
                  </label>

                  <input
                    id="correo"
                    name="correo"
                    type="email"
                    value={form.correo}
                    onChange={cambiarCampo}
                    placeholder="correo@ejemplo.com"
                    disabled={saving}
                  />
                </div>

                <div className="campo campo-completo">
                  <label htmlFor="direccion">
                    Dirección
                  </label>

                  <input
                    id="direccion"
                    name="direccion"
                    type="text"
                    value={form.direccion}
                    onChange={cambiarCampo}
                    placeholder="Dirección del estudiante"
                    disabled={saving}
                  />
                </div>

                <div className="separador-form">
                  <span>
                    Información del apoderado
                  </span>
                </div>

                <div className="campo campo-completo">
                  <label htmlFor="apoderado_nombre">
                    Nombre del apoderado
                  </label>

                  <input
                    id="apoderado_nombre"
                    name="apoderado_nombre"
                    type="text"
                    value={form.apoderado_nombre}
                    onChange={cambiarCampo}
                    placeholder="Nombre completo del apoderado"
                    disabled={saving}
                  />
                </div>

                <div className="campo">
                  <label htmlFor="apoderado_telefono">
                    Teléfono del apoderado
                  </label>

                  <input
                    id="apoderado_telefono"
                    name="apoderado_telefono"
                    type="text"
                    value={form.apoderado_telefono}
                    onChange={cambiarCampo}
                    placeholder="987654321"
                    disabled={saving}
                  />
                </div>

                <div className="campo campo-completo checkbox-campo">
                  <label>
                    <input
                      type="checkbox"
                      name="activo"
                      checked={form.activo}
                      onChange={cambiarCampo}
                      disabled={saving}
                    />

                    <span>
                      Estudiante activo
                    </span>
                  </label>
                </div>

              </div>

              <div className="modal-footer">
                <button
                  className="btn-cancelar"
                  type="button"
                  onClick={cerrarFormulario}
                  disabled={saving}
                >
                  Cancelar
                </button>

                <button
                  className="btn-principal"
                  type="submit"
                  disabled={saving}
                >
                  {saving
                    ? 'Guardando...'
                    : editando
                      ? 'Guardar cambios'
                      : 'Registrar estudiante'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  )
}

export default Estudiantes