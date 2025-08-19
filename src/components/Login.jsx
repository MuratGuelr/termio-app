import { useAuth } from '../contexts/AuthContext';
import './Login.css';

export default function Login() {
  const { signInWithGoogle } = useAuth();
  return (
    <div className="login-container" id="loginPage">
      <div className="login-card">
        <div className="logo">🎯</div>
        <h1>Termio</h1>
        <p>Hedeflerinizi takip edin, gelişiminizi izleyin</p>
        <button className="google-btn" onClick={signInWithGoogle}>
          <i className="fab fa-google" />
          Google ile Giriş Yap
        </button>
      </div>
    </div>
  );
}
