import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import './Explorar.css'

/**
 * Tela "Explorar mercados" do app do consumidor.
 *
 * Igual às telas anteriores (Home, Lista), ainda não existe roteador real —
 * quem usa este componente decide o que fazer com os callbacks de navegação
 * (onNavigateToHome / onNavigateToLista / onNavigateToPerfil).
 *
 * Integração com Supabase (mesmo padrão já usado em Home.jsx):
 * - Lista de mercados: select em market_profiles (id, nome, bairro).
 * - "Com promoção": depois de carregar os mercados, fazemos uma segunda
 *   consulta em products filtrando pelos market_id já buscados (.in()) e
 *   promocao_validade_fim no futuro. Monta-se um Set de market_id com
 *   promoção ativa — mais simples que um join/count para o tamanho de dados
 *   deste MVP.
 * - "Mais próximos" / distância: igual à SIMPLIFICAÇÃO TEMPORÁRIA já usada
 *   na Home — ainda não coletamos a localização do consumidor, então não dá
 *   pra calcular distância real. Enquanto isso não existir, o filtro só
 *   reordena pelos mercados mais recentes (created_at desc) e NÃO mostra
 *   nenhum valor de "km" fictício na tela.
 * - Busca por nome: decidimos filtrar no front-end sobre a lista já
 *   carregada (igual já estava), e não com `.ilike` a cada tecla digitada.
 *   Para o tamanho esperado do piloto (poucos mercados parceiros), buscar
 *   tudo uma vez e filtrar em memória é mais simples e evita uma query nova
 *   por letra digitada. Se a base de mercados crescer muito, aí sim vale
 *   trocar para `.ilike('nome', '%termo%')` direto no Supabase.
 *
 * Botão "Ver no mapa": é só um placeholder visual (abre um aviso, não um
 * mapa de verdade). Um mapa real (Google Maps/Mapbox) fica para uma etapa
 * futura — fora do escopo desta tela, que é validar lista + filtros primeiro.
 *
 * Clique num card de mercado: a tela de detalhe do mercado ainda não existe
 * (próxima etapa do MVP), então por enquanto só loga um TODO no console.
 */
