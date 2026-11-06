-- ============================================================================
-- Calango Digital — Schema inicial do MVP (Supabase/Postgres)
-- ============================================================================
-- STATUS: PROPOSTA. Não aplicar em nenhum projeto Supabase real até o CEO
-- revisar e aprovar.
--
-- Escopo: apenas o que o README.md da raiz descreve para o MVP (consumidor,
-- mercado parceiro, produtos/promoções, listas de compras, métricas simples
-- de dashboard, favoritos). Nada de ERP, financeiro, estoque, PDV, fiscal,
-- fornecedores, contabilidade ou IA.
--
-- Autenticação: usamos o schema auth.users que o Supabase Auth já mantém
-- (email, senha/hash, login social Google/Apple, etc). As tabelas abaixo
-- guardam só os dados de perfil que o app precisa além do que o Auth guarda,
-- e se ligam ao usuário pelo mesmo id (auth.users.id), nunca duplicando
-- e-mail/senha.
-- ============================================================================

-- Extensão usada para gerar UUIDs (gen_random_uuid). No Supabase geralmente já
-- vem habilitada, mas garantimos aqui.
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Perfil do consumidor
-- ----------------------------------------------------------------------------
-- Um registro por consumidor que criou conta. O id é o mesmo do auth.users
-- (relação 1 para 1): quando o usuário se cadastra pelo Supabase Auth, o app
-- cria a linha correspondente aqui com os dados extras do cadastro.
create table if not exists public.consumer_profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    nome text not null,
    cidade text not null,
    bairro text not null,
    aceite_localizacao boolean not null default false,
    aceite_privacidade boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.consumer_profiles is
    'Dados de perfil do consumidor, além do que o Supabase Auth já guarda (email/senha/login social).';

-- ----------------------------------------------------------------------------
-- 2. Perfil do mercado parceiro
-- ----------------------------------------------------------------------------
-- Também ligado 1 para 1 a um usuário de login do Supabase Auth (o "login
-- simples" do painel do mercado citado no README).
create table if not exists public.market_profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    nome text not null,
    cidade text not null,
    bairro text not null,
    endereco text not null,
    latitude double precision,
    longitude double precision,
    horario_funcionamento text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.market_profiles is
    'Dados de perfil do mercado parceiro: quem é, onde fica e quando abre.';

-- ----------------------------------------------------------------------------
-- 3. Produtos / promoções do mercado
-- ----------------------------------------------------------------------------
-- Cada linha é um produto cadastrado pelo mercado no painel. O campo
-- promocao_validade_fim é opcional: se estiver vazio, é um produto comum
-- (sem promoção ativa); se tiver uma data, é a promoção daquele produto até
-- aquela data.
create table if not exists public.products (
    id uuid primary key default gen_random_uuid(),
    market_id uuid not null references public.market_profiles (id) on delete cascade,
    nome text not null,
    categoria text not null,
    preco numeric(10, 2) not null check (preco >= 0),
    imagem_url text,
    promocao_validade_fim timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.products is
    'Produtos cadastrados pelo mercado no painel; promocao_validade_fim marca até quando o preço vale como promoção.';

create index if not exists products_market_id_idx on public.products (market_id);

-- ----------------------------------------------------------------------------
-- 4. Listas de compras do consumidor
-- ----------------------------------------------------------------------------
create table if not exists public.shopping_lists (
    id uuid primary key default gen_random_uuid(),
    consumer_id uuid not null references public.consumer_profiles (id) on delete cascade,
    nome text not null default 'Minha lista',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.shopping_lists is
    'Lista de compras do consumidor. No MVP cada consumidor tende a ter uma lista ativa, mas a tabela permite mais de uma.';

create index if not exists shopping_lists_consumer_id_idx on public.shopping_lists (consumer_id);

-- ----------------------------------------------------------------------------
-- 5. Itens da lista de compras
-- ----------------------------------------------------------------------------
-- Item em texto livre digitado pelo consumidor (sem IA de sugestão no MVP).
create table if not exists public.shopping_list_items (
    id uuid primary key default gen_random_uuid(),
    list_id uuid not null references public.shopping_lists (id) on delete cascade,
    nome_item text not null,
    comprado boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.shopping_list_items is
    'Itens de uma lista de compras, com status comprado/pendente.';

create index if not exists shopping_list_items_list_id_idx on public.shopping_list_items (list_id);

-- ----------------------------------------------------------------------------
-- 6. Mercados favoritos do consumidor
-- ----------------------------------------------------------------------------
create table if not exists public.favorite_markets (
    consumer_id uuid not null references public.consumer_profiles (id) on delete cascade,
    market_id uuid not null references public.market_profiles (id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (consumer_id, market_id)
);

comment on table public.favorite_markets is
    'Relação de mercados que o consumidor marcou como favorito (tela de Perfil).';

-- ----------------------------------------------------------------------------
-- 7. Métrica simples: visualizações do mercado
-- ----------------------------------------------------------------------------
-- Uma linha por visualização da tela de detalhe do mercado. consumer_id é
-- opcional porque a visualização pode acontecer sem login completo (ex:
-- navegação anônima), mas no MVP o app exige login, então normalmente virá
-- preenchido.
create table if not exists public.market_views (
    id uuid primary key default gen_random_uuid(),
    market_id uuid not null references public.market_profiles (id) on delete cascade,
    consumer_id uuid references public.consumer_profiles (id) on delete set null,
    created_at timestamptz not null default now()
);

comment on table public.market_views is
    'Um registro por vez que um consumidor abriu a tela de detalhe de um mercado. Usado só para contar (dashboard do mercado).';

create index if not exists market_views_market_id_idx on public.market_views (market_id);

-- ----------------------------------------------------------------------------
-- 8. Métrica simples: cliques em "rota até o mercado"
-- ----------------------------------------------------------------------------
create table if not exists public.market_route_clicks (
    id uuid primary key default gen_random_uuid(),
    market_id uuid not null references public.market_profiles (id) on delete cascade,
    consumer_id uuid references public.consumer_profiles (id) on delete set null,
    created_at timestamptz not null default now()
);

comment on table public.market_route_clicks is
    'Um registro por vez que um consumidor clicou no botão de rota até o mercado. Usado só para contar (dashboard do mercado).';

create index if not exists market_route_clicks_market_id_idx on public.market_route_clicks (market_id);

-- ----------------------------------------------------------------------------
-- 9. Métrica simples: buscas de produto feitas pelo consumidor
-- ----------------------------------------------------------------------------
-- Uma linha por busca de produto feita no app. Guardamos o termo digitado
-- (busca é texto livre) e, quando a busca encontrou um produto específico,
-- também o id desse produto — assim o dashboard consegue contar tanto por
-- termo buscado quanto por produto efetivamente encontrado. product_id fica
-- opcional porque uma busca pode não bater com nenhum produto cadastrado.
create table if not exists public.product_searches (
    id uuid primary key default gen_random_uuid(),
    consumer_id uuid references public.consumer_profiles (id) on delete set null,
    termo_busca text not null,
    product_id uuid references public.products (id) on delete set null,
    created_at timestamptz not null default now()
);

comment on table public.product_searches is
    'Um registro por busca de produto feita por um consumidor no app. Usado só para contar "produtos mais buscados" no dashboard do mercado.';

create index if not exists product_searches_product_id_idx on public.product_searches (product_id);
create index if not exists product_searches_consumer_id_idx on public.product_searches (consumer_id);
