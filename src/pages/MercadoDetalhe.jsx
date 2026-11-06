import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import './MercadoDetalhe.css'

/**
 * Tela "Mercado (detalhe)" do app do consumidor — abre quando o cliente toca
 * num card de mercado na tela Explorar (ver handleAbrirMercado em
 * Explorar.jsx).
 *
 * Agora ligada ao Supabase de verdade, mesmo padrão já usado em
 * Home/Lista/Explorar (useEffect + useState para carregando/erro):
 *
 * 1. Busca o mercado pelo `mercadoId` em `market_profiles` (nome, bairro,
 *    horario_funcionamento, latitude, longitude). Se não encontrar, mostra
 *    uma mensagem amigável em vez de uma tela quebrada.
 * 2. Busca os produtos desse mercado em `products` (nome, categoria, preco,
 *    promocao_validade_fim), mesma lógica de "tem promoção ativa" já usada
 *    em Explorar.jsx (promocao_validade_fim no futuro = promoção ativa).
 * 3. Favoritar/desfavoritar usa `favorite_markets` (consumer_id + market_id).
 *    Ao montar a tela, verificamos se já existe um favorito para mostrar o
 *    coração preenchido ou vazio. Ao clicar, fazemos insert (favoritar) ou
 *    delete (desfavoritar) — sempre com o id do usuário autenticado vindo de
 *    `supabase.auth.getUser()`, nunca de outra fonte (ex: prop ou estado
 *    guardado), para não arriscar favoritar em nome de outra pessoa.
 * 4. "Traçar rota": se o mercado tiver latitude/longitude cadastradas, abre
 *    o Google Maps com a rota; se não tiver (esperado hoje, nenhum mercado
 *    real cadastrou essas colunas ainda), mostra um aviso em vez de abrir um
 *    link quebrado.
 * 5. "Distância": SIMPLIFICAÇÃO TEMPORÁRIA — continua "a definir", mesma
 *    decisão já aceita em Home/Explorar, porque ainda não coletamos a
 *    localização do consumidor.
 */
