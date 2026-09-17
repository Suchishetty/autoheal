import { useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Redirect, Route, Switch, useLocation, useParams } from 'wouter';
import { ClerkProvider, RedirectToSignIn, SignIn, SignUp, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  Activity, AlertCircle, ArrowRight, BarChart3, Bell, Check, ChevronRight, CircleHelp,
  CloudOff, Database, ExternalLink, Gauge, KeyRound, LayoutDashboard, LifeBuoy, ListFilter,
  Loader2, LockKeyhole, Menu, MoreHorizontal, Network, Plus, RefreshCw, Search, Server,
  Settings, ShieldCheck, SlidersHorizontal, Sparkles, Trash2, TriangleAlert, X, Zap,
} from 'lucide-react';
import {
  getGetApplicationQueryKey, getGetDashboardSummaryQueryKey, getGetIncidentQueryKey,
  getGetServiceQueryKey, getListApplicationsQueryKey, getListIncidentsQueryKey,
  getListRecoveryActionsQueryKey, getListRecoveryRulesQueryKey, getListServicesQueryKey,
  useAnalyzeIncident, useCreateApplication, useCreateRecoveryRule, useCreateService,
  useDeleteApplication, useDeleteRecoveryRule, useDeleteService, useGetApplication,
  useGetDashboardSummary, useGetIncident, useListApplications, useListIncidents,
  useListRecoveryActions, useListRecoveryRules, useListServices, useUpdateRecoveryRule,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { type ButtonHTMLAttributes, type FormEvent, type ReactNode } from 'react';
import { Router as WouterRouter } from 'wouter';
import './index.css';

const queryClient = new QueryClient();
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#176f65',
    colorForeground: '#19302f',
    colorMutedForeground: '#667774',
    colorDanger: '#b3423c',
    colorBackground: '#fffdf8',
    colorInput: '#fffdf8',
    colorInputForeground: '#19302f',
    colorNeutral: '#d9d1c1',
    fontFamily: 'Manrope, sans-serif',
    borderRadius: '0.6rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fffdf8] rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#19302f]',
    headerSubtitle: 'text-[#667774]',
    socialButtonsBlockButtonText: 'text-[#19302f]',
    formFieldLabel: 'text-[#19302f]',
    footerActionLink: 'text-[#176f65]',
    footerActionText: 'text-[#667774]',
    dividerText: 'text-[#667774]',
    identityPreviewEditButton: 'text-[#176f65]',
    formFieldSuccessText: 'text-[#176f65]',
    alertText: 'text-[#b3423c]',
    logoBox: 'h-10',
    logoImage: 'max-h-10',
    socialButtonsBlockButton: 'border-[#d9d1c1] bg-[#fffdf8]',
    formButtonPrimary: 'bg-[#176f65] text-[#fffdf8]',
    formFieldInput: 'border-[#d9d1c1] bg-[#fffdf8] text-[#19302f]',
    footerAction: 'bg-transparent',
    dividerLine: 'bg-[#d9d1c1]',
    alert: 'border-[#e7c3be] bg-[#fff3f1]',
    otpCodeFieldInput: 'border-[#d9d1c1] bg-[#fffdf8] text-[#19302f]',
    formFieldRow: 'text-[#19302f]',
    main: 'bg-[#fffdf8]',
  },
};

type IconType = typeof Activity;
const navGroups = [
  { label: 'Observe', items: [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/applications', label: 'Applications', icon: Network },
    { href: '/services', label: 'Services', icon: Server },
    { href: '/monitoring', label: 'Monitoring', icon: Activity },
  ] },
  { label: 'Respond', items: [
    { href: '/incidents', label: 'Incidents', icon: TriangleAlert },
    { href: '/recovery', label: 'Recovery actions', icon: Zap },
    { href: '/recovery/rules', label: 'Allowlist rules', icon: ShieldCheck },
  ] },
  { label: 'Understand', items: [
    { href: '/ai-insights', label: 'AI insights', icon: Sparkles },
    { href: '/settings', label: 'Settings', icon: Settings },
  ] },
];

function StatusPill({ status }: { status?: string | boolean }) {
  const value = typeof status === 'boolean' ? (status ? 'CONNECTED' : 'NOT CONNECTED') : (status || 'NO DATA');
  const tone = ['HEALTHY', 'SUCCESS', 'CONNECTED', 'AVAILABLE', 'RESOLVED'].includes(value) ? 'good' : ['DOWN', 'FAILED', 'CRITICAL', 'ESCALATED'].includes(value) ? 'bad' : ['DEGRADED', 'INVESTIGATING', 'RECOVERING', 'RUNNING'].includes(value) ? 'warn' : 'quiet';
  return <span className={`status-pill ${tone}`} data-testid={`status-${value.toLowerCase()}`}><i />{value.replaceAll('_', ' ')}</span>;
}

function Button({ children, variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'quiet' | 'outline' | 'danger' }) {
  return <button className={`btn btn-${variant} ${className}`} {...props}>{children}</button>;
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-label="Loading" />;
}

function EmptyState({ icon: Icon, title, body, action }: { icon: IconType; title: string; body: string; action?: ReactNode }) {
  return <div className="empty-state" data-testid={`empty-${title.toLowerCase().replaceAll(' ', '-')}`}>
    <div className="empty-icon"><Icon size={20} /></div><h3>{title}</h3><p>{body}</p>{action}
  </div>;
}

function Failure({ retry }: { retry?: () => void }) {
  return <div className="empty-state"><div className="empty-icon danger"><AlertCircle size={20} /></div><h3>We could not load this view</h3><p>The API returned an error. Your data has not been changed.</p>{retry && <Button variant="outline" onClick={retry}><RefreshCw size={15} /> Try again</Button>}</div>;
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function AppLogo({ light = false }: { light?: boolean }) {
  return <Link href="/" className={`brand ${light ? 'brand-light' : ''}`} data-testid="link-brand"><span className="brand-mark"><span /></span><span>auto<span>heal</span></span></Link>;
}

function Sidebar({ onClose }: { onClose?: () => void }) {
  const [location] = useLocation();
  return <aside className="sidebar">
    <div className="sidebar-top"><AppLogo light />{onClose && <button className="icon-btn close-mobile" onClick={onClose} data-testid="button-close-sidebar"><X size={19} /></button>}</div>
    <div className="console-label">CONTROL ROOM <span className="live-dot" /> LIVE</div>
    <nav>{navGroups.map(group => <div className="nav-group" key={group.label}><div className="nav-label">{group.label}</div>{group.items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={onClose} className={`nav-item ${location === href || (href !== '/dashboard' && location.startsWith(href)) ? 'active' : ''}`} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}><Icon size={17} /><span>{label}</span>{href === '/incidents' && <IncidentCount />}</Link>)}</div>)}</nav>
    <div className="sidebar-bottom"><div className="safety-note"><ShieldCheck size={16} /><div><strong>Safety boundary</strong><span>AI diagnoses. Rules recover.</span></div></div><Link href="/settings" className="user-chip" data-testid="link-user-settings"><span className="avatar">AE</span><span><b>Alex Engineer</b><small>Operator</small></span><MoreHorizontal size={16} /></Link></div>
  </aside>;
}

function IncidentCount() {
  const { data } = useListIncidents({ status: 'OPEN' }, { query: { queryKey: getListIncidentsQueryKey({ status: 'OPEN' }), staleTime: 30000 } });
  return data && data.length > 0 ? <span className="nav-count">{data.length}</span> : null;
}

