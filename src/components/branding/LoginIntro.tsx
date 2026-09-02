import { useEffect } from "react";
import { createPortal } from "react-dom";
import logo from "@src/assets/logo.jpg";
import { APP_BRANDING } from "@src/config/branding";

export default function LoginIntro({ onComplete, statusText = "Logging in..." }: { onComplete: () => void; statusText?: string }) {
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(onComplete, reducedMotion ? 650 : 4200);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return createPortal(
    <section className="admin-login-intro" style={{ zIndex: 2147483647 }} aria-label="Welcome to the Gym Management System">
      <div className="admin-login-intro__content">
        <div className="admin-login-intro__logo-wrap">
          <img className="admin-login-intro__logo" src={logo} alt="A&A Health Club" />
        </div>
        <h1 className="admin-login-intro__title">{APP_BRANDING.applicationName}</h1>
        <div className="admin-login-intro__status">{statusText}</div>
        <div className="admin-login-intro__progress" role="progressbar" aria-label={statusText} aria-valuemin={0} aria-valuemax={100}><span /></div>
        <div className="admin-login-intro__credit">
          <span>{APP_BRANDING.developerLabel}</span>
          <strong>{APP_BRANDING.developerName}</strong>
        </div>
      </div>
    </section>,
    document.body,
  );
}
