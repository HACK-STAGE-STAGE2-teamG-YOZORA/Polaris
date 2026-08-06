'use client';

import { useState } from 'react';
import { DashboardPanel } from './dashboard-panel';
import { EsPanel } from './es-panel';
import { ExperiencesPanel } from './experiences-panel';
import { SelfAnalysisPanel } from './self-analysis-panel';

type View = 'home' | 'analysis' | 'experiences' | 'es';

const NAV: Array<{ id: View; label: string; short: string }> = [
  { id: 'home', label: 'ホーム', short: 'Home' },
  { id: 'analysis', label: '自己分析', short: 'Reflect' },
  { id: 'experiences', label: '経験', short: 'Evidence' },
  { id: 'es', label: 'ES添削', short: 'Write' },
];

export function PolarisApp() {
  const [view, setView] = useState<View>('home');
  const [revision, setRevision] = useState(0);
  const changed = () => setRevision((value) => value + 1);
  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView('home')} aria-label="Polarisホーム">
          <span className="brand-mark">P</span><span>Polaris<small>Know your evidence</small></span>
        </button>
        <nav aria-label="メインナビゲーション">
          {NAV.map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => setView(item.id)}><span>{item.label}</span><small>{item.short}</small></button>)}
        </nav>
      </header>
      <main className="content">
        {view === 'home' ? <DashboardPanel revision={revision} navigate={(next) => setView(next)} /> : null}
        {view === 'analysis' ? <SelfAnalysisPanel onChanged={changed} /> : null}
        {view === 'experiences' ? <ExperiencesPanel revision={revision} onChanged={changed} /> : null}
        {view === 'es' ? <EsPanel revision={revision} onChanged={changed} /> : null}
      </main>
      <footer>Polarisは根拠不足を隠さず、本人が確認した事実だけを使います。</footer>
    </div>
  );
}
