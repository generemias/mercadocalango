import { useState } from 'react'
import AuthLayout from '../../components/AuthLayout'
import { supabase } from '../../lib/supabaseClient'
import { isEmailValido } from '../../lib/validation'
import '../../styles/forms.css'

/**
 * Tela de Login do painel do mercado parceiro.
 *
 * Por que um componente separado do Login do consumidor (src/pages/Login.jsx)
 * em vez de reaproveitar a mesma tela com uma prop "tipo"?
 * - São públicos diferentes (consumidor vs. lojista) com jornadas que vão
 *   divergir rápido (o painel do mercado não tem Google/Apple, não tem
 *   "Esqueci minha senha" ainda, e mais adiante vai ganhar telas que o
 *   consumidor nunca vê — cadastro de produtos, dashboard). Forçar os dois
 *   fluxos dentro do mesmo componente criaria uma tela cheia de "if tipo ===
 *   mercado" só para esconder/mostrar pedaços — mais difícil de ler e de
 *   mudar depois.
 * - Em troca, reaproveitamos o que É igual visualmente: AuthLayout (mesma
 *   moldura de card/logo) e styles/forms.css (mesmos campos, botão, erro),
 *   então as duas telas continuam parecendo o mesmo produto.
 *
 * Diferenças propositais em relação ao Login do consumidor:
 * - Só e-mail/senha (sem Google/Apple) — decisão já tomada pelo CEO para o
 *   painel do mercado.
 * - Sem "Esqueci minha senha" por enquanto (não faz parte do escopo atual;
 *   não inventar aqui, pode ser pedido pelo CEO mais tarde).
 * - Selo "Painel do mercado parceiro" acima do título (prop eyebrow do
 *   AuthLayout), para o lojista saber de imediato que está no lugar certo —
 *   e para quem usa o app do consumidor e caiu aqui por engano perceber que
 *   não é a tela dele.
 *
 * onNavigateToLoginConsumidor: troca para o Login do consumidor (mesmo
 * padrão de navegação por callback já usado em todo o app; ver comentário
 * em src/App.jsx sobre o "trocador de tela" temporário).
 * onLoginSuccess: chamado SÓ quando o login no Supabase Auth funcionou E já
 * existe uma linha em market_profiles para esse usuário (ver comentário em
 * handleSubmit sobre por quê essa checagem extra existe). Quem usa este
 * componente decide a próxima tela — hoje o App.jsx ainda não tem para onde
 * ir (dashboard do mercado é a próxima etapa), mas o login em si já funciona
 * de verdade.
 */
function LoginMercado({ onNavigateToLoginConsumidor, onLoginSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')

    if (!isEmailValido(email)) {
      setErrorMessage('Digite um e-mail válido.')
      return
    }

    setSubmitting(true)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      const mensagemErro = error.message?.toLowerCase() ?? ''

      // Mesmo padrão de segurança do Login do consumidor (src/pages/Login.jsx):
      // mensagem genérica para qualquer falha de credenciais, para não
      // revelar se o e-mail existe; só o caso de e-mail não confirmado tem
      // mensagem específica, porque ela não vaza essa informação (quem
      // acabou de ser cadastrado pelo CEO sabe que precisa confirmar).
      setErrorMessage(
        mensagemErro.includes('email not confirmed') || mensagemErro.includes('confirm')
          ? 'Você precisa confirmar seu e-mail antes de entrar. Verifique sua caixa de entrada.'
          : 'E-mail ou senha inválidos.'
      )
      setSubmitting(false)
      return
    }

    // Login no Auth funcionou. Mas diferente do app do consumidor, aqui não
    // existe tela de cadastro — o CEO cria a conta manualmente em
    // Authentication > Users no painel do Supabase. Isso significa que pode
    // existir um usuário autenticável sem nenhuma linha correspondente em
    // market_profiles (ex: o CEO esqueceu de inserir a linha, ou inseriu com
    // o id errado). As próximas telas do painel (dashboard, cadastro de
    // produtos) dependem de market_profiles existir para este id — então
    // checamos aqui, antes de avisar sucesso, em vez de deixar essas telas
    // (que ainda nem existem) quebrarem sem explicação.
    const userId = data.user?.id
    const { data: perfilMercado, error: erroPerfil } = await supabase
      .from('market_profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (erroPerfil) {
      setErrorMessage('Não foi possível verificar seu perfil agora. Tente novamente em instantes.')
      setSubmitting(false)
      return
    }

    if (!perfilMercado) {
      setErrorMessage(
        'Sua conta foi criada, mas o perfil do mercado ainda não foi configurado. Entre em contato com o suporte.'
      )
      setSubmitting(false)
      return
    }

    console.log('[LoginMercado] login feito com sucesso para:', email)
    setSubmitting(false)
    onLoginSuccess?.()
  }

  return (
    <AuthLayout
      eyebrow="Painel do mercado parceiro"
      title="Entrar"
      subtitle="Acesse para atualizar seus produtos e promoções."
      footer={
        <button type="button" className="link" onClick={onNavigateToLoginConsumidor}>
          Sou consumidor, voltar
        </button>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label className="field-label" htmlFor="login-mercado-email">
            E-mail
          </label>
          <input
            id="login-mercado-email"
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

        <div className="field">
          <label className="field-label" htmlFor="login-mercado-password">
            Senha
          </label>
          <input
            id="login-mercado-password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Sua senha"
            className="field-input"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        {errorMessage && <span className="form-error">{errorMessage}</span>}

        <button type="submit" className="btn-primary" disabled={!email || !password || submitting}>
          {submitting ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </AuthLayout>
  )
}

export default LoginMercado
