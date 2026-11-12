import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import '../../styles/forms.css'
import './PerfilMercado.css'

/**
 * Tela "Perfil do mercado" do painel do mercado parceiro.
 *
 * Por que esta tela precisa existir: market_profiles (nome, cidade, bairro,
 * endereco, latitude, longitude, horario_funcionamento) hoje só pode ser
 * criado/editado via SQL manual no Supabase pelo CEO. Isso tem dois
 * problemas: (1) o lojista não consegue corrigir o próprio endereço ou
 * horário sem pedir ajuda, e (2) se o CEO criar a conta no Auth e esquecer
 * do INSERT manual em market_profiles, o lojista fica travado no Login (ver
 * LoginMercado.jsx, mensagem "perfil do mercado ainda não foi configurado").
 * Esta tela resolve os dois casos com o MESMO formulário:
 * - Perfil já existe → formulário vem preenchido, botão "Salvar alterações".
 * - Perfil não existe ainda → formulário vem vazio, botão "Salvar perfil"
 *   (mesmo texto adaptado conforme o caso, já usado em
 *   CadastroProdutos.jsx entre "Cadastrar produto" / "Salvar alterações").
 *
 * 3ª aba do painel do mercado (ao lado de "Produtos" e "Dashboard") — ver
 * mesma barra .mercado-tabs em CadastroProdutos.jsx e DashboardMercado.jsx.
 *
 * TODO (desenvolvedor) — integração real com Supabase:
 * 1. Ao montar: supabase.auth.getUser() para pegar o id do mercado logado
 *    (mesmo id usado em LoginMercado.jsx/CadastroProdutos.jsx). Com esse id,
 *    SELECT em market_profiles (nome, cidade, bairro, endereco, latitude,
 *    longitude, horario_funcionamento) .eq('id', marketId).maybeSingle().
 *    - Se vier uma linha: perfilExistente = true, preenche o formulário.
 *    - Se vier null (sem erro): perfilExistente = false, formulário vazio —
 *      é o caso "CEO criou só no Auth, sem o INSERT manual".
 * 2. Ao salvar:
 *    - perfilExistente === true  → UPDATE em market_profiles .eq('id', marketId)
 *      com os campos do formulário.
 *    - perfilExistente === false → INSERT em market_profiles com
 *      { id: marketId, ...camposDoFormulario } (o id do mercado é o mesmo id
 *      do Supabase Auth, não um id novo gerado pelo banco).
 *    Depois de um INSERT bem-sucedido, trocar perfilExistente para true (o
 *    formulário continua na tela, mas o botão passa a dizer "Salvar
 *    alterações" e futuras ações devem fazer UPDATE, não INSERT de novo).
 * 3. Latitude/longitude: validar que são números dentro da faixa válida
 *    (-90 a 90 / -180 a 180) antes de enviar — por enquanto só exigimos que
 *    sejam números (ver handleSalvar). Sem mapa interativo nesta etapa (ver
 *    comentário no campo mais abaixo); é complexidade de uma etapa futura.
 * 4. Nome do mercado: ao salvar com sucesso, também vale notificar quem usa
 *    este componente (ex: callback onNomeAtualizado) para o cabeçalho de
 *    CadastroProdutos.jsx/DashboardMercado.jsx atualizar sem precisar
 *    recarregar a página — por enquanto não existe esse callback.
 *
 * Decisões de design (explicadas em detalhe na resposta ao CEO):
 * 1. Sem toggle "Editar" como em src/pages/Perfil.jsx do consumidor — aqui o
 *    formulário já abre editável direto. Motivo: esta tela também precisa
 *    servir para CRIAR o perfil do zero (formulário vazio), e um botão
 *    "Editar" não faz sentido sobre um card que ainda não tem dado nenhum
 *    para mostrar. Um único modo evita duas versões de tela para o mesmo
 *    formulário.
 * 2. Latitude/longitude são dois campos numéricos simples lado a lado, sem
 *    mapa — decisão explícita do CEO para não trazer complexidade de mapa
 *    interativo nesta etapa. Uma nota de ajuda explica como o lojista pega
 *    esses números no Google Maps.
 * 3. Horário de funcionamento é texto livre (ex: "Seg a Sáb, 08h às 20h"),
 *    não um seletor de dias/horas — mesmo formato já usado hoje nos dados
 *    inseridos manualmente, e qualquer mercado piloto consegue escrever sem
 *    ajuda.
 * 4. Mesmo layout de card único + formulário das outras telas do painel
 *    (.mercado-form-secao, .field, .btn-primary/.btn-secundario), para o
 *    lojista continuar no mesmo produto visual.
 *
 * Props:
 * - onNavigateToProdutos / onNavigateToDashboard: troca de aba (mesmo
 *   padrão de navegação por callback já usado em todo o painel do mercado).
 * - onSair: chamado depois do logout (mesmo padrão das outras telas).
 */

