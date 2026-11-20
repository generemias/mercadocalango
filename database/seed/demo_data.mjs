// ============================================================================
// Calango Digital — Seed de dados de demonstração
// ============================================================================
// STATUS: PROPOSTA. Revisar antes de rodar contra o projeto Supabase real.
//
// Pedido do CEO: popular o banco com mais mercados parceiros e produtos
// variados (categorias diferentes, preços diferentes, algumas promoções
// perto do fim ou já vencidas) para dar pra ver a Home/Explorar/Mercado
// (detalhe) funcionando com "muita informação", além dos dados de teste
// que já existem.
//
// Por que um script Node em vez de um SQL puro (como as migrations em
// database/migrations/): criar um mercado exige uma conta de verdade no
// Supabase Auth (market_profiles.id referencia auth.users.id — ver
// 001_init.sql), e isso não dá pra fazer com um INSERT comum em SQL. Este
// script usa o client admin do supabase-js (supabase.auth.admin.createUser),
// que só funciona com a service_role key — por isso ele PRECISA rodar na
// sua máquina (nunca aqui na conversa com o Claude), com a service_role key
// como variável de ambiente, nunca colada no código nem compartilhada.
//
// IMPORTANTE — nomes de demonstração: todo mercado e produto aqui usa o
// prefixo "Demo" (ex: "Mercado Demo Centro") de propósito, para ficar claro
// depois que é dado fictício de teste, não um parceiro real nem uma
// promessa comercial.
//
// Como rodar (no terminal, dentro da pasta do projeto):
//   1. Pegue a service_role key em Supabase > Project Settings > API
//      (NUNCA a mesma coisa que VITE_SUPABASE_ANON_KEY — é uma chave com
//      acesso total, só usar localmente, nunca no app nem no git).
//   2. No PowerShell:
//        $env:SUPABASE_URL = "https://SEU-PROJETO.supabase.co"
//        $env:SUPABASE_SERVICE_ROLE_KEY = "a_chave_aqui"
//        node database/seed/demo_data.mjs
//   3. O script imprime o que criou/pulou. Rodar de novo é seguro (não
//      duplica mercados — ver verificarOuCriarMercado) e sempre insere os
//      produtos de novo só se o mercado acabou de ser criado agora.
//
// Senha de todas as contas demo (só para você entrar e inspecionar/editar
// pelo painel do mercado se quiser): ver SENHA_DEMO abaixo.
// ============================================================================

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SENHA_DEMO = 'DemoCalango2026!'

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'Faltam as variáveis de ambiente SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY. Veja as instruções no topo deste arquivo.',
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ----------------------------------------------------------------------------
// Dados dos mercados demo — bairros diferentes, pra Explorar/filtros terem o
// que mostrar. Coordenadas espalhadas pela região de Campo Grande/MS (mesma
// cidade do mercado de teste real já existente), mas deslocadas pra não
// empilhar em cima dele no mapa.
// ----------------------------------------------------------------------------
const MERCADOS = [
  {
    email: 'demo.mercado.centro@calango.test',
    nome: 'Mercado Demo Centro',
    cidade: 'Campo Grande',
    bairro: 'Centro',
    endereco: 'Rua 14 de Julho, 1200',
    latitude: -20.4625,
    longitude: -54.6158,
    horario_funcionamento: 'Seg a Sáb, 07h às 21h',
  },
  {
    email: 'demo.mercado.vilanova@calango.test',
    nome: 'Mercado Demo Vila Nova',
    cidade: 'Campo Grande',
    bairro: 'Vila Nova',
    endereco: 'Av. Mato Grosso, 850',
    latitude: -20.48,
    longitude: -54.6,
    horario_funcionamento: 'Todos os dias, 08h às 22h',
  },
  {
    email: 'demo.mercado.jardimestados@calango.test',
    nome: 'Mercado Demo Jardim dos Estados',
    cidade: 'Campo Grande',
    bairro: 'Jardim dos Estados',
    endereco: 'Av. Afonso Pena, 3400',
    latitude: -20.46,
    longitude: -54.59,
    horario_funcionamento: 'Seg a Dom, 07h às 23h',
  },
  {
    email: 'demo.mercado.montecastelo@calango.test',
    nome: 'Mercado Demo Monte Castelo',
    cidade: 'Campo Grande',
    bairro: 'Monte Castelo',
    endereco: 'Rua Marquês de Pombal, 540',
    latitude: -20.44,
    longitude: -54.62,
    horario_funcionamento: 'Seg a Sáb, 06h30 às 20h',
  },
  {
    email: 'demo.mercado.amambai@calango.test',
    nome: 'Mercado Demo Amambaí',
    cidade: 'Campo Grande',
    bairro: 'Amambaí',
    endereco: 'Rua Barão do Rio Branco, 2100',
    latitude: -20.49,
    longitude: -54.63,
    horario_funcionamento: 'Seg a Sáb, 07h às 20h',
  },
]

