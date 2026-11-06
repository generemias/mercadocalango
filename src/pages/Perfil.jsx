import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import '../styles/forms.css'
import './Perfil.css'

/**
 * Tela "Perfil" do app do consumidor — última tela mínima do MVP (ver
 * README.md, seção "App do consumidor (telas mínimas)": "dados pessoais,
 * histórico, mercados favoritos").
 *
 * Agora ligada ao Supabase de verdade (mesmo padrão de useEffect + useState
 * "carregando/erro" já usado em Lista.jsx e Explorar.jsx):
 *
 * 1. Perfil: supabase.auth.getUser() para saber quem está logado, depois
 *    select em consumer_profiles (nome, cidade, bairro) pelo id do usuário.
 * 2. Edição: ao salvar, update em consumer_profiles pelo id do usuário
 *    logado (sempre lido de novo via getUser(), nunca guardado solto).
 * 3. Mercados favoritos: select em favorite_markets (consumer_id = id do
 *    usuário logado) com join em market_profiles (nome, bairro) — mesmo
 *    padrão de consulta já usado em Explorar.jsx.
 * 4. Histórico (primeira versão): conta quantos shopping_list_items com
 *    comprado = true o consumidor tem, em todas as suas listas. Como
 *    shopping_list_items não guarda consumer_id direto, primeiro buscamos
 *    os ids das listas do consumidor (shopping_lists.consumer_id) e depois
 *    contamos os itens comprados dessas listas — mesma relação já usada em
 *    Lista.jsx.
 * 5. Sair: chama supabase.auth.signOut() de verdade. Não duplicamos aqui a
 *    lógica de voltar para a tela de Login: o onAuthStateChange em
 *    App.jsx já escuta a sessão sair e troca de tela sozinho.
 *
 * Decisões de design (explicadas em detalhe na resposta ao CEO):
 * 1. Edição de dados pessoais entra NESTA tela (nome/cidade/bairro ficam
 *    editáveis com um botão "Editar" + Salvar/Cancelar), em vez de uma tela
 *    separada — são só 3 campos de texto, o mesmo padrão de Cadastro.jsx já
 *    resolve a parte visual, e criar uma tela nova só para isso adicionaria
 *    navegação sem necessidade neste MVP.
 * 2. "Histórico" nesta primeira versão é só uma métrica simples (nº de itens
 *    já marcados como comprados em todas as listas), não um histórico de
 *    compras confirmadas por mercado/data — isso não existe no schema atual
 *    (não há tabela de "compra confirmada", só shopping_list_items.comprado).
 *    Fica marcado como "(primeira versão)" na própria tela para não parecer
 *    mais completo do que é.
 * 3. Mercados favoritos reaproveita o mesmo card de mercado já usado em
 *    Explorar.jsx (nome + bairro), e toca para abrir o Mercado (detalhe) —
 *    mesma navegação que já existe a partir de Explorar.
 *
 * Props (todas de navegação/ação — mesmo padrão de callbacks já usado nas
 * outras telas, já que ainda não existe roteador real):
 * - onNavigateToHome / onNavigateToLista / onNavigateToExplorar: barra de
 *   navegação inferior.
 * - onNavigateToMercado(mercadoId): abrir um mercado favorito (tela Mercado
 *   detalhe).
 * - onSair: chamado depois do logout, para a tela de cima (App.jsx) saber
 *   que o usuário saiu (hoje ela não precisa fazer nada além de deixar o
 *   onAuthStateChange cuidar da troca de tela, mas mantemos o callback para
 *   não depender só do listener).
 */
