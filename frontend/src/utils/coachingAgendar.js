/**
 * Escala da tabela DISPONIBILIDADE_PROFESSOR: 1 = Seg–Qui, 2 = Sáb–Dom.
 * Usado em GET /api/coaching/vagas (parâmetro diaSemana).
 */
export function diaSemanaDisponibilidadeParaData(isoDate) {
  const s = String(isoDate).split('T')[0];
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return 1;
  const dt = new Date(y, m - 1, d);
  const wd = dt.getDay();
  if (wd === 0 || wd === 6) return 2;
  return 1;
}

/** dia_semana da TABELA_PRECO: 1 = dias úteis, 2 = fim de semana (backend). */
export function diaSemanaPrecoParaData(isoDate) {
  const s = String(isoDate).split('T')[0];
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return 1;
  const dt = new Date(y, m - 1, d);
  const wd = dt.getDay();
  return wd === 0 || wd === 6 ? 2 : 1;
}

export function formatarHoraApi(valor) {
  if (valor == null) return '';
  if (typeof valor === 'string') {
    const m = valor.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (m) {
      const hh = m[1].padStart(2, '0');
      const mm = m[2].padStart(2, '0');
      const ss = (m[3] || '00').padStart(2, '0');
      return `${hh}:${mm}:${ss}`;
    }
    return valor;
  }
  const d = new Date(valor);
  if (!Number.isNaN(d.getTime())) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;
  }
  return String(valor);
}

export function formatarHoraMostrar(valor) {
  const s = formatarHoraApi(valor);
  return s.length >= 5 ? s.slice(0, 5) : s;
}
