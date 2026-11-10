import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import './BuscaProdutos.css'

/**
 * Busca de PRODUTO (não de mercado) — aparece como a segunda aba da tela
 * Explorar (ver o seletor "Mercados" / "Produtos" em Explorar.jsx).
 *
 * Por que uma aba dentro de Explorar, e não um campo novo na Home ou uma
 * tela própria na barra de navegação inferior:
 * - Home é a tela de "o que eu preciso fazer agora" (continuar a lista de
 *   compras) — ver o comentário no topo de Home.jsx sobre a ordem dos blocos
 *   seguir a prioridade de ação. Buscar produto é uma ação de "descoberta",
 *   o mesmo tipo de tarefa que já faz a pessoa abrir a tela Explorar. Juntar
 *   as duas buscas (mercado e produto) no mesmo lugar evita que o usuário
 *   precise decidir, antes de digitar, "isso é uma busca de mercado ou de
 *   produto?" em duas telas diferentes.
 * - Uma 5ª aba na barra de navegação inferior quebraria o padrão de 4 itens
 *   já definido no MVP (Home, Lista, Explorar, Perfil) — fora do escopo
 *   combinado com o CEO. Um seletor de 2 opções ("Mercados"/"Produtos") no
 *   topo de uma tela que já existe é a forma mais simples de encaixar isso
 *   sem adicionar navegação nova.
 * - Reaproveita o mesmo campo de busca, mesmos espaçamentos e mesmo padrão
 *   de "estado vazio" que Explorar.jsx já usa para mercados — quem já usou
 *   a busca de mercado entende a busca de produto sem aprender nada novo.
 *
 * Resultado de cada busca: cards simples (nome do produto, categoria, preço,
 * nome do mercado que vende), e tocar no card leva para a tela "Mercado
 * (detalhe)" daquele mercado — mesmo destino de quando se toca num mercado
 * na aba "Mercados" (callback onNavigateToMercado, já usado em Explorar.jsx
 * e App.jsx).
 *
 * Integração com Supabase (ligada de verdade agora, mesmo padrão já usado em
 * Home/Explorar/MercadoDetalhe):
 * - Busca por nome OU categoria do produto (`.or(nome.ilike...,categoria.ilike...)`),
 *   com join em `market_profiles` para pegar o nome do mercado. Decidimos
 *   incluir categoria porque, no piloto, é comum o cliente digitar algo
 *   genérico ("limpeza", "laticínios") em vez do nome exato do produto — a
 *   mesma busca já cobre os dois casos sem precisar de um segundo campo.
 * - Debounce de ~400ms: a consulta só é disparada 400ms depois da última
 *   tecla digitada, para não gerar uma query (e um possível registro em
 *   product_searches) por letra.
 * - Telemetria (`product_searches`): quando o debounce dispara e a busca
 *   termina, registramos UMA linha com consumer_id (via
 *   supabase.auth.getUser(), nunca de outra fonte), termo_busca e o
 *   product_id do primeiro resultado (ou null se não encontrou nada). Fire
 *   and forget — mesmo cuidado já tomado em market_views/market_route_clicks
 *   no MercadoDetalhe.jsx: não trava a busca nem mostra erro ao usuário se o
 *   insert falhar. Para não duplicar linhas à toa quando o debounce disparar
 *   de novo com o mesmo termo (ex: usuário parou de digitar, buscou, e nada
 *   mudou), guardamos o último termo já registrado e só inserimos de novo se
 *   o termo tiver mudado.
 */

