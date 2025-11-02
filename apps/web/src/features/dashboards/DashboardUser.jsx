// src/pages/DashboardUser.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabase/client';
import { useNavigate } from 'react-router-dom';
import { decryptData } from '../../utils/encryption';
import logo from '../../assets/logo.png';
import { getCertificateStatus } from '../../services/certificateService';

const DashboardUser = () => {
  const [profile, setProfile] = useState(null);
  const [payments, setPayments] = useState([]);
  const [certificateSummary, setCertificateSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const fetchUserData = useCallback(async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        navigate('/login'); // Redirect to login instead of cadastro
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profileError) throw profileError;

      if (profileData.user_type === 'partner') {
        navigate('/dashboard-parceiro');
        return;
      }

      const decryptedDocument = profileData.document ? await decryptData(profileData.document) : '';
      const decryptedPis = profileData.pis ? await decryptData(profileData.pis) : '';

      setProfile({ ...profileData, document: decryptedDocument, pis: decryptedPis });

      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false });

      if (paymentsError) throw paymentsError;
      setPayments(paymentsData);

      const certificadoAtual = await getCertificateStatus(authUser.id).catch(() => null);
      setCertificateSummary(certificadoAtual?.enrollment ?? null);

      setLoading(false);
    } catch (err) {
      setError('Erro ao carregar dados: ' + err.message);
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');

    if (sessionId) {
      window.history.replaceState({}, document.title, "/dashboard");
      // Replace alert with a more modern notification system if available
      alert('🎉 Pagamento confirmado! Seu acesso está liberado.');
    }
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const handleEmitNFS = () => navigate('/emitir-nota');
  const handleEmitGPS = () => navigate('/emitir-gps');
  const handleCertificado = () => navigate('/certificado');

  if (loading) {
    return <div style={styles.centered}><div style={styles.spinner}></div></div>;
  }

  if (error) {
    return <div style={styles.centered}><p>{error}</p></div>;
  }

  return (
    <div style={styles.dashboardContainer}>
      <aside style={styles.sidebar}>
        <img src={logo} alt="Rebelo App Logo" style={styles.logo} />
        <nav style={styles.nav}>
          <button style={{...styles.navLink, ...styles.activeNavLink}}><span>🏠</span> Dashboard</button>
          <button style={styles.navLink} onClick={handleEmitNFS}><span>📄</span> Emitir NFS-e</button>
          <button style={styles.navLink} onClick={handleEmitGPS}><span>💰</span> Emitir Guia GPS</button>
          <button style={styles.navLink}><span>👤</span> Meu Perfil</button>
        </nav>
        <div style={styles.logoutButton} onClick={handleLogout}>
          <span>🚪</span> Sair
        </div>
      </aside>

      <main style={styles.mainContent}>
        <header style={styles.header}>
          <h2>Olá, {profile.name}!</h2>
          <p>Bem-vindo(a) de volta ao seu painel de controle fiscal.</p>
        </header>

        {!profile.onboarding_completed && (
            <div style={styles.onboardingAlert}>
                <strong>Atenção:</strong> Seu cadastro ainda não foi finalizado pela nossa equipe. Algumas funcionalidades podem estar limitadas.
            </div>
        )}

        <section style={styles.cardsContainer}>
            <div style={{...styles.card, ...styles.actionsCard}}>
                <h3>Ações Rápidas</h3>
                <button onClick={handleEmitNFS} style={styles.actionButton} disabled={!profile.onboarding_completed}>
                    Emitir Nota Fiscal de Serviço
                </button>
                <button onClick={handleEmitGPS} style={styles.actionButton} disabled={!profile.onboarding_completed}>
                    Emitir Guia de INSS (GPS)
                </button>
                <button onClick={handleCertificado} style={styles.actionButtonSecondary}>
                    Acompanhar Certificado Digital
                </button>
            </div>
            <div style={styles.card}>
                <h3>Status do Cadastro</h3>
                <div style={styles.statusGrid}>
                    <p><strong>Contrato aceito:</strong> {profile.contract_accepted ? '✅ Sim' : '❌ Não'}</p>
                    <p><strong>Onboarding:</strong> {profile.onboarding_completed ? '✅ Completo' : '⏳ Pendente'}</p>
                    {profile.user_type === 'mei' && (
                        <p>
                            <strong>Certificado Digital:</strong> {certificateSummary ? certificateSummary.status : 'Pendente'}
                            {certificateSummary?.valid_until && (
                                <span> — vence em {new Date(certificateSummary.valid_until).toLocaleDateString('pt-BR')}</span>
                            )}
                        </p>
                    )}
                </div>
            </div>
        </section>

        <section style={{...styles.card, ...styles.tableCard}}>
          <h3>Histórico de Pagamentos</h3>
          {payments.length === 0 ? (
            <p>Nenhum pagamento encontrado.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Tipo</th>
                  <th style={styles.th}>Valor</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Data</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td style={styles.td}>{payment.type === 'onboarding' ? 'Adesão' : payment.type}</td>
                    <td style={styles.td}>R$ {payment.amount.toFixed(2)}</td>
                    <td style={styles.td}><span style={styles.statusBadge(payment.status)}>{payment.status}</span></td>
                    <td style={styles.td}>{new Date(payment.created_at).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
};

const styles = {
  // Main Layout
  dashboardContainer: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: '"Inter", sans-serif',
    backgroundColor: '#f8f9fa',
  },
  sidebar: {
    width: '250px',
    backgroundColor: '#fff',
    padding: '30px 20px',
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid #dee2e6',
  },
  logo: {
    height: '50px',
    marginBottom: '40px',
    alignSelf: 'center',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    flexGrow: 1,
  },
  navLink: {
    textDecoration: 'none',
    color: '#495057',
    padding: '12px 15px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontWeight: 500,
    transition: 'background-color 0.2s, color 0.2s',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
  },
  activeNavLink: {
    backgroundColor: '#e9ecef',
    color: '#007bff',
  },
  logoutButton: {
    padding: '12px 15px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontWeight: 500,
    color: '#dc3545',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  mainContent: {
    flex: 1,
    padding: '40px',
    overflowY: 'auto',
  },
  header: {
    marginBottom: '40px',
  },
  onboardingAlert: {
    backgroundColor: '#fff3cd',
    color: '#664d03',
    padding: '15px',
    borderRadius: '8px',
    marginBottom: '30px',
  },
  // Cards
  cardsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '30px',
    marginBottom: '30px',
  },
  card: {
    backgroundColor: '#fff',
    padding: '30px',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
  },
  actionsCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  actionButton: {
    padding: '15px',
    fontSize: '16px',
    fontWeight: 'bold',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'background-color 0.2s',
  },
  statusGrid: {
    display: 'grid',
    gap: '10px',
  },
  // Table
  tableCard: {
    padding: 0,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '15px 30px',
    backgroundColor: '#f8f9fa',
    fontWeight: '600',
    color: '#6c757d',
    borderBottom: '1px solid #dee2e6',
  },
  td: {
    padding: '15px 30px',
    borderBottom: '1px solid #dee2e6',
    color: '#495057',
  },
  statusBadge: (status) => ({
    padding: '5px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 'bold',
    backgroundColor: status === 'paid' ? '#d1e7dd' : status === 'failed' ? '#f8d7da' : '#fff3cd',
    color: status === 'paid' ? '#0f5132' : status === 'failed' ? '#842029' : '#664d03',
  }),
  // Utils
  centered: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
  },
  spinner: {
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #007bff',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    animation: 'spin 1s linear infinite',
  },
  '@keyframes spin': {
    '0%': { transform: 'rotate(0deg)' },
    '100%': { transform: 'rotate(360deg)' },
  },
};

export default DashboardUser;