const FORM_VAZIO = {
  nome: '',
  cidade: '',
  bairro: '',
  endereco: '',
  horario_funcionamento: '',
  latitude: '',
  longitude: '',
}

function PerfilMercado({ onNavigateToProdutos, onNavigateToDashboard, onSair }) {
  const [marketId, setMarketId] = useState(null)
  // true = já existe uma linha em market_profiles para este mercado (modo
  // "editar"); false = ainda não existe (modo "criar pela primeira vez").
  const [perfilExistente, setPerfilExistente] = useState(false)
  const [form, setForm] = useState(FORM_VAZIO)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [erroForm, setErroForm] = useState('')
  const [mensagemSucesso, setMensagemSucesso] = useState('')
  const [saindo, setSaindo] = useState(false)

  useEffect(() => {
    carregarPerfil()
  }, [])

  async function carregarPerfil() {
    setCarregando(true)
    setErro(null)

    // TODO (desenvolvedor): substituir pelo supabase.auth.getUser() real +
    // SELECT em market_profiles (ver comentário no topo do arquivo). Por
    // enquanto a tela mostra o formulário vazio (caso "criar pela primeira
    // vez"), só para dar para visualizar o layout.
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user) {
      setErro('Não foi possível identificar seu mercado. Tente entrar novamente.')
      setCarregando(false)
      return
    }

    const idMercado = userData.user.id
    setMarketId(idMercado)

    const { data: perfilMercado, error: erroPerfil } = await supabase
      .from('market_profiles')
      .select('nome, cidade, bairro, endereco, horario_funcionamento, latitude, longitude')
      .eq('id', idMercado)
      .maybeSingle()

    if (erroPerfil) {
      setErro('Não foi possível carregar os dados do seu mercado agora.')
      setCarregando(false)
      return
    }

    if (!perfilMercado) {
      // Caso "CEO criou a conta no Auth, mas ainda não inseriu a linha em
      // market_profiles" — em vez de travar (como LoginMercado.jsx faz
      // hoje), abrimos esta tela com o formulário vazio para o próprio
      // lojista preencher e criar o perfil.
      setPerfilExistente(false)
      setForm(FORM_VAZIO)
      setCarregando(false)
      return
    }

    setPerfilExistente(true)
    setForm({
      nome: perfilMercado.nome ?? '',
      cidade: perfilMercado.cidade ?? '',
      bairro: perfilMercado.bairro ?? '',
      endereco: perfilMercado.endereco ?? '',
      horario_funcionamento: perfilMercado.horario_funcionamento ?? '',
      latitude: perfilMercado.latitude != null ? String(perfilMercado.latitude) : '',
      longitude: perfilMercado.longitude != null ? String(perfilMercado.longitude) : '',
    })
    setCarregando(false)
  }

  async function handleSalvar(event) {
    event.preventDefault()
    setMensagemSucesso('')

    const nome = form.nome.trim()
    const cidade = form.cidade.trim()
    const bairro = form.bairro.trim()
    const endereco = form.endereco.trim()
    const horarioFuncionamento = form.horario_funcionamento.trim()

    if (!nome || !cidade || !bairro || !endereco || !horarioFuncionamento) {
      setErroForm('Preencha nome, cidade, bairro, endereço e horário de funcionamento.')
      return
    }

    if (!form.latitude || !form.longitude) {
      setErroForm('Preencha latitude e longitude (veja a dica abaixo de como pegar esses números).')
      return
    }

    const latitude = Number(form.latitude.replace(',', '.'))
    const longitude = Number(form.longitude.replace(',', '.'))

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      setErroForm('Latitude e longitude precisam ser números (ex: -20.4697, -54.6201).')
      return
    }

    if (!marketId) {
      setErroForm('Não foi possível identificar seu mercado. Tente entrar novamente.')
      return
    }

    const dadosPerfil = {
      nome,
      cidade,
      bairro,
      endereco,
      horario_funcionamento: horarioFuncionamento,
      latitude,
      longitude,
    }

    setSalvando(true)
    setErroForm('')

    // TODO (desenvolvedor): substituir pelo UPDATE/INSERT real em
    // market_profiles (ver comentário no topo do arquivo, item 2). Hoje só
    // simula o sucesso para a tela ficar navegável sem backend plugado.
    if (perfilExistente) {
      const { error } = await supabase.from('market_profiles').update(dadosPerfil).eq('id', marketId)

      if (error) {
        setErroForm('Não foi possível salvar as alterações agora. Tente novamente.')
        setSalvando(false)
        return
      }
    } else {
      const { error } = await supabase.from('market_profiles').insert({ id: marketId, ...dadosPerfil })

      if (error) {
        setErroForm('Não foi possível criar o perfil do seu mercado agora. Tente novamente.')
        setSalvando(false)
        return
      }

      setPerfilExistente(true)
    }

    setSalvando(false)
    setMensagemSucesso(
      perfilExistente ? 'Alterações salvas com sucesso.' : 'Perfil do mercado criado com sucesso.'
    )
  }

  async function handleSair() {
    setSaindo(true)
    await supabase.auth.signOut()
    onSair?.()
  }

  if (saindo) {
    return (
      <div className="mercado-screen">
        <main className="mercado-content">
          <p>Saindo...</p>
        </main>
      </div>
    )
  }

  if (carregando) {
    return (
      <div className="mercado-screen">
        <main className="mercado-content">
          <p>Carregando o perfil do seu mercado...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="mercado-screen">
      <header className="mercado-topbar">
        <div className="mercado-topbar-top">
          <div className="mercado-topbar-info">
            <span className="mercado-eyebrow">Painel do mercado parceiro</span>
            <h1 className="mercado-nome">{form.nome || 'Seu mercado'}</h1>
          </div>
          <button type="button" className="mercado-sair-botao" onClick={handleSair}>
            Sair
          </button>
        </div>

        <nav className="mercado-tabs" aria-label="Navegação do painel">
          <button type="button" className="mercado-tab" onClick={onNavigateToProdutos}>
            Produtos
          </button>
          <button type="button" className="mercado-tab" onClick={onNavigateToDashboard}>
            Dashboard
          </button>
          <button type="button" className="mercado-tab mercado-tab-ativa" aria-current="page">
            Perfil
          </button>
        </nav>
      </header>

      <main className="mercado-content">
        {erro && <p className="form-error">{erro}</p>}

        <h2 className="mercado-secao-titulo">Dados do seu mercado</h2>

        {!perfilExistente && (
          <p className="perfil-mercado-aviso">
            Seu mercado ainda não tem um perfil cadastrado. Preencha os campos abaixo para criar — essas
            informações são o que os consumidores veem na tela do seu mercado no app.
          </p>
        )}

        <section className="mercado-form-secao">
          <form className="auth-form" onSubmit={handleSalvar} noValidate>
            <div className="field">
              <label className="field-label" htmlFor="perfil-mercado-nome">
                Nome do mercado
              </label>
              <input
                id="perfil-mercado-nome"
                type="text"
                className="field-input"
                placeholder="ex: Mercadinho Exemplo (placeholder)"
                value={form.nome}
                onChange={(event) => setForm((atual) => ({ ...atual, nome: event.target.value }))}
                required
              />
            </div>

            <div className="perfil-mercado-linha-dupla">
              <div className="field">
                <label className="field-label" htmlFor="perfil-mercado-cidade">
                  Cidade
                </label>
                <input
                  id="perfil-mercado-cidade"
                  type="text"
                  className="field-input"
                  placeholder="ex: Campo Grande (placeholder)"
                  value={form.cidade}
                  onChange={(event) => setForm((atual) => ({ ...atual, cidade: event.target.value }))}
                  required
                />
              </div>

              <div className="field">
                <label className="field-label" htmlFor="perfil-mercado-bairro">
                  Bairro
                </label>
                <input
                  id="perfil-mercado-bairro"
                  type="text"
                  className="field-input"
                  placeholder="ex: Centro (placeholder)"
                  value={form.bairro}
                  onChange={(event) => setForm((atual) => ({ ...atual, bairro: event.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="perfil-mercado-endereco">
                Endereço
              </label>
              <input
                id="perfil-mercado-endereco"
                type="text"
                className="field-input"
                placeholder="ex: Rua Exemplo, 123 (placeholder)"
                value={form.endereco}
                onChange={(event) => setForm((atual) => ({ ...atual, endereco: event.target.value }))}
                required
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="perfil-mercado-horario">
                Horário de funcionamento
              </label>
              <input
                id="perfil-mercado-horario"
                type="text"
                className="field-input"
                placeholder="ex: Seg a Sáb, 08h às 20h"
                value={form.horario_funcionamento}
                onChange={(event) =>
                  setForm((atual) => ({ ...atual, horario_funcionamento: event.target.value }))
                }
                required
              />
              <span className="field-hint">Use o mesmo formato de texto livre já usado hoje (ex: "Seg a Sáb, 08h às 20h").</span>
            </div>

            {/*
              Latitude/longitude como dois campos numéricos simples, sem mapa
              interativo — decisão explícita do CEO: mapa é complexidade de
              uma etapa futura, fora deste MVP. A nota de ajuda abaixo explica
              como o lojista consegue esses números sem precisar de ajuda
              externa.
              TODO (desenvolvedor): se o piloto mostrar que lojistas têm
              dificuldade com esses dois campos, avaliar um seletor de local
              em mapa numa próxima etapa — não construir agora. */}
            <div className="perfil-mercado-linha-dupla">
              <div className="field">
                <label className="field-label" htmlFor="perfil-mercado-latitude">
                  Latitude
                </label>
                <input
                  id="perfil-mercado-latitude"
                  type="text"
                  inputMode="decimal"
                  className="field-input"
                  placeholder="ex: -20.4697"
                  value={form.latitude}
                  onChange={(event) => setForm((atual) => ({ ...atual, latitude: event.target.value }))}
                  required
                />
              </div>

              <div className="field">
                <label className="field-label" htmlFor="perfil-mercado-longitude">
                  Longitude
                </label>
                <input
                  id="perfil-mercado-longitude"
                  type="text"
                  inputMode="decimal"
                  className="field-input"
                  placeholder="ex: -54.6201"
                  value={form.longitude}
                  onChange={(event) => setForm((atual) => ({ ...atual, longitude: event.target.value }))}
                  required
                />
              </div>
            </div>

            <p className="perfil-mercado-dica">
              <span aria-hidden="true">💡</span> Pegue as coordenadas no Google Maps: clique com o botão
              direito no local do seu mercado e copie os números que aparecem (o primeiro é a latitude, o
              segundo é a longitude).
            </p>

            {erroForm && <span className="form-error">{erroForm}</span>}
            {mensagemSucesso && <span className="perfil-mercado-sucesso">{mensagemSucesso}</span>}

            <div className="mercado-form-acoes">
              <button type="submit" className="btn-primary" disabled={salvando}>
                {salvando ? 'Salvando...' : perfilExistente ? 'Salvar alterações' : 'Salvar perfil'}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  )
}

export default PerfilMercado
