-- ============================================================================
-- Calango Digital — Adiciona peso e marca ao cadastro de produtos
-- ============================================================================
-- STATUS: PROPOSTA. Não aplicar em nenhum projeto Supabase real até o CEO
-- revisar e aprovar (mesmo processo de 001_init.sql/002_rls_policies.sql).
--
-- Pedido do CEO: o cadastro de produtos (CadastroProdutos.jsx) só tinha
-- nome/categoria/preço/imagem/validade da promoção — faltava o lojista poder
-- informar peso (ex: "5kg", "500g") e marca do produto.
--
-- Decisão de design: os dois campos são texto livre, opcionais (nullable),
-- igual a outros campos "livres" já existentes no schema (ex:
-- horario_funcionamento em market_profiles). Peso vira texto em vez de
-- número + unidade separados porque o MVP não precisa comparar/ordenar por
-- peso — é só informação para o consumidor ler, e texto livre ("5kg", "pacote
-- 500g", "caixa com 12 unidades") cobre casos que um campo numérico rígido
-- não cobriria sem mais complexidade.
--
-- Nenhuma política de RLS nova é necessária: as colunas entram na mesma
-- tabela products, que já tem RLS habilitada (ver 002_rls_policies.sql) e as
-- políticas existentes (select liberado para autenticados, insert/update/
-- delete só pelo próprio mercado dono) cobrem as colunas novas automaticamente.
-- ============================================================================

alter table public.products
    add column if not exists peso text,
    add column if not exists marca text;

comment on column public.products.peso is
    'Peso/quantidade do produto em texto livre (ex: "5kg", "pacote 500g"). Opcional.';
comment on column public.products.marca is
    'Marca do produto, texto livre. Opcional.';
