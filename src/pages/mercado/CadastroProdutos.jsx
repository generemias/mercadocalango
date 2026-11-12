import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import '../../styles/forms.css'
import './CadastroProdutos.css'

/**
 * Tela "Cadastro de produtos/promoções" do painel do mercado parceiro (ver
 * README.md, seção "Painel do mercado (mínimo)": "nome, categoria, preço,
 * imagem, validade da promoção").
 *
 * Por decisão do CEO, esta era a próxima etapa depois do Login do mercado
 * (src/pages/mercado/LoginMercado.jsx) e, por isso, continua sendo o ponto
 * de entrada principal do lojista após o login. Agora que o Dashboard (ver
 * src/pages/mercado/DashboardMercado.jsx) também existe, as duas telas
 * ganharam uma barra de abas simples no cabeçalho (.mercado-tabs) para
 * alternar entre "Produtos" e "Dashboard" sem precisar logar de novo.
 *
 * Integração real com Supabase (tabela `products`, ver schema: id,
 * market_id, nome, categoria, marca, peso, preco, imagem_url,
 * promocao_ativa, preco_promocional, promocao_inicio,
 * promocao_validade_fim — ver migrations 003 e 004):
 * - Ao montar: supabase.auth.getUser() dá o id do mercado logado (mesmo id
 *   de market_profiles, confirmado em LoginMercado.jsx). Com esse id,
 *   busca o nome do mercado (market_profiles) e a lista de produtos
 *   (products, filtrado por market_id — a RLS no Supabase também garante
 *   isso no lado do banco).
 * - Adicionar/editar usam o mesmo formulário (insert ou update conforme o
 *   modo); remover usa delete após a confirmação nativa.
 * - Mesmo padrão de loading/erro já usado em src/pages/Lista.jsx
 *   (useEffect + useState carregando/erro).
 *
 * Decisões de design (explicadas em detalhe na resposta ao CEO):
 * 1. Imagem do produto = campo de URL (texto), não upload de arquivo. Ver
 *    comentário no campo "imagem_url" do formulário para o motivo.
 * 2. Categoria é um campo de texto livre (não uma lista fixa de categorias),
 *    porque o MVP tem poucos mercados piloto com produtos variados demais
 *    para travar numa taxonomia agora — engessar isso cedo arrisca forçar o
 *    lojista a escolher "Outros" pra tudo. Pode evoluir para um seletor com
 *    sugestões mais tarde, se o piloto mostrar poucas categorias repetidas.
 * 3. Um único formulário serve para adicionar E editar (mesmo padrão já
 *    usado em src/pages/Perfil.jsx, seção de dados pessoais: um botão
 *    "Editar" troca o card por um formulário preenchido) — evita duplicar
 *    layout para duas telas quase idênticas.
 * 4. Lista de produtos em cards verticais (não tabela): mais fácil de tocar
 *    "Editar"/"Remover" no celular do que colunas de tabela apertadas, e
 *    mantém a mesma linguagem visual de cards já usada em todo o app do
 *    consumidor (Home, Explorar, Perfil).
 *
 * Props:
 * - onNavigateToDashboard: troca para a tela de Dashboard (ver
 *   src/pages/mercado/DashboardMercado.jsx) — mesmo padrão de navegação por
 *   callback já usado em todo o app.
 * - onNavigateToPerfil: troca para a tela de Perfil do mercado (ver
 *   src/pages/mercado/PerfilMercado.jsx), 3ª aba do painel — mesmo padrão de
 *   navegação por callback das outras abas.
 * - onSair: chamado depois do logout (mesmo padrão de callback de
 *   src/pages/Perfil.jsx) — quem usa este componente decide a próxima tela
 *   (hoje App.jsx volta para LoginMercado).
 */

