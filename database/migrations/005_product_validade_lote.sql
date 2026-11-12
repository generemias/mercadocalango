-- ============================================================================
-- Calango Digital — Adiciona validade do lote ao cadastro de produtos
-- ============================================================================
-- STATUS: PROPOSTA. Não aplicar em nenhum projeto Supabase real até o CEO
-- revisar e aprovar (mesmo processo das migrations anteriores).
--
-- Pedido do CEO: campo de validade do lote do produto — diferente da
-- validade da PROMOÇÃO (promocao_validade_fim, ver migration 004), que é
-- até quando o DESCONTO vale. Validade de lote é quando o produto físico
-- vence (controle de estoque do lojista).
--
-- Decisão de design, confirmada com o CEO: este campo é só para uso INTERNO
-- do mercado (controle de estoque/validade), não aparece para o consumidor
-- em nenhuma tela. Por isso só é selecionado/mostrado em
-- CadastroProdutos.jsx — nenhuma tela do app do consumidor (Home, Explorar,
-- MercadoDetalhe, BuscaProdutos) deve consultar esta coluna.
--
-- Nenhuma política de RLS nova é necessária: mesma tabela products, mesma
-- RLS já existente (select liberado para autenticados, insert/update/delete
-- só pelo próprio mercado dono).
-- ============================================================================

alter table public.products
    add column if not exists validade_lote date;

comment on column public.products.validade_lote is
    'Validade do lote físico do produto (controle interno do mercado) — NÃO é a validade da promoção (ver promocao_validade_fim) e não aparece para o consumidor.';
