import { useNavigate } from "react-router-dom";

export default function HomeShell({ name, badge, intro, heroExtra, heading, actions, profilePath }) {
  const navigate = useNavigate();
  const initial = (name || "?").charAt(0).toUpperCase();

  return (
    <div className="home">
      <header className="home-top">
        <div className="brand">MiniPay</div>
        <button className="avatar-btn" onClick={() => navigate(profilePath)} title="My account">
          {initial}
        </button>
      </header>

      <main className="home-main">
        <section className="hero">
          <span className="hero-badge">{badge}</span>
          <h1 className="hero-title">Welcome to MiniPay</h1>
          <p>{intro}</p>
          {heroExtra}
        </section>

        <aside className="actions-panel">
          <h3>{heading}</h3>
          {actions.map((a) => (
            <button
              key={a.path}
              className={`action ${a.primary ? "primary" : ""}`}
              onClick={() => navigate(a.path)}
            >
              <span className="action-icon">{a.icon}</span>
              <span>
                {a.label}
                <small>{a.hint}</small>
              </span>
              {a.count != null && <span className="action-count">{a.count}</span>}
            </button>
          ))}
        </aside>
      </main>
    </div>
  );
}