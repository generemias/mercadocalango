// Corredores/categorias fixas para agrupar os itens da lista de compras
// (pedido do CEO: "separar por coisas que podem estar juntas no mesmo
// corredor"). Lista fixa (não texto livre) — decisão do CEO — pra não
// gerar variações do mesmo corredor escritas de jeitos diferentes (ex:
// "Limpeza" vs "Produtos de limpeza"), o que quebraria o agrupamento.
//
// A ordem aqui é a mesma ordem em que os grupos aparecem na tela (Lista.jsx)
// — segue, a grosso modo, uma caminhada comum pelo mercado (hortifruti/
// padaria costumam ficar na entrada, limpeza/higiene mais ao fundo).
// "Outros" fica sempre por último, como grupo "coringa" pra item que não
// se encaixa em nenhum corredor específico.
export const CORREDORES = [
  'Hortifruti',
  'Padaria',
  'Açougue e frios',
  'Laticínios',
  'Mercearia (grãos, farinhas, massas)',
  'Condimentos e temperos',
  'Bebidas',
  'Congelados',
  'Limpeza',
  'Higiene e perfumaria',
  'Outros',
]

export const CORREDOR_PADRAO = 'Outros'
