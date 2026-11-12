import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import './Home.css'

/**
 * Tela Home do app do consumidor.
 *
 * Ordem dos blocos (de cima para baixo) segue a prioridade de ação do
 * usuário, não só a ordem do README:
 * 1. Lista de compras ativa — é a tarefa que o usuário mais repete (abrir o
 *    app pra ver o que falta comprar), por isso fica em destaque visual logo
 *    no topo, como um card de cor sólida (mesma --accent do botão primário
 *    de Login/Cadastro, pra manter uma única "cor de ação" no app).
 * 2. Mercados próximos — ajuda a decidir "pra onde eu vou", em cards
 *    horizontais (rolagem lateral), comum em apps de descoberta por
 *    proximidade (inspiração Google Maps).
 * 3. Promoções em destaque — descoberta passiva, por isso vem depois: é
 *    conteúdo pra "explorar", não uma tarefa pendente.
 *
 * onNavigateToLista / onNavigateToExplorar / onNavigateToPerfil: callbacks
 * para a futura navegação entre telas (hoje só a Home existe). Como ainda
 * não existe roteador real, quem usa este componente decide o que fazer ao
 * clicar — mesmo padrão de callbacks já usado em Login/Cadastro.
 *
 * onNavigateToBuscarProdutos: atalho para a busca de PRODUTO (ver aba nova
 * "Produtos" dentro da tela Explorar, em src/pages/BuscaProdutos.jsx).
 * Decidimos não duplicar o campo de busca aqui na Home — ela é a tela de
 * "o que eu preciso fazer agora" (lista de compras em destaque no topo), e
 * um campo de busca de produto competiria visualmente com isso. Em vez
 * disso, um link discreto leva direto para a aba certa em Explorar, que já
 * é a tela de "descoberta" do app.
 *
 * Integração com Supabase (substitui os dados de exemplo que existiam
 * aqui antes):
 * - Resumo da lista: reaproveita a mesma lógica da tela Lista.jsx (busca a
 *   lista do consumidor logado, criando uma lista padrão se ainda não
 *   existir nenhuma) só para mostrar "Faltam X de Y itens".
 * - Mercados próximos: hoje ainda não existe nenhum mercado parceiro
 *   cadastrado no banco (ninguém usou o painel do mercado ainda), então é
 *   esperado que esta lista venha vazia por enquanto. Quando vier vazia,
 *   mostramos uma mensagem amigável em vez de uma seção quebrada/sumida.
 *   SIMPLIFICAÇÃO TEMPORÁRIA: como ainda não usamos a localização do
 *   consumidor em nenhuma consulta, "próximos" por enquanto só lista os
 *   mercados mais recentes cadastrados (ordenado por created_at desc) —
 *   não é uma distância real. Isso precisa ser revisto quando a regra de
 *   "melhor mercado" (distância + itens em promoção) for implementada de
 *   verdade.
 * - Promoções em destaque: produtos com a flag promocao_ativa ligada e
 *   dentro do range de datas (promocao_inicio/promocao_validade_fim) —
 *   mostra preco_promocional, não o preço normal (ver migration 004).
 *   Também vem vazia até algum mercado cadastrar produtos em promoção —
 *   mesma lógica de mensagem amigável.
 */