function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <div className="app-shell min-h-[100dvh]"><div className={`mobile-overlay ${open ? 'show' : ''}`} onClick={() => setOpen(false)} /><div className={`sidebar-wrap ${open ? 'open' : ''}`}><Sidebar onClose={() => setOpen(false)} /></div><main className="main-area"><header className="topbar"><button className="icon-btn menu-btn" onClick={() => setOpen(true)} data-testid="button-open-sidebar"><Menu size={20} /></button><div className="crumb"><span>AutoHeal</span><ChevronRight size={14} /><strong>Reliability console</strong></div><div className="top-actions"><span className="connection"><i /> API connected</span><button className="icon-btn" aria-label="Help" data-testid="button-help"><CircleHelp size={18} /></button><span className="top-avatar">AE</span></div></header><div className="page-wrap">{children}</div></main></div>;
}

function PageHeader({ eyebrow, title, body, action }: { eyebrow: string; title: string; body?: string; action?: ReactNode }) {
  return <div className="page-header rise"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{body && <p>{body}</p>}</div>{action}</div>;
}

function MetricCard({ label, value, detail, icon: Icon, tone = '' }: { label: string; value: ReactNode; detail: string; icon: IconType; tone?: string }) {
  return <div className={`metric-card rise ${tone}`}><div className="metric-top"><span>{label}</span><Icon size={17} /></div><strong data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</strong><small>{detail}</small></div>;
}

function Dashboard() {
  const { data, isLoading, isError, refetch } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey(), refetchInterval: 60000 } });
  const connected = data?.monitoringConnected;
  return <><PageHeader eyebrow="OVERVIEW / 01" title="Production, with receipts." body="A quiet view of what is real, what is missing, and what needs a decision." action={<Button variant="outline" onClick={() => refetch()}><RefreshCw size={15} /> Refresh</Button>} />
    {isError ? <Failure retry={refetch} /> : isLoading ? <div className="metrics-grid">{[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}</div> : <><div className="metrics-grid">
      <MetricCard label="Applications" value={data?.totalApplications ?? '—'} detail="registered in AutoHeal" icon={Network} />
      <MetricCard label="Healthy services" value={data?.healthyServices ?? '—'} detail={data?.failedHealthChecks ? `${data.failedHealthChecks} failed checks` : 'no failed checks reported'} icon={Gauge} tone={data?.failedHealthChecks ? 'attention' : 'positive'} />
      <MetricCard label="Active incidents" value={data?.activeIncidents ?? '—'} detail="requiring operator attention" icon={TriangleAlert} tone={data?.activeIncidents ? 'attention' : ''} />
      <MetricCard label="Recovery actions" value={data?.recoveryActions ?? '—'} detail="recorded by deterministic rules" icon={Zap} />
    </div><div className="dashboard-grid rise-2"><div className="panel hero-status"><div className="panel-heading"><div><span className="eyebrow">SYSTEM SIGNAL</span><h2>Monitoring connection</h2></div><StatusPill status={connected} /></div><div className={`signal ${connected ? 'connected' : ''}`}><div className="signal-orbit"><span /><span /><span /></div><div><strong>{connected ? 'Receiving real health data' : 'Monitoring is not connected'}</strong><p>{data?.monitoringMessage || (connected ? 'Health checks are flowing into this console.' : 'Configure an integration before trusting any service status.')}</p></div></div><Link href="/monitoring" className="text-link" data-testid="link-configure-monitoring">{connected ? 'Review health-check coverage' : 'Configure monitoring'} <ArrowRight size={15} /></Link></div><div className="panel recent-panel"><div className="panel-heading"><div><span className="eyebrow">ACTIVITY</span><h2>Recent signal</h2></div><Link href="/incidents" className="text-link" data-testid="link-view-incidents">View incidents <ArrowRight size={15} /></Link></div><div className="timeline-mini"><div><span className="timeline-dot muted" /><p><b>{data?.recentDeployments ?? 0}</b> recent deployments reported</p><small>Deployment data is only shown when connected</small></div><div><span className="timeline-dot amber" /><p><b>{data?.activeIncidents ?? 0}</b> active incidents</p><small>Open the incident queue to investigate</small></div><div><span className="timeline-dot teal" /><p><b>{data?.recoveryActions ?? 0}</b> recovery actions recorded</p><small>Every action is allowlisted and auditable</small></div></div></div></div><div className="safety-banner"><ShieldCheck size={19} /><div><b>Designed for safe recovery</b><span>Gemini can explain an incident, but it cannot take action. Only enabled, allowlisted rules can trigger deterministic recovery.</span></div><Link href="/recovery/rules" className="text-link" data-testid="link-review-rules">Review rules <ArrowRight size={15} /></Link></div></>}</>;
}

function LegacyLanding() {
  return <div className="landing"><header className="landing-nav"><AppLogo /><div className="landing-links"><a href="#model" data-testid="link-safety-model">Safety model</a><a href="#how" data-testid="link-how-it-works">How it works</a><Link href="/login" className="nav-login" data-testid="link-sign-in">Sign in <ArrowRight size={15} /></Link></div></header><section className="landing-hero"><div className="hero-copy rise"><div className="kicker"><span /> RELIABILITY, WITHOUT THE GUESSWORK</div><h1>A calmer way to<br /><em>hold production.</em></h1><p>AutoHeal gives engineers one honest surface for service health, incident context, and safe, allowlisted recovery.</p><div className="hero-actions"><Link href="/register" className="btn btn-primary" data-testid="link-start-console">Start your console <ArrowRight size={16} /></Link><a href="#model" className="btn btn-quiet" data-testid="link-see-safety">See the safety model</a></div></div><div className="hero-console rise-2"><div className="console-window"><div className="window-bar"><span /><span /><span /><small>autoheal / overview</small><i>CONNECTED</i></div><div className="console-body"><div className="mini-title">Good evening, Alex <span>·</span> production overview</div><div className="mini-metrics"><div><small>HEALTHY SERVICES</small><b>24</b><i>+2 this week</i></div><div><small>ACTIVE INCIDENTS</small><b>02</b><i className="red">needs attention</i></div></div><div className="mini-chart"><div className="chart-line" /><div className="chart-labels"><span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span></div></div><div className="mini-row"><span className="fake-status" /> payments-api <small>healthy · 84ms</small></div><div className="mini-row warn"><span className="fake-status" /> queue-worker <small>degraded · 3 failures</small></div></div></div><div className="float-note"><ShieldCheck size={15} /><span><b>Safe by default</b><small>Rule allowlist verified</small></span></div></div></section><section id="model" className="landing-section model-section"><div className="section-lead"><div className="kicker">THE BOUNDARY IS THE PRODUCT</div><h2>Every signal has<br /><em>a provenance.</em></h2><p>No invented green dots. No ambiguous “connected-ish” state. AutoHeal is explicit about what it knows, what it does not, and what it needs from you.</p></div><div className="model-list"><div className="model-item"><span className="model-number">01</span><div><div className="model-icon teal"><Database size={18} /></div><h3>Real data</h3><p>Health, incidents, and recovery history come from your connected infrastructure.</p></div></div><div className="model-item"><span className="model-number">02</span><div><div className="model-icon amber"><CloudOff size={18} /></div><h3>Not connected</h3><p>We say so plainly. Configure an integration before relying on a status.</p></div></div><div className="model-item"><span className="model-number">03</span><div><div className="model-icon ink"><LockKeyhole size={18} /></div><h3>Deterministic action</h3><p>AI can diagnose. Only your allowlist can recover. Every mutation leaves a receipt.</p></div></div></div></section><section id="how" className="landing-section how-section"><div className="kicker">THE CONTROL ROOM</div><h2>Observe. Understand. <em>Respond.</em></h2><div className="how-grid"><div><span>01</span><h3>Register what matters</h3><p>Keep applications, service boundaries, and health-check expectations together.</p></div><div><span>02</span><h3>Investigate with context</h3><p>See the incident timeline, known evidence, and AI diagnosis in one place.</p></div><div><span>03</span><h3>Recover with guardrails</h3><p>Allowlisted rules decide what is safe to run. Not a language model.</p></div></div></section><footer className="landing-footer"><AppLogo /><span>Reliable systems deserve honest interfaces.</span><Link href="/login" className="text-link" data-testid="link-footer-login">Open console <ArrowRight size={15} /></Link></footer></div>;
}

