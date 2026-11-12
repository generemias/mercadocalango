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
 * - "Esqueci minha senha" leva para EsqueciSenhaMercado.jsx (aprovado pelo
 *   CEO), que usa a mesma mecânica do EsqueciSenha.jsx do consumidor, só com
 *   o selo do painel do mercado em vez do layout padrão do consumidor.
 * - Selo "Painel do mercado parceiro" acima do título (prop eyebrow do
 *   AuthLayout), para o lojista saber de imediato que está no lugar certo —
 *   e para quem usa o app do consumidor e caiu aqui por engano perceber que
 *   não é a tela dele.
 *
 * onNavigateToLoginConsumidor: troca para o Login do consumidor (mesmo
 * padrão de navegação por callback já usado em todo o app; ver comentário
 * em src/App.jsx sobre o "trocador de tela" temporário).
 * onNavigateToCadastro: troca para a tela "Cadastrar mercado"
 * (CadastroMercado.jsx) — agora que o próprio lojista pode criar a conta
 * sozinho, em vez de depender do CEO criar manualmente no Supabase (ver
 * comentário mais abaixo, no handleSubmit, sobre como isso funcionava antes).
 * onLoginSuccess: chamado quando o login funcionou E já existe (ou acabou de
 * ser criada) uma linha em market_profiles para esse usuário.
 * onPerfilIncompleto: chamado quando o login funcionou mas market_profiles
 * ainda não existe e não há dados suficientes (user_metadata do
 * CadastroMercado.jsx, ou uma conta antiga criada manualmente pelo CEO sem
 * esses dados) para criar a linha sozinho — em vez de travar o lojista com
 * um erro sem saída, deixamos ele entrar e cair direto em "Meu perfil"
 * (PerfilMercado.jsx), que já sabe criar o perfil do zero.
 */
function LoginMercado({
  onNavigateToLoginConsumidor,
  onNavigateToEsqueciSenha,
  onNavigateToCadastro,
  onLoginSuccess,
  onPerfilIncompleto,
}) {
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

    // Login no Auth funcionou. market_profiles ainda pode não existir por
    // dois motivos: (1) CadastroMercado.jsx guardou os dados como
    // user_metadata em vez de um INSERT direto (a confirmação de e-mail
    // deixa signUp() sem sessão naquele momento — mesmo motivo explicado em
    // Cadastro.jsx), e este é o primeiro login com sessão de verdade para
    // criar a linha a partir deles; ou (2) é uma conta antiga, criada
    // manualmente pelo CEO antes de existir tela de cadastro, sem user
    // metadata nenhum. Tratamos os dois casos aqui, antes de avisar sucesso,
    // em vez de deixar as próximas telas do painel (que dependem de
    // market_profiles existir) quebrarem sem explicação.
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
      const metadata = data.user?.user_metadata ?? {}
      if (metadata.nome && metadata.cidade && metadata.bairro && metadata.endereco) {
        const { error: erroInsert } = await supabase.from('market_profiles').insert({
          id: userId,
          nome: metadata.nome,
          cidade: metadata.cidade,
          bairro: metadata.bairro,
          endereco: metadata.endereco,
        })

        if (!erroInsert) {
          console.log('[LoginMercado] login feito com sucesso para:', email)
          setSubmitting(false)
          onLoginSuccess?.()
          return
        }
      }

      // Sem metadata suficiente (conta antiga do CEO) ou o INSERT falhou:
      // deixa entrar mesmo assim, indo direto para "Meu perfil" completar.
      console.log('[LoginMercado] login feito, perfil incompleto, para:', email)
      setSubmitting(false)
      onPerfilIncompleto?.()
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
        <span>
          <span>
            Ainda não tem conta?{' '}
            <button type="button" className="link" onClick={onNavigateToCadastro}>
              Cadastrar mercado
            </button>
          </span>
          <br />
          <button type="button" className="link" onClick={onNavigateToLoginConsumidor}>
            Sou consumidor, voltar
          </button>
        </span>
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
          <button type="button" className="forgot-link" onClick={onNavigateToEsqueciSenha}>
            Esqueci minha senha
          </button>
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
