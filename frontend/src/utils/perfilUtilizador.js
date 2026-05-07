/**
 * Deteção de perfil a partir de `viva_user` (login guarda `perfil` e `perfis` do JWT).
 * Evita falhas quando o texto do perfil na BD não coincide exactamente com 'Professor'.
 */
export function isProfessorUtilizador(u) {
  if (!u) return false;
  const p = String(u.perfil || '').toLowerCase();
  if (p.includes('prof')) return true;
  const perfis = Array.isArray(u.perfis) ? u.perfis : [];
  return perfis.some((x) => String(x).toLowerCase().includes('prof'));
}

export function isEncarregadoUtilizador(u) {
  if (!u) return false;
  const p = String(u.perfil || '').toLowerCase();
  if (p.includes('encarregado') || p === 'ee' || p.includes('educação') || p.includes('educacao')) return true;
  const perfis = Array.isArray(u.perfis) ? u.perfis : [];
  return perfis.some((x) => {
    const s = String(x).toLowerCase();
    return s.includes('encarregado') || s === 'ee' || s.includes('educação') || s.includes('educacao');
  });
}
