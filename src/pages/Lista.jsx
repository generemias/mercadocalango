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
 *
 * Mais de uma lista (pedido do CEO): a tabela shopping_lists já suportava
 * várias listas por consumidor desde o início (não existe nenhum limite de
 * 1 lista no schema), e o seletor no topo já trocava entre elas — só
 * faltava um jeito de CRIAR uma lista nova além da "Minha lista" automática
 * do primeiro uso. handleCriarLista resolve isso com um prompt simples
 * (nome da lista), no mesmo espírito de handleEntrarComCodigo logo abaixo.
 *
 * "Ajustar o valor na hora das compras" (pedido do CEO): cada item ganhou
 * um campo opcional valor_pago (ver migration 006). Só aparece depois que o
 * item é marcado como comprado — antes disso não faz sentido perguntar
 * quanto custou algo que ainda não foi pago. O campo salva ao perder o foco
 * (onBlur), mesmo padrão de "salva sozinho sem precisar de botão" já usado
 * em outras telas do app (ex: handleAlternarComprado logo abaixo). A soma
 * dos itens com valor preenchido aparece como "Total gasto" ao lado do
 * contador de itens comprados.
 *
 * "Lista em conjunto" (pedido do CEO, ver migration 007): uma lista pode
 * ser compartilhada por código — quem cria a lista toca "Compartilhar",
 * recebe um código curto (gerado e salvo em shopping_lists.convite_codigo),
 * e repassa esse código por fora do app (WhatsApp etc.). Quem recebe toca
 * "Entrar com código" e cola o código; por trás, isso chama a função do
 * banco entrar_lista_compartilhada (RPC), que acha a lista pelo código e
 * adiciona quem chamou como membro em shopping_list_members. A partir daí a
 * lista aparece pra essa pessoa também no seletor, com acesso igual ao do
 * dono (adicionar/marcar/remover item) — sem hierarquia entre dono e
 * convidado, só decisão do CEO. carregarListas() busca as listas próprias
 * E as compartilhadas na mesma consulta (a RLS de shopping_lists já libera
 * as duas; não precisa filtrar no código do app).
 */
// Mesma formatação automática de preço já usada no cadastro de produtos do
// mercado (CadastroProdutos.jsx): completa ",00" se a pessoa digitou só a
// parte inteira, sem mexer se já tiver vírgula ou ponto.
function completarCentavos(valor) {
  const valorLimpo = valor.trim()
  if (!valorLimpo || valorLimpo.includes(',') || valorLimpo.includes('.')) {
    return valorLimpo
  }
  return `${valorLimpo},00`
}

