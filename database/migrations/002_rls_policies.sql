-- ============================================================================
-- Calango Digital — Políticas de Row Level Security (RLS) (Supabase/Postgres)
-- ============================================================================
-- STATUS: PROPOSTA DE REVISÃO DE SEGURANÇA. Não aplicar em nenhum projeto
-- Supabase real até o CEO revisar e aprovar (via gerente-geral). Esta revisão
-- de RLS NÃO é aprovação de publicação — é só a análise de segurança do
-- schema proposto em 001_init.sql.
--
-- Objetivo: nenhuma tabela deve ficar acessível sem controle. Por padrão, o
-- Postgres libera leitura/escrita para qualquer usuário autenticado quando
-- RLS está desligado — isso abriria, por exemplo, o perfil de TODOS os
-- consumidores (nome, cidade, bairro) para qualquer pessoa logada no app.
-- Ativamos RLS em todas as tabelas e criamos uma política por operação
-- (select/insert/update/delete), em vez de uma política "para tudo", para
-- deixar claro e auditável o que cada papel pode fazer em cada tabela.
--
-- Papéis usados pelo Supabase Auth: "authenticated" (qualquer usuário
-- logado, seja consumidor ou mercado) e "anon" (não logado). Como o próprio
-- README confirma que o app exige login, não damos nenhum acesso a "anon".
--
-- Como diferenciamos consumidor de mercado: o id da linha em
-- consumer_profiles/market_profiles é o mesmo id do usuário autenticado
-- (auth.uid()). Então "auth.uid() = consumer_profiles.id" só é verdade para
-- o próprio consumidor, e "auth.uid() = market_profiles.id" só é verdade
-- para o próprio mercado. Não existe hoje um jeito de um usuário ser "os
-- dois" ao mesmo tempo — se isso mudar no futuro, estas políticas precisam
-- ser revisadas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. consumer_profiles — dado pessoal do consumidor
-- ----------------------------------------------------------------------------
-- Risco sem RLS: qualquer usuário logado (outro consumidor, ou um mercado)
-- conseguiria ler nome/cidade/bairro de todos os consumidores. Isso é dado
-- pessoal e não tem nenhuma razão de negócio para ser público.
alter table public.consumer_profiles enable row level security;

create policy consumer_profiles_select_own
    on public.consumer_profiles
    for select
    to authenticated
    using (auth.uid() = id);

create policy consumer_profiles_insert_own
    on public.consumer_profiles
    for insert
    to authenticated
    with check (auth.uid() = id);

create policy consumer_profiles_update_own
    on public.consumer_profiles
    for update
    to authenticated
    using (auth.uid() = id)
    with check (auth.uid() = id);

-- Sem política de delete: a exclusão do perfil deve acontecer junto com a
-- exclusão do usuário no auth.users (on delete cascade já cuida disso). Não
-- expomos um "delete" solto pela API para o próprio consumidor nesta fase.

-- ----------------------------------------------------------------------------
-- 2. market_profiles — dado do mercado parceiro
-- ----------------------------------------------------------------------------
-- Diferente do consumidor: nome, cidade, bairro, endereço e horário do
-- mercado são informações que o app PRECISA mostrar para qualquer consumidor
-- (tela "Explorar mercados" e "Mercado (detalhe)"). Por isso o select é
-- aberto para qualquer usuário autenticado (consumidor ou outro mercado),
-- mas insert/update/delete só para o próprio mercado — ninguém pode editar o
-- cadastro de um mercado concorrente.
alter table public.market_profiles enable row level security;

create policy market_profiles_select_all_authenticated
    on public.market_profiles
    for select
    to authenticated
    using (true);

create policy market_profiles_insert_own
    on public.market_profiles
    for insert
    to authenticated
    with check (auth.uid() = id);

