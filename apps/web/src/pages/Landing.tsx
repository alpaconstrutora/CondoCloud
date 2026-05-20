import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import styles from './Landing.module.css';

const FAQ_ITEMS = [
  {
    q: 'Preciso trocar de sistema de cobrança?',
    a: 'Não. CondoCloud integra com os principais bancos via Open Finance e com as administradoras de boleto já contratadas. A migração mantém histórico de pagamentos, acordos e multas.',
  },
  {
    q: 'A assembleia online tem validade jurídica?',
    a: 'Sim. Seguimos a Lei 14.010/2020 e a Lei 14.309/2022, com registro de presença, votação auditável e ata assinada digitalmente. Aceita pelos cartórios.',
  },
  {
    q: 'Quanto tempo leva a migração?',
    a: 'De 5 a 10 dias úteis para um condomínio de até 100 unidades. Nosso time cuida de importar moradores, histórico financeiro, documentos e convenção — sem interromper a cobrança.',
  },
  {
    q: 'E a LGPD?',
    a: 'Somos controladores conjuntos com o condomínio, com DPO dedicado, criptografia em trânsito e em repouso, e backup geograficamente redundante. Contrato padrão inclui cláusula LGPD.',
  },
  {
    q: 'Funciona em condomínios pequenos?',
    a: 'Sim — temos um plano para edifícios com até 24 unidades, com preço compatível. Cobrança por unidade gerida, sem mensalidade mínima por usuário.',
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`${styles.faqItem} ${open ? styles.faqOpen : ''}`}>
      <button className={styles.faqSummary} onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{q}</span>
        <span className={styles.plus}>{open ? '×' : '+'}</span>
      </button>
      {open && <p className={styles.faqAnswer}>{a}</p>}
    </div>
  );
}