function formatarPreco(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Código de convite curto (8 caracteres, letras maiúsculas + números) —
// fácil de digitar/ditar por WhatsApp, e o espaço (36^8) é grande o
// suficiente pra colisão ser raríssima no tamanho deste piloto. Se mesmo
// assim colidir (unique constraint), handleCompartilhar tenta de novo.
function gerarCodigoConvite() {
  const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let codigo = ''
  for (let i = 0; i < 8; i += 1) {
    codigo += caracteres[Math.floor(Math.random() * caracteres.length)]
  }
  return codigo
}

function Lista({ onNavigateToHome, onNavigateToExplorar, onNavigateToPerfil }) {
  const [listas, setListas] = useState([])
  const [listaAtivaId, setListaAtivaId] = useState(null)
  const [meuConsumerId, setMeuConsumerId] = useState(null)
  const [itens, setItens] = useState([])
  const [novoItem, setNovoItem] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  // Rascunho do valor pago por item, enquanto a pessoa ainda está digitando
  // (antes de salvar no onBlur) — ver handleDigitarValorPago/
  // handleSalvarValorPago mais abaixo. Chave: id do item; valor: texto bruto
  // do input (ainda não validado/formatado).
  const [valoresPagosDraft, setValoresPagosDraft] = useState({})

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
    setMeuConsumerId(consumerId)

    // Primeiro uso: checa só as listas PRÓPRIAS (não as compartilhadas) pra
    // decidir se precisa criar a lista padrão — uma pessoa que só entrou
    // numa lista compartilhada de outra ainda não tem lista própria
    // nenhuma, e também deve ganhar a "Minha lista" automática.
    const { data: listasProprias, error: listasPropriasError } = await supabase
      .from('shopping_lists')
      .select('id')
      .eq('consumer_id', consumerId)

    if (listasPropriasError) {
      setErro('Não foi possível carregar sua lista agora.')
      setCarregando(false)
      return
    }

    if (listasProprias.length === 0) {
      const { error: criarError } = await supabase
        .from('shopping_lists')
        .insert({ consumer_id: consumerId, nome: 'Minha lista' })

      if (criarError) {
        setErro('Não foi possível criar sua lista agora.')
        setCarregando(false)
        return
      }
    }

    // Busca TODAS as listas que esta pessoa pode acessar — próprias E
    // compartilhadas (ver migration 007). A RLS de shopping_lists já filtra
    // isso sozinha, então aqui não tem nenhum .eq('consumer_id', ...): um
    // filtro assim excluiria justamente as listas compartilhadas que
    // queremos mostrar.
    const { data: todasListas, error: todasListasError } = await supabase
      .from('shopping_lists')
      .select('id, nome, consumer_id, convite_codigo')
      .order('created_at', { ascending: true })

    if (todasListasError || !todasListas || todasListas.length === 0) {
      setErro('Não foi possível carregar sua lista agora.')
      setCarregando(false)
      return
    }

    setListas(todasListas)
    setListaAtivaId(todasListas[0].id)
    setCarregando(false)
  }

  async function carregarItens(listId) {
    setErro(null)

    const { data, error } = await supabase
      .from('shopping_list_items')
      .select('id, nome_item, comprado, valor_pago')
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
  // Soma só itens que estão comprado=true E têm valor_pago preenchido —
  // sem o "comprado=true", o campo de valor fica escondido na tela (ver
  // comentário no topo do arquivo), então um valor de uma compra desfeita
  // (desmarcada depois) não pode continuar contando no total sem aparecer
  // em lugar nenhum.
  const itensComprovados = itens.filter((item) => item.comprado && item.valor_pago != null)
  const totalGasto = itensComprovados.reduce((soma, item) => soma + Number(item.valor_pago), 0)
  const temAlgumValorPago = itensComprovados.length > 0

  function handleTrocarLista(event) {
    setListaAtivaId(event.target.value)
  }

  async function handleCriarLista() {
    const nomeDigitado = window.prompt('Nome da nova lista (ex: "Mercado do mês", "Churrasco"):')
    if (!nomeDigitado) return

    const nome = nomeDigitado.trim()
    if (!nome) return

    if (!meuConsumerId) {
      setErro('Não foi possível identificar seu usuário. Tente entrar novamente.')
      return
    }

    const { data: novaLista, error } = await supabase
      .from('shopping_lists')
      .insert({ consumer_id: meuConsumerId, nome })
      .select('id, nome, consumer_id, convite_codigo')
      .single()

    if (error || !novaLista) {
      setErro('Não foi possível criar a lista agora.')
      return
    }

    setListas((atual) => [...atual, novaLista])
    setListaAtivaId(novaLista.id)
  }

  async function handleCompartilhar(lista) {
    // Já tem código gerado antes: só mostra de novo, não gera outro (um
    // código novo invalidaria o que já foi compartilhado com alguém).
    if (lista.convite_codigo) {
      window.alert(`Código para compartilhar "${lista.nome}": ${lista.convite_codigo}`)
      return
    }

    // Só o dono consegue gravar o código (RLS de shopping_lists só libera
    // UPDATE para quem criou a lista) — ver comentário no botão que chama
    // esta função, que já fica escondido pra quem não é dono.
    const codigo = gerarCodigoConvite()
    const { data, error } = await supabase
      .from('shopping_lists')
      .update({ convite_codigo: codigo })
      .eq('id', lista.id)
      .select('id, convite_codigo')
      .single()

    if (error || !data) {
      setErro('Não foi possível gerar o código de compartilhamento agora.')
      return
    }

    setListas((atual) =>
      atual.map((item) => (item.id === lista.id ? { ...item, convite_codigo: data.convite_codigo } : item)),
    )
    window.alert(`Código para compartilhar "${lista.nome}": ${data.convite_codigo}`)
  }

  async function handleEntrarComCodigo() {
    const codigoDigitado = window.prompt('Cole aqui o código de convite da lista:')
    if (!codigoDigitado) return

    const codigo = codigoDigitado.trim().toUpperCase()

    // entrar_lista_compartilhada roda no banco com privilégio elevado só
    // para achar a lista pelo código e nos adicionar como membro — ver
    // comentário completo na migration 007. Nunca expõe os códigos de
    // outras listas, só diz se o que digitamos bateu com alguma.
    const { data: listaId, error } = await supabase.rpc('entrar_lista_compartilhada', {
      p_codigo: codigo,
    })

    if (error) {
      setErro('Não foi possível entrar na lista agora. Tente novamente.')
      return
    }

    if (!listaId) {
      window.alert('Código inválido. Confira com quem te enviou e tente de novo.')
      return
    }

    // Recarrega a lista de listas acessíveis (agora inclui a que acabamos
    // de entrar) e já troca para ela.
    await carregarListas()
    setListaAtivaId(listaId)
  }

  async function handleAdicionarItem(event) {
    event.preventDefault()
    const nome = novoItem.trim()
    if (!nome || !listaAtivaId) return

    const { data, error } = await supabase
      .from('shopping_list_items')
      .insert({ list_id: listaAtivaId, nome_item: nome, comprado: false })
      .select('id, nome_item, comprado, valor_pago')
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

  function handleDigitarValorPago(itemId, valorDigitado) {
    setValoresPagosDraft((atual) => ({ ...atual, [itemId]: valorDigitado }))
  }

  async function handleSalvarValorPago(itemId) {
    const valorDigitado = valoresPagosDraft[itemId]
    // undefined = a pessoa não mexeu no campo (ex: só passou o foco e saiu)
    // — nada para salvar.
    if (valorDigitado === undefined) return

    const valorFormatado = completarCentavos(valorDigitado)
    const valorPago = valorFormatado ? Number(valorFormatado.replace(',', '.')) : null

    // Campo vazio (apagou o valor) é válido — volta a não ter valor pago
    // registrado. Só bloqueia um número inválido de verdade (ex: "abc").
    if (valorFormatado && (Number.isNaN(valorPago) || valorPago < 0)) {
      setErro('Digite um valor válido (ex: 9,90) ou deixe o campo em branco.')
      return
    }

    setValoresPagosDraft((atual) => {
      const { [itemId]: _removido, ...resto } = atual
      return resto
    })

    const itemAtual = itens.find((item) => item.id === itemId)
    setItens((atual) =>
      atual.map((item) => (item.id === itemId ? { ...item, valor_pago: valorPago } : item)),
    )

    const { error } = await supabase
      .from('shopping_list_items')
      .update({ valor_pago: valorPago })
      .eq('id', itemId)

    if (error) {
      setErro('Não foi possível salvar o valor pago agora.')
      setItens((atual) =>
        atual.map((item) => (item.id === itemId ? { ...item, valor_pago: itemAtual?.valor_pago ?? null } : item)),
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

        {/* Seletor de lista (select nativo) — navega entre todas as listas
            que a pessoa tem acesso (próprias e compartilhadas, ver
            carregarListas). "+" ao lado cria mais uma lista própria. */}
        {listaAtiva && (
          <div className="lista-seletor-grupo">
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
            <button
              type="button"
              className="lista-nova-botao"
              aria-label="Criar nova lista"
              title="Criar nova lista"
              onClick={handleCriarLista}
            >
              +
            </button>
          </div>
        )}
      </header>

      {/* Lista em conjunto: "Compartilhar" só aparece pra quem É dono da
          lista ativa (RLS só deixa o dono gravar o código, ver migration
          007) — quem entrou via código não vê esse botão nesta lista, mas
          pode compartilhar as próprias. "Entrar com código" fica sempre
          visível, pra qualquer pessoa entrar em uma lista de outra. */}
      {listaAtiva && (
        <div className="lista-compartilhar-barra">
          {listaAtiva.consumer_id === meuConsumerId && (
            <button type="button" className="lista-compartilhar-botao" onClick={() => handleCompartilhar(listaAtiva)}>
              Compartilhar
            </button>
          )}
          <button type="button" className="lista-compartilhar-botao" onClick={handleEntrarComCodigo}>
            Entrar com código
          </button>
        </div>
      )}

      <main className="lista-content">
        {erro && <p className="lista-erro">{erro}</p>}

        {listaAtiva && (
          <>
            <div className="lista-progresso">
              {totalComprados} de {totalItens} comprados
              {temAlgumValorPago && (
                <span className="lista-total-gasto"> · Total gasto: {formatarPreco(totalGasto)}</span>
              )}
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

                  {/* Valor pago: só aparece depois que o item é marcado
                      como comprado (ver comentário no topo do arquivo) —
                      não faz sentido perguntar o preço de algo que ainda
                      não foi pago. */}
                  {item.comprado && (
                    <input
                      type="text"
                      inputMode="decimal"
                      className="lista-item-valor-pago"
                      placeholder="R$"
                      aria-label={`Valor pago em ${item.nome_item}`}
                      value={
                        valoresPagosDraft[item.id] ??
                        (item.valor_pago != null ? String(item.valor_pago) : '')
                      }
                      onChange={(event) => handleDigitarValorPago(item.id, event.target.value)}
                      onBlur={() => handleSalvarValorPago(item.id)}
                    />
                  )}

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
