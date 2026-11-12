import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import marcadorIcone from 'leaflet/dist/images/marker-icon.png'
import marcadorIcone2x from 'leaflet/dist/images/marker-icon-2x.png'
import marcadorSombra from 'leaflet/dist/images/marker-shadow.png'
import { supabase } from '../lib/supabaseClient'
import BuscaProdutos from './BuscaProdutos'
import './Explorar.css'

// Mesma correção de ícone do Leaflet+bundler já usada em MercadoDetalhe.jsx.
const iconeMercado = L.icon({
  iconUrl: marcadorIcone,
  iconRetinaUrl: marcadorIcone2x,
  shadowUrl: marcadorSombra,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
})


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
 * Botão "Ver no mapa": mapa geral (OpenStreetMap via Leaflet, mesmo padrão
 * de MercadoDetalhe.jsx) com um marcador para cada mercado que já tem
 * latitude/longitude cadastrada em PerfilMercado.jsx. Mercados sem
 * localização cadastrada simplesmente não aparecem no mapa (não dá pra
 * desenhar um pino sem coordenada) — a lista abaixo do mapa continua
 * mostrando todos, com ou sem localização. Isso atualiza sozinho conforme
 * mais mercados parceiros cadastrarem a localização deles, sem precisar de
 * nenhuma mudança de código.
 *
 * Clique num card de mercado: agora navega para a tela "Mercado (detalhe)"
 * (ver src/pages/MercadoDetalhe.jsx), via o callback onNavigateToMercado.
 *
 * Aba "Mercados" / "Produtos": o CEO pediu uma busca por PRODUTO (em todos
 * os mercados parceiros, não só por nome de mercado) para alimentar a
 * métrica "produtos mais buscados pelos clientes" do dashboard do mercado.
 * Em vez de criar uma tela nova (ou um campo na Home), ela entra aqui como
 * uma segunda aba, porque busca de produto é a mesma "intenção" de busca de
 * mercado — descoberta, não tarefa pendente — e assim reaproveita o mesmo
 * campo de busca e o mesmo lugar na navegação (ver explicação completa no
 * topo de BuscaProdutos.jsx, o componente que implementa essa aba).
 */
function Explorar({
  onNavigateToHome,
  onNavigateToLista,
  onNavigateToPerfil,
  onNavigateToMercado,
  // Permite chegar nesta tela já na aba "Produtos" (ex: atalho "Buscar
  // produtos" na Home — ver Home.jsx e o App.jsx, que guarda qual aba abrir
  // igual já faz hoje com mercadoSelecionadoId para a tela de detalhe).
  abaInicial = 'mercados',
}) {
  const [aba, setAba] = useState(abaInicial) // 'mercados' | 'produtos'
  const [busca, setBusca] = useState('')
  const [filtroProximos, setFiltroProximos] = useState(false)
  const [filtroPromocao, setFiltroPromocao] = useState(false)
  const [mostrarMapa, setMostrarMapa] = useState(false)

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
      .select('id, nome, bairro, latitude, longitude')
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

  // Só entram no mapa os mercados com latitude/longitude cadastradas —
  // atualiza sozinho conforme mais mercados completarem o cadastro em
  // PerfilMercado.jsx (ver comentário no topo do arquivo).
  const mercadosComLocalizacao = useMemo(
    () => mercados.filter((mercado) => mercado.latitude && mercado.longitude),
    [mercados],
  )

  function handleAbrirMapa() {
    setMostrarMapa(true)
  }

  function handleAbrirMercado(mercadoId) {
    onNavigateToMercado?.(mercadoId)
  }

  return (
    <div className="explorar-screen">
      <header className="explorar-topbar">
        <h1 className="explorar-titulo">Explorar mercados</h1>
        <button
          type="button"
          className="explorar-mapa-botao"
          onClick={handleAbrirMapa}
        >
          Ver no mapa
        </button>
      </header>

      {/* Mapa geral — overlay em tela cheia com um marcador por mercado que
          já tem localização cadastrada (ver mercadosComLocalizacao acima).
          Tocar num marcador abre o detalhe daquele mercado, igual ao clique
          num card da lista. */}
      {mostrarMapa && (
        <div className="explorar-mapa-overlay" role="dialog" aria-label="Mapa dos mercados">
          <header className="explorar-mapa-overlay-topbar">
            <span className="explorar-mapa-overlay-titulo">Mercados no mapa</span>
            <button
              type="button"
              className="explorar-mapa-overlay-fechar"
              aria-label="Fechar mapa"
              onClick={() => setMostrarMapa(false)}
            >
              ✕
            </button>
          </header>

          {mercadosComLocalizacao.length === 0 ? (
            <p className="explorar-mapa-overlay-vazio">
              Nenhum mercado parceiro cadastrou a localização ainda. Volte em breve!
            </p>
          ) : (
            <MapContainer
              center={[mercadosComLocalizacao[0].latitude, mercadosComLocalizacao[0].longitude]}
              zoom={13}
              scrollWheelZoom
              className="explorar-mapa-overlay-mapa"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {mercadosComLocalizacao.map((mercado) => (
                <Marker
                  key={mercado.id}
                  position={[mercado.latitude, mercado.longitude]}
                  icon={iconeMercado}
                >
                  <Popup>
                    <strong>{mercado.nome}</strong>
                    <br />
                    {mercado.bairro}
                    <br />
                    <button
                      type="button"
                      className="explorar-mapa-overlay-popup-botao"
                      onClick={() => {
                        setMostrarMapa(false)
                        handleAbrirMercado(mercado.id)
                      }}
                    >
                      Ver mercado
                    </button>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}
        </div>
      )}

      <main className="explorar-content">
        {/* Seletor de abas: "Mercados" (busca original, por nome de
            mercado) e "Produtos" (busca nova, por nome de produto em todos
            os mercados parceiros). Segmented control simples (2 opções),
            no mesmo espírito dos chips de filtro já usados nesta tela. */}
        <div className="explorar-abas" role="tablist" aria-label="Tipo de busca">
          <button
            type="button"
            role="tab"
            aria-selected={aba === 'mercados'}
            className={`explorar-aba${aba === 'mercados' ? ' is-ativa' : ''}`}
            onClick={() => setAba('mercados')}
          >
            Mercados
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={aba === 'produtos'}
            className={`explorar-aba${aba === 'produtos' ? ' is-ativa' : ''}`}
            onClick={() => setAba('produtos')}
          >
            Produtos
          </button>
        </div>

        {aba === 'produtos' ? (
          <BuscaProdutos onNavigateToMercado={handleAbrirMercado} />
        ) : (
          <>
            {/* Busca por nome de mercado */}
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
                      onClick={() => handleAbrirMercado(mercado.id)}
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
          </>
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
