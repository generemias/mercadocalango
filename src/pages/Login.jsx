import { useState } from 'react'
import AuthLayout from '../components/AuthLayout'
import SocialButtons from '../components/SocialButtons'
import { supabase } from '../lib/supabaseClient'
import { isEmailValido } from '../lib/validation'
import '../styles/forms.css'

/**
 * Tela de Login.
 *
 * Login tradicional (e-mail + senha), por decisão do CEO. A conta e a senha
 * são criadas na tela de Cadastro; aqui só autenticamos com o que já existe.
 *
 * onNavigateToCadastro: função chamada ao clicar em "Criar conta", para o
 * componente que está usando esta tela trocar para o Cadastro (hoje o
 * App.jsx faz isso com um simples useState; quando o projeto adicionar
 * roteamento, aqui entraria algo como navigate('/cadastro')).
 */
function Login({
  onNavigateToCadastro,
  onNavigateToEsqueciSenha,
  onLoginSuccess,
  onNavigateToLoginMercado,
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [sucesso, setSucesso] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')
    setSucesso(false)

    if (!isEmailValido(email)) {
      setErrorMessage('Digite um e-mail válido.')
      return
    }

    setSubmitting(true)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      const mensagemErro = error.message?.toLowerCase() ?? ''

      // Caso específico: e-mail ainda não confirmado. Isso não revela se
      // uma conta existe para quem não passou pelo Cadastro antes — só
      // orienta quem genuinamente acabou de se cadastrar e ainda não
      // confirmou o e-mail. Para qualquer outro erro (senha errada, e-mail
      // que não existe, etc.) mantemos a mensagem genérica de propósito,
      // para não revelar se o e-mail está cadastrado (boa prática de
      // segurança em login).
      setErrorMessage(
        mensagemErro.includes('email not confirmed') || mensagemErro.includes('confirm')
          ? 'Você precisa confirmar seu e-mail antes de entrar. Verifique sua caixa de entrada.'
          : 'E-mail ou senha inválidos.'
      )
      setSubmitting(false)
      return
    }

    // Garante que o perfil existe antes de seguir. Ver comentário em
    // Cadastro.jsx: o INSERT em consumer_profiles não acontece mais no
    // cadastro (a confirmação de e-mail deixa signUp() sem sessão naquele
    // momento), então é aqui, no primeiro login com sessão de verdade, que
    // criamos a linha a partir dos dados salvos como user_metadata.
    const userId = data.user?.id
    const { data: perfilExistente, error: erroPerfil } = await supabase
      .from('consumer_profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (!erroPerfil && !perfilExistente) {
      const metadata = data.user?.user_metadata ?? {}
      if (metadata.nome && metadata.cidade && metadata.bairro) {
        await supabase.from('consumer_profiles').insert({
          id: userId,
          nome: metadata.nome,
          cidade: metadata.cidade,
          bairro: metadata.bairro,
          aceite_localizacao: Boolean(metadata.aceite_localizacao),
          aceite_privacidade: Boolean(metadata.aceite_privacidade),
        })
      }
    }

    // Ainda não existe roteador de verdade nesta etapa do MVP — por isso
    // quem usa este componente decide o que acontece a seguir via
    // onLoginSuccess (hoje o App.jsx troca para a Home com um simples
    // useState; quando o projeto adicionar rotas reais, aqui entraria algo
    // como navigate('/home')).
    console.log('[Login] login feito com sucesso para:', email)
    setSucesso(true)
    setSubmitting(false)
    onLoginSuccess?.()
  }

  // Login social (Google/Apple): o CEO ainda não configurou os provedores
  // OAuth no painel do Supabase (Authentication > Providers). Enquanto isso
  // não acontece, NÃO chamamos supabase.auth.signInWithOAuth de verdade,
  // porque ele faz um redirect de página inteira do navegador — sem os
  // provedores configurados, isso ejeta o usuário do app para uma tela de
  // erro do navegador, sem volta. Por isso só mostramos um aviso inline.
  //
  // Quando o CEO confirmar que os provedores foram configurados, trocar o
  // corpo destas funções de volta para:
  //   supabase.auth.signInWithOAuth({ provider: 'google' })
  //   supabase.auth.signInWithOAuth({ provider: 'apple' })
  function handleGoogleClick() {
    setErrorMessage('Login com Google ainda não disponível.')
  }

  function handleAppleClick() {
    setErrorMessage('Login com Apple ainda não disponível.')
  }

  return (
    <AuthLayout
      title="Bem-vindo de volta"
      subtitle="Entre para ver sua lista e as promoções do seu bairro."
      footer={
        <>
          <span>
            Ainda não tem conta?{' '}
            <button type="button" className="link" onClick={onNavigateToCadastro}>
              Criar conta
            </button>
          </span>
          {/* Link discreto: o consumidor comum nunca precisa disso, então
              fica separado do fluxo principal (fonte menor, abaixo), mas
              ainda visível para o mercado parceiro que abrir o app por
              engano. */}
          <p className="auth-footer-secondary">
            É um mercado parceiro?{' '}
            <button type="button" className="link" onClick={onNavigateToLoginMercado}>
              Entrar aqui
            </button>
          </p>
        </>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label className="field-label" htmlFor="login-email">
            E-mail
          </label>
          <input
            id="login-email"
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

        <div className="field">
          <label className="field-label" htmlFor="login-password">
            Senha
          </label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Sua senha"
            className="field-input"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button type="button" className="forgot-link" onClick={onNavigateToEsqueciSenha}>
            Esqueci minha senha
          </button>
        </div>

        {errorMessage && <span className="form-error">{errorMessage}</span>}
        {sucesso && <span className="field-hint">Login feito com sucesso.</span>}

        <button type="submit" className="btn-primary" disabled={!email || !password || submitting}>
          {submitting ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <div className="divider">ou</div>

      <SocialButtons onGoogleClick={handleGoogleClick} onAppleClick={handleAppleClick} />
    </AuthLayout>
  )
}

export default Login
