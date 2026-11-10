import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import '../../styles/forms.css'
import './DashboardMercado.css'

/**
 * Tela "Dashboard" do painel do mercado parceiro (ver README.md, seção
 * "Painel do mercado (mínimo)": "Dashboard com 3-4 métricas: nº de
 * visualizações, produtos mais buscados pelos clientes do app, cliques em
 * 'rota até o mercado'").
 *
 * Por decisão do CEO, esta é a última tela do painel mínimo do mercado —
 * junto com src/pages/mercado/CadastroProdutos.jsx, forma as duas telas do
 * painel logado. Por isso as duas ganharam uma barra de abas simples no
 * cabeçalho (.mercado-tabs) para alternar entre "Produtos" e "Dashboard" sem
 * precisar passar pelo login de novo.
 *
 * Dados reais (IMPORTANTE):
 * As 3 métricas (visualizações, cliques em rota, ranking de produtos
 * buscados) vêm de verdade do Supabase — ver carregarMercado() abaixo. Nada
 * de dado fictício é mostrado nesta tela.
 * 1. Total de visualizações: count exato em market_views filtrado por
 *    market_id. 0 é um valor real e válido — só troca a frase do card.
 * 2. Total de cliques em "Traçar rota": mesma lógica em
 *    market_route_clicks.
 * 3. Ranking de produtos mais buscados — product_searches não tem coluna
 *    market_id direta (só product_id, que pode ser null quando a busca não
 *    bateu com nenhum produto — ver comentário na policy
 *    product_searches_select_own_market em
 *    database/migrations/002_rls_policies.sql). Então o filtro por mercado
 *    "sobe" até products via products!inner, e o agrupamento/contagem por
 *    product_id é feito no próprio JavaScript (o volume esperado no piloto é
 *    pequeno; se crescer muito, vale migrar para uma view/RPC no banco).
 *    Antes disso, checamos se o mercado tem algum produto cadastrado — sem
 *    produto, o ranking nem faz sentido, e mostramos um estado vazio próprio
 *    convidando a cadastrar (em vez de rodar a busca e mostrar "0 buscas").
 *
 * Decisões de design (explicadas em detalhe na resposta ao CEO):
 * 1. Duas métricas simples (visualizações, cliques em rota) em cards de
 *    número grande + rótulo — fáceis de ler "de relance" no balcão da loja,
 *    sem exigir interpretação.
 * 2. Ranking de produtos buscados em lista numerada (1º, 2º, 3º...) em vez
 *    de gráfico de barras — mais simples de construir e de ler para o
 *    lojista, e README.md explicitamente deixa "relatórios avançados" fora
 *    do escopo deste MVP.
 * 3. Estado vazio por métrica (não uma tela de "sem dados" genérica) —
 *    porque é perfeitamente possível ter cliques em rota mas nenhuma busca
 *    ainda, por exemplo; tratar cada card separadamente evita escurecer uma
 *    métrica que já tem dado por causa de outra que não tem.
 * 4. Barra de abas "Produtos / Dashboard" no cabeçalho, não uma barra
 *    inferior (bottom nav) como no app do consumidor — o painel do mercado é
 *    mais usado em desktop/tablet (decisão já registrada em
 *    CadastroProdutos.css), onde abas no topo são o padrão mais comum
 *    (Notion, painéis administrativos em geral).
 *
 * Props:
 * - onNavigateToProdutos: troca para a tela de Cadastro de produtos
 *   (mesmo padrão de navegação por callback já usado em todo o app).
 * - onSair: chamado depois do logout (mesmo padrão de
 *   src/pages/mercado/CadastroProdutos.jsx).
 */

