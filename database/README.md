# Banco de dados — Calango Digital

Esquema do banco (Supabase/Postgres) do MVP.

## Status

**Proposta pendente de aprovação do CEO.** O arquivo
[`migrations/001_init.sql`](./migrations/001_init.sql) contém a primeira
proposta de schema, cobrindo exatamente o que o `README.md` da raiz descreve
para o MVP: perfil de consumidor, perfil de mercado parceiro, produtos e
promoções, listas de compras e seus itens, mercados favoritos, e três tabelas
simples de métrica (visualização de mercado, clique em "rota" e busca de
produto) para alimentar as 3-4 métricas do dashboard do painel do mercado.

Este arquivo SQL **não foi aplicado em nenhum projeto Supabase real**. Não há
credenciais de produção configuradas neste repositório. Só deve ser aplicado
depois que o CEO revisar e aprovar, e então rodado manualmente (ex: via SQL
Editor do Supabase ou `supabase db push`) contra o projeto Supabase do piloto.

As 4 perguntas iniciais de produto já foram respondidas pelo CEO (múltiplas
listas por consumidor: ok; métrica de produtos mais buscados: incluída via
`product_searches`; login do mercado: só email/senha; histórico no Perfil:
monta a partir das tabelas existentes, sem tabela nova). Próximo passo após
aprovação final: revisão de segurança (políticas de RLS do Supabase), que
ainda não foi definida neste arquivo de propósito — é decisão de acesso, não
de modelagem de dados.
