// Validação simples de formato de e-mail (regex básica, não tenta cobrir
// todos os casos da RFC — só pega os erros de digitação mais comuns, ex:
// "joana@" sem domínio, ou "joana.com" sem @). Os formulários usam
// `noValidate` no <form>, então essa é a única checagem de formato que
// roda antes de chamar o Supabase.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isEmailValido(email) {
  return EMAIL_REGEX.test(email.trim())
}
