import { useState } from 'react'
import AuthLayout from '../components/AuthLayout'
import { supabase } from '../lib/supabaseClient'
import '../styles/forms.css'

/**
 * Tela de "Esqueci minha senha".
 *
 * Só pede o e-mail e dispara o fluxo de redefinição — a tela de "definir
 * nova senha" em si não entra aqui, porque depende de como o Supabase vai
 * redirecionar o usuário de volta para o app (link de e-mail com token),
 * o que é decisão do desenvolvedor na integração.
 *
 * onNavigateToLogin: volta para a tela de Login (mesmo esquema de
 * "trocador de tela" temporário usado em Login/Cadastro via App.jsx).
 */
function EsqueciSenha({ onNavigateToLogin }) {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')
    setSubmitting(true)

    // redirectTo: para onde o link do e-mail leva o usuário para digitar a
    // nova senha. Ainda não existe essa tela nem domínio definido no MVP —
    // por enquanto deixamos sem redirectTo (usa o padrão do projeto Supabase).
    // Quando a tela "Redefinir senha" existir, voltar aqui e definir isso.
    const { error } = await supabase.auth.resetPasswordForEmail(email)

    setSubmitting(false)

    if (error) {
      // O Supabase, por padrão, não avisa se o e-mail existe ou não (isso é
      // de propósito, para não vazar quais e-mails têm conta — mantemos essa
      // mensagem genérica de segurança nesse caso). Mas se vier um erro de
      // verdade (rede fora do ar, limite de envios, problema no servidor),
      // isso não tem a ver com o e-mail existir ou não — então avisamos o
      // usuário em vez de fingir que o link foi enviado.
      setErrorMessage('Não foi possível processar sua solicitação agora. Tente novamente.')
      return
    }

    setEnviado(true)
  }

  return (
    <AuthLayout
      title="Esqueci minha senha"
      subtitle="Informe seu e-mail e enviaremos um link para redefinir sua senha."
      footer={
        <span>
          Lembrou a senha?{' '}
          <button type="button" className="link" onClick={onNavigateToLogin}>
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
            <label className="field-label" htmlFor="esqueci-email">
              E-mail
            </label>
            <input
              id="esqueci-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="ex: joana@exemplo.com"
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

export default EsqueciSenha
