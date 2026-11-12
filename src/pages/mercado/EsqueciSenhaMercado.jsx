import { useState } from 'react'
import AuthLayout from '../../components/AuthLayout'
import { supabase } from '../../lib/supabaseClient'
import '../../styles/forms.css'

/**
 * Tela de "Esqueci minha senha" do painel do mercado parceiro.
 *
 * Mesma mecânica e mesmo texto de src/pages/EsqueciSenha.jsx (versão do
 * consumidor) — a chamada ao Supabase (resetPasswordForEmail) e as regras de
 * mensagem (genérica por segurança vs. erro real de infraestrutura) não
 * mudam entre os dois públicos. A única diferença proposital é visual: aqui
 * usamos o selo "Painel do mercado parceiro" (prop eyebrow do AuthLayout),
 * o mesmo já usado em LoginMercado.jsx, para o lojista saber que está no
 * lugar certo.
 *
 * onNavigateToLoginMercado: volta para a tela de Login do mercado (mesmo
 * esquema de "trocador de tela" temporário usado em todo o app via
 * App.jsx).
 */
function EsqueciSenhaMercado({ onNavigateToLoginMercado }) {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')
    setSubmitting(true)

    // redirectTo: mesma observação de EsqueciSenha.jsx (consumidor) — ainda
    // não existe tela de "definir nova senha" nem domínio definido no MVP,
    // então deixamos sem redirectTo (usa o padrão do projeto Supabase).
    const { error } = await supabase.auth.resetPasswordForEmail(email)

    setSubmitting(false)

    if (error) {
      // Mesma regra de segurança do EsqueciSenha.jsx do consumidor: o
      // Supabase não avisa se o e-mail existe ou não (de propósito, para não
      // vazar quais contas existem) — mantemos a mensagem genérica nesse
      // caso. Um erro de verdade (rede fora do ar, limite de envios,
      // problema no servidor) não tem a ver com o e-mail existir ou não,
      // então avisamos o usuário em vez de fingir que o link foi enviado.
      setErrorMessage('Não foi possível processar sua solicitação agora. Tente novamente.')
      return
    }

    setEnviado(true)
  }

  return (
    <AuthLayout
      eyebrow="Painel do mercado parceiro"
      title="Esqueci minha senha"
      subtitle="Informe seu e-mail e enviaremos um link para redefinir sua senha."
      footer={
        <span>
          Lembrou a senha?{' '}
          <button type="button" className="link" onClick={onNavigateToLoginMercado}>
            Voltar para o login
          </button>
        </span>
      }
    >
      {enviado ? (
        <p className="field-hint">
          Se o e-mail <strong>{email}</strong> estiver cadastrado, enviamos um
          link de redefinição de senha para ele.
        </p>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label className="field-label" htmlFor="esqueci-mercado-email">
              E-mail
            </label>
            <input
              id="esqueci-mercado-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="ex: contato@seumercado.com"
              className="field-input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          {errorMessage && <span className="form-error">{errorMessage}</span>}

          <button type="submit" className="btn-primary" disabled={!email || submitting}>
            {submitting ? 'Enviando...' : 'Enviar link de redefinição'}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}

export default EsqueciSenhaMercado
