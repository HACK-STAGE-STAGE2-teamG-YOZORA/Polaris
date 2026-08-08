'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, friendlyError } from './api-client';
import type { Dashboard } from './types';
import { Empty, Notice, Panel, Spinner, Tag } from './ui';

type LmStatus = { status: string; modelId?: string; contextLength?: number; guidance: string[] };
type Health = { status: 'OK' | 'DEGRADED'; database: { status: 'UP' | 'DOWN' }; ai: { status: 'UP' | 'DOWN' } };

const AXIS_NAMES: Record<string, string> = {
  ENERGY_SOURCE: '集中 ↔ 共創',
  ACTION_STYLE: '設計 ↔ 実験',
  SATISFACTION_SOURCE: '習熟 ↔ 貢献',
  PREFERRED_ENVIRONMENT: '安定 ↔ 変化',
};

const POSITION_NAMES: Record<string, string> = {
  LEFT: '左寄り', LEANS_LEFT: 'やや左寄り', BALANCED_OR_BOTH: '両方・中間', LEANS_RIGHT: 'やや右寄り', RIGHT: '右寄り', CONTEXT_DEPENDENT: '状況依存', INSUFFICIENT_EVIDENCE: '根拠不足',
};

export function DashboardPanel({ revision, navigate }: { revision: number; navigate: (view: 'analysis' | 'es') => void }) {
  const [dashboard, setDashboard] = useState<Dashboard>();
  const [lm, setLm] = useState<LmStatus>();
  const [health, setHealth] = useState<Health>();
  const [error, setError] = useState('');
  const [recomputing, setRecomputing] = useState(false);
  const load = useCallback(async () => {
    setError('');
    try {
      const [nextDashboard, nextLm, nextHealth] = await Promise.all([
        api<Dashboard>('/api/v1/dashboard'),
        api<LmStatus>('/api/v1/system/lm-studio'),
        api<Health>('/api/v1/system/health'),
      ]);
      setDashboard(nextDashboard);
      setLm(nextLm);
      setHealth(nextHealth);
    } catch (reason) {
      setError(friendlyError(reason));
    }
  }, []);
  useEffect(() => { void load(); }, [load, revision]);

  async function recompute() {
    setRecomputing(true); setError('');
    try { await api('/api/v1/overall-self-analysis/recompute', { method: 'POST' }); await load(); }
    catch (reason) { setError(friendlyError(reason)); }
    finally { setRecomputing(false); }
  }

  if (!dashboard || !lm || !health) return error ? <Notice tone="error">{error} <button className="text-button" onClick={() => void load()}>再試行</button></Notice> : <Spinner label="ホームを準備しています…" />;
  return (
    <div className="stack">
      {error ? <Notice tone="error">{error}</Notice> : null}
      {health.database.status === 'DOWN' ? <Notice tone="error">データベースへ接続できません。設定とDBファイルを確認してください。</Notice> : null}
      {lm.status === 'CONNECTED' ? (
        <Notice tone="success">LM Studio接続済み：{lm.modelId ?? 'モデルロード済み'}{lm.contextLength ? `（${lm.contextLength.toLocaleString()} tokens）` : ''}</Notice>
      ) : (
        <Notice tone="warning"><strong>LM Studioを確認してください。</strong> {lm.guidance[0] ?? lm.status}</Notice>
      )}

      <div className="hero-card">
        <div>
          <span className="eyebrow">EVIDENCE-BASED CAREER REFLECTION</span>
          <h2>経験を、選べる言葉に。</h2>
          <p>会話から根拠を残しながら自己理解を整理し、確認した事実だけでESを磨きます。</p>
        </div>
        <button className="button button-primary" onClick={() => navigate('analysis')}>
          {dashboard.activeSession ? '自己分析の続きを開く' : '自己分析を始める'}
        </button>
      </div>

      {dashboard.activeSession ? (
        <Panel title="進行中の自己分析" actions={<Tag tone="warn">{dashboard.activeSession.status}</Tag>}>
          <div className="metric-grid">
            <div><strong>{dashboard.activeSession.progress.userMessageCount}</strong><span>回答</span></div>
            <div><strong>{dashboard.activeSession.progress.confirmedExperienceCount}</strong><span>確認済み経験</span></div>
            <div><strong>{dashboard.activeSession.progress.missingAxes.length}</strong><span>根拠不足の軸</span></div>
          </div>
        </Panel>
      ) : null}

      <Panel title="現在の総合傾向" lead="完了した自己分析と確認済み経験から再計算した現在地です。" actions={dashboard.overallProfile?.freshness === 'STALE' ? <button className="button button-secondary" onClick={() => void recompute()} disabled={recomputing}>{recomputing ? '再集計中…' : '総合傾向を再集計'}</button> : undefined}>
        {!dashboard.overallProfile ? <Empty>自己分析を完了すると、ここに4軸とコメントが表示されます。</Empty> : (
          <div className="stack">
            {dashboard.overallProfile.freshness === 'STALE' ? <Notice tone="warning">自己分析または経験が更新されています。現在の表示は古いため、再集計してください。</Notice> : null}
            {dashboard.overallProfile.dataSummary.isDataSparse ? <Notice tone="warning">※データが少ないため、今後結果が変わる可能性があります。完了セッション {dashboard.overallProfile.dataSummary.completedSessionCount}件、回答 {dashboard.overallProfile.dataSummary.userMessageCount}件、確認済み経験 {dashboard.overallProfile.dataSummary.confirmedExperienceCount}件。</Notice> : null}
            <p className="summary-copy">{dashboard.overallProfile.summary}</p>
            <div className="axis-grid">
              {dashboard.overallProfile.axes.map((axis) => (
                <article className="axis-card" key={axis.axis}>
                  <span>{AXIS_NAMES[axis.axis] ?? axis.axis}</span>
                  <strong>{POSITION_NAMES[axis.position] ?? axis.position}</strong>
                  <p>{axis.statement}</p>
                </article>
              ))}
            </div>
            <div className="two-column">
              <div><h3>強み</h3>{dashboard.overallProfile.strengths.map((item) => <article className="mini-card" key={item.title}><strong>{item.title}</strong><p>{item.description}</p></article>)}</div>
              <div><h3>弱み・注意点</h3>{dashboard.overallProfile.weaknesses.map((item) => <article className="mini-card" key={item.title}><strong>{item.title}</strong><p>{item.description}</p></article>)}</div>
            </div>
          </div>
        )}
      </Panel>

      <Panel title="最近のES" actions={<button className="button button-secondary" onClick={() => navigate('es')}>ESを作成</button>}>
        {dashboard.recentEsDocuments.length === 0 ? <Empty>まだESはありません。文章貼り付け・画像・PDFから始められます。</Empty> : (
          <div className="list">
            {dashboard.recentEsDocuments.map((document) => (
              <button className="list-row" key={document.id} onClick={() => navigate('es')}>
                <span><strong>{document.question}</strong><small>{document.characterCount} / {document.characterLimit}文字</small></span>
                <Tag>{document.status}</Tag>
              </button>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
