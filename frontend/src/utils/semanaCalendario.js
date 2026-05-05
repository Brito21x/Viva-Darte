/** Devolve YYYY-MM-DD a partir de um Date local. */
export function toYMD(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseYMD(s) {
  if (!s) return null;
  const [y, m, dd] = String(s).split('T')[0].split('-').map(Number);
  if (!y || !m || !dd) return null;
  return new Date(y, m - 1, dd);
}

/** Segunda-feira da semana que contém `ymd` (ou hoje). */
export function segundaDaSemanaDe(ymd) {
  const d = ymd ? parseYMD(ymd) : new Date();
  if (!d || Number.isNaN(d.getTime())) return toYMD(new Date());
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toYMD(d);
}

export function adicionarDias(ymd, n) {
  const d = parseYMD(ymd);
  if (!d) return ymd;
  d.setDate(d.getDate() + n);
  return toYMD(d);
}

/** Lista de 7 YMD a partir da segunda `segundaYmd`. */
export function diasDaSemana(segundaYmd) {
  const out = [];
  let cur = segundaYmd;
  for (let i = 0; i < 7; i++) {
    out.push(cur);
    cur = adicionarDias(cur, 1);
  }
  return out;
}

const LABELS_DIA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export function labelDiaSemanaCurto(ymd) {
  const d = parseYMD(ymd);
  if (!d) return '';
  const idx = d.getDay() === 0 ? 6 : d.getDay() - 1;
  return LABELS_DIA[idx] || '';
}

export function diaMesCurto(ymd) {
  const d = parseYMD(ymd);
  if (!d) return '';
  return String(d.getDate());
}

const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** Ex.: «Seg · 5 Mai». */
export function formatDiaCurtoPT(ymd) {
  const d = parseYMD(ymd);
  if (!d) return '';
  const mes = MESES_PT[d.getMonth()] || '';
  return `${labelDiaSemanaCurto(ymd)} · ${d.getDate()} ${mes}`;
}

/** Texto curto do intervalo da semana (ex.: «3–9 Fev 2026»). */
export function formatIntervaloSemanaPT(segundaYmd) {
  const dias = diasDaSemana(segundaYmd);
  const ini = dias[0];
  const fim = dias[6];
  const di = parseYMD(ini);
  const df = parseYMD(fim);
  if (!di || !df) return '';
  const mi = di.getMonth();
  const mf = df.getMonth();
  const yi = di.getFullYear();
  const yf = df.getFullYear();
  const ddi = di.getDate();
  const ddf = df.getDate();
  if (mi === mf && yi === yf) {
    return `${ddi}–${ddf} ${MESES_PT[mi]} ${yi}`;
  }
  return `${ddi} ${MESES_PT[mi]} – ${ddf} ${MESES_PT[mf]} ${yf}`;
}

const MESES_PT_LONGO = [
  'jan.',
  'fev.',
  'mar.',
  'abr.',
  'mai.',
  'jun.',
  'jul.',
  'ago.',
  'set.',
  'out.',
  'nov.',
  'dez.'
];

/** Ex.: «4 – 10 de mai. de 2026» (cabeçalho tipo Google Calendar). */
export function formatIntervaloSemanaLongoPT(segundaYmd) {
  const dias = diasDaSemana(segundaYmd);
  const di = parseYMD(dias[0]);
  const df = parseYMD(dias[6]);
  if (!di || !df) return '';
  const mi = di.getMonth();
  const mf = df.getMonth();
  const yi = di.getFullYear();
  const yf = df.getFullYear();
  const ddi = di.getDate();
  const ddf = df.getDate();
  if (mi === mf && yi === yf) {
    return `${ddi} – ${ddf} de ${MESES_PT_LONGO[mf]} de ${yf}`;
  }
  if (yi === yf) {
    return `${ddi} de ${MESES_PT_LONGO[mi]} – ${ddf} de ${MESES_PT_LONGO[mf]} de ${yf}`;
  }
  return `${ddi} de ${MESES_PT_LONGO[mi]} de ${yi} – ${ddf} de ${MESES_PT_LONGO[mf]} de ${yf}`;
}

/** Ex.: «seg. 04/05» para cabeçalho de coluna. */
export function formatDiaCabecalhoAgenda(ymd) {
  const d = parseYMD(ymd);
  if (!d) return '';
  const dow = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'][d.getDay()];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dow} ${dd}/${mm}`;
}

const MESES_NOME_COMPLETO = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro'
];

const DIAS_SEMANA_COMPLETO = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado'
];

/** Ex.: «5 de maio de 2026» (barra do calendário, vista dia). */
export function formatDataLongaPT(ymd) {
  const d = parseYMD(ymd);
  if (!d) return '';
  const mes = MESES_NOME_COMPLETO[d.getMonth()] || '';
  return `${d.getDate()} de ${mes} de ${d.getFullYear()}`;
}

/** Ex.: «terça-feira» */
export function nomeDiaSemanaCompletoPT(ymd) {
  const d = parseYMD(ymd);
  if (!d) return '';
  return DIAS_SEMANA_COMPLETO[d.getDay()] || '';
}

/** Ex.: «05/05/2026» */
export function formatDataBarraPT(ymd) {
  const d = parseYMD(ymd);
  if (!d) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}
