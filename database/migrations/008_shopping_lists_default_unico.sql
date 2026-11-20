-- ============================================================================
-- Calango Digital — Corrige a lista "Minha lista" duplicada (condição de corrida)
-- ============================================================================
-- STATUS: PROPOSTA. Não aplicar em nenhum projeto Supabase real até o CEO
-- revisar e aprovar (mesmo processo das migrations anteriores).
--
-- Bug encontrado em teste ao vivo: Home.jsx e Lista.jsx cada um tem sua
-- própria lógica de "se o consumidor ainda não tem nenhuma lista, cria a
-- 'Minha lista' padrão" (pra nenhuma das duas telas ficar sem lista
-- nenhuma no primeiro uso). Se a pessoa entra e navega rápido da Home pra
-- Lista, a chamada assíncrona de criação da Home.jsx ainda está em
-- andamento quando a de Lista.jsx roda — as duas checam "não existe lista
-- ainda" ao mesmo tempo e as duas criam, resultando em duas "Minha lista"
-- vazias para o mesmo consumidor.
--
-- Fix: marca qual lista é a "padrão" de cada consumidor (is_default) e usa
-- uma constraint única no banco (não só uma checagem no código, que é
-- exatamente o que já existia e falhou) pra garantir só uma por
-- consumidor, não importa quantas telas tentem criar ao mesmo tempo. Cada
-- tela tenta o INSERT com is_default = true; se perder a corrida, o banco
-- rejeita com "unique violation" (código 23505) e o código trata isso como
-- sucesso (já existe uma lista padrão agora, que é exatamente o objetivo),
-- em vez de mostrar erro pro usuário.
--
-- Backfill: marca a lista mais ANTIGA de cada consumidor como padrão (não
-- apaga nenhuma lista duplicada que já exista — ex: contas de teste que já
-- têm duas "Minha lista" continuam com as duas, só uma vira "a padrão";
-- a outra continua acessível normalmente pelo seletor de listas).
-- ============================================================================

alter table public.shopping_lists
    add column if not exists is_default boolean not null default false;

update public.shopping_lists sl
set is_default = true
where id = (
    select id
    from public.shopping_lists sl2
    where sl2.consumer_id = sl.consumer_id
    order by created_at asc
    limit 1
)
and not exists (
    select 1
    from public.shopping_lists sl3
    where sl3.consumer_id = sl.consumer_id
      and sl3.is_default = true
);

create unique index if not exists shopping_lists_um_padrao_por_consumidor
    on public.shopping_lists (consumer_id)
    where is_default = true;

comment on column public.shopping_lists.is_default is
    'true = esta é a lista "Minha lista" criada automaticamente no primeiro uso. Só pode haver uma por consumidor (ver índice único shopping_lists_um_padrao_por_consumidor) — é isso que evita a duplicação em condição de corrida entre Home.jsx e Lista.jsx.';
