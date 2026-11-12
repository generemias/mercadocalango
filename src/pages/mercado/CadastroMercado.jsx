import { useState } from 'react'
import AuthLayout from '../../components/AuthLayout'
import { supabase } from '../../lib/supabaseClient'
import { isEmailValido } from '../../lib/validation'
import '../../styles/forms.css'

/**
 * Tela de Cadastro do mercado parceiro — mesmo papel que Cadastro.jsx tem
 * para o consumidor, mas para o lado da empresa.
 *
 * Antes desta tela, só existia um jeito de um mercado entrar no app: o CEO
 * criava a conta manualmente em Authentication > Users no painel do Supabase
 * (ver comentário em LoginMercado.jsx sobre isso). Virou um gargalo para
 * recrutar mais mercados parceiros, então o CEO pediu esta tela para o
 * próprio lojista criar a conta sozinho, igual ao consumidor já faz.
 *
 * Campos: nome do mercado, e-mail, senha (+ confirmação), cidade, bairro,
 * endereço. Os quatro últimos são os campos NOT NULL de market_profiles
 * (ver database/migrations/001_init.sql) — sem eles o INSERT falharia.
 * Latitude/longitude e horário de funcionamento ficam de fora deste
 * formulário (o lojista preenche depois em "Meu perfil", ver
 * PerfilMercado.jsx) para manter o cadastro inicial curto, no mesmo espírito
 * do cadastro do consumidor.
 *
 * Mesmo padrão do Cadastro.jsx do consumidor: os dados do formulário vão
 * como user_metadata dentro do próprio supabase.auth.signUp, em vez de um
 * INSERT imediato em market_profiles. Motivo: a confirmação de e-mail está
 * ativada no projeto, então signUp() não devolve uma sessão autenticada —
 * um INSERT nesse momento cairia sem auth.uid() e seria sempre rejeitado
 * pela RLS de market_profiles (policy "to authenticated", ver
 * database/migrations/002_rls_policies.sql). A linha em market_profiles só
 * é criada de verdade no primeiro login bem-sucedido (ver LoginMercado.jsx),
 * quando já existe uma sessão de verdade.
 */
function CadastroMercado({ onNavigateToLoginMercado }) {
  const [form, setForm] = useState({
    nome: '',
    email: '',
    password: '',
    confirmPassword: '',
    cidade: '',
    bairro: '',
    endereco: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [sucesso, setSucesso] = useState(false)

  const senhasConferem = form.password && form.password === form.confirmPassword

  const podeCriarConta =
    form.nome.trim() &&
    form.email.trim() &&
    form.cidade.trim() &&
    form.bairro.trim() &&
    form.endereco.trim() &&
    senhasConferem

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

    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          nome: form.nome,
          cidade: form.cidade,
          bairro: form.bairro,
          endereco: form.endereco,
        },
      },
    })

    if (error) {
      const mensagemErro = error.message?.toLowerCase() ?? ''
      let mensagem = 'Não foi possível criar a conta. Tente novamente.'

      if (mensagemErro.includes('already')) {
        mensagem = 'Esse e-mail já está cadastrado.'
      } else if (error.status === 429 || mensagemErro.includes('rate limit')) {
        mensagem = 'Muitas tentativas em pouco tempo. Aguarde alguns minutos antes de tentar de novo.'
      }

      setErrorMessage(mensagem)
      setSubmitting(false)
      return
    }

    if (!data.user?.id) {
      setErrorMessage('Não foi possível criar a conta. Tente novamente.')
      setSubmitting(false)
      return
    }

    console.log('[CadastroMercado] conta criada com sucesso para:', form.email)
    setSucesso(true)
    setSubmitting(false)
  }

  return (
    <AuthLayout
      eyebrow="Painel do mercado parceiro"
      title="Cadastrar mercado"
      subtitle="Crie a conta do seu mercado para publicar produtos e promoções."
      footer={
        <span>
          Já tem conta?{' '}
          <button type="button" className="link" onClick={onNavigateToLoginMercado}>
            Entrar
          </button>
        </span>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label className="field-label" htmlFor="cadastro-mercado-nome">
            Nome do mercado
          </label>
          <input
            id="cadastro-mercado-nome"
            name="nome"
            type="text"
            placeholder="ex: Mercadinho Bom Preço"
            className="field-input"
            value={form.nome}
            onChange={handleChange('nome')}
            required
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="cadastro-mercado-email">
            E-mail
          </label>
          <input
            id="cadastro-mercado-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="ex: contato@seumercado.com"
            className="field-input"
            value={form.email}
            onChange={handleChange('email')}
            required
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="cadastro-mercado-password">
            Senha
          </label>
          <input
            id="cadastro-mercado-password"
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
          <label className="field-label" htmlFor="cadastro-mercado-confirm-password">
            Confirmar senha
          </label>
          <input
            id="cadastro-mercado-confirm-password"
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
          <label className="field-label" htmlFor="cadastro-mercado-cidade">
            Cidade
          </label>
          <input
            id="cadastro-mercado-cidade"
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
          <label className="field-label" htmlFor="cadastro-mercado-bairro">
            Bairro
          </label>
          <input
            id="cadastro-mercado-bairro"
            name="bairro"
            type="text"
            placeholder="ex: Centro"
            className="field-input"
            value={form.bairro}
            onChange={handleChange('bairro')}
            required
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="cadastro-mercado-endereco">
            Endereço
          </label>
          <input
            id="cadastro-mercado-endereco"
            name="endereco"
            type="text"
            autoComplete="street-address"
            placeholder="ex: Rua das Flores, 123"
            className="field-input"
            value={form.endereco}
            onChange={handleChange('endereco')}
            required
          />
          <span className="field-hint">
            Depois de entrar, você pode adicionar a localização exata no mapa em "Meu perfil".
          </span>
        </div>

        {errorMessage && <span className="form-error">{errorMessage}</span>}
        {sucesso && (
          <span className="field-hint">
            Conta criada! Verifique seu e-mail (inclusive a caixa de spam) para confirmar antes de
            entrar.
          </span>
        )}

        <button type="submit" className="btn-primary" disabled={!podeCriarConta || submitting}>
          {submitting ? 'Criando conta...' : 'Criar conta do mercado'}
        </button>
      </form>
    </AuthLayout>
  )
}

export default CadastroMercado
