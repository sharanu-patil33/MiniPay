import { useNavigate } from "react-router-dom";
import Icon from "./Icon";

export default function HomeShell({ name, badge, intro, heroExtra, heading, actions, profilePath }) {
  const navigate = useNavigate();
  const initial = (name || "?").charAt(0).toUpperCase();

  return (
    <div className="home">
      <header className="home-top">
        <div className="brand">
          <span className="brand-mark">M</span>
          <span className="brand-text">MiniPay</span>
        </div>
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
          {actions.map((a, i) => (
            <button
              key={a.path}
              className={`action ${a.primary ? "primary" : ""}`}
              style={{ "--i": i }}
              onClick={() => navigate(a.path)}
            >
              <span className="action-icon">
                <Icon name={a.icon} />
              </span>
              <span className="action-text">
                {a.label}
                <small>{a.hint}</small>
              </span>
              {a.count != null && <span className="action-count">{a.count}</span>}
              <span className="action-chev">
                <Icon name="chevron" size={18} />
              </span>
            </button>
          ))}
        </aside>
      </main>
    </div>
  );
}