function Landing() {
  return <div className="landing"><header className="landing-nav"><AppLogo /><div className="landing-links"><a href="#model" data-testid="link-safety-model">Safety model</a><a href="#how" data-testid="link-how-it-works">How it works</a><Link href="/sign-in" className="nav-login" data-testid="link-sign-in">Sign in <ArrowRight size={15} /></Link></div></header><section className="landing-hero"><div className="hero-copy rise"><div className="kicker"><span /> RELIABILITY, WITHOUT THE GUESSWORK</div><h1>A calmer way to<br /><em>hold production.</em></h1><p>AutoHeal gives engineers one honest surface for service health, incident context, and safe, allowlisted recovery.</p><div className="hero-actions"><Link href="/sign-up" className="btn btn-primary" data-testid="link-start-console">Start your console <ArrowRight size={16} /></Link><a href="#model" className="btn btn-quiet" data-testid="link-see-safety">See the safety model</a></div></div><div className="hero-console rise-2"><div className="console-window"><div className="window-bar"><span /><span /><span /><small>autoheal / overview</small><i>NOT CONNECTED</i></div><div className="console-body"><div className="mini-title">Your production overview <span>·</span> honest by default</div><div className="mini-metrics"><div><small>HEALTHY SERVICES</small><b>NO DATA</b><i>monitoring not connected</i></div><div><small>ACTIVE INCIDENTS</small><b>NO DATA</b><i className="red">nothing fabricated</i></div></div><div className="mini-chart empty-chart"><div className="chart-labels"><span>REGISTER</span><span>CONNECT</span><span>VERIFY</span></div><small>Connect infrastructure to see real health signal</small></div><div className="mini-row"><span className="fake-status empty" /> No services registered <small>configure a health check</small></div><div className="mini-row warn"><span className="fake-status empty" /> Recovery allowlist <small>review required</small></div></div></div><div className="float-note"><ShieldCheck size={15} /><span><b>Safe by default</b><small>AI diagnosis only</small></span></div></div></section><section id="model" className="landing-section model-section"><div className="section-lead"><div className="kicker">THE BOUNDARY IS THE PRODUCT</div><h2>Every signal has<br /><em>a provenance.</em></h2><p>No invented green dots. No ambiguous “connected-ish” state. AutoHeal is explicit about what it knows, what it does not, and what it needs from you.</p></div><div className="model-list"><div className="model-item"><span className="model-number">01</span><div><div className="model-icon teal"><Database size={18} /></div><h3>Real data</h3><p>Health, incidents, and recovery history come from your connected infrastructure.</p></div></div><div className="model-item"><span className="model-number">02</span><div><div className="model-icon amber"><CloudOff size={18} /></div><h3>Not connected</h3><p>We say so plainly. Configure an integration before relying on a status.</p></div></div><div className="model-item"><span className="model-number">03</span><div><div className="model-icon ink"><LockKeyhole size={18} /></div><h3>Deterministic action</h3><p>AI can diagnose. Only your allowlist can recover. Every mutation leaves a receipt.</p></div></div></div></section><section id="how" className="landing-section how-section"><div className="kicker">THE CONTROL ROOM</div><h2>Observe. Understand. <em>Respond.</em></h2><div className="how-grid"><div><span>01</span><h3>Register what matters</h3><p>Keep applications, service boundaries, and health-check expectations together.</p></div><div><span>02</span><h3>Investigate with context</h3><p>See the incident timeline, known evidence, and AI diagnosis in one place.</p></div><div><span>03</span><h3>Recover with guardrails</h3><p>Allowlisted rules decide what is safe to run. Not a language model.</p></div></div></section><footer className="landing-footer"><AppLogo /><span>Reliable systems deserve honest interfaces.</span><Link href="/sign-in" className="text-link" data-testid="link-footer-login">Open console <ArrowRight size={15} /></Link></footer></div>;
}

function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register';
  return <div className="auth-page"><div className="auth-aside"><AppLogo light /><div><div className="kicker">RELIABILITY CONSOLE</div><h1>Production deserves<br /><em>clear thinking.</em></h1><p>Health signals, incident context, and safe recovery — in one calm place.</p></div><div className="auth-quote"><ShieldCheck size={18} /><span>AI may explain. Your rules decide.</span></div></div><div className="auth-form-wrap"><Link href="/" className="back-link" data-testid="link-back-home"><ArrowRight size={15} /> Back to home</Link><div className="auth-form rise"><div className="eyebrow">{isRegister ? 'CREATE ACCOUNT' : 'WELCOME BACK'}</div><h2>{isRegister ? 'Start with a clear view.' : 'Back to the control room.'}</h2><p>{isRegister ? 'Create an operator account for your team.' : 'Sign in to continue to your reliability console.'}</p>{isRegister && <Field label="Full name"><input data-testid="input-name" placeholder="Alex Engineer" /></Field>}<Field label="Work email"><input data-testid="input-email" type="email" placeholder="you@company.com" /></Field><Field label="Password"><input data-testid="input-password" type="password" placeholder="At least 8 characters" /></Field>{!isRegister && <div className="auth-row"><label className="check"><input type="checkbox" /> <span>Remember me</span></label><button className="plain-link" data-testid="button-forgot-password">Forgot password?</button></div>}<Link href="/dashboard" className="btn btn-primary auth-submit" data-testid="button-submit-auth">{isRegister ? 'Create account' : 'Sign in'} <ArrowRight size={16} /></Link><p className="auth-switch">{isRegister ? 'Already have an account?' : 'New to AutoHeal?'} <Link href={isRegister ? '/login' : '/register'} data-testid="link-switch-auth">{isRegister ? 'Sign in' : 'Create an account'}</Link></p></div></div></div>;
}

function ClerkSignInPage() {
  return <div className="auth-page"><div className="auth-aside"><AppLogo light /><div><div className="kicker">RELIABILITY CONSOLE</div><h1>Production deserves<br /><em>clear thinking.</em></h1><p>Health signals, incident context, and safe recovery — in one calm place.</p></div><div className="auth-quote"><ShieldCheck size={18} /><span>AI may explain. Your rules decide.</span></div></div><div className="auth-form-wrap"><Link href="/" className="back-link" data-testid="link-back-home"><ArrowRight size={15} /> Back to home</Link><div className="clerk-auth-frame"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div></div></div>;
}

function ClerkSignUpPage() {
  return <div className="auth-page"><div className="auth-aside"><AppLogo light /><div><div className="kicker">RELIABILITY CONSOLE</div><h1>Start with<br /><em>clear signals.</em></h1><p>Create an operator account for a safer, more accountable reliability workflow.</p></div><div className="auth-quote"><ShieldCheck size={18} /><span>AI may explain. Your rules decide.</span></div></div><div className="auth-form-wrap"><Link href="/" className="back-link" data-testid="link-back-home"><ArrowRight size={15} /> Back to home</Link><div className="clerk-auth-frame"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div></div></div>;
}

