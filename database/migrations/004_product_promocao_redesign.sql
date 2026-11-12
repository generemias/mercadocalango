-- ============================================================================
-- Calango Digital — Redesenha promoção de produto (flag + preço + range)
-- ============================================================================
-- STATUS: PROPOSTA. Não aplicar em nenhum projeto Supabase real até o CEO
-- revisar e aprovar (mesmo processo das migrations anteriores).
--
-- Pedido do CEO: hoje "promoção" é só uma data de validade
-- (promocao_validade_fim) — o preço cadastrado em `preco` já É o preço
-- promocional, sem preço "normal" separado nem data de início. O CEO pediu
-- para virar: (1) uma flag explícita dizendo se o produto está em promoção
-- agora, (2) um preço promocional separado do preço normal, e (3) um range
-- de datas (início + fim), não só o fim.
--
-- Colunas novas:
-- - promocao_ativa: flag que o lojista liga/desliga (em vez de só inferir
--   pela presença de uma data). Default false.
-- - preco_promocional: preço com desconto, separado de `preco` (que passa a
--   ser sempre o preço "cheio" do produto). Mesmo tipo/constraint de `preco`.
-- - promocao_inicio: início do range (timestamptz, mesmo tipo de
--   promocao_validade_fim, que continua sendo o fim do range).
--
-- Backfill (produtos que já tinham promocao_validade_fim preenchida ANTES
-- desta migration): continuam aparecendo como "em promoção" pra não sumir
-- do dia pra noite. Como esses produtos nunca tiveram preço normal
-- separado, preco_promocional recebe o mesmo valor hoje salvo em `preco`
-- (era assim que a promoção funcionava até aqui: o preço cadastrado já era
-- o promocional). promocao_inicio fica vazio (nunca existiu antes). O
-- lojista pode revisar/ajustar esses valores depois em "Seus produtos".
alter table public.products
    add column if not exists promocao_ativa boolean not null default false,
    add column if not exists preco_promocional numeric(10, 2) check (preco_promocional is null or preco_promocional >= 0),
    add column if not exists promocao_inicio timestamptz;

update public.products
set promocao_ativa = true,
    preco_promocional = preco
where promocao_validade_fim is not null
  and promocao_ativa = false;

comment on column public.products.promocao_ativa is
    'Flag ligada pelo lojista: true = produto está em promoção agora (ver também promocao_inicio/promocao_validade_fim para o range de datas).';
comment on column public.products.preco_promocional is
    'Preço com desconto, usado só quando promocao_ativa = true. `preco` continua sendo o preço normal/cheio do produto.';
comment on column public.products.promocao_inicio is
    'Início do range de datas da promoção. promocao_validade_fim (coluna já existente) é o fim do range.';
