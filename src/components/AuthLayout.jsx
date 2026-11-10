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
 * eyebrow: selo pequeno opcional acima do título (ex: "Painel do mercado
 * parceiro"), usado para deixar claro que a tela pertence ao painel do
 * mercado e não ao app do consumidor — sem precisar de um visual totalmente
 * diferente, já que é o mesmo produto/marca.
 */
function AuthLayout({ title, subtitle, children, footer, eyebrow }) {
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
          {eyebrow && <span className="auth-eyebrow">{eyebrow}</span>}
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
