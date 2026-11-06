import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import './Lista.css'

/**
 * Tela "Lista de compras" do app do consumidor.
 *
 * Agora ligada ao Supabase de verdade (tabelas shopping_lists /
 * shopping_list_items, ver database/migrations/001_init.sql). Resumo do que
 * acontece ao abrir a tela:
 *
 * 1. Pega o usuário logado (supabase.auth.getUser()).
 * 2. Busca as listas desse consumidor (shopping_lists where consumer_id =
 *    id do usuário).
 * 3. Se não existir nenhuma lista ainda (primeiro uso), cria uma lista
 *    padrão chamada "Minha lista" automaticamente — assim a tela nunca
 *    fica sem nenhuma ação possível.
 * 4. Busca os itens da lista selecionada (shopping_list_items where
 *    list_id = id da lista ativa, ordenado por created_at).
 *
 * As decisões de design visual (seletor nativo, botão de adicionar no
 * topo, checkbox redondo, lixeira em vez de swipe, etc.) continuam as
 * mesmas já aprovadas pelo CEO e documentadas antes desta tela virar
 * integração real — só o "motor" por trás trocou de dados de exemplo em
 * useState para chamadas reais ao Supabase.
 */
function Lista({ onNavigateToHome, onNavigateToExplorar, onNavigateToPerfil }) {
  const [listas, setListas] = useState([])
  const [listaAtivaId, setListaAtivaId] = useState(null)
  const [itens, setItens] = useState([])
  const [novoItem, setNovoItem] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  // Carrega as listas do consumidor logado ao montar a tela.
  useEffect(() => {
    carregarListas()
  }, [])

  // Sempre que a lista ativa mudar, busca os itens dela.
  useEffect(() => {
    if (listaAtivaId) {
      carregarItens(listaAtivaId)
    }
  }, [listaAtivaId])

  async function carregarListas() {
    setCarregando(true)
    setErro(null)

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user) {
      setErro('Não foi possível identificar seu usuário. Tente entrar novamente.')
      setCarregando(false)
      return
    }

    const consumerId = userData.user.id

    const { data: listasExistentes, error: listasError } = await supabase
      .from('shopping_lists')
      .select('id, nome')
      .eq('consumer_id', consumerId)
      .order('created_at', { ascending: true })

    if (listasError) {
      setErro('Não foi possível carregar sua lista agora.')
      setCarregando(false)
      return
    }

    // Primeiro uso: ainda não existe nenhuma lista para este consumidor.
    // Criamos uma lista padrão para a tela nunca ficar sem ação possível.
    if (!listasExistentes || listasExistentes.length === 0) {
      const { data: novaLista, error: criarError } = await supabase
        .from('shopping_lists')
        .insert({ consumer_id: consumerId, nome: 'Minha lista' })
        .select('id, nome')
        .single()

      if (criarError || !novaLista) {
        setErro('Não foi possível criar sua lista agora.')
        setCarregando(false)
        return
      }

      setListas([novaLista])
      setListaAtivaId(novaLista.id)
      setCarregando(false)
      return
    }

    setListas(listasExistentes)
    setListaAtivaId(listasExistentes[0].id)
    setCarregando(false)
  }

  async function carregarItens(listId) {
    setErro(null)

    const { data, error } = await supabase
      .from('shopping_list_items')
      .select('id, nome_item, comprado')
      .eq('list_id', listId)
      .order('created_at', { ascending: true })

    if (error) {
      setErro('Não foi possível carregar sua lista agora.')
      return
    }

    setItens(data ?? [])
  }

  const totalItens = itens.length
  const totalComprados = itens.filter((item) => item.comprado).length

  function handleTrocarLista(event) {
    setListaAtivaId(event.target.value)
  }

  async function handleAdicionarItem(event) {
    event.preventDefault()
    const nome = novoItem.trim()
    if (!nome || !listaAtivaId) return

    const { data, error } = await supabase
      .from('shopping_list_items')
      .insert({ list_id: listaAtivaId, nome_item: nome, comprado: false })
      .select('id, nome_item, comprado')
      .single()

    if (error || !data) {
      setErro('Não foi possível adicionar o item agora.')
      return
    }

    setItens((atual) => [...atual, data])
    setNovoItem('')
  }

  async function handleAlternarComprado(itemId) {
    const itemAtual = itens.find((item) => item.id === itemId)
    if (!itemAtual) return

    const novoValor = !itemAtual.comprado

    // Atualiza a tela primeiro (otimista) para o toque parecer instantâneo,
    // e desfaz se a chamada ao banco falhar.
    setItens((atual) =>
      atual.map((item) => (item.id === itemId ? { ...item, comprado: novoValor } : item)),
    )

    const { error } = await supabase
      .from('shopping_list_items')
      .update({ comprado: novoValor })
      .eq('id', itemId)

    if (error) {
      setErro('Não foi possível salvar essa alteração agora.')
      setItens((atual) =>
        atual.map((item) => (item.id === itemId ? { ...item, comprado: itemAtual.comprado } : item)),
      )
    }
  }

  async function handleRemoverItem(itemId) {
    const itemAtual = itens.find((item) => item.id === itemId)
    if (!itemAtual) return

    setItens((atual) => atual.filter((item) => item.id !== itemId))

    const { error } = await supabase.from('shopping_list_items').delete().eq('id', itemId)

    if (error) {
      setErro('Não foi possível remover o item agora.')
      setItens((atual) => [...atual, itemAtual])
    }
  }

  if (carregando) {
    return (
      <div className="lista-screen">
        <main className="lista-content">
          <p>Carregando sua lista...</p>
        </main>
      </div>
    )
  }

  const listaAtiva = listas.find((lista) => lista.id === listaAtivaId) ?? listas[0]

  return (
    <div className="lista-screen">
      <header className="lista-topbar">
        <h1 className="lista-titulo">Lista de compras</h1>

        {/* Seletor de lista — só aparece de forma simples (select nativo),
            já que a maioria dos usuários terá apenas uma lista no MVP. */}
        {listaAtiva && (
          <label className="lista-seletor-label" htmlFor="seletor-lista">
            <span className="sr-only">Escolher lista</span>
            <select
              id="seletor-lista"
              className="lista-seletor"
              value={listaAtiva.id}
              onChange={handleTrocarLista}
            >
              {listas.map((lista) => (
                <option key={lista.id} value={lista.id}>
                  {lista.nome}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      <main className="lista-content">
        {erro && <p className="lista-erro">{erro}</p>}

        {listaAtiva && (
          <>
            <div className="lista-progresso">
              {totalComprados} de {totalItens} comprados
            </div>

            {/* Adicionar item — fica no topo do conteúdo porque é a ação mais
                repetida desta tela. */}
            <form className="lista-adicionar" onSubmit={handleAdicionarItem}>
              <input
                type="text"
                className="lista-adicionar-input"
                placeholder="Adicionar item (ex: leite)"
                value={novoItem}
                onChange={(event) => setNovoItem(event.target.value)}
                aria-label="Novo item"
              />
              <button type="submit" className="lista-adicionar-botao" aria-label="Adicionar item">
                +
              </button>
            </form>

            {/* Itens da lista */}
            <ul className="lista-itens">
              {itens.length === 0 && (
                <li className="lista-vazia">Nenhum item ainda. Adicione o primeiro acima.</li>
              )}

              {itens.map((item) => (
                <li
                  key={item.id}
                  className={`lista-item${item.comprado ? ' is-comprado' : ''}`}
                >
                  <button
                    type="button"
                    className="lista-item-toque"
                    onClick={() => handleAlternarComprado(item.id)}
                  >
                    <span
                      className={`lista-item-checkbox${item.comprado ? ' is-marcado' : ''}`}
                      aria-hidden="true"
                    >
                      {item.comprado ? '✓' : ''}
                    </span>
                    <span className="lista-item-nome">{item.nome_item}</span>
                  </button>

                  <button
                    type="button"
                    className="lista-item-remover"
                    aria-label={`Remover ${item.nome_item}`}
                    onClick={() => handleRemoverItem(item.id)}
                  >
                    🗑
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>

      {/* Barra de navegação inferior — mesma estrutura visual da Home,
          com "Lista" marcado como ativo. */}
      <nav className="bottom-nav">
        <button type="button" className="bottom-nav-item" onClick={onNavigateToHome}>
          <span className="bottom-nav-icon" aria-hidden="true">
            ⌂
          </span>
          <span className="bottom-nav-label">Home</span>
        </button>
        <button type="button" className="bottom-nav-item is-active" aria-current="page">
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

export default Lista