function Perfil({ onNavigateToHome, onNavigateToLista, onNavigateToExplorar, onNavigateToMercado, onSair }) {
  const [perfil, setPerfil] = useState(null)
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({ nome: '', cidade: '', bairro: '' })
  // Guarda os valores antes de entrar em modo de edição, para poder
  // descartar no "Cancelar" sem perder o que estava salvo antes.
  const [formAntesDeEditar, setFormAntesDeEditar] = useState({ nome: '', cidade: '', bairro: '' })

  const [favoritos, setFavoritos] = useState([])
  const [itensCompradosTotal, setItensCompradosTotal] = useState(0)

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [erroSalvar, setErroSalvar] = useState(null)
  // Enquanto o logout está em andamento, mostramos uma tela simples de
  // "Saindo..." em vez do conteúdo do perfil. Evita mostrar por um instante
  // dados antigos do usuário que acabou de clicar em "Sair", caso este
  // componente continue montado entre o signOut() resolver e o App.jsx
  // trocar de tela (o onAuthStateChange é assíncrono).
  const [saindo, setSaindo] = useState(false)

  useEffect(() => {
    carregarPerfil()
  }, [])

  async function carregarPerfil() {
    setCarregando(true)
    setErro(null)

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user) {
      setErro('Não foi possível identificar seu usuário. Tente entrar novamente.')
      setCarregando(false)
      return
    }

    const consumerId = userData.user.id

    const { data: perfilData, error: perfilError } = await supabase
      .from('consumer_profiles')
      .select('id, nome, cidade, bairro')
      .eq('id', consumerId)
      .maybeSingle()

    if (perfilError) {
      setErro('Não foi possível carregar seu perfil agora.')
      setCarregando(false)
      return
    }

    if (!perfilData) {
      // Não deveria acontecer (toda conta de consumidor cria sua linha em
      // consumer_profiles no cadastro), mas se faltar por algum motivo,
      // avisamos de forma amigável em vez de quebrar a tela.
      setErro('Não encontramos os dados do seu perfil. Tente novamente mais tarde ou entre em contato com o suporte.')
      setCarregando(false)
      return
    }

    setPerfil(perfilData)
    const dadosForm = { nome: perfilData.nome, cidade: perfilData.cidade, bairro: perfilData.bairro }
    setForm(dadosForm)
    setFormAntesDeEditar(dadosForm)

    await Promise.all([carregarFavoritos(consumerId), carregarHistorico(consumerId)])

    setCarregando(false)
  }

  async function carregarFavoritos(consumerId) {
    const { data, error } = await supabase
      .from('favorite_markets')
      .select('market_id, market_profiles(nome, bairro)')
      .eq('consumer_id', consumerId)

    if (error) {
      // Favoritos são uma seção secundária da tela; se der erro, mostramos
      // a lista vazia em vez de travar o resto do perfil.
      setFavoritos([])
      return
    }

    const lista = (data ?? [])
      .filter((linha) => linha.market_profiles)
      .map((linha) => ({
        id: linha.market_id,
        nome: linha.market_profiles.nome,
        bairro: linha.market_profiles.bairro,
      }))

    setFavoritos(lista)
  }

  async function carregarHistorico(consumerId) {
    const { data: listasDoConsumidor, error: listasError } = await supabase
      .from('shopping_lists')
      .select('id')
      .eq('consumer_id', consumerId)

    if (listasError || !listasDoConsumidor || listasDoConsumidor.length === 0) {
      setItensCompradosTotal(0)
      return
    }

    const idsListas = listasDoConsumidor.map((lista) => lista.id)

    const { count, error: itensError } = await supabase
      .from('shopping_list_items')
      .select('id', { count: 'exact', head: true })
      .in('list_id', idsListas)
      .eq('comprado', true)

    if (itensError) {
      setItensCompradosTotal(0)
      return
    }

    setItensCompradosTotal(count ?? 0)
  }

  function handleAbrirEdicao() {
    setFormAntesDeEditar(form)
    setErroSalvar(null)
    setEditando(true)
  }

  function handleCancelarEdicao() {
    setForm(formAntesDeEditar)
    setErroSalvar(null)
    setEditando(false)
  }

  async function handleSalvarEdicao(event) {
    event.preventDefault()
    setErroSalvar(null)
    setSalvando(true)

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user) {
      setErroSalvar('Não foi possível identificar seu usuário. Tente entrar novamente.')
      setSalvando(false)
      return
    }

    const consumerId = userData.user.id

    const { error } = await supabase
      .from('consumer_profiles')
      .update({ nome: form.nome, cidade: form.cidade, bairro: form.bairro })
      .eq('id', consumerId)

    if (error) {
      setErroSalvar('Não foi possível salvar suas alterações agora. Tente novamente.')
      setSalvando(false)
      return
    }

    setPerfil((atual) => (atual ? { ...atual, ...form } : atual))
    setFormAntesDeEditar(form)
    setSalvando(false)
    setEditando(false)
  }

  function handleAbrirFavorito(mercadoId) {
    onNavigateToMercado?.(mercadoId)
  }

  async function handleSair() {
    setSaindo(true)
    await supabase.auth.signOut()
    // O onAuthStateChange em App.jsx já troca a tela de volta para Login
    // quando a sessão sai; este callback só avisa quem usa este componente,
    // sem duplicar aquela lógica aqui. O estado "saindo" acima garante que,
    // enquanto isso não acontece, a tela não mostra mais os dados antigos
    // do perfil.
    onSair?.()
  }

  if (saindo) {
    return (
      <div className="perfil-screen">
        <header className="perfil-topbar">
          <h1 className="perfil-titulo">Perfil</h1>
        </header>
        <main className="perfil-content">
          <p>Saindo...</p>
        </main>
      </div>
    )
  }

  if (carregando) {
    return (
      <div className="perfil-screen">
        <header className="perfil-topbar">
          <h1 className="perfil-titulo">Perfil</h1>
        </header>
        <main className="perfil-content">
          <p>Carregando seu perfil...</p>
        </main>
      </div>
    )
  }

  if (erro) {
    return (
      <div className="perfil-screen">
        <header className="perfil-topbar">
          <h1 className="perfil-titulo">Perfil</h1>
        </header>
        <main className="perfil-content">
          <p className="perfil-secao-vazia">{erro}</p>
          {/* Sem este botão, quem cai aqui (ex: sessão inválida) ficava
              preso na tela sem a barra de navegação inferior, precisando
              dar F5 para conseguir saber. Reaproveita o mesmo logout real
              de "Sair" para voltar ao Login de forma segura. */}
          <button type="button" className="btn-secundario" onClick={handleSair}>
            Voltar para o Login
          </button>
        </main>
      </div>
    )
  }

  const iniciais = form.nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join('')

  return (
    <div className="perfil-screen">
      <header className="perfil-topbar">
        <h1 className="perfil-titulo">Perfil</h1>
      </header>

      <main className="perfil-content">
        {/* 1. Dados pessoais */}
        <section className="perfil-card">
          <div className="perfil-card-header">
            <div className="perfil-avatar" aria-hidden="true">
              {iniciais || '?'}
            </div>
            {!editando && (
              <button type="button" className="perfil-editar-botao" onClick={handleAbrirEdicao}>
                Editar
              </button>
            )}
          </div>

          {editando ? (
            <form className="perfil-form" onSubmit={handleSalvarEdicao}>
              {erroSalvar && (
                <p className="perfil-erro" role="alert">
                  {erroSalvar}
                </p>
              )}
              <div className="field">
                <label className="field-label" htmlFor="perfil-nome">
                  Nome
                </label>
                <input
                  id="perfil-nome"
                  type="text"
                  className="field-input"
                  value={form.nome}
                  onChange={(event) => setForm((atual) => ({ ...atual, nome: event.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="perfil-cidade">
                  Cidade
                </label>
                <input
                  id="perfil-cidade"
                  type="text"
                  className="field-input"
                  value={form.cidade}
                  onChange={(event) => setForm((atual) => ({ ...atual, cidade: event.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="perfil-bairro">
                  Bairro
                </label>
                <input
                  id="perfil-bairro"
                  type="text"
                  className="field-input"
                  value={form.bairro}
                  onChange={(event) => setForm((atual) => ({ ...atual, bairro: event.target.value }))}
                  required
                />
              </div>

              <div className="perfil-form-acoes">
                <button type="button" className="btn-secundario" onClick={handleCancelarEdicao} disabled={salvando}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary perfil-salvar-botao" disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          ) : (
            <div className="perfil-dados">
              <h2 className="perfil-nome">{form.nome}</h2>
              <span className="perfil-local">
                <span aria-hidden="true">📍</span> {form.bairro}, {form.cidade}
              </span>
            </div>
          )}
        </section>

        {/* 2. Histórico (primeira versão, métrica simples) */}
        <section className="perfil-section">
          <div className="perfil-section-header">
            <h2 className="perfil-section-title">Histórico</h2>
            <span className="perfil-section-nota">primeira versão</span>
          </div>
          <div className="perfil-historico-card">
            <span className="perfil-historico-numero">{itensCompradosTotal}</span>
            <span className="perfil-historico-label">itens comprados até hoje</span>
          </div>
        </section>

        {/* 3. Mercados favoritos */}
        <section className="perfil-section">
          <div className="perfil-section-header">
            <h2 className="perfil-section-title">Mercados favoritos</h2>
          </div>

          {favoritos.length === 0 ? (
            <p className="perfil-secao-vazia">
              Você ainda não favoritou nenhum mercado. Toque no coração na tela de um mercado para
              salvá-lo aqui.
            </p>
          ) : (
            <ul className="perfil-lista-favoritos">
              {favoritos.map((mercado) => (
                <li key={mercado.id}>
                  <button
                    type="button"
                    className="card-mercado-favorito"
                    onClick={() => handleAbrirFavorito(mercado.id)}
                  >
                    <div className="card-mercado-favorito-info">
                      <span className="card-mercado-favorito-nome">{mercado.nome}</span>
                      <span className="card-mercado-favorito-local">{mercado.bairro}</span>
                    </div>
                    <span className="card-mercado-favorito-seta" aria-hidden="true">
                      →
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 4. Sair */}
        <section className="perfil-section perfil-section-sair">
          <button type="button" className="perfil-sair-botao" onClick={handleSair}>
            Sair
          </button>
        </section>
      </main>

      {/* Barra de navegação inferior — mesma estrutura visual da
          Home/Lista/Explorar, com "Perfil" marcado como ativo. */}
      <nav className="bottom-nav">
        <button type="button" className="bottom-nav-item" onClick={onNavigateToHome}>
          <span className="bottom-nav-icon" aria-hidden="true">
            ⌂
          </span>
          <span className="bottom-nav-label">Home</span>
        </button>
        <button type="button" className="bottom-nav-item" onClick={onNavigateToLista}>
          <span className="bottom-nav-icon" aria-hidden="true">
            ☑
          </span>
          <span className="bottom-nav-label">Lista</span>
        </button>
        <button type="button" className="bottom-nav-item" onClick={onNavigateToExplorar}>
          <span className="bottom-nav-icon" aria-hidden="true">
            ⚲
          </span>
          <span className="bottom-nav-label">Explorar</span>
        </button>
        <button type="button" className="bottom-nav-item is-active" aria-current="page">
          <span className="bottom-nav-icon" aria-hidden="true">
            ◍
          </span>
          <span className="bottom-nav-label">Perfil</span>
        </button>
      </nav>
    </div>
  )
}

export default Perfil
