import { useEffect, useMemo, useState } from 'react'
import {
  DoorOpen,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertTriangle,
  Search,
  X,
  History,
  CalendarDays,
  Clock3,
  UserRound,
  Timer,
  FileText,
  XCircle,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import './Salidas.css'

function Salidas() {
  const { profile } = useAuth()

  const [añoEscolar, setAñoEscolar] = useState(null)
  const [estudiantes, setEstudiantes] = useState([])
  const [motivos, setMotivos] = useState([])
  const [salidasAbiertas, setSalidasAbiertas] = useState([])
  const [solicitudesPendientes, setSolicitudesPendientes] = useState([])

  const [busqueda, setBusqueda] = useState('')
  const [mostrarResultados, setMostrarResultados] = useState(false)
  const [estudianteSeleccionado, setEstudianteSeleccionado] = useState(null)

  const [motivoId, setMotivoId] = useState('')
  const [observacion, setObservacion] = useState('')

  const [salidasHoy, setSalidasHoy] = useState(null)
  const [cargandoSalidas, setCargandoSalidas] = useState(false)
  const [cargando, setCargando] = useState(true)

  const [procesando, setProcesando] = useState(false)
  const [procesandoRetorno, setProcesandoRetorno] = useState(false)
  const [pestaña, setPestaña] = useState('registrar')
  const [fechaHistorial, setFechaHistorial] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date()))
  const [historialSalidas, setHistorialSalidas] = useState([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)

  const [periodosAcademicos, setPeriodosAcademicos] = useState([])
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState('')
  const [rankingSalidas, setRankingSalidas] = useState([])
  const [cargandoRanking, setCargandoRanking] = useState(false)
  const [busquedaRanking, setBusquedaRanking] = useState('')
  const [estudianteRankingSeleccionado, setEstudianteRankingSeleccionado] = useState(null)
  const [detalleEstudianteRanking, setDetalleEstudianteRanking] = useState([])
  const [cargandoDetalleRanking, setCargandoDetalleRanking] = useState(false)

  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    cargarDatos()
  }, [profile?.institucion_id])

  useEffect(() => {
    if (pestaña === 'historial' && añoEscolar?.id) cargarHistorial(fechaHistorial)
    if (pestaña === 'ranking' && añoEscolar?.id && periodoSeleccionado) cargarRanking(periodoSeleccionado)
  }, [pestaña, fechaHistorial, añoEscolar?.id])

  async function cargarDatos() {
    if (!profile?.institucion_id) return

    setCargando(true)
    setError('')

    try {
      const { data: anio, error: anioError } = await supabase
        .from('años_escolares')
        .select('id, nombre, estado')
        .eq('institucion_id', profile.institucion_id)
        .eq('estado', 'activo')
        .order('fecha_inicio', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (anioError) throw anioError
      if (!anio) throw new Error('No existe un año escolar activo.')

      setAñoEscolar(anio)

      const { data: periodosData, error: periodosError } = await supabase
        .from('periodos_academicos')
        .select('id, numero, nombre, fecha_inicio, fecha_fin, estado')
        .eq('año_escolar_id', anio.id)
        .order('numero', { ascending: true })

      if (periodosError) throw periodosError
      setPeriodosAcademicos(periodosData || [])
      if (!periodoSeleccionado && periodosData?.length) {
        const activo = periodosData.find((item) => item.estado === 'activo') || periodosData[0]
        setPeriodoSeleccionado(activo.id)
      }

      const { data: matriculas, error: matriculasError } = await supabase
        .from('matriculas')
        .select('id, estudiante_id, año_escolar_id, seccion_id, estado')
        .eq('año_escolar_id', anio.id)
        .in('estado', ['matriculado', 'promovido'])

      if (matriculasError) throw matriculasError

      const estudianteIds = [
        ...new Set((matriculas || []).map((item) => item.estudiante_id)),
      ]

      let estudiantesData = []

      if (estudianteIds.length > 0) {
        const { data, error: estudiantesError } = await supabase
          .from('estudiantes')
          .select('id, dni, nombres, apellidos, activo')
          .in('id', estudianteIds)
          .eq('activo', true)
          .order('apellidos', { ascending: true })
          .order('nombres', { ascending: true })

        if (estudiantesError) throw estudiantesError
        estudiantesData = data || []
      }

      const estudiantesConMatricula = estudiantesData
        .map((estudiante) => {
          const matricula = (matriculas || []).find(
            (item) => item.estudiante_id === estudiante.id
          )

          return {
            ...estudiante,
            seccion_id: matricula?.seccion_id || null,
          }
        })
        .filter((item) => item.seccion_id)

      setEstudiantes(estudiantesConMatricula)

      const { data: motivosData, error: motivosError } = await supabase
        .from('motivos_salida')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre', { ascending: true })

      if (motivosError) throw motivosError
      setMotivos(motivosData || [])

      await cargarSalidasAbiertas(anio.id)
    } catch (err) {
      console.error(err)
      setError(err.message || 'No se pudieron cargar los datos.')
    } finally {
      setCargando(false)
    }
  }

  async function cargarSalidasAbiertas(anioId = añoEscolar?.id) {
    if (!profile?.institucion_id || !anioId) return

    try {
      const { data: salidas, error: salidasError } = await supabase
        .from('salidas')
        .select(`
          id,
          estudiante_id,
          motivo_id,
          seccion_id,
          hora_salida,
          numero_salida_dia
        `)
        .eq('institucion_id', profile.institucion_id)
        .eq('año_escolar_id', anioId)
        .eq('permiso_autorizado', true)
        .is('hora_regreso', null)
        .order('hora_salida', { ascending: true })

      if (salidasError) throw salidasError

      const { data: pendientes, error: pendientesError } = await supabase
        .from('salidas')
        .select(`
          id,
          estudiante_id,
          motivo_id,
          seccion_id,
          hora_salida,
          numero_salida_dia,
          created_at,
          alerta_frecuencia,
          permiso_autorizado
        `)
        .eq('institucion_id', profile.institucion_id)
        .eq('año_escolar_id', anioId)
        .eq('alerta_frecuencia', true)
        .is('permiso_autorizado', null)
        .order('created_at', { ascending: true })

      if (pendientesError) throw pendientesError

      const lista = salidas || []
      const listaPendientes = pendientes || []

      const todos = [...lista, ...listaPendientes]
      const estudianteIds = [...new Set(todos.map((item) => item.estudiante_id))]
      const motivoIds = [...new Set(todos.map((item) => item.motivo_id))]

      if (todos.length === 0) {
        setSalidasAbiertas([])
        setSolicitudesPendientes([])
        return
      }

      const [
        { data: estudiantesData, error: estudiantesError },
        { data: motivosData, error: motivosError },
      ] = await Promise.all([
        supabase
          .from('estudiantes')
          .select('id, dni, nombres, apellidos')
          .in('id', estudianteIds),
        supabase
          .from('motivos_salida')
          .select('id, nombre')
          .in('id', motivoIds),
      ])

      if (estudiantesError) throw estudiantesError
      if (motivosError) throw motivosError

      const estudiantesMap = new Map(
        (estudiantesData || []).map((item) => [item.id, item])
      )

      const motivosMap = new Map(
        (motivosData || []).map((item) => [item.id, item.nombre])
      )

      setSalidasAbiertas(
        lista.map((salida) => ({
          ...salida,
          estudiante: estudiantesMap.get(salida.estudiante_id),
          motivo_nombre: motivosMap.get(salida.motivo_id) || 'Sin destino',
        }))
      )

      setSolicitudesPendientes(
        listaPendientes.map((salida) => ({
          ...salida,
          estudiante: estudiantesMap.get(salida.estudiante_id),
          motivo_nombre: motivosMap.get(salida.motivo_id) || 'Sin destino',
        }))
      )
    } catch (err) {
      console.error(err)
    }
  }

  function normalizarTexto(texto) {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  }

  const resultadosBusqueda = useMemo(() => {
    if (!busqueda.trim()) return []

    const textoBusqueda = normalizarTexto(busqueda)

    return estudiantes
      .filter((estudiante) => {
        const nombreCompleto = normalizarTexto(
          `${estudiante.apellidos} ${estudiante.nombres}`
        )

        const dni = (estudiante.dni || '').toLowerCase()

        return (
          nombreCompleto.includes(textoBusqueda) ||
          dni.includes(textoBusqueda)
        )
      })
      .slice(0, 10)
  }, [busqueda, estudiantes])

  async function seleccionarEstudiante(estudiante) {
    setEstudianteSeleccionado(estudiante)
    setBusqueda(`${estudiante.apellidos}, ${estudiante.nombres}`)
    setMostrarResultados(false)
    setMensaje('')
    setError('')

    await consultarSalidasHoy(estudiante.id)
    await cargarSalidasAbiertas()
  }

  async function consultarSalidasHoy(estudianteId) {
    setCargandoSalidas(true)

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'evaluar_proxima_salida',
        {
          p_estudiante_id: estudianteId,
        }
      )

      if (rpcError) throw rpcError

      setSalidasHoy(data)
    } catch (err) {
      console.error(err)
      setError(err.message || 'No se pudo consultar las salidas del día.')
      setSalidasHoy(null)
    } finally {
      setCargandoSalidas(false)
    }
  }

  function limpiarEstudiante() {
    setEstudianteSeleccionado(null)
    setBusqueda('')
    setMostrarResultados(false)
    setSalidasHoy(null)
    setMensaje('')
    setError('')
  }

  async function seleccionarDesdePanel(salida) {
    const estudiante = estudiantes.find(
      (item) => item.id === salida.estudiante_id
    )

    if (!estudiante) return

    await seleccionarEstudiante(estudiante)
  }

  async function registrarRetorno(salidaId) {
    if (!salidaId) return

    setProcesandoRetorno(true)
    setError('')
    setMensaje('')

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'registrar_retorno_salida',
        {
          p_salida_id: salidaId,
        }
      )

      if (rpcError) throw rpcError

      console.log('Retorno registrado:', data)

      setMensaje('Retorno del estudiante registrado correctamente.')

      await cargarSalidasAbiertas()

      if (estudianteSeleccionado) {
        await consultarSalidasHoy(estudianteSeleccionado.id)
      }
    } catch (err) {
      console.error(err)
      setError(err.message || 'No se pudo registrar el retorno.')
    } finally {
      setProcesandoRetorno(false)
    }
  }

  async function solicitarSalida(e) {
    e.preventDefault()

    setError('')
    setMensaje('')

    if (!estudianteSeleccionado) {
      setError('Selecciona un estudiante.')
      return
    }

    const estudianteFuera = salidasAbiertas.some(
      (salida) => salida.estudiante_id === estudianteSeleccionado.id
    )

    if (estudianteFuera) {
      setError(
        'El estudiante se encuentra fuera del aula. Primero registra su retorno.'
      )
      return
    }

    if (!motivoId) {
      setError('Selecciona el destino o motivo de la salida.')
      return
    }

    if (!añoEscolar?.id) {
      setError('No existe un año escolar activo.')
      return
    }

    setProcesando(true)

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'solicitar_salida',
        {
          p_estudiante_id: estudianteSeleccionado.id,
          p_año_escolar_id: añoEscolar.id,
          p_seccion_id: estudianteSeleccionado.seccion_id,
          p_motivo_id: motivoId,
          p_observacion: observacion.trim() || null,
        }
      )

      if (rpcError) throw rpcError

      console.log('Resultado solicitar_salida:', data)

      const estudianteIdRegistrado = estudianteSeleccionado.id

      if (data?.permiso_autorizado === true) {
        setMensaje(
          `Salida ${data.numero_salida_dia}.ª autorizada correctamente.`
        )
      } else if (data?.requiere_decision_docente) {
        setMensaje(
          `La ${data.numero_salida_dia}.ª salida quedó pendiente de decisión del docente.`
        )
      }

      // Limpiar el formulario después de registrar la solicitud.
      // La solicitud pendiente queda visible en el panel derecho.
      setEstudianteSeleccionado(null)
      setBusqueda('')
      setMostrarResultados(false)
      setSalidasHoy(null)
      setMotivoId('')
      setObservacion('')

      await Promise.all([
        consultarSalidasHoy(estudianteIdRegistrado),
        cargarSalidasAbiertas(),
      ])
    } catch (err) {
      console.error(err)
      setError(err.message || 'No se pudo registrar la salida.')
    } finally {
      setProcesando(false)
    }
  }

  async function resolverSolicitud(salidaId, autorizar) {
    if (!salidaId) return

    setProcesandoRetorno(true)
    setError('')
    setMensaje('')

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'resolver_solicitud_salida',
        {
          p_salida_id: salidaId,
          p_autorizar: autorizar,
        }
      )

      if (rpcError) throw rpcError

      if (autorizar) {
        setMensaje(
          `Salida ${data?.numero_salida_dia || ''}.ª autorizada. El estudiante ya figura como fuera del aula.`
        )
      } else {
        setMensaje(
          'Salida no autorizada. El intento quedó registrado y no se contabilizó como salida autorizada.'
        )
      }

      await cargarSalidasAbiertas()
    } catch (err) {
      console.error(err)
      setError(err.message || 'No se pudo resolver la solicitud.')
    } finally {
      setProcesandoRetorno(false)
    }
  }

  function obtenerRangoFecha(fecha) {
    const inicio = new Date(`${fecha}T00:00:00-05:00`)
    const siguiente = new Date(inicio)
    siguiente.setUTCDate(siguiente.getUTCDate() + 1)
    return { inicio: inicio.toISOString(), fin: siguiente.toISOString() }
  }

  function formatearFechaLarga(fecha) {
    if (!fecha) return ''
    return new Date(`${fecha}T12:00:00-05:00`).toLocaleDateString('es-PE', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Lima'
    })
  }

  function calcularDuracion(horaSalida, horaRegreso) {
    if (!horaSalida || !horaRegreso) return null
    const segundos = Math.max(0, Math.floor((new Date(horaRegreso) - new Date(horaSalida)) / 1000))
    const minutos = Math.floor(segundos / 60)
    const segundosRestantes = segundos % 60
    if (minutos === 0) return `${segundosRestantes} s`
    if (segundosRestantes === 0) return `${minutos} min`
    return `${minutos} min ${segundosRestantes} s`
  }

  async function cargarHistorial(fecha = fechaHistorial) {
    if (!profile?.institucion_id || !añoEscolar?.id) return

    setCargandoHistorial(true)
    setError('')

    try {
      const { inicio, fin } = obtenerRangoFecha(fecha)

      // IMPORTANTE:
      // El historial es institucional. NO se filtra por docente_id.
      // Cualquier docente puede consultar las salidas de todo el colegio.
      const { data: salidas, error: salidasError } = await supabase
        .from('salidas')
        .select(`
          id,
          estudiante_id,
          motivo_id,
          seccion_id,
          docente_id,
          usuario_autorizador,
          hora_salida,
          hora_regreso,
          observacion,
          numero_salida_dia,
          alerta_frecuencia,
          permiso_autorizado,
          fecha_decision,
          created_at
        `)
        .eq('institucion_id', profile.institucion_id)
        .eq('año_escolar_id', añoEscolar.id)
        .gte('created_at', inicio)
        .lt('created_at', fin)
        .order('created_at', { ascending: false })

      if (salidasError) throw salidasError

      const lista = salidas || []

      if (lista.length === 0) {
        setHistorialSalidas([])
        return
      }

      const ids = (key) => [
        ...new Set(lista.map((item) => item[key]).filter(Boolean)),
      ]

      const estudianteIds = ids('estudiante_id')
      const motivoIds = ids('motivo_id')
      const seccionIds = ids('seccion_id')
      const docenteIds = ids('docente_id')
      const perfilIds = ids('usuario_autorizador')

      const [
        estudiantesResult,
        motivosResult,
        seccionesResult,
        docentesResult,
        perfilesResult,
      ] = await Promise.all([
        estudianteIds.length
          ? supabase
              .from('estudiantes')
              .select('id, nombres, apellidos, dni')
              .in('id', estudianteIds)
          : Promise.resolve({ data: [], error: null }),

        motivoIds.length
          ? supabase
              .from('motivos_salida')
              .select('id, nombre')
              .in('id', motivoIds)
          : Promise.resolve({ data: [], error: null }),

        seccionIds.length
          ? supabase
              .from('secciones')
              .select('id, nombre, grado_id')
              .in('id', seccionIds)
          : Promise.resolve({ data: [], error: null }),

        docenteIds.length
          ? supabase
              .from('docentes')
              .select('id, nombres, apellidos, perfil_id')
              .in('id', docenteIds)
          : Promise.resolve({ data: [], error: null }),

        perfilIds.length
          ? supabase
              .from('perfiles')
              .select('id, nombres, apellidos')
              .in('id', perfilIds)
          : Promise.resolve({ data: [], error: null }),
      ])

      for (const result of [
        estudiantesResult,
        motivosResult,
        seccionesResult,
        docentesResult,
        perfilesResult,
      ]) {
        if (result.error) throw result.error
      }

      const gradoIds = [
        ...new Set(
          (seccionesResult.data || [])
            .map((item) => item.grado_id)
            .filter(Boolean)
        ),
      ]

      let gradosData = []
      if (gradoIds.length) {
        const { data, error } = await supabase
          .from('grados')
          .select('id, nombre, numero, nivel')
          .in('id', gradoIds)

        if (error) throw error
        gradosData = data || []
      }

      const crearMapa = (items) =>
        new Map((items || []).map((item) => [item.id, item]))

      const estudiantesMap = crearMapa(estudiantesResult.data)
      const motivosMap = crearMapa(motivosResult.data)
      const seccionesMap = crearMapa(seccionesResult.data)
      const gradosMap = crearMapa(gradosData)
      const docentesMap = crearMapa(docentesResult.data)
      const perfilesMap = crearMapa(perfilesResult.data)

      const historial = lista.map((salida) => {
        const seccion = seccionesMap.get(salida.seccion_id)
        const grado = seccion
          ? gradosMap.get(seccion.grado_id)
          : null

        const docente = docentesMap.get(salida.docente_id)
        const autorizador = perfilesMap.get(salida.usuario_autorizador)
        const responsable = docente || autorizador

        return {
          ...salida,
          estudiante: estudiantesMap.get(salida.estudiante_id),
          motivo_nombre:
            motivosMap.get(salida.motivo_id)?.nombre || 'Sin destino',
          seccion,
          grado,
          docente_nombre: responsable
            ? `${responsable.apellidos}, ${responsable.nombres}`
            : 'No registrado',
          duracion: calcularDuracion(
            salida.hora_salida,
            salida.hora_regreso
          ),
        }
      })

      setHistorialSalidas(historial)
    } catch (err) {
      console.error('Error cargando historial diario:', err)
      setError(
        err.message || 'No se pudo cargar el historial de salidas.'
      )
      setHistorialSalidas([])
    } finally {
      setCargandoHistorial(false)
    }
  }

  async function cargarRanking(periodoId = periodoSeleccionado) {
    if (!profile?.institucion_id || !añoEscolar?.id || !periodoId) return

    const periodo = periodosAcademicos.find((item) => item.id === periodoId)
    if (!periodo) return

    setCargandoRanking(true)
    setError('')
    setEstudianteRankingSeleccionado(null)
    setDetalleEstudianteRanking([])

    try {
      const { data: salidas, error: salidasError } = await supabase
        .from('salidas')
        .select(`
          id,
          estudiante_id,
          seccion_id,
          motivo_id,
          docente_id,
          hora_salida,
          hora_regreso,
          permiso_autorizado,
          numero_salida_dia,
          alerta_frecuencia,
          observacion
        `)
        .eq('institucion_id', profile.institucion_id)
        .eq('año_escolar_id', añoEscolar.id)
        .gte('hora_salida', `${periodo.fecha_inicio}T00:00:00-05:00`)
        .lt('hora_salida', `${periodo.fecha_fin}T23:59:59.999-05:00`)
        .eq('permiso_autorizado', true)
        .not('hora_salida', 'is', null)
        .order('hora_salida', { ascending: false })

      if (salidasError) throw salidasError

      const lista = salidas || []
      const ids = (key) => [...new Set(lista.map((item) => item[key]).filter(Boolean))]
      const estudianteIds = ids('estudiante_id')
      const seccionIds = ids('seccion_id')

      const [estudiantesResult, seccionesResult] = await Promise.all([
        estudianteIds.length
          ? supabase.from('estudiantes').select('id, dni, nombres, apellidos').in('id', estudianteIds)
          : Promise.resolve({ data: [], error: null }),
        seccionIds.length
          ? supabase.from('secciones').select('id, nombre, grado_id').in('id', seccionIds)
          : Promise.resolve({ data: [], error: null }),
      ])

      if (estudiantesResult.error) throw estudiantesResult.error
      if (seccionesResult.error) throw seccionesResult.error

      const gradoIds = [...new Set((seccionesResult.data || []).map((item) => item.grado_id).filter(Boolean))]
      const { data: gradosData, error: gradosError } = gradoIds.length
        ? await supabase.from('grados').select('id, nombre, numero, nivel').in('id', gradoIds)
        : { data: [], error: null }
      if (gradosError) throw gradosError

      const estudiantesMap = new Map((estudiantesResult.data || []).map((item) => [item.id, item]))
      const seccionesMap = new Map((seccionesResult.data || []).map((item) => [item.id, item]))
      const gradosMap = new Map((gradosData || []).map((item) => [item.id, item]))

      const acumulado = new Map()
      for (const salida of lista) {
        const estudiante = estudiantesMap.get(salida.estudiante_id)
        if (!estudiante) continue
        const seccion = seccionesMap.get(salida.seccion_id)
        const grado = seccion ? gradosMap.get(seccion.grado_id) : null
        const actual = acumulado.get(estudiante.id) || {
          estudiante_id: estudiante.id,
          estudiante,
          seccion,
          grado,
          total_salidas: 0,
          ultima_salida: null,
          salidas_alerta: 0,
        }
        actual.total_salidas += 1
        if (salida.alerta_frecuencia) actual.salidas_alerta += 1
        if (!actual.ultima_salida || new Date(salida.hora_salida) > new Date(actual.ultima_salida)) {
          actual.ultima_salida = salida.hora_salida
        }
        acumulado.set(estudiante.id, actual)
      }

      const ranking = [...acumulado.values()]
        .sort((a, b) => b.total_salidas - a.total_salidas || `${a.estudiante.apellidos} ${a.estudiante.nombres}`.localeCompare(`${b.estudiante.apellidos} ${b.estudiante.nombres}`))
        .map((item, index) => ({ ...item, posicion: index + 1 }))

      setRankingSalidas(ranking)
    } catch (err) {
      console.error('Error cargando ranking:', err)
      setError(err.message || 'No se pudo cargar el ranking de salidas.')
      setRankingSalidas([])
    } finally {
      setCargandoRanking(false)
    }
  }

  async function cargarDetalleEstudianteRanking(item) {
    if (!item?.estudiante_id || !periodoSeleccionado || !añoEscolar?.id || !profile?.institucion_id) return
    const periodo = periodosAcademicos.find((p) => p.id === periodoSeleccionado)
    if (!periodo) return

    setEstudianteRankingSeleccionado(item)
    setCargandoDetalleRanking(true)

    try {
      const { data, error: detalleError } = await supabase
        .from('salidas')
        .select(`
          id, estudiante_id, seccion_id, motivo_id, docente_id,
          hora_salida, hora_regreso, permiso_autorizado,
          numero_salida_dia, alerta_frecuencia, observacion
        `)
        .eq('institucion_id', profile.institucion_id)
        .eq('año_escolar_id', añoEscolar.id)
        .eq('estudiante_id', item.estudiante_id)
        .gte('created_at', `${periodo.fecha_inicio}T00:00:00-05:00`)
        .lt('created_at', `${periodo.fecha_fin}T23:59:59.999-05:00`)
        .order('created_at', { ascending: false })

      if (detalleError) throw detalleError

      const lista = data || []
      const motivoIds = [...new Set(lista.map((x) => x.motivo_id).filter(Boolean))]
      const docenteIds = [...new Set(lista.map((x) => x.docente_id).filter(Boolean))]
      const seccionIds = [...new Set(lista.map((x) => x.seccion_id).filter(Boolean))]

      const [motivosResult, docentesResult, seccionesResult] = await Promise.all([
        motivoIds.length ? supabase.from('motivos_salida').select('id, nombre').in('id', motivoIds) : Promise.resolve({ data: [], error: null }),
        docenteIds.length ? supabase.from('docentes').select('id, nombres, apellidos').in('id', docenteIds) : Promise.resolve({ data: [], error: null }),
        seccionIds.length ? supabase.from('secciones').select('id, nombre, grado_id').in('id', seccionIds) : Promise.resolve({ data: [], error: null }),
      ])
      for (const result of [motivosResult, docentesResult, seccionesResult]) if (result.error) throw result.error

      const gradoIds = [...new Set((seccionesResult.data || []).map((x) => x.grado_id).filter(Boolean))]
      const { data: gradosData, error: gradosError } = gradoIds.length
        ? await supabase.from('grados').select('id, nombre, numero, nivel').in('id', gradoIds)
        : { data: [], error: null }
      if (gradosError) throw gradosError

      const map = (items) => new Map((items || []).map((x) => [x.id, x]))
      const motivosMap = map(motivosResult.data)
      const docentesMap = map(docentesResult.data)
      const seccionesMap = map(seccionesResult.data)
      const gradosMap = map(gradosData)

      setDetalleEstudianteRanking(lista.map((salida) => {
        const seccion = seccionesMap.get(salida.seccion_id)
        const grado = seccion ? gradosMap.get(seccion.grado_id) : null
        const docente = docentesMap.get(salida.docente_id)
        return {
          ...salida,
          motivo_nombre: motivosMap.get(salida.motivo_id)?.nombre || 'Sin destino',
          docente_nombre: docente ? `${docente.apellidos}, ${docente.nombres}` : 'No registrado',
          aula: grado ? `${grado.nombre || grado.numero} ${seccion?.nombre || ''}`.trim() : 'Sin aula',
          duracion: calcularDuracion(salida.hora_salida, salida.hora_regreso),
        }
      }))
    } catch (err) {
      console.error('Error cargando detalle del estudiante:', err)
      setError(err.message || 'No se pudo cargar el detalle del estudiante.')
      setDetalleEstudianteRanking([])
    } finally {
      setCargandoDetalleRanking(false)
    }
  }

  function exportarRankingExcel() {
    const periodo = periodosAcademicos.find((p) => p.id === periodoSeleccionado)
    if (!rankingSalidas.length || !periodo) return
    const rows = rankingSalidas.map((item) => ({
      Posición: item.posicion,
      DNI: item.estudiante?.dni || '',
      Estudiante: item.estudiante ? `${item.estudiante.apellidos}, ${item.estudiante.nombres}` : '',
      Nivel: item.grado?.nivel || '',
      Grado: item.grado?.nombre || item.grado?.numero || '',
      Sección: item.seccion?.nombre || '',
      'Total de salidas': item.total_salidas,
      'Salidas con frecuencia alta': item.salidas_alerta,
      'Última salida': item.ultima_salida ? new Date(item.ultima_salida).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Ranking')
    XLSX.writeFile(wb, `Ranking_salidas_${periodo.nombre.replace(/[^a-z0-9áéíóúñ ]/gi, '_')}.xlsx`)
  }

  function exportarDetalleEstudianteExcel() {
    if (!estudianteRankingSeleccionado || !detalleEstudianteRanking.length) return
    const periodo = periodosAcademicos.find((p) => p.id === periodoSeleccionado)
    const rows = detalleEstudianteRanking.map((item) => ({
      DNI: estudianteRankingSeleccionado.estudiante?.dni || '',
      Estudiante: estudianteRankingSeleccionado.estudiante ? `${estudianteRankingSeleccionado.estudiante.apellidos}, ${estudianteRankingSeleccionado.estudiante.nombres}` : '',
      Fecha: item.hora_salida ? new Date(item.hora_salida).toLocaleDateString('es-PE', { timeZone: 'America/Lima' }) : '',
      'Hora salida': formatearHora(item.hora_salida),
      'Hora regreso': formatearHora(item.hora_regreso),
      Destino: item.motivo_nombre,
      Aula: item.aula,
      Docente: item.docente_nombre,
      Estado: estadoHistorial(item),
      'Salida del día': item.numero_salida_dia || '',
      Observación: item.observacion || '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Salidas del estudiante')
    XLSX.writeFile(wb, `Salidas_${(estudianteRankingSeleccionado.estudiante?.apellidos || 'Estudiante').replace(/[^a-z0-9áéíóúñ ]/gi, '_')}_${periodo?.nombre || 'periodo'}.xlsx`)
  }

  function estadoHistorial(s) {
    if (s.permiso_autorizado === false) return 'Rechazada'
    if (s.permiso_autorizado === null) return 'Pendiente'
    if (s.hora_salida && !s.hora_regreso) return 'Fuera del aula'
    return 'Completada'
  }

  function claseEstadoHistorial(s) {
    if (s.permiso_autorizado === false) return 'historial-estado rechazada'
    if (s.permiso_autorizado === null) return 'historial-estado pendiente'
    if (s.hora_salida && !s.hora_regreso) return 'historial-estado fuera'
    return 'historial-estado completada'
  }

  function formatearHora(fecha) {
    if (!fecha) return '--:--:--'

    return new Date(fecha).toLocaleTimeString('es-PE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'America/Lima',
    })
  }

  return (
    <div className="salidas-page">
      <div className="salidas-header">
        <div className="salidas-title-row">
          <div className="salidas-icon">
            <DoorOpen size={24} />
          </div>

          <div>
            <h1>Salidas</h1>
            <p>
              Control de salidas temporales de estudiantes durante la jornada escolar.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="salidas-refresh"
          onClick={cargarDatos}
          disabled={cargando}
        >
          <RefreshCw size={17} />
          Actualizar
        </button>
      </div>

      {añoEscolar && (
        <div className="salidas-periodo">
          <strong>Año escolar:</strong> {añoEscolar.nombre}
        </div>
      )}

      <div className="salidas-tabs">
        <button type="button" className={pestaña === 'registrar' ? 'salidas-tab activa' : 'salidas-tab'} onClick={() => setPestaña('registrar')}><DoorOpen size={17} /> Registrar salida</button>
        <button type="button" className={pestaña === 'historial' ? 'salidas-tab activa' : 'salidas-tab'} onClick={() => setPestaña('historial')}><History size={17} /> Historial diario</button>
        <button type="button" className={pestaña === 'ranking' ? 'salidas-tab activa' : 'salidas-tab'} onClick={() => setPestaña('ranking')}><Timer size={17} /> Ranking por bimestre</button>
      </div>

      {error && (
        <div className="salidas-alert salidas-alert-error">
          <AlertTriangle size={19} />
          <span>{error}</span>
        </div>
      )}

      {mensaje && (
        <div className="salidas-alert salidas-alert-success">
          <CheckCircle2 size={19} />
          <span>{mensaje}</span>
        </div>
      )}

      {cargando ? (
        <div className="salidas-card salidas-loading">
          Cargando estudiantes y motivos de salida...
        </div>
      ) : pestaña === 'registrar' ? (
        <div className="salidas-grid">
          <div className="salidas-card">
            <div className="salidas-card-header">
              <div>
                <h2>Registrar salida</h2>
                <p>Busca al estudiante por nombre, apellido o DNI.</p>
              </div>
            </div>

            <form onSubmit={solicitarSalida} className="salidas-form">
              <div className="salidas-field">
                <label htmlFor="busqueda-estudiante">Estudiante</label>

                <div className="salidas-search-wrapper">
                  <div className="salidas-search-box">
                    <Search size={18} />

                    <input
                      id="busqueda-estudiante"
                      type="text"
                      value={busqueda}
                      onChange={(e) => {
                        setBusqueda(e.target.value)
                        setMostrarResultados(true)

                        if (estudianteSeleccionado) {
                          setEstudianteSeleccionado(null)
                          setSalidasHoy(null)
                        }
                      }}
                      onFocus={() => {
                        if (busqueda.trim()) {
                          setMostrarResultados(true)
                        }
                      }}
                      placeholder="Escribe nombre, apellido o DNI..."
                      autoComplete="off"
                      disabled={procesando || procesandoRetorno}
                    />

                    {busqueda && (
                      <button
                        type="button"
                        className="salidas-search-clear"
                        onClick={limpiarEstudiante}
                        disabled={procesando || procesandoRetorno}
                      >
                        <X size={17} />
                      </button>
                    )}
                  </div>

                  {mostrarResultados && busqueda.trim() && (
                    <div className="salidas-search-results">
                      {resultadosBusqueda.length === 0 ? (
                        <div className="salidas-no-results">
                          No se encontraron estudiantes.
                        </div>
                      ) : (
                        resultadosBusqueda.map((estudiante) => (
                          <button
                            type="button"
                            key={estudiante.id}
                            className="salidas-student-option"
                            onClick={() => seleccionarEstudiante(estudiante)}
                          >
                            <div className="salidas-student-name">
                              {estudiante.apellidos}, {estudiante.nombres}
                            </div>
                            <div className="salidas-student-meta">
                              DNI: {estudiante.dni || 'Sin DNI'}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {estudianteSeleccionado && (
                <div className="salidas-selected-student">
                  <div>
                    <span className="salidas-selected-label">
                      Estudiante seleccionado
                    </span>

                    <strong>
                      {estudianteSeleccionado.apellidos},{' '}
                      {estudianteSeleccionado.nombres}
                    </strong>

                    <span>
                      DNI: {estudianteSeleccionado.dni || 'Sin DNI'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={limpiarEstudiante}
                    disabled={procesando || procesandoRetorno}
                  >
                    Cambiar
                  </button>
                </div>
              )}

              {estudianteSeleccionado && (
                <div className="salidas-frequency">
                  <div className="salidas-frequency-icon">
                    <DoorOpen size={21} />
                  </div>

                  <div>
                    <strong>
                      {cargandoSalidas
                        ? 'Consultando salidas...'
                        : salidasHoy
                          ? `Salidas autorizadas hoy: ${salidasHoy.salidas_hoy}`
                          : 'No se pudo consultar el registro.'}
                    </strong>

                    {salidasHoy && (
                      <span>
                        Próxima salida: {salidasHoy.proxima_salida}.ª
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="salidas-field">
                <label htmlFor="motivo">Destino / motivo</label>

                <select
                  id="motivo"
                  value={motivoId}
                  onChange={(e) => setMotivoId(e.target.value)}
                  disabled={
                    procesando ||
                    procesandoRetorno ||
                    !estudianteSeleccionado ||
                    salidasAbiertas.some(
                      (salida) =>
                        salida.estudiante_id === estudianteSeleccionado?.id
                    )
                  }
                >
                  <option value="">Seleccionar destino...</option>

                  {motivos.map((motivo) => (
                    <option key={motivo.id} value={motivo.id}>
                      {motivo.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="salidas-field">
                <label htmlFor="observacion">Observación</label>

                <textarea
                  id="observacion"
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  placeholder="Observación opcional..."
                  rows={3}
                  disabled={
                    procesando ||
                    procesandoRetorno ||
                    !estudianteSeleccionado ||
                    salidasAbiertas.some(
                      (salida) =>
                        salida.estudiante_id === estudianteSeleccionado?.id
                    )
                  }
                />
              </div>

              <button
                type="submit"
                className="salidas-submit"
                disabled={
                  procesando ||
                  procesandoRetorno ||
                  !estudianteSeleccionado ||
                  salidasAbiertas.some(
                    (salida) =>
                      salida.estudiante_id === estudianteSeleccionado?.id
                  )
                }
              >
                <Send size={18} />

                {procesando
                  ? 'Procesando...'
                  : salidasAbiertas.some(
                        (salida) =>
                          salida.estudiante_id === estudianteSeleccionado?.id
                      )
                    ? 'Estudiante fuera del aula'
                    : 'Solicitar salida'}
              </button>
            </form>
          </div>

          <div className="salidas-card salidas-panel-fuera">
            {solicitudesPendientes.length > 0 && (
              <div className="salidas-pendientes">
                <div className="salidas-pendientes-header">
                  <AlertTriangle size={19} />
                  <div>
                    <strong>Solicitudes pendientes de decisión</strong>
                    <span>Estas salidas alcanzaron el umbral de frecuencia y requieren autorización del docente.</span>
                  </div>
                </div>

                <div className="salidas-pendientes-lista">
                  {solicitudesPendientes.map((solicitud) => (
                    <div
                      key={solicitud.id}
                      className="salida-pendiente-card"
                    >
                      <div className="salida-pendiente-info">
                        <strong>
                          {solicitud.estudiante
                            ? `${solicitud.estudiante.apellidos}, ${solicitud.estudiante.nombres}`
                            : 'Estudiante'}
                        </strong>

                        <span>
                          {solicitud.numero_salida_dia}.ª salida · {solicitud.motivo_nombre}
                        </span>

                        <span>
                          Solicitud: {formatearHora(solicitud.created_at)}
                        </span>
                      </div>

                      <div className="salida-pendiente-acciones">
                        <button
                          type="button"
                          className="salida-autorizar"
                          onClick={() => resolverSolicitud(solicitud.id, true)}
                          disabled={procesandoRetorno}
                        >
                          <CheckCircle2 size={16} />
                          Autorizar salida
                        </button>

                        <button
                          type="button"
                          className="salida-rechazar"
                          onClick={() => resolverSolicitud(solicitud.id, false)}
                          disabled={procesandoRetorno}
                        >
                          <X size={16} />
                          Rechazar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {salidasAbiertas.length === 0 ? (
              <div className="salidas-empty">
                <DoorOpen size={32} />

                <span>
                  No hay estudiantes fuera del aula.
                </span>
              </div>
            ) : (
              <div className="salidas-fuera-lista">
                {salidasAbiertas.map((salida) => (
                  <div
                    key={salida.id}
                    className="salida-abierta-card"
                  >
                    <button
                      type="button"
                      className="salida-abierta-datos"
                      onClick={() => seleccionarDesdePanel(salida)}
                      title="Seleccionar estudiante"
                    >
                      <div className="salida-abierta-icono">
                        <DoorOpen size={22} />
                      </div>

                      <div className="salida-abierta-info">
                        <strong>
                          {salida.estudiante
                            ? `${salida.estudiante.apellidos}, ${salida.estudiante.nombres}`
                            : 'Estudiante'}
                        </strong>

                        <span>
                          Salida {salida.numero_salida_dia}.ª ·{' '}
                          {salida.motivo_nombre}
                        </span>

                        <span>
                          Salió: {formatearHora(salida.hora_salida)}
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      className="salida-abierta-retorno"
                      onClick={() => registrarRetorno(salida.id)}
                      disabled={procesandoRetorno}
                    >
                      <CheckCircle2 size={17} />

                      {procesandoRetorno
                        ? 'Procesando...'
                        : 'REGISTRAR RETORNO'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : pestaña === 'ranking' ? (
        <div className="salidas-ranking">
          <div className="salidas-ranking-toolbar">
            <div>
              <h2>Ranking de salidas</h2>
              <p>Consulta el total de salidas autorizadas por estudiante en cada bimestre.</p>
            </div>
            <div className="salidas-ranking-controles">
              <label htmlFor="periodo-ranking">Bimestre</label>
              <select id="periodo-ranking" value={periodoSeleccionado} onChange={(e) => { setPeriodoSeleccionado(e.target.value); cargarRanking(e.target.value) }}>
                {periodosAcademicos.map((periodo) => <option key={periodo.id} value={periodo.id}>{periodo.nombre}</option>)}
              </select>
              <button type="button" className="salidas-refresh" onClick={() => cargarRanking(periodoSeleccionado)} disabled={cargandoRanking}><RefreshCw size={17}/> Actualizar</button>
              <button type="button" className="salidas-ranking-exportar" onClick={exportarRankingExcel} disabled={!rankingSalidas.length}><FileText size={17}/> Descargar ranking</button>
            </div>
          </div>

          <div className="salidas-ranking-resumen">
            <strong>{rankingSalidas.length}</strong><span>estudiantes con salidas registradas</span>
          </div>

          <div className="salidas-ranking-busqueda">
            <Search size={18}/>
            <input value={busquedaRanking} onChange={(e) => setBusquedaRanking(e.target.value)} placeholder="Buscar estudiante por nombre, apellido o DNI..." />
          </div>

          {cargandoRanking ? <div className="salidas-card salidas-loading">Cargando ranking...</div> : (
            <div className="salidas-ranking-layout">
              <div className="salidas-card salidas-ranking-tabla-wrap">
                <div className="salidas-ranking-tabla">
                  <div className="salidas-ranking-fila cabecera"><span>#</span><span>Estudiante</span><span>Aula</span><span>Salidas</span><span>Acción</span></div>
                  {rankingSalidas.filter((item) => { const q = busquedaRanking.trim().toLowerCase(); if (!q) return true; const nombre = `${item.estudiante?.nombres || ''} ${item.estudiante?.apellidos || ''} ${item.estudiante?.dni || ''}`.toLowerCase(); return nombre.includes(q) }).map((item) => (
                    <div className="salidas-ranking-fila" key={item.estudiante_id}>
                      <span className="ranking-posicion">{item.posicion}</span>
                      <span><strong>{item.estudiante?.apellidos}, {item.estudiante?.nombres}</strong><small>DNI: {item.estudiante?.dni || 'Sin DNI'}</small></span>
                      <span>{item.grado?.nombre || item.grado?.numero || '-'} {item.seccion?.nombre || ''}</span>
                      <span className="ranking-total">{item.total_salidas}</span>
                      <button type="button" onClick={() => cargarDetalleEstudianteRanking(item)}>Ver detalle</button>
                    </div>
                  ))}
                  {!rankingSalidas.length && <div className="salidas-ranking-vacio">No hay salidas autorizadas en este bimestre.</div>}
                </div>
              </div>

              {estudianteRankingSeleccionado && (
                <div className="salidas-card salidas-ranking-detalle">
                  <div className="salidas-ranking-detalle-header">
                    <div><h3>{estudianteRankingSeleccionado.estudiante?.apellidos}, {estudianteRankingSeleccionado.estudiante?.nombres}</h3><p>DNI: {estudianteRankingSeleccionado.estudiante?.dni || 'Sin DNI'}</p></div>
                    <button type="button" onClick={() => setEstudianteRankingSeleccionado(null)}><X size={18}/></button>
                  </div>
                  <div className="salidas-ranking-detalle-actions"><strong>{detalleEstudianteRanking.length} registros</strong><button type="button" className="salidas-ranking-exportar" onClick={exportarDetalleEstudianteExcel} disabled={!detalleEstudianteRanking.length}><FileText size={17}/> Descargar historial</button></div>
                  {cargandoDetalleRanking ? <p>Cargando salidas del estudiante...</p> : <div className="salidas-ranking-detalle-lista">
                    {detalleEstudianteRanking.map((item) => <div className="salida-ranking-detalle-item" key={item.id}>
                      <div><strong>{formatearFechaLarga(item.hora_salida?.slice(0,10))}</strong><span>{formatearHora(item.hora_salida)} → {item.hora_regreso ? formatearHora(item.hora_regreso) : 'Pendiente'}</span></div>
                      <div><span>Destino</span><strong>{item.motivo_nombre}</strong></div>
                      <div><span>Aula</span><strong>{item.aula}</strong></div>
                      <div><span>Docente</span><strong>{item.docente_nombre}</strong></div>
                      <div><span>Estado</span><strong>{estadoHistorial(item)}</strong></div>
                    </div>)}
                  </div>}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="salidas-historial">
          <div className="salidas-historial-toolbar">
            <div><h2>Historial de salidas</h2><p>{formatearFechaLarga(fechaHistorial)}</p></div>
            <div className="salidas-historial-filtros">
              <label htmlFor="fecha-historial">Fecha</label>
              <div className="salidas-date-control"><CalendarDays size={18}/><input id="fecha-historial" type="date" value={fechaHistorial} onChange={e=>setFechaHistorial(e.target.value)}/></div>
              <button type="button" className="salidas-refresh" onClick={()=>cargarHistorial(fechaHistorial)} disabled={cargandoHistorial}><RefreshCw size={17}/> Actualizar</button>
            </div>
          </div>
          {cargandoHistorial ? <div className="salidas-card salidas-loading">Cargando historial del día...</div> : historialSalidas.length === 0 ? (
            <div className="salidas-card historial-vacio"><History size={34}/><strong>No hay solicitudes de salida registradas para este día.</strong><span>Prueba seleccionando otra fecha.</span></div>
          ) : (
            <div className="historial-lista">
              {historialSalidas.map(salida=><article key={salida.id} className="historial-salida-card">
                <div className="historial-salida-top">
                  <div className="historial-estudiante"><div className="historial-avatar"><UserRound size={20}/></div><div><strong>{salida.estudiante ? `${salida.estudiante.apellidos}, ${salida.estudiante.nombres}` : 'Estudiante'}</strong><span>DNI: {salida.estudiante?.dni || 'Sin DNI'}</span></div></div>
                  <div className={claseEstadoHistorial(salida)}>{estadoHistorial(salida)}</div>
                </div>
                <div className="historial-datos-grid">
                  <div className="historial-dato"><span><DoorOpen size={16}/> Destino</span><strong>{salida.motivo_nombre}</strong></div>
                  <div className="historial-dato"><span><UserRound size={16}/> Aula</span><strong>{salida.grado?.nombre || salida.grado?.numero || 'Grado'} {salida.seccion?.nombre || ''}</strong></div>
                  <div className="historial-dato"><span><Clock3 size={16}/> Hora de salida</span><strong>{formatearHora(salida.hora_salida)}</strong></div>
                  <div className="historial-dato"><span><Clock3 size={16}/> Hora de regreso</span><strong>{salida.hora_regreso ? formatearHora(salida.hora_regreso) : '--:--:--'}</strong></div>
                  <div className="historial-dato"><span><Timer size={16}/> Tiempo fuera</span><strong>{salida.duracion || (salida.permiso_autorizado === false ? 'No salió' : 'En curso')}</strong></div>
                  <div className="historial-dato"><span><UserRound size={16}/> Docente</span><strong>{salida.docente_nombre}</strong></div>
                </div>
                <div className="historial-salida-bottom">
                  <div className="historial-numero"><span>Salida del día</span><strong>{salida.numero_salida_dia || '-'}.ª</strong></div>
                  {salida.alerta_frecuencia && <span className="historial-alerta"><AlertTriangle size={15}/> Frecuencia alta</span>}
                  {salida.observacion && <div className="historial-observacion"><FileText size={16}/><div><span>Observación</span><strong>{salida.observacion}</strong></div></div>}
                  {salida.permiso_autorizado === false && <span className="historial-rechazo"><XCircle size={15}/> Solicitud rechazada</span>}
                </div>
              </article>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Salidas
