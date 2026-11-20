-- ============================================================================
-- Calango Digital — Agrupar itens da lista por corredor/categoria
-- ============================================================================
-- STATUS: PROPOSTA. Não aplicar em nenhum projeto Supabase real até o CEO
-- revisar e aprovar (mesmo processo das migrations anteriores).
--
-- Pedido do CEO: separar os itens da lista de compras por corredor do
-- mercado (ex: frios, limpeza, mercearia, condimentos), pra facilitar
-- percorrer o mercado por seção em vez de uma lista única sem ordem.
--
-- Decisão de design, confirmada com o CEO: corredor é escolhido de uma
-- lista FIXA (não texto livre) — ver src/lib/corredores.js para a lista
-- completa e o motivo (evitar variações do mesmo corredor escritas de
-- jeitos diferentes, o que quebraria o agrupamento visual). Por isso não
-- há CHECK constraint aqui no banco "travando" os valores possíveis: a
-- lista fixa já é garantida do lado do app (um <select>, não um campo de
-- texto livre) — mesmo padrão de outros campos "livres" do schema que não
-- têm enum no banco.
--
-- Opcional (nullable): itens já existentes ficam sem corredor definido até
-- a pessoa editar, e a tela trata isso caindo no grupo "Outros" — nunca
-- quebra por falta desse dado.
-- ============================================================================

alter table public.shopping_list_items
    add column if not exists categoria text;

comment on column public.shopping_list_items.categoria is
    'Corredor/categoria do item (ver src/lib/corredores.js para a lista fixa de opções), usado para agrupar a lista visualmente. Opcional — item sem corredor definido aparece no grupo "Outros".';
