import './AuthLayout.css'

/**
 * Casca visual compartilhada pelas telas de autenticação (Login e Cadastro).
 *
 * Por quê um layout compartilhado?
 * - Garante que Login e Cadastro tenham exatamente a mesma "moldura" (logo,
 *   card, respiro, rodapé) — o usuário sente que está na mesma jornada, só
 *   trocando de formulário.
 * - Se o CEO pedir para trocar o logo ou o estilo do card mais tarde, muda em
 *   um lugar só.
 *
 * title / subtitle: cabeçalho da tela (ex: "Bem-vindo de volta").
 * children: o formulário específico de cada tela.
 * footer: o link de troca entre Login <-> Cadastro.
 */
function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          {/* Placeholder de logo — trocar pelo logo final do Calango Digital */}
          <div className="auth-brand-mark" aria-hidden="true">
            CD
          </div>
          <span className="auth-brand-name">Calango Digital</span>
        </div>

        <header className="auth-header">
          <h1>{title}</h1>
          {subtitle && <p className="auth-subtitle">{subtitle}</p>}
        </header>

        {children}

        {footer && <div className="auth-footer">{footer}</div>}
      </div>
    </div>
  )
}

export default AuthLayout
