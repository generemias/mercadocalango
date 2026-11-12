-- ============================================================================
-- Calango Digital — Adiciona valor pago ao item da lista de compras
-- ============================================================================
-- STATUS: PROPOSTA. Não aplicar em nenhum projeto Supabase real até o CEO
-- revisar e aprovar (mesmo processo das migrations anteriores).
--
-- Pedido do CEO: deixar o cliente ajustar o valor do item na hora das
-- compras — hoje shopping_list_items é só texto livre (nome_item) + um
-- boolean (comprado), sem nenhum preço associado.
--
-- Decisão de design: campo opcional (nullable), preenchido pelo próprio
-- cliente ao marcar o item como comprado (não vem de nenhum produto
-- cadastrado — a lista continua sendo texto livre, sem ligação com
-- `products`). Serve tanto pra registrar quanto efetivamente pagou (preço
-- pode variar do que estava anunciado) quanto pra somar um "total gasto"
-- simples na tela.
alter table public.shopping_list_items
    add column if not exists valor_pago numeric(10, 2) check (valor_pago is null or valor_pago >= 0);

comment on column public.shopping_list_items.valor_pago is
    'Valor que o cliente efetivamente pagou pelo item, preenchido opcionalmente na hora da compra. Independente do nome_item (texto livre, sem ligação com products).';