function DashboardMercado({ onNavigateToProdutos, onSair }) {
  const [marketNome, setMarketNome] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [saindo, setSaindo] = useState(false)

  // Métricas reais, vindas do Supabase (ver carregarMercado abaixo).
  const [totalVisualizacoes, setTotalVisualizacoes] = useState(0)
  const [totalCliquesRota, setTotalCliquesRota] = useState(0)
  const [rankingProdutosBuscados, setRankingProdutosBuscados] = useState([])
  // true = mercado ainda não cadastrou nenhum produto, então o ranking de
  // buscas nem faz sentido ainda (ver estado vazio específico mais abaixo).
  const [semProdutosCadastrados, setSemProdutosCadastrados] = useState(false)

  // Carrega o nome do mercado logado + as 3 métricas ao montar — mesmo
  // padrão de useEffect + useState carregando/erro já usado em
  // CadastroProdutos.jsx, repetido aqui porque as duas telas ainda não
  // compartilham um "layout de painel" comum (ver comentário de
  // duplicação de CSS em CadastroProdutos.css; o mesmo vale para esta busca).
  useEffect(() => {
    carregarMercado()
  }, [])

  async function carregarMercado() {
    setCarregando(true)
    setErro(null)

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user) {
      setErro('Não foi possível identificar seu mercado. Tente entrar novamente.')
      setCarregando(false)
      return
    }

    const marketId = userData.user.id

    const { data: perfilMercado, error: erroPerfil } = await supabase
      .from('market_profiles')
      .select('nome')
      .eq('id', marketId)
      .maybeSingle()

    if (erroPerfil) {
      setErro('Não foi possível carregar os dados do seu mercado agora.')
      setCarregando(false)
      return
    }

    setMarketNome(perfilMercado?.nome ?? '')

    // Passo 2: total de visualizações do mercado no app. 0 é um valor
    // real/válido (mercado ainda não apareceu pra ninguém) — não tratamos
    // como "erro" nem escondemos o card; o texto do estado vazio só troca a
    // frase para deixar claro que é "ainda não há dado", e não "zero views
    // de propósito".
    const { count: contagemVisualizacoes, error: erroVisualizacoes } = await supabase
      .from('market_views')
      .select('*', { count: 'exact', head: true })
      .eq('market_id', marketId)

    if (erroVisualizacoes) {
      setErro('Não foi possível carregar as métricas do seu mercado agora.')
      setCarregando(false)
      return
    }

    setTotalVisualizacoes(contagemVisualizacoes ?? 0)

    // Passo 3: total de cliques em "Traçar rota" até o mercado.
    const { count: contagemCliquesRota, error: erroCliquesRota } = await supabase
      .from('market_route_clicks')
      .select('*', { count: 'exact', head: true })
      .eq('market_id', marketId)

    if (erroCliquesRota) {
      setErro('Não foi possível carregar as métricas do seu mercado agora.')
      setCarregando(false)
      return
    }

    setTotalCliquesRota(contagemCliquesRota ?? 0)

    // Passo 5: se o mercado ainda não cadastrou nenhum produto, o ranking de
    // buscas não faz sentido (não há o que ranquear) — mostramos um estado
    // vazio dedicado em vez de rodar a busca de product_searches.
    const { count: contagemProdutos, error: erroContagemProdutos } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('market_id', marketId)

    if (erroContagemProdutos) {
      setErro('Não foi possível carregar as métricas do seu mercado agora.')
      setCarregando(false)
      return
    }

    if (!contagemProdutos) {
      setSemProdutosCadastrados(true)
      setRankingProdutosBuscados([])
      setCarregando(false)
      return
    }

    setSemProdutosCadastrados(false)

    // Passo 4: ranking de produtos mais buscados. product_searches não tem
    // market_id direto, então subimos até products via !inner e filtramos
    // por products.market_id (mesma condição que a policy de RLS
    // product_searches_select_own_market já exige para liberar a leitura —
    // ver database/migrations/002_rls_policies.sql). Como o volume esperado
    // no piloto é pequeno, agrupamos/contamos por product_id aqui no
    // JavaScript mesmo, em vez de criar uma view/RPC só para isso agora.
    const { data: buscas, error: erroBuscas } = await supabase
      .from('product_searches')
      .select('product_id, products!inner(id, nome, market_id)')
      .eq('products.market_id', marketId)

    if (erroBuscas) {
      setErro('Não foi possível carregar as métricas do seu mercado agora.')
      setCarregando(false)
      return
    }

    const contagemPorProduto = new Map()
    for (const busca of buscas ?? []) {
      const produto = busca.products
      if (!produto) continue
      const atual = contagemPorProduto.get(produto.id)
      if (atual) {
        atual.quantidade += 1
      } else {
        contagemPorProduto.set(produto.id, { id: produto.id, nome: produto.nome, quantidade: 1 })
      }
    }

    const ranking = Array.from(contagemPorProduto.values())
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 5)

    setRankingProdutosBuscados(ranking)
    setCarregando(false)
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
          <p>Carregando seu painel...</p>
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
            <h1 className="mercado-nome">{marketNome || 'Seu mercado'}</h1>
          </div>
          <button type="button" className="mercado-sair-botao" onClick={handleSair}>
            Sair
          </button>
        </div>

        <nav className="mercado-tabs" aria-label="Navegação do painel">
          <button type="button" className="mercado-tab" onClick={onNavigateToProdutos}>
            Produtos
          </button>
          <button type="button" className="mercado-tab mercado-tab-ativa" aria-current="page">
            Dashboard
          </button>
        </nav>
      </header>

      <main className="mercado-content">
        {erro && <p className="form-error">{erro}</p>}

        <h2 className="mercado-secao-titulo">Como seu mercado está aparecendo no app</h2>

        <div className="metricas-grid">
          <div className="metric-card">
            <span className="metric-card-icone" aria-hidden="true">
              👁️
            </span>
            {totalVisualizacoes === 0 ? (
              <p className="metric-card-vazio">Ainda não há visualizações registradas.</p>
            ) : (
              <>
                <span className="metric-card-valor">{totalVisualizacoes}</span>
                <span className="metric-card-rotulo">Visualizações do seu mercado no app</span>
              </>
            )}
          </div>

          <div className="metric-card">
            <span className="metric-card-icone" aria-hidden="true">
              📍
            </span>
            {totalCliquesRota === 0 ? (
              <p className="metric-card-vazio">Ainda não há cliques em "Traçar rota" registrados.</p>
            ) : (
              <>
                <span className="metric-card-valor">{totalCliquesRota}</span>
                <span className="metric-card-rotulo">Cliques em "Traçar rota" até seu mercado</span>
              </>
            )}
          </div>
        </div>

        <section className="metric-card metric-card-ranking">
          <h3 className="metric-card-ranking-titulo">Produtos mais buscados pelos clientes</h3>

          {semProdutosCadastrados ? (
            <p className="metric-card-vazio">
              Cadastre seus produtos na aba "Produtos" para começar a acompanhar quais deles os clientes mais
              buscam no app.
            </p>
          ) : rankingProdutosBuscados.length === 0 ? (
            <p className="metric-card-vazio">Ainda não há buscas de produtos registradas.</p>
          ) : (
            <ol className="ranking-lista">
              {rankingProdutosBuscados.map((item, indice) => (
                <li key={item.id} className="ranking-item">
                  <span className="ranking-posicao">{indice + 1}º</span>
                  <span className="ranking-nome">{item.nome}</span>
                  <span className="ranking-quantidade">{item.quantidade}x</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
    </div>
  )
}

export default DashboardMercado
