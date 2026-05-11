/** Parse YYYY-MM-DD em Date local (evita desvios UTC). */
export function parseDateParts(dataValor) {
  if (!dataValor) return null;
  const s =
    dataValor instanceof Date
      ? `${dataValor.getFullYear()}-${String(dataValor.getMonth() + 1).padStart(2, "0")}-${String(
          dataValor.getDate(),
        ).padStart(2, "0")}`
      : String(dataValor).split("T")[0];
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** Início da aula no fuso local (data_aula + hora_inicio). */
export function instanteInicioCoaching({ data_aula, hora_inicio }) {
  const d =
    data_aula instanceof Date ? new Date(data_aula) : parseDateParts(data_aula);
  if (!d) return null;
  let hh = 0;
  let mm = 0;
  let ss = 0;
  if (hora_inicio instanceof Date) {
    hh = hora_inicio.getHours();
    mm = hora_inicio.getMinutes();
    ss = hora_inicio.getSeconds();
  } else if (hora_inicio != null) {
    const m = String(hora_inicio).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (m) {
      hh = parseInt(m[1], 10);
      mm = parseInt(m[2], 10);
      ss = m[3] ? parseInt(m[3], 10) : 0;
    }
  }
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm, ss);
}

/** Fim previsto da aula (início + duração; fallback 60 min). */
export function instanteFimCoaching(cab) {
  const inicio = instanteInicioCoaching(cab);
  if (!inicio) return null;
  const dur = Number(cab.duracao_minutos);
  const minutos = Number.isFinite(dur) && dur > 0 ? dur : 60;
  return new Date(inicio.getTime() + minutos * 60000);
}

/** Aula já terminou e o coaching permite validação pelo EE/prof (Agendado ou Confirmado). */
export function podeMostrarValidacaoRealizacao(row) {
  const estado = String(row.estado_coaching || row.estado || "").trim();
  if (!["Agendado", "Confirmado"].includes(estado)) return false;
  const fim = instanteFimCoaching({
    data_aula: row.data_aula_coaching ?? row.data_aula,
    hora_inicio: row.hora_inicio_coaching ?? row.hora_inicio,
    duracao_minutos: row.duracao_minutos,
  });
  if (!fim) return false;
  return fim.getTime() <= Date.now();
}