// ----------------------------------------------------------------------------
// Datas relativas a hoje, pra cobrir os casos que o CEO pediu: promoção
// ativa de verdade, promoção acabando logo, lote vencido e lote vencendo
// em breve. Calculadas em vez de fixas, pra continuarem fazendo sentido não
// importa quando este script rodar.
// ----------------------------------------------------------------------------
function dataIsoComOffset(diasOffset) {
  const data = new Date()
  data.setDate(data.getDate() + diasOffset)
  return data.toISOString().slice(0, 10)
}

const HOJE = dataIsoComOffset(0)
const ONTEM = dataIsoComOffset(-1)
const EM_2_DIAS = dataIsoComOffset(2)
const EM_10_DIAS = dataIsoComOffset(10)
const HA_5_DIAS = dataIsoComOffset(-5)
const HA_15_DIAS = dataIsoComOffset(-15)

// ----------------------------------------------------------------------------
// Produtos demo por mercado — categorias variadas (Alimentos, Bebidas,
// Limpeza, Higiene, Hortifruti, Padaria, Carnes, Laticínios, Congelados),
// preços variados, e os casos de promoção/validade de lote que o CEO pediu
// pra testar os filtros:
// - produto comum (sem promoção)
// - promoção ativa agora (dentro do range de datas)
// - promoção acabando em 2 dias (pra ver o selo de "até" próximo do fim)
// - promoção com a flag desligada mas datas antigas (não deve aparecer
//   como em promoção — testa que a flag manda mais que as datas)
// - validade de lote já vencida e vencendo em breve (só aparece pro
//   próprio mercado, nunca pro cliente — ver migration 005)
// ----------------------------------------------------------------------------
function produtosParaMercado(nomeMercado) {
  return [
    {
      nome: 'Arroz branco tipo 1',
      categoria: 'Alimentos',
      marca: 'Demo Grãos',
      peso: '5kg',
      preco: 26.9,
      promocao_ativa: false,
    },
    {
      nome: 'Refrigerante cola 2L',
      categoria: 'Bebidas',
      marca: 'Demo Cola',
      peso: '2L',
      preco: 9.5,
      promocao_ativa: true,
      preco_promocional: 6.99,
      promocao_inicio: HA_5_DIAS,
      promocao_validade_fim: EM_10_DIAS,
    },
    {
      nome: 'Detergente neutro',
      categoria: 'Limpeza',
      marca: 'Demo Limp',
      peso: '500ml',
      preco: 3.2,
      promocao_ativa: true,
      preco_promocional: 2.49,
      promocao_inicio: ONTEM,
      promocao_validade_fim: EM_2_DIAS,
    },
    {
      nome: 'Sabonete em barra',
      categoria: 'Higiene',
      marca: 'Demo Suave',
      peso: '90g',
      preco: 2.8,
      // Promoção "desligada" (flag false) mesmo com datas antigas
      // preenchidas — testa que não aparece como em promoção.
      promocao_ativa: false,
      preco_promocional: 1.99,
      promocao_inicio: HA_15_DIAS,
      promocao_validade_fim: HA_5_DIAS,
    },
    {
      nome: 'Tomate',
      categoria: 'Hortifruti',
      peso: 'kg',
      preco: 7.9,
      promocao_ativa: false,
      validade_lote: ONTEM, // já vencido — só aparece pro mercado
    },
    {
      nome: 'Pão francês',
      categoria: 'Padaria',
      peso: 'kg',
      preco: 14.0,
      promocao_ativa: false,
      validade_lote: EM_2_DIAS, // vencendo em breve — só aparece pro mercado
    },
    {
      nome: 'Peito de frango',
      categoria: 'Carnes',
      marca: 'Demo Granja',
      peso: 'kg',
      preco: 16.5,
      promocao_ativa: false,
    },
    {
      nome: 'Leite integral',
      categoria: 'Laticínios',
      marca: 'Demo Vaca Feliz',
      peso: '1L',
      preco: 5.3,
      promocao_ativa: true,
      preco_promocional: 4.49,
      promocao_inicio: HOJE,
      promocao_validade_fim: EM_10_DIAS,
    },
    {
      nome: 'Pizza congelada',
      categoria: 'Congelados',
      marca: 'Demo Forno',
      peso: '460g',
      preco: 18.9,
      promocao_ativa: false,
    },
  ].map((produto) => ({
    ...produto,
    // Pequena variação de preço entre mercados pro mesmo tipo de produto
    // não ficar idêntico em todo lugar (ajuda a notar visualmente que os
    // dados vieram de mercados diferentes).
    preco: Number((produto.preco * (0.9 + (nomeMercado.length % 5) * 0.04)).toFixed(2)),
  }))
}