function ProtectedPage({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <div className="auth-loading"><Loader2 className="spin" size={20} /> Loading secure session…</div>;
  if (!isSignedIn) return <RedirectToSignIn />;
  return <Shell>{children}</Shell>;
}

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <div className="auth-loading"><Loader2 className="spin" size={20} /> Loading secure session…</div>;
  return isSignedIn ? <Redirect to="/dashboard" /> : <Landing />;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (previousUserId.current !== undefined && previousUserId.current !== userId) qc.clear();
      previousUserId.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);
  return null;
}

function Applications() {
  const qc = useQueryClient(); const { data, isLoading, isError, refetch } = useListApplications({ query: { queryKey: getListApplicationsQueryKey() } });
  const create = useCreateApplication(); const del = useDeleteApplication(); const [open, setOpen] = useState(false); const [search, setSearch] = useState('');
  const apps = (data || []).filter(a => `${a.name} ${a.description}`.toLowerCase().includes(search.toLowerCase()));
  const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); create.mutate({ data: { name: String(f.get('name')), description: String(f.get('description') || ''), environment: String(f.get('environment')) as 'development' | 'staging' | 'production', baseUrl: String(f.get('baseUrl')) } }, { onSuccess: () => { setOpen(false); qc.invalidateQueries({ queryKey: getListApplicationsQueryKey() }); } }); };
  return <><PageHeader eyebrow="OBSERVE / APPLICATIONS" title="Applications" body="The systems you are responsible for, registered by environment." action={<Button onClick={() => setOpen(true)} data-testid="button-add-application"><Plus size={16} /> Add application</Button>} /><div className="toolbar"><div className="search-box"><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search applications" data-testid="input-search-applications" /></div><button className="filter-button" data-testid="button-filter-applications"><ListFilter size={15} /> All environments</button></div>{isError ? <Failure retry={refetch} /> : isLoading ? <div className="list-stack">{[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}</div> : apps.length === 0 ? <EmptyState icon={Network} title={search ? 'No matching applications' : 'No applications yet'} body={search ? 'Try a different search term.' : 'Register your first application to begin mapping service health.'} action={!search && <Button onClick={() => setOpen(true)}><Plus size={15} /> Add application</Button>} /> : <div className="list-stack">{apps.map(app => <div className="list-row" key={app.id} data-testid={`row-application-${app.id}`}><div className="row-main"><div className="app-glyph">{app.name.slice(0, 1).toUpperCase()}</div><div><Link href={`/applications/${app.id}`} className="row-title" data-testid={`link-application-${app.id}`}>{app.name}<ArrowRight size={14} /></Link><p>{app.description || 'No description provided'}</p></div></div><div className="row-meta"><span className="env">{app.environment}</span><StatusPill status={app.status} /><button className="icon-btn danger-hover" onClick={() => { if (confirm(`Delete ${app.name}?`)) del.mutate({ id: app.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListApplicationsQueryKey() }) }); }} data-testid={`button-delete-application-${app.id}`}><Trash2 size={16} /></button></div></div>)}</div>}{open && <Modal title="Register application" onClose={() => setOpen(false)}><form onSubmit={submit} className="form-grid"><Field label="Name"><input name="name" required placeholder="Payments platform" data-testid="input-application-name" /></Field><Field label="Environment"><select name="environment" defaultValue="production" data-testid="select-application-environment"><option value="production">Production</option><option value="staging">Staging</option><option value="development">Development</option></select></Field><Field label="Base URL"><input name="baseUrl" required type="url" placeholder="https://api.example.com" data-testid="input-application-url" /></Field><Field label="Description"><textarea name="description" rows={3} placeholder="What does this system do?" data-testid="input-application-description" /></Field><div className="modal-actions"><Button type="button" variant="quiet" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={create.isPending}>{create.isPending && <Loader2 className="spin" size={15} />} Register application</Button></div></form></Modal>}</>;
}

function ApplicationDetail() {
  const { id } = useParams<{ id: string }>(); const appId = Number(id); const { data: app, isLoading, isError } = useGetApplication(appId, { query: { queryKey: getGetApplicationQueryKey(appId) } }); const { data: services } = useListServices({ applicationId: appId }, { query: { queryKey: getListServicesQueryKey({ applicationId: appId }) } }); const { data: incidents } = useListIncidents();
  if (isLoading) return <><PageHeader eyebrow="APPLICATION" title="Loading application…" /><Skeleton className="h-48" /></>; if (isError || !app) return <Failure />;
  const appIncidents = incidents?.filter(i => i.applicationId === appId) || [];
  return <><Link href="/applications" className="back-link page-back" data-testid="link-back-applications"><ArrowRight size={15} /> Applications</Link><PageHeader eyebrow={`APPLICATION / ${app.environment.toUpperCase()}`} title={app.name} body={app.description || 'No description provided'} action={<StatusPill status={app.status} />} /><div className="detail-grid"><div className="panel"><div className="panel-heading"><div><span className="eyebrow">REGISTERED SERVICES</span><h2>Service surface</h2></div><Link href="/services" className="text-link" data-testid="link-manage-services">Manage <ArrowRight size={15} /></Link></div>{!services?.length ? <EmptyState icon={Server} title="No services registered" body="Add a service to start checking this application." action={<Link href="/services" className="btn btn-outline" data-testid="link-add-service-detail"><Plus size={15} /> Register service</Link>} /> : <div className="compact-list">{services.map(s => <div className="compact-row" key={s.id}><span className="service-mark"><Activity size={15} /></span><span><b>{s.name}</b><small>{s.type} · {s.endpoint}</small></span><StatusPill status={s.status} /><span className="mono response">{s.responseTime ? `${s.responseTime}ms` : '—'}</span></div>)}</div>}</div><div className="panel"><div className="panel-heading"><div><span className="eyebrow">INCIDENT CONTEXT</span><h2>Related incidents</h2></div><Link href="/incidents" className="text-link" data-testid="link-detail-incidents">View all <ArrowRight size={15} /></Link></div>{!appIncidents.length ? <EmptyState icon={TriangleAlert} title="No incidents for this app" body="That is good news. If something changes, it will appear here." /> : <div className="compact-list">{appIncidents.slice(0, 5).map(i => <Link href={`/incidents/${i.id}`} className="compact-row" key={i.id} data-testid={`link-detail-incident-${i.id}`}><span className="incident-mark"><TriangleAlert size={15} /></span><span><b>{i.type}</b><small>{i.description}</small></span><StatusPill status={i.severity} /><ChevronRight size={15} /></Link>)}</div>}</div></div></>;
}