function formatarPreco(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function BuscaProdutos({ onNavigateToMercado }) {
  const [termo, setTermo] = useState('')
  const [resultados, setResultados] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)
  const [buscou, setBuscou] = useState(false)

  // Guarda o último termo já registrado em product_searches, para não
  // inserir uma linha duplicada se o debounce disparar de novo com o mesmo
  // termo (ver comentário no topo do arquivo).
  const ultimoTermoRegistradoRef = useRef(null)

  const termoNormalizado = termo.trim()

  useEffect(() => {
    if (!termoNormalizado) {
      setResultados([])
      setBuscou(false)
      setErro(null)
      return
    }

    const timeoutId = setTimeout(() => {
      buscarProdutos(termoNormalizado)
    }, 400)

    return () => clearTimeout(timeoutId)
  }, [termoNormalizado])

  async function buscarProdutos(termoBusca) {
    setCarregando(true)
    setErro(null)

    const { data, error } = await supabase
      .from('products')
      .select('id, nome, categoria, preco, market_id, market_profiles(nome)')
      .or(`nome.ilike.%${termoBusca}%,categoria.ilike.%${termoBusca}%`)
      .limit(30)

    if (error) {
      setErro('Não foi possível buscar produtos agora.')
      setResultados([])
      setCarregando(false)
      setBuscou(true)
      return
    }

    const lista = data ?? []
    setResultados(lista)
    setCarregando(false)
    setBuscou(true)

    registrarBusca(termoBusca, lista[0]?.id ?? null)
  }

  // Telemetria: fire and forget, nunca trava a busca nem mostra erro ao
  // usuário (mesmo padrão de market_views/market_route_clicks em
  // MercadoDetalhe.jsx).
  function registrarBusca(termoBusca, primeiroProdutoId) {
    if (ultimoTermoRegistradoRef.current === termoBusca) return
    ultimoTermoRegistradoRef.current = termoBusca

    supabase.auth
      .getUser()
      .then(({ data: userData }) => {
        if (!userData?.user) return
        return supabase.from('product_searches').insert({
          consumer_id: userData.user.id,
          termo_busca: termoBusca,
          product_id: primeiroProdutoId,
        })
      })
      .catch(() => {})
  }

  function handleAbrirResultado(produto) {
    onNavigateToMercado?.(produto.market_id)
  }

  return (
    <div className="busca-produtos">
      {/* Busca por nome de produto (ou categoria) */}
      <div className="explorar-busca">
        <span className="explorar-busca-icone" aria-hidden="true">
          ⚲
        </span>
        <input
          type="text"
          className="explorar-busca-input"
          placeholder="Buscar produto pelo nome"
          value={termo}
          onChange={(event) => setTermo(event.target.value)}
          aria-label="Buscar produto pelo nome em todos os mercados parceiros"
        />
      </div>

      {erro && (
        <p className="explorar-erro" role="alert">
          {erro}
        </p>
      )}

      {/* Estado inicial: ainda não digitou nada */}
      {!termoNormalizado && (
        <div className="busca-produtos-vazio">
          <p className="busca-produtos-vazio-titulo">Busque um produto</p>
          <p className="busca-produtos-vazio-texto">
            Digite o nome de um produto para buscar em todos os mercados parceiros.
          </p>
        </div>
      )}

      {/* Aguardando o debounce ou a resposta do Supabase */}
      {termoNormalizado && carregando && (
        <p className="explorar-secao-vazia">Buscando...</p>
      )}

      {/* Estado vazio: buscou e não encontrou nada */}
      {termoNormalizado && !carregando && buscou && resultados.length === 0 && !erro && (
        <div className="busca-produtos-vazio">
          <p className="busca-produtos-vazio-titulo">Nenhum produto encontrado com esse nome.</p>
          <p className="busca-produtos-vazio-texto">Tente outro termo, ou busque pelo nome do mercado na aba "Mercados".</p>
        </div>
      )}

      {/* Resultados */}
      {!carregando && resultados.length > 0 && (
        <ul className="busca-produtos-lista">
          {resultados.map((produto) => (
            <li key={produto.id}>
              <button
                type="button"
                className="card-produto-busca"
                onClick={() => handleAbrirResultado(produto)}
              >
                <div className="card-produto-busca-info">
                  <span className="card-produto-busca-nome">{produto.nome}</span>
                  <span className="card-produto-busca-categoria">{produto.categoria}</span>
                  <span className="card-produto-busca-mercado">
                    Vendido em: {produto.market_profiles?.nome ?? 'Mercado'}
                  </span>
                </div>
                <span className="card-produto-busca-preco">{formatarPreco(produto.preco)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default BuscaProdutos