async function verificarOuCriarMercado(definicaoMercado) {
  // Idempotente: se já existe uma conta com este e-mail, não cria de novo
  // (evita duplicar mercados demo se o script rodar mais de uma vez).
  const { data: usuariosExistentes, error: erroListagem } = await supabase.auth.admin.listUsers()
  if (erroListagem) {
    throw new Error(`Não foi possível listar usuários: ${erroListagem.message}`)
  }

  const usuarioExistente = usuariosExistentes.users.find((usuario) => usuario.email === definicaoMercado.email)
  if (usuarioExistente) {
    console.log(`  Já existe: ${definicaoMercado.nome} (${definicaoMercado.email}) — pulando criação.`)
    return { id: usuarioExistente.id, jaExistia: true }
  }

  const { data: criado, error: erroCriar } = await supabase.auth.admin.createUser({
    email: definicaoMercado.email,
    password: SENHA_DEMO,
    email_confirm: true,
  })

  if (erroCriar || !criado?.user) {
    throw new Error(`Falha ao criar usuário para ${definicaoMercado.nome}: ${erroCriar?.message}`)
  }

  const { error: erroPerfil } = await supabase.from('market_profiles').insert({
    id: criado.user.id,
    nome: definicaoMercado.nome,
    cidade: definicaoMercado.cidade,
    bairro: definicaoMercado.bairro,
    endereco: definicaoMercado.endereco,
    latitude: definicaoMercado.latitude,
    longitude: definicaoMercado.longitude,
    horario_funcionamento: definicaoMercado.horario_funcionamento,
  })

  if (erroPerfil) {
    throw new Error(`Falha ao criar market_profiles para ${definicaoMercado.nome}: ${erroPerfil.message}`)
  }

  console.log(`  Criado: ${definicaoMercado.nome} (${definicaoMercado.email})`)
  return { id: criado.user.id, jaExistia: false }
}

async function main() {
  console.log(`Rodando seed de demonstração contra: ${SUPABASE_URL}\n`)

  for (const definicaoMercado of MERCADOS) {
    const { id: marketId, jaExistia } = await verificarOuCriarMercado(definicaoMercado)

    // Só insere produtos na primeira vez que o mercado é criado — rodar o
    // script de novo não duplica os produtos de um mercado que já existia.
    if (jaExistia) continue

    const produtos = produtosParaMercado(definicaoMercado.nome).map((produto) => ({
      ...produto,
      market_id: marketId,
    }))

    const { error: erroProdutos } = await supabase.from('products').insert(produtos)
    if (erroProdutos) {
      throw new Error(`Falha ao criar produtos para ${definicaoMercado.nome}: ${erroProdutos.message}`)
    }
    console.log(`    + ${produtos.length} produtos demo cadastrados.`)
  }

  console.log(`\nPronto! Senha de todas as contas demo: ${SENHA_DEMO}`)
}

main().catch((error) => {
  console.error('\nErro ao rodar o seed:', error.message)
  process.exit(1)
})