function Services() {
  const qc = useQueryClient(); const { data: services, isLoading, isError, refetch } = useListServices(undefined, { query: { queryKey: getListServicesQueryKey() } }); const { data: apps } = useListApplications(); const create = useCreateService(); const del = useDeleteService(); const [open, setOpen] = useState(false); const [search, setSearch] = useState('');
  const list = (services || []).filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
  const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); create.mutate({ data: { applicationId: Number(f.get('applicationId')), name: String(f.get('name')), type: String(f.get('type')), endpoint: String(f.get('endpoint')), healthEndpoint: String(f.get('healthEndpoint')), expectedStatus: Number(f.get('expectedStatus')), timeout: Number(f.get('timeout')), interval: Number(f.get('interval')) } }, { onSuccess: () => { setOpen(false); qc.invalidateQueries({ queryKey: getListServicesQueryKey() }); } }); };
  return <><PageHeader eyebrow="OBSERVE / SERVICES" title="Services" body="Health-check configuration and the last known signal for every service." action={<Button onClick={() => setOpen(true)} data-testid="button-add-service"><Plus size={16} /> Register service</Button>} /><div className="toolbar"><div className="search-box"><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search services" data-testid="input-search-services" /></div><span className="toolbar-note"><ShieldCheck size={15} /> Status is only real when monitoring is connected</span></div>{isError ? <Failure retry={refetch} /> : isLoading ? <Skeleton className="h-72" /> : !list.length ? <EmptyState icon={Server} title="No services registered" body="Register a service and define exactly what healthy means." action={<Button onClick={() => setOpen(true)}><Plus size={15} /> Register service</Button>} /> : <div className="table-card"><div className="table-head"><span>SERVICE</span><span>APPLICATION</span><span>HEALTH CHECK</span><span>LAST SIGNAL</span><span>STATUS</span><span /></div>{list.map(s => <div className="table-row" key={s.id} data-testid={`row-service-${s.id}`}><div className="service-cell"><span className="service-mark"><Activity size={14} /></span><span><b>{s.name}</b><small>{s.type}</small></span></div><span>{apps?.find(a => a.id === s.applicationId)?.name || `Application #${s.applicationId}`}</span><span className="mono">{s.healthEndpoint}<small>every {s.interval}s · {s.timeout}ms timeout</small></span><span className="mono">{s.responseTime ? `${s.responseTime}ms` : 'No data'}<small>{s.lastCheckedAt ? new Date(s.lastCheckedAt).toLocaleString() : 'Not connected'}</small></span><StatusPill status={s.status} /><button className="icon-btn danger-hover" onClick={() => { if (confirm(`Delete ${s.name}?`)) del.mutate({ id: s.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListServicesQueryKey() }) }); }} data-testid={`button-delete-service-${s.id}`}><Trash2 size={16} /></button></div>)}</div>}{open && <Modal title="Register service" onClose={() => setOpen(false)}><form onSubmit={submit} className="form-grid"><Field label="Application"><select name="applicationId" required data-testid="select-service-application"><option value="">Select application</option>{apps?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field><Field label="Service name"><input name="name" required placeholder="payments-api" data-testid="input-service-name" /></Field><Field label="Type"><input name="type" required placeholder="HTTP API" data-testid="input-service-type" /></Field><Field label="Endpoint"><input name="endpoint" required type="url" placeholder="https://api.example.com/payments" data-testid="input-service-endpoint" /></Field><Field label="Health endpoint"><input name="healthEndpoint" required type="url" placeholder="https://api.example.com/health" data-testid="input-service-health-endpoint" /></Field><div className="form-split"><Field label="Expected status"><input name="expectedStatus" type="number" defaultValue="200" data-testid="input-service-expected-status" /></Field><Field label="Timeout (ms)"><input name="timeout" type="number" defaultValue="5000" data-testid="input-service-timeout" /></Field><Field label="Interval (sec)"><input name="interval" type="number" defaultValue="60" data-testid="input-service-interval" /></Field></div><div className="modal-actions"><Button type="button" variant="quiet" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={create.isPending}>{create.isPending && <Loader2 className="spin" size={15} />} Register service</Button></div></form></Modal>}</>;
}

function Monitoring() {
  const { data: health, isLoading, refetch } = useGetDashboardSummary(); const { data: services } = useListServices(); const connected = !!health?.monitoringConnected;
  return <><PageHeader eyebrow="OBSERVE / MONITORING" title="Monitoring" body="Know whether your health signals are connected before you act." action={<Button variant="outline" onClick={() => refetch()}><RefreshCw size={15} /> Test connection</Button>} /><div className={`connection-card ${connected ? 'connected' : ''}`}><div className="connection-badge"><span className="connection-pulse" /><StatusPill status={connected} /></div><h2>{isLoading ? 'Checking connection…' : connected ? 'Monitoring is connected' : 'Monitoring is not connected'}</h2><p>{health?.monitoringMessage || 'No provider connection has been configured. Service states will remain explicit until one is available.'}</p>{!connected && <Button onClick={() => alert('Configure a monitoring provider in Settings when an integration is available.')} data-testid="button-configure-monitoring"><Settings size={15} /> Configure integration</Button>}</div><div className="panel"><div className="panel-heading"><div><span className="eyebrow">COVERAGE</span><h2>Health-check overview</h2></div><span className="mono">{services?.length ?? 0} services</span></div>{!services?.length ? <EmptyState icon={Activity} title="No health checks yet" body="Register services to see their health-check configuration here." /> : <div className="coverage-list">{services.map(s => <div className="coverage-row" key={s.id}><span className={`coverage-bar ${s.status === 'HEALTHY' ? 'good' : s.status === 'NOT_CONNECTED' ? 'empty' : 'warn'}`} /><div><b>{s.name}</b><small>{s.healthEndpoint}</small></div><span className="mono">{s.responseTime ? `${s.responseTime}ms` : 'No data'}</span><StatusPill status={s.status} /></div>)}</div>}</div></>;
}

function Incidents() {
  const [status, setStatus] = useState<string>(''); const params = status ? { status: status as any } : undefined; const { data, isLoading, isError, refetch } = useListIncidents(params, { query: { queryKey: getListIncidentsQueryKey(params) } }); const { data: apps } = useListApplications(); const [search, setSearch] = useState('');
  const incidents = (data || []).filter(i => `${i.type} ${i.description}`.toLowerCase().includes(search.toLowerCase()));
  return <><PageHeader eyebrow="RESPOND / INCIDENTS" title="Incidents" body="An honest queue for production events — from first signal to resolution." action={<Button variant="outline" onClick={() => refetch()}><RefreshCw size={15} /> Refresh</Button>} /><div className="toolbar"><div className="search-box"><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search incidents" data-testid="input-search-incidents" /></div><select className="filter-button" value={status} onChange={e => setStatus(e.target.value)} data-testid="select-filter-incidents"><option value="">All statuses</option>{['OPEN','INVESTIGATING','RECOVERING','RESOLVED','ESCALATED'].map(s => <option key={s} value={s}>{s}</option>)}</select></div>{isError ? <Failure retry={refetch} /> : isLoading ? <div className="list-stack">{[1,2,3].map(i => <Skeleton key={i} className="h-28" />)}</div> : !incidents.length ? <EmptyState icon={TriangleAlert} title={status ? 'No incidents in this state' : 'No incident data'} body={status ? 'Try another status filter.' : 'Incidents will appear when connected monitoring detects a failure.'} /> : <div className="list-stack">{incidents.map(i => <Link href={`/incidents/${i.id}`} className="incident-row" key={i.id} data-testid={`row-incident-${i.id}`}><div className={`severity-bar ${i.severity.toLowerCase()}`} /><div className="incident-content"><div className="incident-top"><span className="eyebrow">{i.type}</span><StatusPill status={i.severity} /></div><h3>{i.description}</h3><p>{apps?.find(a => a.id === i.applicationId)?.name || `Application #${i.applicationId}`} · {i.failureCount} failures · detected {new Date(i.detectedAt).toLocaleString()}</p></div><div className="incident-end"><StatusPill status={i.status} /><ChevronRight size={16} /></div></Link>)}</div>}</>;
}

