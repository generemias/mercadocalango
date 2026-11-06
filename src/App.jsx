import { useEffect, useState } from 'react'
import './App.css'
import Login from './pages/Login'
import Cadastro from './pages/Cadastro'
import EsqueciSenha from './pages/EsqueciSenha'
import Home from './pages/Home'
import Lista from './pages/Lista'
import { isSupabaseConfigured, supabase } from './lib/supabaseClient'

/**
 * Por enquanto o projeto não tem um roteador (react-router ou similar), e
 * adicionar um está fora do escopo desta tarefa (só desenho das telas de
 * Login/Cadastro/Esqueci minha senha). Este useState é só um "trocador de
 * tela" temporário para dar para visualizar as telas no navegador — quando
 * o desenvolvedor adicionar rotas reais, este bloco deve ser substituído
 * por algo como <Route path="/login" ... />.
 */
function App() {
  const [tela, setTela] = useState('login')
  // Enquanto checamos se já existe uma sessão salva pelo supabase-js (ele
  // guarda a sessão no localStorage por padrão), não sabemos ainda se o
  // usuário está logado. Sem esse estado, a tela de Login aparecia
  // rapidamente antes de redirecionar para a Home — um "flash" confuso.
  const [verificandoSessao, setVerificandoSessao] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setVerificandoSessao(false)
      return
    }

    // Checagem inicial: se já existe uma sessão ativa salva, pula direto
    // para a Home em vez de mostrar o Login de novo. Corrige o bug de F5 /
    // reabrir a aba derrubar um usuário já logado para a tela de login.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setTela('home')
      }
      setVerificandoSessao(false)
    })

    // Mantém a tela sincronizada se a sessão expirar ou o usuário sair
    // (ex: token expirado, logout em outra aba).
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setTela('login')
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  // Sem VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY no .env, nenhuma tela de
  // login/cadastro funcionaria de verdade. Antes isso travava o app numa
  // tela branca; agora mostramos um aviso simples e claro em vez disso.
  if (!isSupabaseConfigured) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Configuração do Supabase ausente</h1>
        <p>
          Faltam as variáveis VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY.
          Copie o arquivo .env.example para .env e preencha os valores, ou
          contate o suporte.
        </p>
      </div>
    )
  }

  // Enquanto a checagem inicial de sessão não terminou, mostramos um
  // carregamento simples em vez de decidir entre Login/Home sem saber a
  // resposta ainda (evita o "flash" de tela de Login para quem já está
  // logado).
  if (verificandoSessao) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Carregando...</p>
      </div>
    )
  }

  if (tela === 'cadastro') {
    return <Cadastro onNavigateToLogin={() => setTela('login')} />
  }

  if (tela === 'esqueci-senha') {
    return <EsqueciSenha onNavigateToLogin={() => setTela('login')} />
  }

  if (tela === 'lista') {
    return (
      <Lista
        onNavigateToHome={() => setTela('home')}
        // TODO: Explorar mercados e Perfil ainda não existem (próximas
        // etapas do MVP) — por isso esses callbacks só ficam registrados
        // aqui, sem nenhuma tela de destino por enquanto.
        onNavigateToExplorar={() => console.log('[Lista] TODO: navegar para Explorar mercados')}
        onNavigateToPerfil={() => console.log('[Lista] TODO: navegar para Perfil')}
      />
    )
  }

  if (tela === 'home') {
    return (
      <Home
        // TODO: Explorar mercados e Perfil ainda não existem (próximas
        // etapas do MVP) — por isso esses callbacks só ficam registrados
        // aqui, sem nenhuma tela de destino por enquanto.
        onNavigateToLista={() => setTela('lista')}
        onNavigateToExplorar={() => console.log('[Home] TODO: navegar para Explorar mercados')}
        onNavigateToPerfil={() => console.log('[Home] TODO: navegar para Perfil')}
      />
    )
  }

  return (
    <Login
      onNavigateToCadastro={() => setTela('cadastro')}
      onNavigateToEsqueciSenha={() => setTela('esqueci-senha')}
      onLoginSuccess={() => setTela('home')}
    />
  )
}

export default App