function MercadoDetalhe({
  mercadoId,
  onVoltar,
  onNavigateToHome,
  onNavigateToLista,
  onNavigateToExplorar,
  onNavigateToPerfil,
}) {
  const [mercado, setMercado] = useState(null)
  const [produtos, setProdutos] = useState([])
  const [favoritado, setFavoritado] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [mercadoNaoEncontrado, setMercadoNaoEncontrado] = useState(false)

  useEffect(() => {
    carregarMercado()
  }, [mercadoId])

  async function carregarMercado() {
    setCarregando(true)
    setErro(null)
    setMercadoNaoEncontrado(false)

    if (!mercadoId) {
      setMercadoNaoEncontrado(true)
      setCarregando(false)
      return
    }

    const { data: mercadoData, error: mercadoError } = await supabase
      .from('market_profiles')
      .select('id, nome, bairro, horario_funcionamento, latitude, longitude')
      .eq('id', mercadoId)
      .maybeSingle()

    if (mercadoError) {
      setErro('Não foi possível carregar este mercado agora.')
      setCarregando(false)
      return
    }

    if (!mercadoData) {
      setMercadoNaoEncontrado(true)
      setCarregando(false)
      return
    }

    setMercado(mercadoData)

    // Produtos do mercado, com a mesma lógica de "tem promoção ativa" já
    // usada em Explorar.jsx: promocao_validade_fim preenchida e no futuro.
    const agora = new Date().toISOString()
    const { data: produtosData, error: produtosError } = await supabase
      .from('products')
      .select('id, nome, categoria, preco, promocao_validade_fim')
      .eq('market_id', mercadoId)
      .order('created_at', { ascending: true })

    if (!produtosError) {
      const listaProdutos = (produtosData ?? []).map((produto) => ({
        ...produto,
        emPromocao: Boolean(
          produto.promocao_validade_fim && produto.promocao_validade_fim > agora,
        ),
      }))
      setProdutos(listaProdutos)
    }

    // Estado inicial do favorito: só existe se o usuário logado já tiver
    // favoritado este mercado antes.
    const { data: userData } = await supabase.auth.getUser()
    if (userData?.user) {
      const { data: favoritoData } = await supabase
        .from('favorite_markets')
        .select('market_id')
        .eq('consumer_id', userData.user.id)
        .eq('market_id', mercadoId)
        .maybeSingle()

      setFavoritado(Boolean(favoritoData))
    }

    setCarregando(false)
  }

  async function handleFavoritar() {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user) {
      setErro('Não foi possível identificar seu usuário. Tente entrar novamente.')
      return
    }

    const consumerId = userData.user.id
    const novoValor = !favoritado

    // Atualiza a tela primeiro (otimista) e desfaz se a chamada ao banco
    // falhar — mesmo padrão já usado em handleAlternarComprado na Lista.jsx.
    setFavoritado(novoValor)

    if (novoValor) {
      const { error } = await supabase
        .from('favorite_markets')
        .insert({ consumer_id: consumerId, market_id: mercadoId })

      if (error) {
        setErro('Não foi possível favoritar este mercado agora.')
        setFavoritado(false)
      }
    } else {
      const { error } = await supabase
        .from('favorite_markets')
        .delete()
        .eq('consumer_id', consumerId)
        .eq('market_id', mercadoId)

      if (error) {
        setErro('Não foi possível remover este favorito agora.')
        setFavoritado(true)
      }
    }
  }

  function handleTracarRota() {
    // Decisão de design: em vez de um mapa embutido (fora do escopo desta
    // etapa — igual ao botão "Ver no mapa" do Explorar), o botão abre o
    // Google Maps em uma nova aba já com a rota até o mercado, usando
    // latitude/longitude quando existirem.
    if (mercado?.latitude && mercado?.longitude) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${mercado.latitude},${mercado.longitude}`,
        '_blank',
        'noopener,noreferrer',
      )
      return
    }

    window.alert('Localização do mercado ainda não cadastrada.')
  }

  if (carregando) {
    return (
      <div className="mercado-detalhe-screen">
        <header className="mercado-detalhe-topbar">
          <button
            type="button"
            className="mercado-detalhe-voltar"
            aria-label="Voltar para Explorar"
            onClick={onVoltar}
          >
            ←
          </button>
          <span className="mercado-detalhe-topbar-titulo">Mercado</span>
        </header>
        <main className="mercado-detalhe-content">
          <p>Carregando...</p>
        </main>
      </div>
    )
  }

  if (mercadoNaoEncontrado || !mercado) {
    return (
      <div className="mercado-detalhe-screen">
        <header className="mercado-detalhe-topbar">
          <button
            type="button"
            className="mercado-detalhe-voltar"
            aria-label="Voltar para Explorar"
            onClick={onVoltar}
          >
            ←
          </button>
          <span className="mercado-detalhe-topbar-titulo">Mercado</span>
        </header>
        <main className="mercado-detalhe-content">
          <p className="mercado-detalhe-secao-vazia">Mercado não encontrado.</p>
        </main>
      </div>
    )
  }

  return (
    <div className="mercado-detalhe-screen">
      <header className="mercado-detalhe-topbar">
        <button
          type="button"
          className="mercado-detalhe-voltar"
          aria-label="Voltar para Explorar"
          onClick={onVoltar}
        >
          ←
        </button>
        <span className="mercado-detalhe-topbar-titulo">Mercado</span>
        <button
          type="button"
          className={`mercado-detalhe-favorito${favoritado ? ' is-ativo' : ''}`}
          aria-label={favoritado ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          aria-pressed={favoritado}
          onClick={handleFavoritar}
        >
          {favoritado ? '♥' : '♡'}
        </button>
      </header>

      <main className="mercado-detalhe-content">
        {erro && (
          <p className="mercado-detalhe-erro" role="alert">
            {erro}
          </p>
        )}

        {/* Cabeçalho: nome, bairro/distância, horário */}
        <section className="mercado-detalhe-info">
          <h1 className="mercado-detalhe-nome">{mercado.nome}</h1>
          <div className="mercado-detalhe-meta">
            <span className="mercado-detalhe-meta-item">
              <span aria-hidden="true">📍</span> {mercado.bairro}
            </span>
            <span className="mercado-detalhe-meta-separador" aria-hidden="true">
              ·
            </span>
            {/* SIMPLIFICAÇÃO TEMPORÁRIA: sem localização do consumidor
                ainda, mesma decisão já aceita em Home/Explorar. */}
            <span className="mercado-detalhe-meta-item">a definir</span>
          </div>
          {mercado.horario_funcionamento && (
            <div className="mercado-detalhe-horario">
              <span aria-hidden="true">🕐</span> {mercado.horario_funcionamento}
            </div>
          )}
        </section>

        {/* Botão de rota — ação de destaque, fácil de alcançar com o
            polegar (largura total, logo abaixo das informações principais,
            antes da rolagem para a lista de produtos). */}
        <button type="button" className="mercado-detalhe-rota-botao" onClick={handleTracarRota}>
          <span aria-hidden="true">↗</span> Traçar rota
        </button>

        {/* Lista de produtos / promoções do mercado */}
        <section className="mercado-detalhe-produtos">
          <h2 className="mercado-detalhe-secao-titulo">Produtos</h2>

          {produtos.length === 0 ? (
            <p className="mercado-detalhe-secao-vazia">
              Este mercado ainda não cadastrou produtos.
            </p>
          ) : (
            <ul className="mercado-detalhe-lista-produtos">
              {produtos.map((produto) => (
                <li key={produto.id} className="card-produto-mercado">
                  <div className="card-produto-mercado-info">
                    <span className="card-produto-mercado-nome">{produto.nome}</span>
                    <span className="card-produto-mercado-categoria">{produto.categoria}</span>
                  </div>
                  <div className="card-produto-mercado-direita">
                    {produto.emPromocao && <span className="badge-promocao">Promoção</span>}
                    <span className="card-produto-mercado-preco">
                      {Number(produto.preco).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {/* Barra de navegação inferior — mesma estrutura visual das outras
          telas. "Explorar" continua marcado como ativo porque é de lá que o
          consumidor chegou até aqui. */}
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
        <button type="button" className="bottom-nav-item is-active" aria-current="page" onClick={onNavigateToExplorar}>
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

export default MercadoDetalhe