function IncidentDetail() {
  const { id } = useParams<{ id: string }>(); const incidentId = Number(id); const { data: incident, isLoading, isError, refetch } = useGetIncident(incidentId, { query: { queryKey: getGetIncidentQueryKey(incidentId) } }); const analyze = useAnalyzeIncident(); const [analyzing, setAnalyzing] = useState(false);
  if (isLoading) return <><PageHeader eyebrow="INCIDENT" title="Loading incident…" /><Skeleton className="h-64" /></>; if (isError || !incident) return <Failure retry={refetch} />;
  const insight = incident.aiInsight;
  return <><Link href="/incidents" className="back-link page-back" data-testid="link-back-incidents"><ArrowRight size={15} /> Incidents</Link><PageHeader eyebrow={`INCIDENT / ${incident.severity}`} title={incident.description} body={`${incident.type} · detected ${new Date(incident.detectedAt).toLocaleString()}`} action={<StatusPill status={incident.status} />} /><div className="incident-layout"><div className="panel timeline-panel"><div className="panel-heading"><div><span className="eyebrow">EVENT TIMELINE</span><h2>What happened</h2></div><span className="mono">{incident.failureCount} failures</span></div>{incident.timeline?.length ? <div className="event-timeline">{incident.timeline.map((event, idx) => <div className="event" key={event.id || idx}><span className={`event-marker ${idx === 0 ? 'first' : ''}`} /><div><div><b>{event.eventType}</b><small>{new Date(event.timestamp).toLocaleString()}</small></div><p>{event.message}</p></div></div>)}</div> : <EmptyState icon={Activity} title="No timeline data" body="This incident has no recorded events yet." />}</div><div className="insight-column"><div className={`panel insight-panel ${insight ? 'has-insight' : ''}`}><div className="panel-heading"><div><span className="eyebrow">AI INSIGHT</span><h2>Diagnosis</h2></div><Sparkles size={18} /></div>{insight?.status === 'AVAILABLE' ? <><div className="insight-status"><StatusPill status="AVAILABLE" />{insight.confidence !== null && <span className="mono">{Math.round(insight.confidence * 100)}% confidence</span>}</div><h3>{insight.diagnosis}</h3><div className="insight-block"><small>ROOT CAUSE</small><p>{insight.rootCause}</p></div><div className="insight-block"><small>EVIDENCE</small>{insight.evidence?.map((e, i) => <p key={i} className="evidence"><Check size={14} /> {e}</p>)}</div></> : <EmptyState icon={Sparkles} title={insight?.status === 'NOT_CONNECTED' ? 'AI is not connected' : 'No insight available'} body={insight?.status === 'NOT_CONNECTED' ? 'Configure the Gemini integration to generate diagnosis-only context.' : 'There is not enough incident data to produce an insight yet.'} action={!insight || insight.status === 'NO_DATA' ? <Button onClick={() => { setAnalyzing(true); analyze.mutate({ id: incidentId }, { onSettled: () => setAnalyzing(false), onSuccess: () => refetch() }); }} disabled={analyzing} data-testid="button-analyze-incident">{analyzing ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />} Analyze incident</Button> : undefined} />}</div><div className="safety-card"><ShieldCheck size={18} /><div><b>Diagnosis only</b><p>Gemini never executes recovery. Any action must pass an enabled allowlist rule.</p></div></div></div></div></>;
}

function RecoveryActions() {
  const { data, isLoading, isError, refetch } = useListRecoveryActions({ query: { queryKey: getListRecoveryActionsQueryKey() } }); const { data: incidents } = useListIncidents();
  return <><PageHeader eyebrow="RESPOND / RECOVERY" title="Recovery actions" body="A complete receipt of deterministic actions taken by enabled rules." action={<Button variant="outline" onClick={() => refetch()}><RefreshCw size={15} /> Refresh</Button>} /><div className="safety-banner"><ShieldCheck size={19} /><div><b>Allowlist only</b><span>Actions are never suggested or executed by AI. If it is not in an enabled rule, it cannot run.</span></div><Link href="/recovery/rules" className="text-link" data-testid="link-recovery-rules-banner">Manage allowlist <ArrowRight size={15} /></Link></div>{isError ? <Failure retry={refetch} /> : isLoading ? <Skeleton className="h-64" /> : !data?.length ? <EmptyState icon={Zap} title="No recovery actions" body="Actions will be recorded here when an enabled rule safely responds to an incident." action={<Link href="/recovery/rules" className="btn btn-outline" data-testid="link-create-recovery-rule"><ShieldCheck size={15} /> Review rules</Link>} /> : <div className="table-card"><div className="table-head"><span>ACTION</span><span>INCIDENT</span><span>STARTED</span><span>COMPLETED</span><span>STATUS</span><span>RESULT</span></div>{data.map(a => <div className="table-row" key={a.id} data-testid={`row-recovery-action-${a.id}`}><b className="mono">{a.actionType}</b><span>{a.incidentId ? `Incident #${a.incidentId}` : 'No incident linked'}</span><span className="mono">{new Date(a.startedAt).toLocaleString()}</span><span className="mono">{a.completedAt ? new Date(a.completedAt).toLocaleString() : '—'}</span><StatusPill status={a.status} /><span>{a.result || 'No result provided'}</span></div>)}</div>}</>;
}