const FORM_VAZIO = {
  nome: '',
  categoria: '',
  marca: '',
  peso: '',
  preco: '',
  imagem_url: '',
  // Promoção: antes era só uma data de validade (o preço cadastrado já era
  // o preço promocional). Agora é uma flag explícita + preço promocional
  // separado do preço normal + range de datas (ver migration 004 e
  // promocaoEstaAtiva mais abaixo).
  promocao_ativa: false,
  preco_promocional: '',
  promocao_inicio: '',
  promocao_validade_fim: '',
}

// Formatação automática do preço ao sair do campo (onBlur): se o lojista
// digitou só a parte inteira (ex: "25"), completa com ",00" — decisão do
// CEO para evitar cadastrar um preço errado por esquecer os centavos. Não
// mexe se já tiver vírgula ou ponto (ex: "24,90" ou "24.90" continuam como
// o lojista digitou).
function completarCentavos(valor) {
  const valorLimpo = valor.trim()
  if (!valorLimpo || valorLimpo.includes(',') || valorLimpo.includes('.')) {
    return valorLimpo
  }
  return `${valorLimpo},00`
}

function formatarPreco(preco) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(preco)
}

function formatarData(dataIso) {
  // Aceita tanto "YYYY-MM-DD" (o que o <input type="date"> dá) quanto um
  // timestamptz completo (o que volta do banco, ex: produto.promocao_inicio)
  // — toLocaleDateString com timeZone 'UTC' lê os dois certo, sem o
  // problema de o produto mostrar um dia a menos/mais por fuso horário.
  return new Date(dataIso).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

// Promoção agora é uma flag explícita (promocao_ativa) + um range de datas
// (promocao_inicio / promocao_validade_fim), em vez de só inferir pela
// presença de uma data de validade (ver migration 004). A promoção só conta
// como "ativa" se a flag estiver ligada E a data de hoje estiver dentro do
// range (quando um dos dois lados do range existir).
function promocaoEstaAtiva(produto) {
  if (!produto.promocao_ativa) return false
  const agoraIso = new Date().toISOString()
  if (produto.promocao_inicio && produto.promocao_inicio > agoraIso) return false
  if (produto.promocao_validade_fim && produto.promocao_validade_fim < agoraIso) return false
  return true
}

function CadastroProdutos({ onNavigateToDashboard, onNavigateToPerfil, onSair }) {
  const [marketId, setMarketId] = useState(null)
  const [marketNome, setMarketNome] = useState('')
  const [produtos, setProdutos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  // Categorias já usadas (por qualquer mercado) para sugerir no campo
  // "Categoria" via <datalist> — não trava a digitação livre, só ajuda a
  // reaproveitar nomes já existentes em vez de criar variações do mesmo
  // termo (ex: "Bebida" vs "Bebidas").
  const [categoriasSugeridas, setCategoriasSugeridas] = useState([])

  // null = formulário fechado (só lista + botão "Novo produto").
  // 'novo' = formulário aberto para cadastrar.
  // um id de produto = formulário aberto editando aquele produto.
  const [modoFormulario, setModoFormulario] = useState(null)
  const [form, setForm] = useState(FORM_VAZIO)
  const [erroForm, setErroForm] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [saindo, setSaindo] = useState(false)

  const formularioAberto = modoFormulario !== null
  const editando = typeof modoFormulario === 'string' && modoFormulario !== 'novo'

  // Carrega os dados do mercado logado (nome + produtos) ao montar a tela.
  useEffect(() => {
    carregarDados()
  }, [])

  async function carregarDados() {
    setCarregando(true)
    setErro(null)

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
      .select('nome')
      .eq('id', idMercado)
      .maybeSingle()

    if (erroPerfil) {
      setErro('Não foi possível carregar os dados do seu mercado agora.')
      setCarregando(false)
      return
    }

    setMarketNome(perfilMercado?.nome ?? '')

    const { data: produtosExistentes, error: erroProdutos } = await supabase
      .from('products')
      .select('id, nome, categoria, marca, peso, preco, imagem_url, promocao_ativa, preco_promocional, promocao_inicio, promocao_validade_fim')
      .eq('market_id', idMercado)
      .order('created_at', { ascending: false })

    if (erroProdutos) {
      setErro('Não foi possível carregar seus produtos agora.')
      setCarregando(false)
      return
    }

    setProdutos(produtosExistentes ?? [])
    setCarregando(false)

    // Sugestões de categoria: busca as categorias já usadas em TODOS os
    // mercados (não só o logado), pra reaproveitar nomenclatura entre
    // parceiros diferentes. Falha silenciosa (fire-and-forget) — é só uma
    // conveniência de digitação, não deve travar a tela se der erro.
    supabase
      .from('products')
      .select('categoria')
      .then(({ data: categoriasData, error: erroCategorias }) => {
        if (erroCategorias) return
        const unicas = [...new Set((categoriasData ?? []).map((item) => item.categoria))].sort()
        setCategoriasSugeridas(unicas)
      })
  }

  function handleAbrirNovo() {
    setForm(FORM_VAZIO)
    setErroForm('')
    setModoFormulario('novo')
  }

  function handleAbrirEdicao(produto) {
    setForm({
      nome: produto.nome,
      categoria: produto.categoria,
      marca: produto.marca ?? '',
      peso: produto.peso ?? '',
      preco: String(produto.preco),
      imagem_url: produto.imagem_url ?? '',
      promocao_ativa: produto.promocao_ativa ?? false,
      preco_promocional: produto.preco_promocional != null ? String(produto.preco_promocional) : '',
      // <input type="date"> exige "YYYY-MM-DD"; o banco devolve um
      // timestamptz completo (ex: "2026-11-15T00:00:00+00:00") — os 10
      // primeiros caracteres já são a data que o input precisa.
      promocao_inicio: produto.promocao_inicio ? produto.promocao_inicio.slice(0, 10) : '',
      promocao_validade_fim: produto.promocao_validade_fim ? produto.promocao_validade_fim.slice(0, 10) : '',
    })
    setErroForm('')
    setModoFormulario(produto.id)
  }

  function handleFecharFormulario() {
    setModoFormulario(null)
    setForm(FORM_VAZIO)
    setErroForm('')
  }

  async function handleSalvarProduto(event) {
    event.preventDefault()

    const nome = form.nome.trim()
    const categoria = form.categoria.trim()
    const precoNumero = Number(form.preco.replace(',', '.'))

    if (!nome || !categoria || !form.preco) {
      setErroForm('Preencha nome, categoria e preço.')
      return
    }

    // Garante que um preço inválido (ex: "abc") nunca chega a ser enviado
    // ao banco como NaN.
    if (Number.isNaN(precoNumero) || precoNumero <= 0) {
      setErroForm('Digite um preço válido (ex: 9.90).')
      return
    }

    // Validação da promoção: só entra em jogo quando a flag está ligada —
    // os três campos (preço promocional, início, fim) são obrigatórios
    // juntos, porque uma promoção sem um deles não faz sentido (sem preço
    // não há desconto pra mostrar; sem range não sabemos quando ela vale).
    let precoPromocionalNumero = null
    if (form.promocao_ativa) {
      if (!form.preco_promocional || !form.promocao_inicio || !form.promocao_validade_fim) {
        setErroForm('Preencha preço promocional, início e fim da promoção, ou desligue a promoção.')
        return
      }

      precoPromocionalNumero = Number(form.preco_promocional.replace(',', '.'))
      if (Number.isNaN(precoPromocionalNumero) || precoPromocionalNumero <= 0) {
        setErroForm('Digite um preço promocional válido (ex: 9.90).')
        return
      }

      if (precoPromocionalNumero >= precoNumero) {
        setErroForm('O preço promocional precisa ser menor que o preço normal.')
        return
      }

      if (form.promocao_inicio > form.promocao_validade_fim) {
        setErroForm('A data de início da promoção não pode ser depois da data de fim.')
        return
      }
    }

    if (!marketId) {
      setErroForm('Não foi possível identificar seu mercado. Tente entrar novamente.')
      return
    }

    const dadosProduto = {
      nome,
      categoria,
      marca: form.marca.trim() || null,
      peso: form.peso.trim() || null,
      preco: precoNumero,
      imagem_url: form.imagem_url.trim(),
      promocao_ativa: form.promocao_ativa,
      preco_promocional: form.promocao_ativa ? precoPromocionalNumero : null,
      promocao_inicio: form.promocao_ativa ? form.promocao_inicio : null,
      promocao_validade_fim: form.promocao_ativa ? form.promocao_validade_fim : null,
    }

    setSalvando(true)
    setErroForm('')

    if (editando) {
      // modoFormulario guarda o id do produto sendo editado. A lista já foi
      // carregada filtrada por market_id, então só chegam aqui produtos do
      // próprio mercado logado — a RLS no Supabase também garante isso do
      // lado do banco, mesmo se algo tentasse forçar outro id.
      const { data, error } = await supabase
        .from('products')
        .update(dadosProduto)
        .eq('id', modoFormulario)
        .eq('market_id', marketId)
        .select('id, nome, categoria, marca, peso, preco, imagem_url, promocao_ativa, preco_promocional, promocao_inicio, promocao_validade_fim')
        .single()

      if (error || !data) {
        setErroForm('Não foi possível salvar as alterações agora. Tente novamente.')
        setSalvando(false)
        return
      }

      setProdutos((atual) => atual.map((produto) => (produto.id === data.id ? data : produto)))
    } else {
      const { data, error } = await supabase
        .from('products')
        .insert({ market_id: marketId, ...dadosProduto })
        .select('id, nome, categoria, marca, peso, preco, imagem_url, promocao_ativa, preco_promocional, promocao_inicio, promocao_validade_fim')
        .single()

      if (error || !data) {
        setErroForm('Não foi possível cadastrar o produto agora. Tente novamente.')
        setSalvando(false)
        return
      }

      setProdutos((atual) => [data, ...atual])
    }

    setSalvando(false)
    handleFecharFormulario()
  }

  async function handleRemover(produto) {
    // Confirmação nativa do navegador antes de apagar — decisão do CEO
    // (remoção direta era arriscada demais para um toque sem querer). Mesmo
    // padrão simples já usado em Explorar.jsx do consumidor.
    const confirmou = window.confirm(`Remover ${produto.nome}? Essa ação não pode ser desfeita.`)
    if (!confirmou) return

    setErro(null)

    // Atualiza a tela primeiro (otimista) e desfaz se a chamada falhar —
    // mesmo padrão já usado em src/pages/Lista.jsx.
    setProdutos((atual) => atual.filter((item) => item.id !== produto.id))

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', produto.id)
      .eq('market_id', marketId)

    if (error) {
      setErro('Não foi possível remover o produto agora.')
      setProdutos((atual) => [produto, ...atual])
    }
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
          <p>Carregando seus produtos...</p>
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
          <button type="button" className="mercado-tab mercado-tab-ativa" aria-current="page">
            Produtos
          </button>
          <button type="button" className="mercado-tab" onClick={onNavigateToDashboard}>
            Dashboard
          </button>
          <button type="button" className="mercado-tab" onClick={onNavigateToPerfil}>
            Perfil
          </button>
        </nav>
      </header>

      <main className="mercado-content">
        {erro && <p className="form-error">{erro}</p>}

        {!formularioAberto && (
          <>
            <div className="mercado-acoes">
              <h2 className="mercado-secao-titulo">Seus produtos</h2>
              <button
                type="button"
                className="btn-primary mercado-novo-botao"
                onClick={handleAbrirNovo}
                disabled={!marketId}
              >
                + Novo produto
              </button>
            </div>

            {produtos.length === 0 ? (
              <p className="mercado-vazio">Você ainda não cadastrou nenhum produto.</p>
            ) : (
              <ul className="mercado-lista-produtos">
                {produtos.map((produto) => {
                  const emPromocao = promocaoEstaAtiva(produto)

                  return (
                    <li key={produto.id} className="card-produto">
                      <div className="card-produto-imagem" aria-hidden="true">
                        {produto.imagem_url ? (
                          <img src={produto.imagem_url} alt="" />
                        ) : (
                          <span>Sem foto</span>
                        )}
                      </div>

                      <div className="card-produto-info">
                        <span className="card-produto-nome">{produto.nome}</span>
                        <span className="card-produto-categoria">
                          {produto.categoria}
                          {produto.marca && ` · ${produto.marca}`}
                          {produto.peso && ` · ${produto.peso}`}
                        </span>
                        <div className="card-produto-linha-preco">
                          {emPromocao ? (
                            <>
                              <span className="card-produto-preco card-produto-preco-riscado">
                                {formatarPreco(produto.preco)}
                              </span>
                              <span className="card-produto-preco card-produto-preco-promocional">
                                {formatarPreco(produto.preco_promocional)}
                              </span>
                              <span className="badge-promocao">
                                Até {formatarData(produto.promocao_validade_fim)}
                              </span>
                            </>
                          ) : (
                            <span className="card-produto-preco">{formatarPreco(produto.preco)}</span>
                          )}
                        </div>
                      </div>

                      <div className="card-produto-acoes">
                        <button
                          type="button"
                          className="card-produto-acao"
                          onClick={() => handleAbrirEdicao(produto)}
                          aria-label={`Editar ${produto.nome}`}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className="card-produto-acao card-produto-acao-remover"
                          onClick={() => handleRemover(produto)}
                          aria-label={`Remover ${produto.nome}`}
                        >
                          🗑
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}

        {formularioAberto && (
          <section className="mercado-form-secao">
            <h2 className="mercado-secao-titulo">{editando ? 'Editar produto' : 'Novo produto'}</h2>

            <form className="auth-form" onSubmit={handleSalvarProduto} noValidate>
              <div className="field">
                <label className="field-label" htmlFor="produto-nome">
                  Nome do produto
                </label>
                <input
                  id="produto-nome"
                  type="text"
                  className="field-input"
                  placeholder="ex: Arroz tipo 1 5kg"
                  value={form.nome}
                  onChange={(event) => setForm((atual) => ({ ...atual, nome: event.target.value }))}
                  required
                />
              </div>

              <div className="field">
                <label className="field-label" htmlFor="produto-categoria">
                  Categoria
                </label>
                <input
                  id="produto-categoria"
                  type="text"
                  className="field-input"
                  placeholder="ex: Alimentos, Bebidas, Limpeza"
                  value={form.categoria}
                  onChange={(event) => setForm((atual) => ({ ...atual, categoria: event.target.value }))}
                  // list + datalist: sugere categorias já usadas por
                  // qualquer mercado, sem travar a digitação livre (ver
                  // categoriasSugeridas, carregado junto com os produtos).
                  list="produto-categorias-sugeridas"
                  autoComplete="off"
                  required
                />
                <datalist id="produto-categorias-sugeridas">
                  {categoriasSugeridas.map((categoriaSugerida) => (
                    <option key={categoriaSugerida} value={categoriaSugerida} />
                  ))}
                </datalist>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="produto-marca">
                  Marca (opcional)
                </label>
                <input
                  id="produto-marca"
                  type="text"
                  className="field-input"
                  placeholder="ex: Camil"
                  value={form.marca}
                  onChange={(event) => setForm((atual) => ({ ...atual, marca: event.target.value }))}
                />
              </div>

              <div className="field">
                <label className="field-label" htmlFor="produto-peso">
                  Peso/quantidade (opcional)
                </label>
                <input
                  id="produto-peso"
                  type="text"
                  className="field-input"
                  placeholder="ex: 5kg, pacote 500g, caixa com 12 unidades"
                  value={form.peso}
                  onChange={(event) => setForm((atual) => ({ ...atual, peso: event.target.value }))}
                />
              </div>

              <div className="field">
                <label className="field-label" htmlFor="produto-preco">
                  Preço (R$)
                </label>
                <input
                  id="produto-preco"
                  type="text"
                  inputMode="decimal"
                  className="field-input"
                  placeholder="ex: 24,90"
                  value={form.preco}
                  onChange={(event) => setForm((atual) => ({ ...atual, preco: event.target.value }))}
                  onBlur={(event) =>
                    setForm((atual) => ({ ...atual, preco: completarCentavos(event.target.value) }))
                  }
                  required
                />
                <span className="field-hint">Digitou só o número inteiro? Completamos com ",00" sozinhos.</span>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="produto-imagem">
                  Link da imagem (opcional)
                </label>
                {/*
                  Decisão: campo de URL, não upload de arquivo.
                  - Upload real exige Supabase Storage configurado (bucket,
                    políticas de acesso, limite de tamanho, barra de
                    progresso, conversão/validação de formato) — trabalho de
                    backend considerável para o momento do MVP.
                  - Com URL, o lojista cola o link de uma foto que já tem no
                    celular (ex: enviada para si mesmo no WhatsApp Web, Google
                    Fotos compartilhado, etc.) e o app já funciona hoje.
                  - Fica marcado como "(opcional)" porque um produto sem foto
                    ainda deve aparecer normalmente na lista (ver
                    .card-produto-imagem com fallback "Sem foto").
                  TODO (desenvolvedor): se o piloto mostrar que lojistas têm
                  dificuldade em achar/colar um link de imagem, avaliar
                  upload real via Supabase Storage numa próxima etapa. */}
                <input
                  id="produto-imagem"
                  type="url"
                  className="field-input"
                  placeholder="ex: https://..."
                  value={form.imagem_url}
                  onChange={(event) => setForm((atual) => ({ ...atual, imagem_url: event.target.value }))}
                />
                <span className="field-hint">Cole o link de uma imagem do produto. Deixe em branco se não tiver.</span>
              </div>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.promocao_ativa}
                  onChange={(event) =>
                    setForm((atual) => ({ ...atual, promocao_ativa: event.target.checked }))
                  }
                />
                <span>Este produto está em promoção</span>
              </label>

              {form.promocao_ativa && (
                <>
                  <div className="field">
                    <label className="field-label" htmlFor="produto-preco-promocional">
                      Preço promocional (R$)
                    </label>
                    <input
                      id="produto-preco-promocional"
                      type="text"
                      inputMode="decimal"
                      className="field-input"
                      placeholder="ex: 19,90"
                      value={form.preco_promocional}
                      onChange={(event) =>
                        setForm((atual) => ({ ...atual, preco_promocional: event.target.value }))
                      }
                      onBlur={(event) =>
                        setForm((atual) => ({ ...atual, preco_promocional: completarCentavos(event.target.value) }))
                      }
                      required={form.promocao_ativa}
                    />
                    <span className="field-hint">Precisa ser menor que o preço normal, cadastrado acima.</span>
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="produto-promocao-inicio">
                      Promoção válida de
                    </label>
                    <input
                      id="produto-promocao-inicio"
                      type="date"
                      className="field-input"
                      value={form.promocao_inicio}
                      onChange={(event) =>
                        setForm((atual) => ({ ...atual, promocao_inicio: event.target.value }))
                      }
                      required={form.promocao_ativa}
                    />
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="produto-validade">
                      Até
                    </label>
                    <input
                      id="produto-validade"
                      type="date"
                      className="field-input"
                      value={form.promocao_validade_fim}
                      onChange={(event) =>
                        setForm((atual) => ({ ...atual, promocao_validade_fim: event.target.value }))
                      }
                      required={form.promocao_ativa}
                    />
                  </div>
                </>
              )}

              {erroForm && <span className="form-error">{erroForm}</span>}

              <div className="mercado-form-acoes">
                <button type="button" className="btn-secundario" onClick={handleFecharFormulario} disabled={salvando}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={salvando}>
                  {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Cadastrar produto'}
                </button>
              </div>
            </form>
          </section>
        )}
      </main>
    </div>
  )
}

export default CadastroProdutos
