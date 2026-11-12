-- ============================================================================
-- Calango Digital — Lista de compras em conjunto (compartilhada por código)
-- ============================================================================
-- STATUS: PROPOSTA. Não aplicar em nenhum projeto Supabase real até o CEO
-- revisar e aprovar (mesmo processo das migrations anteriores).
--
-- Pedido do CEO: deixar várias pessoas usarem a mesma lista de compras.
-- Decisões confirmadas com o CEO:
-- 1. Convite por código/link simples (não precisa saber e-mail de ninguém
--    pra convidar) — a pessoa que já tem a lista gera um código, compartilha
--    por fora do app (WhatsApp etc.), e quem recebe cola o código no app.
-- 2. Quem entra numa lista compartilhada pode fazer TUDO que o dono faz nos
--    itens (adicionar, marcar como comprado, remover) — sem hierarquia
--    dono/convidado dentro da lista.
--
-- Design:
-- - shopping_lists ganha `convite_codigo` (texto curto, único, gerado pelo
--   app só quando o dono pede para compartilhar — não vem preenchido por
--   padrão, pra não gastar códigos em listas que nunca são compartilhadas).
-- - Tabela nova shopping_list_members: quem (além do dono) tem acesso a
--   qual lista. O dono continua sendo shopping_lists.consumer_id (não vira
--   uma linha de member) — a tabela só guarda os convidados extras.
-- - Entrar numa lista pelo código NÃO é um INSERT direto (exigiria expor o
--   código de todas as listas via SELECT pra qualquer usuário autenticado
--   conseguir validar o que digitou, o que vaza códigos de listas de
--   terceiros). Em vez disso, uma função `entrar_lista_compartilhada(codigo)`
--   roda com privilégio elevado (security definer) só para achar a lista
--   pelo código e inserir o próprio usuário como membro — sem nunca expor
--   a lista de códigos existentes.
-- ============================================================================

alter table public.shopping_lists
    add column if not exists convite_codigo text unique;

comment on column public.shopping_lists.convite_codigo is
    'Código curto gerado pelo app quando o dono pede para compartilhar a lista. Nulo até isso acontecer.';

create table if not exists public.shopping_list_members (
    list_id uuid not null references public.shopping_lists (id) on delete cascade,
    consumer_id uuid not null references public.consumer_profiles (id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (list_id, consumer_id)
);

comment on table public.shopping_list_members is
    'Consumidores (além do dono, em shopping_lists.consumer_id) com acesso a uma lista de compras compartilhada.';

alter table public.shopping_list_members enable row level security;

-- Cada um só vê a própria linha de participação (não a lista completa de
-- quem mais está na lista). DECISÃO IMPORTANTE: NÃO consultar
-- shopping_lists aqui, mesmo que pareça fazer sentido deixar o dono ver
-- todos os membros — isso criaria uma referência circular entre as
-- policies de shopping_lists e shopping_list_members (a de shopping_lists
-- consulta shopping_list_members, e se esta consultasse shopping_lists de
-- volta, o Postgres entra em "infinite recursion detected in policy" ao
-- tentar resolver as duas policies uma dependendo da outra). Se no futuro
-- for preciso o dono ver todos os membros, isso deve vir de uma função
-- security definer (que roda sem RLS por dentro), não de uma policy direta.
create policy shopping_list_members_select_own
    on public.shopping_list_members
    for select
    to authenticated
    using (consumer_id = auth.uid());

-- Nenhuma policy de insert/update/delete direta: entrar numa lista
-- compartilhada só acontece pela função abaixo (security definer), nunca
-- por um INSERT direto do cliente — ver comentário no topo do arquivo.

-- shopping_lists: select agora também libera quem é membro (convidado),
-- não só o dono. Insert/update/delete continuam só para o dono (ver
-- policies já existentes em 002_rls_policies.sql, que não mudam).
drop policy if exists shopping_lists_select_own on public.shopping_lists;
create policy shopping_lists_select_own_or_member
    on public.shopping_lists
    for select
    to authenticated
    using (
        auth.uid() = consumer_id
        or id in (select list_id from public.shopping_list_members where consumer_id = auth.uid())
    );

-- shopping_list_items: select/insert/update/delete agora valem tanto para o
-- dono da lista quanto para os membros convidados (permissão "tudo", igual
-- ao dono, conforme decisão do CEO).
drop policy if exists shopping_list_items_select_own on public.shopping_list_items;
drop policy if exists shopping_list_items_insert_own on public.shopping_list_items;
drop policy if exists shopping_list_items_update_own on public.shopping_list_items;
drop policy if exists shopping_list_items_delete_own on public.shopping_list_items;

create policy shopping_list_items_select_own_or_member
    on public.shopping_list_items
    for select
    to authenticated
    using (
        list_id in (
            select id from public.shopping_lists where consumer_id = auth.uid()
            union
            select list_id from public.shopping_list_members where consumer_id = auth.uid()
        )
    );

create policy shopping_list_items_insert_own_or_member
    on public.shopping_list_items
    for insert
    to authenticated
    with check (
        list_id in (
            select id from public.shopping_lists where consumer_id = auth.uid()
            union
            select list_id from public.shopping_list_members where consumer_id = auth.uid()
        )
    );

create policy shopping_list_items_update_own_or_member
    on public.shopping_list_items
    for update
    to authenticated
    using (
        list_id in (
            select id from public.shopping_lists where consumer_id = auth.uid()
            union
            select list_id from public.shopping_list_members where consumer_id = auth.uid()
        )
    )
    with check (
        list_id in (
            select id from public.shopping_lists where consumer_id = auth.uid()
            union
            select list_id from public.shopping_list_members where consumer_id = auth.uid()
        )
    );

create policy shopping_list_items_delete_own_or_member
    on public.shopping_list_items
    for delete
    to authenticated
    using (
        list_id in (
            select id from public.shopping_lists where consumer_id = auth.uid()
            union
            select list_id from public.shopping_list_members where consumer_id = auth.uid()
        )
    );

-- Função que resolve um código de convite para dentro de uma lista,
-- adicionando quem chamou como membro. security definer: roda com
-- privilégio de dono do banco, então consegue procurar em TODAS as linhas
-- de shopping_lists (inclusive as que a RLS do chamador não deixaria ver),
-- só para achar a que bate com o código — sem nunca devolver códigos de
-- outras listas, só o resultado da própria tentativa.
create or replace function public.entrar_lista_compartilhada(p_codigo text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_list_id uuid;
    v_dono_id uuid;
begin
    select id, consumer_id into v_list_id, v_dono_id
    from public.shopping_lists
    where convite_codigo = p_codigo;

    if v_list_id is null then
        return null;
    end if;

    -- Dono entrando com o próprio código: não faz sentido virar "membro" da
    -- própria lista, só devolve o id normalmente.
    if v_dono_id = auth.uid() then
        return v_list_id;
    end if;

    insert into public.shopping_list_members (list_id, consumer_id)
    values (v_list_id, auth.uid())
    on conflict (list_id, consumer_id) do nothing;

    return v_list_id;
end;
$$;

grant execute on function public.entrar_lista_compartilhada(text) to authenticated;