create policy market_profiles_update_own
    on public.market_profiles
    for update
    to authenticated
    using (auth.uid() = id)
    with check (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- 3. products — produtos/promoções cadastrados pelo mercado
-- ----------------------------------------------------------------------------
-- Mesma lógica de market_profiles: produto/promoção é informação pública
-- dentro do app (precisa aparecer para consumidores em "Home", "Explorar
-- mercados" e "Mercado (detalhe)"), mas só o mercado dono pode cadastrar,
-- editar ou remover os seus próprios produtos. Um mercado NUNCA pode criar,
-- editar ou apagar produto de outro mercado.
alter table public.products enable row level security;

create policy products_select_all_authenticated
    on public.products
    for select
    to authenticated
    using (true);

create policy products_insert_own_market
    on public.products
    for insert
    to authenticated
    with check (auth.uid() = market_id);

create policy products_update_own_market
    on public.products
    for update
    to authenticated
    using (auth.uid() = market_id)
    with check (auth.uid() = market_id);

create policy products_delete_own_market
    on public.products
    for delete
    to authenticated
    using (auth.uid() = market_id);

-- ----------------------------------------------------------------------------
-- 4. shopping_lists — listas de compras do consumidor
-- ----------------------------------------------------------------------------
-- Dado pessoal do consumidor (o que ele pretende comprar). Nenhum outro
-- consumidor, e nenhum mercado, tem razão de negócio para ver isso. Só o
-- dono da lista pode ler/criar/editar/apagar.
alter table public.shopping_lists enable row level security;

create policy shopping_lists_select_own
    on public.shopping_lists
    for select
    to authenticated
    using (auth.uid() = consumer_id);

create policy shopping_lists_insert_own
    on public.shopping_lists
    for insert
    to authenticated
    with check (auth.uid() = consumer_id);

create policy shopping_lists_update_own
    on public.shopping_lists
    for update
    to authenticated
    using (auth.uid() = consumer_id)
    with check (auth.uid() = consumer_id);

create policy shopping_lists_delete_own
    on public.shopping_lists
    for delete
    to authenticated
    using (auth.uid() = consumer_id);

-- ----------------------------------------------------------------------------
-- 5. shopping_list_items — itens de uma lista de compras
-- ----------------------------------------------------------------------------
-- Não tem coluna consumer_id direta, então a checagem é feita "subindo" até
-- shopping_lists e confirmando que o dono da lista é o usuário autenticado.
-- Isso garante que um consumidor não possa ler nem alterar item de lista de
-- outro consumidor, mesmo sabendo o id do item.
alter table public.shopping_list_items enable row level security;

create policy shopping_list_items_select_own
    on public.shopping_list_items
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.shopping_lists sl
            where sl.id = shopping_list_items.list_id
              and sl.consumer_id = auth.uid()
        )
    );

create policy shopping_list_items_insert_own
    on public.shopping_list_items
    for insert
    to authenticated
    with check (
        exists (
            select 1
            from public.shopping_lists sl
            where sl.id = shopping_list_items.list_id
              and sl.consumer_id = auth.uid()
        )
    );

create policy shopping_list_items_update_own
    on public.shopping_list_items
    for update
    to authenticated
    using (
        exists (
            select 1
            from public.shopping_lists sl
            where sl.id = shopping_list_items.list_id
              and sl.consumer_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1
            from public.shopping_lists sl
            where sl.id = shopping_list_items.list_id
              and sl.consumer_id = auth.uid()
        )
    );