function Explorar({ onNavigateToHome, onNavigateToLista, onNavigateToPerfil }) {
  const [busca, setBusca] = useState('')
  const [filtroProximos, setFiltroProximos] = useState(false)
  const [filtroPromocao, setFiltroPromocao] = useState(false)

  const [mercados, setMercados] = useState([])
  const [marketIdsComPromocao, setMarketIdsComPromocao] = useState(new Set())
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    carregarMercados()
  }, [])

  async function carregarMercados() {
    setCarregando(true)
    setErro(null)

    // SIMPLIFICAÇÃO TEMPORÁRIA: sem localização do consumidor ainda, então
    // sempre buscamos por mais recentes primeiro (mesma lógica da Home). O
    // filtro "Mais próximos" só reaplica essa mesma ordenação.
    const { data: mercadosData, error: mercadosError } = await supabase
      .from('market_profiles')
      .select('id, nome, bairro')
      .order('created_at', { ascending: false })

    if (mercadosError) {
      setErro('Não foi possível carregar os mercados agora.')
      setMercados([])
      setCarregando(false)
      return
    }

    const listaMercados = mercadosData ?? []
    setMercados(listaMercados)

    if (listaMercados.length > 0) {
      const agora = new Date().toISOString()
      const idsMercados = listaMercados.map((mercado) => mercado.id)

      const { data: produtosPromocao, error: produtosError } = await supabase
        .from('products')
        .select('market_id')
        .in('market_id', idsMercados)
        .not('promocao_validade_fim', 'is', null)
        .gt('promocao_validade_fim', agora)

      if (!produtosError) {
        setMarketIdsComPromocao(new Set((produtosPromocao ?? []).map((produto) => produto.market_id)))
      }
    }

    setCarregando(false)
  }

  const mercadosFiltrados = useMemo(() => {
    let lista = mercados.map((mercado) => ({
      ...mercado,
      temPromocao: marketIdsComPromocao.has(mercado.id),
    }))

    const termo = busca.trim().toLowerCase()
    if (termo) {
      lista = lista.filter((mercado) => mercado.nome.toLowerCase().includes(termo))
    }

    if (filtroPromocao) {
      lista = lista.filter((mercado) => mercado.temPromocao)
    }

    // "Mais próximos" não reordena de verdade (ver aviso no topo do
    // arquivo) — a lista já vem ordenada por mais recentes do carregamento.

    return lista
  }, [mercados, marketIdsComPromocao, busca, filtroPromocao])

  function handleAbrirMapaPlaceholder() {
    // Placeholder sem funcionalidade real — só avisa que o mapa ainda não
    // existe, em vez de o botão não fazer nada visivelmente ao ser tocado.
    window.alert('Mapa ainda não disponível nesta versão. Em breve!')
  }

  function handleAbrirMercadoPlaceholder() {
    // A tela de detalhe do mercado ainda não existe (próxima etapa do MVP).
    console.log('[Explorar] TODO: navegar para Mercado (detalhe)')
  }

  return (
    <div className="explorar-screen">
      <header className="explorar-topbar">
        <h1 className="explorar-titulo">Explorar mercados</h1>
        <button
          type="button"
          className="explorar-mapa-botao"
          onClick={handleAbrirMapaPlaceholder}
        >
          Ver no mapa
        </button>
      </header>

      <main className="explorar-content">
        {/* Busca por nome */}
        <div className="explorar-busca">
          <span className="explorar-busca-icone" aria-hidden="true">
            ⚲
          </span>
          <input
            type="text"
            className="explorar-busca-input"
            placeholder="Buscar mercado pelo nome"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            aria-label="Buscar mercado pelo nome"
          />
        </div>

        {/* Filtros simples (chips de toggle) */}
        <div className="explorar-filtros" role="group" aria-label="Filtros">
          <button
            type="button"
            className={`chip-filtro${filtroProximos ? ' is-ativo' : ''}`}
            aria-pressed={filtroProximos}
            onClick={() => setFiltroProximos((atual) => !atual)}
          >
            Mais próximos
          </button>
          <button
            type="button"
            className={`chip-filtro${filtroPromocao ? ' is-ativo' : ''}`}
            aria-pressed={filtroPromocao}
            onClick={() => setFiltroPromocao((atual) => !atual)}
          >
            Com promoção
          </button>
        </div>

        {erro && (
          <p className="explorar-erro" role="alert">
            {erro}
          </p>
        )}

        {/* Lista de mercados */}
        {carregando ? (
          <p className="explorar-secao-vazia">Carregando...</p>
        ) : mercadosFiltrados.length === 0 ? (
          <div className="explorar-vazio">
            {mercados.length === 0 ? (
              <>
                <p className="explorar-vazio-titulo">
                  Nenhum mercado parceiro por aqui ainda.
                </p>
                <p className="explorar-vazio-texto">
                  Estamos recrutando mercados do seu bairro. Volte em breve!
                </p>
              </>
            ) : (
              <>
                <p className="explorar-vazio-titulo">
                  Nenhum mercado encontrado.
                </p>
                <p className="explorar-vazio-texto">
                  Tente outro termo de busca ou remova os filtros ativos.
                </p>
              </>
            )}
          </div>
        ) : (
          <ul className="explorar-lista">
            {mercadosFiltrados.map((mercado) => (
              <li key={mercado.id}>
                <button
                  type="button"
                  className="card-mercado-explorar"
                  onClick={handleAbrirMercadoPlaceholder}
                >
                  <div className="card-mercado-explorar-info">
                    <span className="card-mercado-explorar-nome">{mercado.nome}</span>
                    <span className="card-mercado-explorar-local">{mercado.bairro}</span>
                  </div>
                  {mercado.temPromocao && (
                    <span className="badge-promocao">Promoção</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* Barra de navegação inferior — mesma estrutura visual da Home/Lista,
          com "Explorar" marcado como ativo. */}
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
        <button type="button" className="bottom-nav-item is-active" aria-current="page">
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

export default Explorar
