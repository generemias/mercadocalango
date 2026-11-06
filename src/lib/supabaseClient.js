import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Antes isso disparava um `throw` aqui mesmo, no nível do módulo. Isso
// quebrava a montagem de toda a árvore React e deixava a tela 100% em
// branco (o erro só aparecia no console do navegador, que ninguém comum
// abre). Agora, se faltar configuração, não travamos o app: expomos
// `isSupabaseConfigured = false` e App.jsx mostra uma tela amigável
// avisando que falta configurar o .env, em vez de uma tela branca.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  console.error(
    'Faltam VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY. Copie .env.example para .env e preencha.'
  )
}

// Quando a configuração está ausente, criamos o client com valores
// fictícios só para o import não quebrar — nenhuma tela chega a usá-lo de
// fato, porque App.jsx intercepta esse caso antes de renderizar
// Login/Cadastro/EsqueciSenha.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
)