create policy shopping_list_items_delete_own
    on public.shopping_list_items
    for delete
    to authenticated
    using (
        exists (
            select 1
            from public.shopping_lists sl
            where sl.id = shopping_list_items.list_id
              and sl.consumer_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- 6. favorite_markets — mercados favoritos do consumidor
-- ----------------------------------------------------------------------------
-- Dado pessoal do consumidor. Nesta fase do MVP não existe métrica de
-- "quantos favoritaram" no dashboard do mercado (README só cita
-- visualizações, produtos buscados e cliques em rota), então o mercado não
-- recebe nenhum acesso a esta tabela. Só o próprio consumidor lê/gerencia os
-- seus favoritos.
alter table public.favorite_markets enable row level security;

create policy favorite_markets_select_own
    on public.favorite_markets
    for select
    to authenticated
    using (auth.uid() = consumer_id);

create policy favorite_markets_insert_own
    on public.favorite_markets
    for insert
    to authenticated
    with check (auth.uid() = consumer_id);

create policy favorite_markets_delete_own
    on public.favorite_markets
    for delete
    to authenticated
    using (auth.uid() = consumer_id);

-- ----------------------------------------------------------------------------
-- 7. market_views — métrica: visualização do mercado
-- ----------------------------------------------------------------------------
-- Regra pedida: consumidor só insere (não lê); o mercado dono só lê (não
-- precisa inserir nem editar/apagar métrica manualmente). O insert exige que
-- consumer_id seja sempre o próprio usuário autenticado (nunca null e nunca
-- o id de outro consumidor) — isso impede que alguém registre uma
-- visualização "em nome" de outra pessoa, o que poderia forjar as métricas
-- do dashboard do mercado.
alter table public.market_views enable row level security;

create policy market_views_insert_own_consumer
    on public.market_views
    for insert
    to authenticated
    with check (auth.uid() = consumer_id);

create policy market_views_select_own_market
    on public.market_views
    for select
    to authenticated
    using (auth.uid() = market_id);

-- ----------------------------------------------------------------------------
-- 8. market_route_clicks — métrica: clique em "rota até o mercado"
-- ----------------------------------------------------------------------------
-- Mesma regra da tabela anterior.
alter table public.market_route_clicks enable row level security;

create policy market_route_clicks_insert_own_consumer
    on public.market_route_clicks
    for insert
    to authenticated
    with check (auth.uid() = consumer_id);

create policy market_route_clicks_select_own_market
    on public.market_route_clicks
    for select
    to authenticated
    using (auth.uid() = market_id);

-- ----------------------------------------------------------------------------
-- 9. product_searches — métrica: busca de produto feita pelo consumidor
-- ----------------------------------------------------------------------------
-- Não tem coluna market_id direta (só product_id, que pode ser null quando a
-- busca não bateu com nenhum produto). O mercado só pode ler as buscas que
-- encontraram um dos SEUS produtos — a checagem "sobe" até products e
-- confirma o dono. Buscas sem produto encontrado (product_id null) não
-- aparecem para nenhum mercado, porque não têm dono a confirmar; isso é
-- esperado e não é uma brecha, só significa que esse dado ainda não
-- alimenta o dashboard de nenhum mercado específico.
alter table public.product_searches enable row level security;

create policy product_searches_insert_own_consumer
    on public.product_searches
    for insert
    to authenticated
    with check (auth.uid() = consumer_id);

create policy product_searches_select_own_market
    on public.product_searches
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.products p
            where p.id = product_searches.product_id
              and p.market_id = auth.uid()
        )
    );

-- ============================================================================
-- Observações para quem for aplicar isto depois (CEO / desenvolvedor):
--
-- 1. Estas políticas pressupõem que o id em consumer_profiles e em
--    market_profiles é SEMPRE igual ao auth.uid() de quem está logado (é
--    assim que o 001_init.sql foi desenhado). Se amanhã existir um usuário
--    "admin" interno acessando via chave de serviço (service_role), essas
--    políticas de RLS não valem para ele — a service_role sempre ignora RLS
--    por padrão no Supabase. Isso é esperado para uso administrativo/
--    backend, mas a chave service_role NUNCA deve ser usada no app
--    cliente (React), só em backend de confiança, se um dia existir.
--
-- 2. O select de market_profiles e products está liberado para qualquer
--    usuário autenticado (consumidor OU mercado), porque é informação
--    pública dentro do app (vitrine de mercados/promoções). Isso é
--    intencional, não uma brecha — mas se no futuro produtos passarem a
--    guardar algo sensível (ex: custo interno do mercado), essa política
--    precisa ser revista.
-- ============================================================================
