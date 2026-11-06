import './SocialButtons.css'

/**
 * Botões de login social (Google e Apple), usados tanto no Login quanto no
 * Cadastro — nas duas telas, entrar com Google/Apple "pula" o formulário.
 *
 * onGoogleClick / onAppleClick: por enquanto são só placeholders (ver
 * comentário em Login.jsx e Cadastro.jsx). O desenvolvedor vai plugar aqui
 * o supabase.auth.signInWithOAuth({ provider: 'google' | 'apple' }).
 */
function SocialButtons({ onGoogleClick, onAppleClick }) {
  return (
    <div className="social-buttons">
      <button type="button" className="social-btn" onClick={onGoogleClick}>
        <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
          <path
            fill="#EA4335"
            d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.4-6.4C35.6 3 30.2 1 24 1 14.8 1 6.9 6.3 3.1 14l7.5 5.8C12.5 13.6 17.8 9.5 24 9.5z"
          />
          <path
            fill="#4285F4"
            d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.4 5.7c4.3-4 6.9-9.9 6.9-17.4z"
          />
          <path
            fill="#FBBC05"
            d="M10.6 19.8A14.5 14.5 0 0 0 9.5 24c0 1.5.2 2.9.6 4.2l-7.5 5.8A23 23 0 0 1 1 24c0-3.7.9-7.2 2.6-10.2z"
          />
          <path
            fill="#34A853"
            d="M24 47c6.2 0 11.4-2 15.2-5.6l-7.4-5.7c-2 1.4-4.7 2.3-7.8 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.5 5.8C6.9 41.7 14.8 47 24 47z"
          />
        </svg>
        <span>Continuar com Google</span>
      </button>

      <button type="button" className="social-btn" onClick={onAppleClick}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M16.7 1c.1 1.2-.4 2.4-1.1 3.3-.8.9-2 1.6-3.2 1.5-.1-1.1.4-2.3 1.1-3.1.8-.9 2.1-1.6 3.2-1.7zM20.9 17c-.6 1.3-.9 1.9-1.7 3.1-1.1 1.6-2.7 3.7-4.6 3.7-1.7 0-2.1-1.1-4.4-1.1-2.2 0-2.7 1.1-4.4 1.1-1.9 0-3.4-1.9-4.5-3.5C-1 16.6-1.5 10.6 1 7.4c1.3-1.7 3.3-2.7 5.2-2.7 1.9 0 3.1 1.1 4.6 1.1 1.5 0 2.4-1.1 4.6-1.1 1.7 0 3.5.9 4.8 2.5-4.2 2.5-3.5 8.6.7 9.8z"
          />
        </svg>
        <span>Continuar com Apple</span>
      </button>
    </div>
  )
}

export default SocialButtons