function LegacyRecoveryRules() {
  const qc = useQueryClient(); const { data, isLoading, isError, refetch } = useListRecoveryRules({ query: { queryKey: getListRecoveryRulesQueryKey() } }); const create = useCreateRecoveryRule(); const update = useUpdateRecoveryRule(); const del = useDeleteRecoveryRule(); const [open, setOpen] = useState(false); const [editing, setEditing] = useState<any>(null);
  const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); const body: any = { name: String(f.get('name')), triggerType: String(f.get('triggerType')), threshold: Number(f.get('threshold')), actionType: String(f.get('actionType')), enabled: f.get('enabled') === 'on', cooldownSeconds: Number(f.get('cooldownSeconds')), maxAttempts: Number(f.get('maxAttempts')) }; const done = () => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: getListRecoveryRulesQueryKey() }); }; editing ? update.mutate({ id: editing.id, data: body }, { onSuccess: done }) : create.mutate({ data: body }, { onSuccess: done }); };
  return <><PageHeader eyebrow="RESPOND / ALLOWLIST" title="Recovery rules" body="The only actions AutoHeal is permitted to run. Keep this list small, explicit, and reviewed." action={<Button onClick={() => setOpen(true)} data-testid="button-add-recovery-rule"><Plus size={16} /> Add rule</Button>} /><div className="rule-callout"><ShieldCheck size={19} /><div><b>This is the safety boundary.</b><span>Rules are deterministic. Gemini has no access to this control plane.</span></div></div>{isError ? <Failure retry={refetch} /> : isLoading ? <Skeleton className="h-64" /> : !data?.length ? <EmptyState icon={ShieldCheck} title="No rules configured" body="Nothing can run automatically until your team explicitly allowlists a recovery action." action={<Button onClick={() => setOpen(true)}><Plus size={15} /> Add first rule</Button>} /> : <div className="rules-list">{data.map(rule => <div className={`rule-row ${rule.enabled ? '' : 'disabled'}`} key={rule.id} data-testid={`row-recovery-rule-${rule.id}`}><div className="rule-icon"><ShieldCheck size={17} /></div><div className="rule-info"><div><h3>{rule.name}</h3><StatusPill status={rule.enabled ? 'ENABLED' : 'DISABLED'} /></div><p>When <b>{rule.triggerType.replaceAll('_', ' ').toLowerCase()}</b> reaches <b>{rule.threshold}</b>, <b>{rule.actionType.replaceAll('_', ' ').toLowerCase()}</b>.</p><small>Cooldown {rule.cooldownSeconds}s · max {rule.maxAttempts} attempts</small></div><div className="rule-actions"><button className="icon-btn" onClick={() => { setEditing(rule); setOpen(true); }} data-testid={`button-edit-recovery-rule-${rule.id}`}><SlidersHorizontal size={16} /></button><button className="icon-btn danger-hover" onClick={() => { if (confirm(`Delete ${rule.name}?`)) del.mutate({ id: rule.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListRecoveryRulesQueryKey() }) }); }} data-testid={`button-delete-recovery-rule-${rule.id}`}><Trash2 size={16} /></button></div></div>)}</div>}{open && <Modal title={editing ? 'Edit recovery rule' : 'Add recovery rule'} onClose={() => { setOpen(false); setEditing(null); }}><form onSubmit={submit} className="form-grid"><Field label="Rule name"><input name="name" required defaultValue={editing?.name || ''} placeholder="Restart after repeated failures" data-testid="input-rule-name" /></Field><div className="form-split"><Field label="Trigger"><select name="triggerType" defaultValue={editing?.triggerType || 'CONSECUTIVE_FAILURES'}><option value="CONSECUTIVE_FAILURES">Consecutive failures</option><option value="HTTP_5XX">HTTP 5xx</option><option value="SERVICE_UNHEALTHY">Service unhealthy</option></select></Field><Field label="Threshold"><input name="threshold" type="number" min="1" defaultValue={editing?.threshold || 3} /></Field></div><Field label="Action"><select name="actionType" defaultValue={editing?.actionType || 'RETRY_HEALTH_CHECK'}><option value="RETRY_HEALTH_CHECK">Retry health check</option><option value="RESTART_CONTAINER">Restart container</option><option value="START_CONTAINER">Start container</option></select></Field><div className="form-split"><Field label="Cooldown (seconds)"><input name="cooldownSeconds" type="number" min="0" defaultValue={editing?.cooldownSeconds || 300} /></Field><Field label="Max attempts"><input name="maxAttempts" type="number" min="1" defaultValue={editing?.maxAttempts || 1} /></Field></div><label className="check"><input type="checkbox" name="enabled" defaultChecked={editing ? editing.enabled : true} /> <span>Enable this rule immediately</span></label><div className="modal-actions"><Button type="button" variant="quiet" onClick={() => { setOpen(false); setEditing(null); }}>Cancel</Button><Button type="submit" disabled={create.isPending || update.isPending}>{(create.isPending || update.isPending) && <Loader2 className="spin" size={15} />} Save rule</Button></div></form></Modal>}</>;
}

function RecoveryRules() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useListRecoveryRules({ query: { queryKey: getListRecoveryRulesQueryKey() } });
  const create = useCreateRecoveryRule();
  const update = useUpdateRecoveryRule();
  const del = useDeleteRecoveryRule();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const close = () => { setOpen(false); setEditing(null); };
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      name: String(f.get('name')),
      triggerType: String(f.get('triggerType')) as 'CONSECUTIVE_FAILURES' | 'HTTP_5XX' | 'SERVICE_UNHEALTHY',
      threshold: Number(f.get('threshold')),
      actionType: String(f.get('actionType')) as 'RESTART_CONTAINER' | 'START_CONTAINER' | 'RETRY_HEALTH_CHECK',
      target: String(f.get('target') || '').trim() || undefined,
      enabled: f.get('enabled') === 'on',
      cooldownSeconds: Number(f.get('cooldownSeconds')),
      maxAttempts: Number(f.get('maxAttempts')),
    };
    const done = () => { close(); qc.invalidateQueries({ queryKey: getListRecoveryRulesQueryKey() }); };
    if (editing) update.mutate({ id: editing.id, data: body }, { onSuccess: done });
    else create.mutate({ data: body }, { onSuccess: done });
  };

  return <><PageHeader eyebrow="RESPOND / ALLOWLIST" title="Recovery rules" body="The only actions AutoHeal is permitted to run. Keep this list small, explicit, and reviewed." action={<Button onClick={() => setOpen(true)} data-testid="button-add-recovery-rule"><Plus size={16} /> Add rule</Button>} /><div className="rule-callout"><ShieldCheck size={19} /><div><b>This is the safety boundary.</b><span>Rules are deterministic. Gemini has no access to this control plane.</span></div></div>{isError ? <Failure retry={refetch} /> : isLoading ? <Skeleton className="h-64" /> : !data?.length ? <EmptyState icon={ShieldCheck} title="No rules configured" body="Nothing can run automatically until your team explicitly allowlists a recovery action." action={<Button onClick={() => setOpen(true)}><Plus size={15} /> Add first rule</Button>} /> : <div className="rules-list">{data.map(rule => <div className={`rule-row ${rule.enabled ? '' : 'disabled'}`} key={rule.id} data-testid={`row-recovery-rule-${rule.id}`}><div className="rule-icon"><ShieldCheck size={17} /></div><div className="rule-info"><div><h3>{rule.name}</h3><StatusPill status={rule.enabled ? 'ENABLED' : 'DISABLED'} /></div><p>When <b>{rule.triggerType.replaceAll('_', ' ').toLowerCase()}</b> reaches <b>{rule.threshold}</b>, <b>{rule.actionType.replaceAll('_', ' ').toLowerCase()}</b>.</p><small>{rule.target ? `Target ${rule.target} · ` : ''}Cooldown {rule.cooldownSeconds}s · max {rule.maxAttempts} attempts</small></div><div className="rule-actions"><button className="icon-btn" onClick={() => { setEditing(rule); setOpen(true); }} data-testid={`button-edit-recovery-rule-${rule.id}`}><SlidersHorizontal size={16} /></button><button className="icon-btn danger-hover" onClick={() => { if (confirm(`Delete ${rule.name}?`)) del.mutate({ id: rule.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListRecoveryRulesQueryKey() }) }); }} data-testid={`button-delete-recovery-rule-${rule.id}`}><Trash2 size={16} /></button></div></div>)}</div>}{open && <Modal title={editing ? 'Edit recovery rule' : 'Add recovery rule'} onClose={close}><form onSubmit={submit} className="form-grid"><Field label="Rule name"><input name="name" required defaultValue={editing?.name || ''} placeholder="Restart after repeated failures" data-testid="input-rule-name" /></Field><div className="form-split"><Field label="Trigger"><select name="triggerType" defaultValue={editing?.triggerType || 'CONSECUTIVE_FAILURES'}><option value="CONSECUTIVE_FAILURES">Consecutive failures</option><option value="HTTP_5XX">HTTP 5xx</option><option value="SERVICE_UNHEALTHY">Service unhealthy</option></select></Field><Field label="Threshold"><input name="threshold" type="number" min="1" defaultValue={editing?.threshold || 3} /></Field></div><Field label="Action"><select name="actionType" defaultValue={editing?.actionType || 'RETRY_HEALTH_CHECK'}><option value="RETRY_HEALTH_CHECK">Retry health check</option><option value="RESTART_CONTAINER">Restart container</option><option value="START_CONTAINER">Start container</option></select></Field><Field label="Docker container target" hint="Required for start/restart actions; use an existing container name or ID."><input name="target" defaultValue={editing?.target || ''} placeholder="api-container" data-testid="input-rule-target" /></Field><div className="form-split"><Field label="Cooldown (seconds)"><input name="cooldownSeconds" type="number" min="0" defaultValue={editing?.cooldownSeconds ?? 300} /></Field><Field label="Max attempts"><input name="maxAttempts" type="number" min="1" defaultValue={editing?.maxAttempts ?? 1} /></Field></div><label className="check"><input type="checkbox" name="enabled" defaultChecked={editing ? editing.enabled : true} /> <span>Enable this rule immediately</span></label><div className="modal-actions"><Button type="button" variant="quiet" onClick={close}>Cancel</Button><Button type="submit" disabled={create.isPending || update.isPending}>{(create.isPending || update.isPending) && <Loader2 className="spin" size={15} />} Save rule</Button></div></form></Modal>}</>;
}