export default function Landing() {
  const { session } = useAuth();

  return (
    <div className={styles.root}>
      {/* NAV */}
      <nav className={styles.nav}>
        <div className={styles.wrap}>
          <div className={styles.navInner}>
            <div className={styles.brand}>
              <div className={styles.brandMark}>CC</div>
              CondoCloud
            </div>
            <div className={styles.navLinks}>
              <a href="#solucoes">Soluções</a>
              <a href="#recursos">Recursos</a>
              <a href="#app">Aplicativo</a>
              <a href="#faq">FAQ</a>
            </div>
            <div className={styles.navRight}>
              {session ? (
                <Link className={`${styles.btn} ${styles.btnPink}`} to="/dashboard">Ir ao painel →</Link>
              ) : (
                <>
                  <Link className={`${styles.btn} ${styles.btnOutlineLight}`} to="/login">Entrar</Link>
                  <a className={`${styles.btn} ${styles.btnGreen}`} href="#demo">Fale com a gente</a>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header className={styles.hero}>
        <div className={styles.wrap}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <div className={styles.pillList}>
                <span className={styles.pill}>● Para síndicos</span>
                <span className={styles.pill}>Plataforma 2026</span>
              </div>
              <h1>Gestão de Condomínios e Prestação de Contas para Síndicos Modernos.</h1>
              <p className={styles.lede}>
                Transforme seu mandato em uma rotina digital: cobrança automática, assembleias online,
                comunicados que chegam e muito mais — tudo em um só painel.
              </p>
              <div className={styles.ctaRow}>
                <a className={`${styles.btn} ${styles.btnPink}`} href="#demo">Comece agora →</a>
                <a className={`${styles.btn} ${styles.btnOutlineLight}`} href="#tour">Ver demonstração</a>
              </div>
            </div>

            <div className={styles.heroVisual} aria-hidden="true">
              <div className={styles.blob} />
              <div className={styles.person}><span>foto: síndico trabalhando</span></div>
              <div className={styles.laptop}>
                <div className={styles.scr}>
                  <div className={styles.r} />
                  <div className={`${styles.r} ${styles.rPink}`} />
                  <div className={`${styles.r} ${styles.rFaded}`} />
                  <div className={`${styles.r} ${styles.rFaded}`} />
                </div>
              </div>
            </div>
          </div>

          <div className={styles.heroBase}>
            <span>● Usado em 2.400+ condomínios · 14 estados</span>
            <span>CONDOCLOUD · PLATAFORMA CONDOMINIAL</span>
          </div>
        </div>
      </header>

      {/* APP SECTION */}
      <section className={styles.appSec} id="app">
        <div className={styles.wrap}>
          <div className={styles.appGrid}>
            <div className={styles.appHand} aria-hidden="true">
              <div className={styles.handBg} />
              <div className={styles.phone}>
                <div className={styles.phoneScr}>
                  <div className={styles.phSub}>BOA TARDE</div>
                  <div className={styles.phH}>Beatriz · Ap. 402</div>
                  <div className={styles.phCard}>
                    <div>
                      <div className={styles.phT}>Boleto abril</div>
                      <div className={styles.phV}>R$ 842,00</div>
                    </div>
                    <span className={styles.phPill}>Em dia</span>
                  </div>
                  <div className={styles.phList}>
                    <div className={styles.phRow}><span>🚪 Entrega chegou</span><span className={styles.phN}>14min</span></div>
                    <div className={styles.phRow}><span>🏊 Piscina — sáb 16h</span><span className={styles.phN}>ok</span></div>
                    <div className={styles.phRow}><span>📩 Assembleia 22/04</span><span className={styles.phN}>novo</span></div>
                    <div className={styles.phRow}><span>👤 Visita liberada</span><span className={styles.phN}>até 22h</span></div>
                  </div>
                  <div className={styles.phNav}>
                    <div className={styles.phNavOn}>⌂</div>
                    <div>◇</div>
                    <div>◉</div>
                    <div>☰</div>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.appCopy}>
              <h2>
                <span>NO APP CONDOCLOUD,</span> moradores e síndicos têm acesso 24 horas por dia a:
              </h2>
              <div className={styles.featRow}>
                <div className={styles.featCard}>
                  <div className={styles.ic}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16"/>
                    </svg>
                  </div>
                  <strong>Segunda via de boleto</strong>
                </div>
                <div className={styles.featCard}>
                  <div className={styles.ic}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                      <path d="M14 2v6h6"/>
                    </svg>
                  </div>
                  <strong>Atas, balancetes e documentos</strong>
                </div>
                <div className={`${styles.featCard} ${styles.featCardWide}`}>
                  <div className={styles.ic}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="8" r="3"/><path d="M5 21v-1a7 7 0 0114 0v1"/>
                    </svg>
                  </div>
                  <strong>Assistente virtual do condomínio</strong>
                  <span className={styles.featDesc}>Responde dúvidas de moradores em segundos, sem acordar o síndico às 22h.</span>
                </div>
              </div>
              <div className={styles.storeRow}>
                <div className={styles.store}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.5 12.5c0-2 1.5-3 2-3.5-1-1.5-2.5-1.7-3-1.7-1.3-.1-2.5.7-3.2.7-.7 0-1.7-.7-2.8-.7-1.5 0-2.8.8-3.5 2.1-1.5 2.6-.4 6.4 1 8.5.7 1 1.6 2.2 2.7 2.1 1.1 0 1.5-.7 2.8-.7s1.7.7 2.8.7c1.2 0 1.9-1 2.6-2 .8-1.2 1.1-2.3 1.1-2.4-.1 0-2.2-.8-2.5-3.1z"/>
                  </svg>
                  <div><small>DISPONÍVEL NA</small><b>App Store</b></div>
                </div>
                <div className={styles.store}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 20.5V3.5l10 8.5-10 8.5z"/>
                  </svg>
                  <div><small>DISPONÍVEL NO</small><b>Google Play</b></div>
                </div>
                <a className={`${styles.btn} ${styles.btnPink}`} href="#demo">Comece agora →</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* IA SECTION */}
      <section className={styles.iaSec}>
        <div className={styles.wrap}>
          <div className={styles.iaCard}>
            <div className={styles.iaCopy}>
              <div className={styles.eyebrow}><span className={styles.dot} /> Inteligência Artificial</div>
              <h2>IA <em>Síndica</em> no CondoCloud</h2>
              <p>Nossa IA treinada em convenções e jurisprudência de condomínios responde moradores, classifica chamados, redige comunicados e sugere pautas de assembleia. Ganhe horas — e sossego.</p>
              <a className={`${styles.btn} ${styles.btnPink}`} href="#ia">Comece agora →</a>
            </div>
            <div className={styles.iaVisual} aria-hidden="true">
              <div className={styles.iaLabel}>IA Síndica</div>
              <div className={styles.robot}>
                <div className={styles.robotEye}>
                  <span /><span />
                </div>
                <div className={styles.robotMouth} />
                <div className={styles.robotPanel} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TEXT BLOCK 1: NFS-e */}
      <section className={styles.txBlock} id="recursos">
        <div className={styles.wrap}>
          <div className={styles.txGrid}>
            <div className={`${styles.photo} ${styles.photoPersonA}`} aria-hidden="true">
              <span className={styles.photoTag}>foto: consultor CondoCloud</span>
            </div>
            <div className={styles.txCopy}>
              <div className={styles.eyebrow}><span className={styles.dot} /> Conformidade fiscal</div>
              <h2>NFS-e para condomínios: o CondoCloud já está pronto para a <em>Reforma Tributária</em>.</h2>
              <p>Emitimos automaticamente a Nota Fiscal de Serviço eletrônica para taxas de locação de áreas comuns e serviços internos, conforme o padrão NFS-e nacional (LC 214/2025). Integração direta com a prefeitura, sem retrabalho.</p>
              <p className={styles.quote}>"Em março, emitimos 137 NFS-e sem tocar em nenhum formulário. Antes eu gastava um sábado inteiro com isso." — Carla M., síndica profissional</p>
              <a className={`${styles.btn} ${styles.btnPink}`} href="#fiscal">Comece agora →</a>
            </div>
          </div>
        </div>
      </section>

      {/* TEXT BLOCK 2: Rotinas automáticas */}
      <section className={`${styles.txBlock} ${styles.txBlockPaper}`}>
        <div className={styles.wrap}>
          <div className={`${styles.txGrid} ${styles.txGridReverse}`}>
            <div className={`${styles.photo} ${styles.photoPersonB}`} aria-hidden="true">
              <span className={styles.photoTag}>foto: morador usando o app</span>
            </div>
            <div className={styles.txCopy}>
              <div className={styles.eyebrow}><span className={styles.dot} /> Rotinas automáticas</div>
              <h2>Rotinas Automáticas: notificações que reduzem a <em>inadimplência.</em></h2>
              <p>Lembretes por WhatsApp, e-mail e push no app — sete dias antes, no vencimento e depois. Cada régua é personalizável por bloco, por unidade e por perfil de risco. Resultado: condomínios usando CondoCloud têm inadimplência média de 3,2%.</p>
              <p className={styles.quote}>"CondoCloud é, hoje, o sistema mais completo para síndicos que eu conheço. E o mais humano." — Editor, Revista do Síndico</p>
              <a className={`${styles.btn} ${styles.btnPink}`} href="#rotinas">Comece agora →</a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className={styles.faqSec} id="faq">
        <div className={styles.wrap}>
          <div className={styles.faqHead}>
            <div className={styles.eyebrow} style={{ justifyContent: 'center' }}>
              <span className={styles.dot} /> Dúvidas frequentes
            </div>
            <h2>Perguntas que todo síndico faz.</h2>
            <p>Se a sua não está aqui, fale com nosso time — respondemos em até 2 horas úteis.</p>
          </div>
          <div className={styles.faqList}>
            {FAQ_ITEMS.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className={styles.wrap}>
          <div className={styles.footGrid}>
            <div className={styles.footCol}>
              <div className={styles.brand}>
                <div className={styles.brandMark}>CC</div>
                CondoCloud
              </div>
              <p>Plataforma independente de gestão de condomínios. Feita no Brasil, para síndicos que têm o que fazer.</p>
            </div>
            <div className={styles.footCol}>
              <h5>Produto</h5>
              <ul>
                <li><a href="#">Financeiro</a></li>
                <li><a href="#">Assembleias</a></li>
                <li><a href="#">Comunicados</a></li>
                <li><a href="#">Reservas</a></li>
                <li><a href="#">Portaria</a></li>
              </ul>
            </div>
            <div className={styles.footCol}>
              <h5>Empresa</h5>
              <ul>
                <li><a href="#">Sobre</a></li>
                <li><a href="#">Clientes</a></li>
                <li><a href="#">Blog</a></li>
                <li><a href="#">Carreiras</a></li>
              </ul>
            </div>
            <div className={styles.footCol}>
              <h5>Contato</h5>
              <ul>
                <li><a href="#">oi@condocloud.com.br</a></li>
                <li><a href="#">(11) 4200-0000</a></li>
                <li><a href="#">WhatsApp comercial</a></li>
                <li><a href="#">Status · 99,98%</a></li>
              </ul>
            </div>
          </div>
          <div className={styles.footBase}>
            <div>© 2026 CondoCloud · Todos os direitos reservados</div>
            <div>LGPD · Termos · Privacidade</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
