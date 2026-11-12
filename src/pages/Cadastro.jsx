import { useState } from 'react'
import AuthLayout from '../components/AuthLayout'
import SocialButtons from '../components/SocialButtons'
import { supabase } from '../lib/supabaseClient'
import { isEmailValido } from '../lib/validation'
import '../styles/forms.css'

/**
 * Tela de Cadastro.
 *
 * Campos: nome, e-mail, senha (+ confirmação), cidade, bairro. E-mail e
 * senha entraram porque o login passou a ser tradicional (decisão do CEO):
 * é aqui que o consumidor define a senha que vai usar depois para entrar.
 * Cidade/bairro são pedidos porque o app é todo orientado a "promoções do
 * bairro" — sem isso não dá nem para mostrar a Home depois. Os dois
 * checkboxes de aceite são obrigatórios porque o app depende de localização
 * para funcionar e porque estamos coletando dado pessoal (LGPD).
 *
 * O botão "Criar conta" só habilita quando tudo estiver preenchido, a senha
 * e a confirmação forem iguais e os dois aceites estiverem marcados — assim
 * a tela já deixa claro, sem precisar de texto de erro, o que falta para
 * seguir.
 */
function Cadastro({ onNavigateToLogin }) {
  const [form, setForm] = useState({
    nome: '',
    email: '',
    password: '',
    confirmPassword: '',
    cidade: '',
    bairro: '',
  })
  const [aceitaLocalizacao, setAceitaLocalizacao] = useState(false)
  const [aceitaPrivacidade, setAceitaPrivacidade] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [sucesso, setSucesso] = useState(false)

  const senhasConferem = form.password && form.password === form.confirmPassword

  const podeCriarConta =
    form.nome.trim() &&
    form.email.trim() &&
    form.cidade.trim() &&
    form.bairro.trim() &&
    senhasConferem &&
    aceitaLocalizacao &&
    aceitaPrivacidade

  function handleChange(field) {
    return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!podeCriarConta) return
    setErrorMessage('')
    setSucesso(false)

    if (!isEmailValido(form.email)) {
      setErrorMessage('Digite um e-mail válido.')
      return
    }

    setSubmitting(true)

    // Cria o usuário no Supabase Auth (e-mail + senha). Os dados de perfil
    // (nome/cidade/bairro/aceites) vão como user_metadata, NÃO como um
    // INSERT imediato em consumer_profiles: como a confirmação de e-mail
    // está ativada no projeto, signUp() não devolve uma sessão autenticada
    // (precisa confirmar o e-mail primeiro) — um INSERT nesse momento cai
    // sem auth.uid() e é sempre rejeitado pela RLS de consumer_profiles
    // (policy "to authenticated", ver database/migrations/002_rls_policies.sql).
    // A linha em consumer_profiles só é criada de verdade no primeiro login
    // bem-sucedido (ver Login.jsx), quando já existe uma sessão de verdade.
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          nome: form.nome,
          cidade: form.cidade,
          bairro: form.bairro,
          aceite_localizacao: aceitaLocalizacao,
          aceite_privacidade: aceitaPrivacidade,
        },
      },
    })

    if (error) {
      const mensagemErro = error.message?.toLowerCase() ?? ''
      let mensagem = 'Não foi possível criar a conta. Tente novamente.'

      if (mensagemErro.includes('already')) {
        mensagem = 'Esse e-mail já está cadastrado.'
      } else if (error.status === 429 || mensagemErro.includes('rate limit')) {
        // Erro de limite de tentativas (ou de rede/infra genérica com esse
        // código): não incentivamos o usuário a tentar de novo na hora, já
        // que isso só pioraria o rate limit.
        mensagem = 'Muitas tentativas em pouco tempo. Aguarde alguns minutos antes de tentar de novo.'
      }

      setErrorMessage(mensagem)
      setSubmitting(false)
      return
    }

    if (!data.user?.id) {
      // Caso raro: signUp sem erro mas sem usuário retornado.
      setErrorMessage('Não foi possível criar a conta. Tente novamente.')
      setSubmitting(false)
      return
    }

    console.log('[Cadastro] conta criada com sucesso para:', form.email)
    setSucesso(true)
    setSubmitting(false)
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
    setErrorMessage('Cadastro com Google ainda não disponível.')
  }

  function handleAppleClick() {
    setErrorMessage('Cadastro com Apple ainda não disponível.')
  }

  return (
    <AuthLayout
      title="Criar conta"
      subtitle="Leva menos de um minuto — só o essencial para achar promoções perto de você."
      footer={
        <span>
          Já tem conta?{' '}
          <button type="button" className="link" onClick={onNavigateToLogin}>
            Entrar
          </button>
        </span>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label className="field-label" htmlFor="cadastro-nome">
            Nome
          </label>
          <input
            id="cadastro-nome"
            name="nome"
            type="text"
            autoComplete="name"
            placeholder="ex: Joana Silva"
            className="field-input"
            value={form.nome}
            onChange={handleChange('nome')}
            required
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="cadastro-email">
            E-mail
          </label>
          <input
            id="cadastro-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="ex: joana@exemplo.com"
            className="field-input"
            value={form.email}
            onChange={handleChange('email')}
            required
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="cadastro-password">
            Senha
          </label>
          <input
            id="cadastro-password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Crie uma senha"
            className="field-input"
            value={form.password}
            onChange={handleChange('password')}
            required
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="cadastro-confirm-password">
            Confirmar senha
          </label>
          <input
            id="cadastro-confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Digite a senha novamente"
            className="field-input"
            value={form.confirmPassword}
            onChange={handleChange('confirmPassword')}
            required
          />
          {form.confirmPassword && !senhasConferem && (
            <span className="form-error">As senhas não coincidem.</span>
          )}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="cadastro-cidade">
            Cidade
          </label>
          <input
            id="cadastro-cidade"
            name="cidade"
            type="text"
            autoComplete="address-level2"
            placeholder="ex: Campo Grande"
            className="field-input"
            value={form.cidade}
            onChange={handleChange('cidade')}
            required
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="cadastro-bairro">
            Bairro
          </label>
          <input
            id="cadastro-bairro"
            name="bairro"
            type="text"
            placeholder="ex: Centro"
            className="field-input"
            value={form.bairro}
            onChange={handleChange('bairro')}
            required
          />
          <span className="field-hint">
            Usamos o bairro para mostrar promoções de mercados perto de você.
          </span>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={aceitaLocalizacao}
            onChange={(event) => setAceitaLocalizacao(event.target.checked)}
          />
          <span>
            Aceito compartilhar minha localização para encontrar mercados e
            promoções perto de mim.
          </span>
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={aceitaPrivacidade}
            onChange={(event) => setAceitaPrivacidade(event.target.checked)}
          />
          <span>
            Li e aceito a{' '}
            <a href="#" onClick={(e) => e.preventDefault()}>
              Política de Privacidade
            </a>{' '}
            (placeholder — link real a definir).
          </span>
        </label>

        {errorMessage && <span className="form-error">{errorMessage}</span>}
        {sucesso && (
          <span className="field-hint">
            Conta criada! Verifique seu e-mail (inclusive a caixa de spam) para confirmar antes de
            entrar.
          </span>
        )}

        <button type="submit" className="btn-primary" disabled={!podeCriarConta || submitting}>
          {submitting ? 'Criando conta...' : 'Criar conta'}
        </button>
      </form>

      <div className="divider">ou</div>

      <SocialButtons onGoogleClick={handleGoogleClick} onAppleClick={handleAppleClick} />
    </AuthLayout>
  )
}

export default Cadastro