function AIInsights() {
  const { data: incidents, isLoading } = useListIncidents(); const available = incidents?.filter(i => i.status !== 'OPEN').length || 0;
  return <><PageHeader eyebrow="UNDERSTAND / AI" title="AI insights" body="Diagnosis-only context for incidents with enough evidence to investigate." /><div className="ai-hero"><div className="ai-symbol"><Sparkles size={24} /></div><div><span className="eyebrow">GEMINI / DIAGNOSIS ONLY</span><h2>Useful context, never autonomous action.</h2><p>AutoHeal can ask Gemini to summarize evidence and suggest prevention. It cannot execute a recovery, change a rule, or create a green status.</p></div><StatusPill status="NOT CONNECTED" /></div><div className="ai-grid"><div className="panel"><div className="panel-heading"><div><span className="eyebrow">AVAILABILITY</span><h2>Insight coverage</h2></div><Sparkles size={18} /></div>{isLoading ? <Skeleton className="h-24" /> : <><div className="big-number">{available}<small> incidents with investigation context</small></div><p className="muted-copy">AI insight availability depends on a connected Gemini integration and useful incident data. Nothing is fabricated when either is absent.</p><Link href="/settings" className="text-link" data-testid="link-configure-ai">Configure AI integration <ArrowRight size={15} /></Link></>}</div><div className="panel"><div className="panel-heading"><div><span className="eyebrow">PRINCIPLES</span><h2>How to read an insight</h2></div></div><div className="principle-list"><div><Check size={15} /><span><b>Evidence first</b><small>Every diagnosis is grounded in incident context.</small></span></div><div><Check size={15} /><span><b>Confidence is explicit</b><small>Uncertainty is shown, not smoothed away.</small></span></div><div><LockKeyhole size={15} /><span><b>Action is separate</b><small>Recovery remains inside the allowlist.</small></span></div></div></div></div></>;
}

function SettingsPage() {
  return <><PageHeader eyebrow="GOVERN / SETTINGS" title="Settings" body="Configure the boundaries around your reliability console." /><div className="settings-grid"><div className="settings-nav"><button className="settings-tab active" data-testid="button-settings-profile"><span className="avatar">AE</span><span><b>Profile</b><small>Your operator identity</small></span></button><button className="settings-tab" data-testid="button-settings-monitoring"><Activity size={17} /><span><b>Monitoring</b><small>Provider connections</small></span></button><button className="settings-tab" data-testid="button-settings-recovery"><ShieldCheck size={17} /><span><b>Recovery</b><small>Safety boundaries</small></span></button><button className="settings-tab" data-testid="button-settings-ai"><Sparkles size={17} /><span><b>AI integration</b><small>Diagnosis settings</small></span></button></div><div className="settings-content"><div className="panel"><span className="eyebrow">PROFILE</span><h2>Operator profile</h2><p className="panel-intro">This identity appears in the audit trail and action receipts.</p><div className="form-grid"><Field label="Display name"><input defaultValue="Alex Engineer" data-testid="input-profile-name" /></Field><Field label="Work email"><input defaultValue="alex@company.com" type="email" data-testid="input-profile-email" /></Field><div><Button onClick={() => alert('Profile settings saved.')} data-testid="button-save-profile"><Check size={15} /> Save profile</Button></div></div></div><div className="panel"><span className="eyebrow">INTEGRATIONS</span><h2>Connection status</h2><div className="integration-row"><div className="integration-icon"><Activity size={18} /></div><div><b>Monitoring provider</b><small>Health data source</small></div><StatusPill status="NOT CONNECTED" /><Button variant="outline" onClick={() => alert('Monitoring configuration is ready for your provider credentials.')} data-testid="button-settings-monitoring-config">Configure</Button></div><div className="integration-row"><div className="integration-icon ai"><Sparkles size={18} /></div><div><b>Gemini</b><small>Diagnosis-only analysis</small></div><StatusPill status="NOT CONNECTED" /><Button variant="outline" onClick={() => alert('Gemini configuration is ready for your API key.')} data-testid="button-settings-ai-config">Configure</Button></div></div></div></div></>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal"><div className="modal-head"><div><span className="eyebrow">CONFIGURATION</span><h2>{title}</h2></div><button className="icon-btn" onClick={onClose} data-testid="button-close-modal"><X size={18} /></button></div>{children}</div></div>;
}

function NotFound() {
  return <div className="not-found"><AppLogo /><div className="eyebrow">404 / SIGNAL LOST</div><h1>This route is not registered.</h1><p>The console could not find the page you requested.</p><Link href="/dashboard" className="btn btn-primary" data-testid="link-return-dashboard">Return to dashboard <ArrowRight size={16} /></Link></div>;
}

function AppRouter() {
  return <Switch>
    <Route path="/" component={HomeRedirect} />
    <Route path="/sign-in/*?" component={ClerkSignInPage} />
    <Route path="/sign-up/*?" component={ClerkSignUpPage} />
    <Route path="/login"><Redirect to="/sign-in" /></Route>
    <Route path="/register"><Redirect to="/sign-up" /></Route>
    <Route path="/dashboard"><ProtectedPage><Dashboard /></ProtectedPage></Route>
    <Route path="/applications"><ProtectedPage><Applications /></ProtectedPage></Route>
    <Route path="/applications/:id"><ProtectedPage><ApplicationDetail /></ProtectedPage></Route>
    <Route path="/services"><ProtectedPage><Services /></ProtectedPage></Route>
    <Route path="/monitoring"><ProtectedPage><Monitoring /></ProtectedPage></Route>
    <Route path="/incidents"><ProtectedPage><Incidents /></ProtectedPage></Route>
    <Route path="/incidents/:id"><ProtectedPage><IncidentDetail /></ProtectedPage></Route>
    <Route path="/recovery"><ProtectedPage><RecoveryActions /></ProtectedPage></Route>
    <Route path="/recovery/rules"><ProtectedPage><RecoveryRules /></ProtectedPage></Route>
    <Route path="/ai-insights"><ProtectedPage><AIInsights /></ProtectedPage></Route>
    <Route path="/settings"><ProtectedPage><SettingsPage /></ProtectedPage></Route>
    <Route component={NotFound} />
  </Switch>;
}

function ClerkProviderWithRoutes({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={{
      signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to access your reliability console' } },
      signUp: { start: { title: 'Create your operator account', subtitle: 'Start with a safer view of production' } },
    }}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
  >
    {children}
  </ClerkProvider>;
}

function App() {
  return <WouterRouter base={basePath}>
    <ClerkProviderWithRoutes>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ClerkQueryClientCacheInvalidator />
          <ErrorBoundary resetKey={window.location.pathname}><AppRouter /></ErrorBoundary>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProviderWithRoutes>
  </WouterRouter>;
}

export default App;