function Home({ onNavigateToLista, onNavigateToExplorar, onNavigateToPerfil, onNavigateToBuscarProdutos }) {
  // TODO: trocar pelo nome real do usuário logado (via perfil em
  // consumer_profiles) quando a tela de Perfil existir e essa informação
  // for necessária em mais lugares. Por enquanto a Home não depende disso
  // para funcionar.
  const nomeUsuario = 'Usuário'

  const [resumoLista, setResumoLista] = useState(null)
  const [mercadosProximos, setMercadosProximos] = useState([])
  const [promocoesDestaque, setPromocoesDestaque] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    carregarDadosHome()
  }, [])

  async function carregarDadosHome() {
    setCarregando(true)
    setErro(null)

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user) {
      setErro('Não foi possível identificar seu usuário. Tente entrar novamente.')
      setCarregando(false)
      return
    }

    const consumerId = userData.user.id

    await Promise.all([
      carregarResumoLista(consumerId),
      carregarMercadosProximos(),
      carregarPromocoesDestaque(),
    ])

    setCarregando(false)
  }

  async function carregarResumoLista(consumerId) {
    const { data: listasExistentes, error: listasError } = await supabase
      .from('shopping_lists')
      .select('id, nome')
      .eq('consumer_id', consumerId)
      .order('created_at', { ascending: true })

    if (listasError) {
      setErro((atual) => atual ?? 'Não foi possível carregar sua lista agora.')
      return
    }

    let lista = listasExistentes?.[0] ?? null

    // Primeiro uso: ainda não existe nenhuma lista para este consumidor.
    // Criamos uma lista padrão, igual à tela Lista.jsx, pra Home nunca
    // mostrar um resumo "quebrado".
    if (!lista) {
      const { data: novaLista, error: criarError } = await supabase
        .from('shopping_lists')
        .insert({ consumer_id: consumerId, nome: 'Minha lista' })
        .select('id, nome')
        .single()

      if (criarError || !novaLista) {
        setErro((atual) => atual ?? 'Não foi possível carregar sua lista agora.')
        return
      }

      lista = novaLista
    }

    const { data: itens, error: itensError } = await supabase
      .from('shopping_list_items')
      .select('comprado')
      .eq('list_id', lista.id)

    if (itensError) {
      setErro((atual) => atual ?? 'Não foi possível carregar sua lista agora.')
      return
    }

    const totalItens = itens?.length ?? 0
    const itensFaltando = itens?.filter((item) => !item.comprado).length ?? 0

    setResumoLista({ nome: lista.nome, totalItens, itensFaltando })
  }

  async function carregarMercadosProximos() {
    // SIMPLIFICAÇÃO TEMPORÁRIA: sem regra de distância ainda, listamos os
    // mercados mais recentes como placeholder de "próximos" (ver
    // explicação no comentário do topo do arquivo).
    const { data, error } = await supabase
      .from('market_profiles')
      .select('id, nome')
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) {
      setMercadosProximos([])
      return
    }

    setMercadosProximos(data ?? [])
  }

  async function carregarPromocoesDestaque() {
    const agora = new Date().toISOString()

    // "Em promoção" agora depende da flag promocao_ativa + o range de
    // datas, não só de uma data de validade preenchida — mesma lógica
    // usada em Explorar.jsx/MercadoDetalhe.jsx/CadastroProdutos.jsx (ver
    // migration 004). Mostramos preco_promocional (o preço com desconto),
    // não mais `preco` (que agora é sempre o preço normal/cheio).
    const { data, error } = await supabase
      .from('products')
      .select('id, nome, preco_promocional, market_id, market_profiles(nome)')
      .eq('promocao_ativa', true)
      .or(`promocao_inicio.is.null,promocao_inicio.lte.${agora}`)
      .or(`promocao_validade_fim.is.null,promocao_validade_fim.gte.${agora}`)
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) {
      setPromocoesDestaque([])
      return
    }

    setPromocoesDestaque(data ?? [])
  }

  return (
    <div className="home-screen">
      <header className="home-topbar">
        <div className="home-brand">
          <div className="home-brand-mark" aria-hidden="true">
            CD
          </div>
          <span className="home-greeting">Olá, {nomeUsuario}</span>
        </div>
        {/* Placeholder de avatar/perfil — ainda sem navegação de verdade aqui,
            o atalho principal pro Perfil é a barra de navegação inferior. */}
        <button type="button" className="home-avatar" aria-label="Perfil" onClick={onNavigateToPerfil}>
          UE
        </button>
      </header>

      <main className="home-content">
        {erro && (
          <p className="home-erro" role="alert">
            {erro}
          </p>
        )}

        {/* 1. Lista de compras ativa */}
        <section className="home-section">
          <button type="button" className="card-lista-ativa" onClick={onNavigateToLista}>
            <div className="card-lista-info">
              <span className="card-lista-label">Sua lista de compras</span>
              {carregando ? (
                <span className="card-lista-progresso">Carregando...</span>
              ) : resumoLista ? (
                <>
                  <h2 className="card-lista-nome">{resumoLista.nome}</h2>
                  <span className="card-lista-progresso">
                    Faltam {resumoLista.itensFaltando} de {resumoLista.totalItens} itens
                  </span>
                </>
              ) : (
                <span className="card-lista-progresso">Não foi possível carregar sua lista.</span>
              )}
            </div>
            <span className="card-lista-seta" aria-hidden="true">
              →
            </span>
          </button>
        </section>

        {/* 2. Mercados próximos */}
        <section className="home-section">
          <div className="home-section-header">
            <h2 className="home-section-title">Mercados próximos</h2>
            <button type="button" className="link-ver-todos" onClick={onNavigateToExplorar}>
              Ver todos
            </button>
          </div>

          {carregando ? (
            <p className="home-secao-vazia">Carregando...</p>
          ) : mercadosProximos.length === 0 ? (
            <p className="home-secao-vazia">Nenhum mercado parceiro por perto ainda.</p>
          ) : (
            <div className="mercados-scroll">
              {mercadosProximos.map((mercado) => (
                <button type="button" key={mercado.id} className="card-mercado" onClick={onNavigateToExplorar}>
                  <span className="card-mercado-nome">{mercado.nome}</span>
                </button>
              ))}
            </div>
          )}

          {/* Atalho para a busca de produto (ver comentário no topo do
              arquivo). Estilo discreto/outline — mesma lógica já usada no
              botão "Ver no mapa" de Explorar.jsx: não é a ação principal da
              tela, por isso não usa a cor de destaque (--accent). */}
          <button
            type="button"
            className="home-buscar-produtos-botao"
            onClick={onNavigateToBuscarProdutos}
          >
            <span aria-hidden="true">⚲</span> Buscar produtos em todos os mercados
          </button>
        </section>

        {/* 3. Promoções em destaque */}
        <section className="home-section">
          <div className="home-section-header">
            <h2 className="home-section-title">Promoções em destaque</h2>
          </div>

          {carregando ? (
            <p className="home-secao-vazia">Carregando...</p>
          ) : promocoesDestaque.length === 0 ? (
            <p className="home-secao-vazia">Nenhuma promoção no momento.</p>
          ) : (
            <div className="promocoes-lista">
              {promocoesDestaque.map((produto) => (
                <div className="card-promocao" key={produto.id}>
                  <div className="card-promocao-imagem" aria-hidden="true">
                    {/* Placeholder de imagem do produto */}
                    IMG
                  </div>
                  <div className="card-promocao-info">
                    <span className="card-promocao-nome">{produto.nome}</span>
                    <span className="card-promocao-mercado">{produto.market_profiles?.nome}</span>
                  </div>
                  <span className="card-promocao-preco">
                    {Number(produto.preco_promocional).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Barra de navegação inferior — só estrutura visual por enquanto.
          TODO: ligar cada item a uma rota real quando o roteador existir
          (ex: react-router com <Link to="/lista"> no lugar do onClick). */}
      <nav className="bottom-nav">
        <button type="button" className="bottom-nav-item is-active" aria-current="page">
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
        <button type="button" className="bottom-nav-item" onClick={onNavigateToPerfil}>
          <span className="bottom-nav-icon" aria-hidden="true">
            ◍
          </span>
          <span className="bottom-nav-label">Perfil</span>
        </button>
      </nav>
    </div>
  )
}

export default Home
