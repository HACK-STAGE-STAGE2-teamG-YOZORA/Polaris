'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, friendlyError } from './api-client';
import type { AnalysisSession, AxisAssessment, ChatMessage, Experience } from './types';
import { Empty, Field, Notice, Panel, Spinner, Tag } from './ui';

type Page<T> = { items: T[] };
type ChatTurn = { userMessage: ChatMessage; assistantMessage: ChatMessage; experienceReady: boolean; completionIntent: string };

const EXPERIENCE_TYPES = [
  ['ENGAGED', '熱中した経験'],
  ['ACHIEVEMENT', '達成した経験'],
  ['CHALLENGE', '挑戦した経験'],
  ['DRAINING_SUCCESS', '成果は出たが消耗した経験'],
  ['TEAM_CONFLICT', 'チームで葛藤した経験'],
  ['OTHER', 'その他'],
] as const;

const ASSESSMENTS = [
  ['MATCHES', '当てはまる'],
  ['PARTIALLY_MATCHES', '一部当てはまる'],
  ['DOES_NOT_MATCH', '当てはまらない'],
  ['NEEDS_EXPLORATION', 'さらに確認したい'],
] as const;

const AXIS_NAMES: Record<string, string> = {
  ENERGY_SOURCE: '集中 ↔ 共創',
  ACTION_STYLE: '設計 ↔ 実験',
  SATISFACTION_SOURCE: '習熟 ↔ 貢献',
  PREFERRED_ENVIRONMENT: '安定 ↔ 変化',
};

const POSITION_NAMES: Record<string, string> = {
  LEFT: '左寄り', LEANS_LEFT: 'やや左寄り', BALANCED_OR_BOTH: '両方・中間', LEANS_RIGHT: 'やや右寄り', RIGHT: '右寄り', CONTEXT_DEPENDENT: '状況依存', INSUFFICIENT_EVIDENCE: '根拠不足',
};

function DraftEditor({ draft, busy, onConfirm, onCancel }: {
  draft: Experience;
  busy: boolean;
  onConfirm: (value: Experience) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(draft);
  return (
    <div className="editor-card">
      <div className="editor-heading"><h3>経験カードを確認</h3><Tag tone="warn">未確認</Tag></div>
      <Notice tone="warning">AIが会話から整理した案です。事実と違う箇所を直してから確認してください。</Notice>
      <div className="form-grid">
        <Field label="タイトル"><input value={value.title} onChange={(event) => setValue({ ...value, title: event.target.value })} /></Field>
        <Field label="自分の役割"><input value={value.role} onChange={(event) => setValue({ ...value, role: event.target.value })} /></Field>
        <Field label="状況"><textarea rows={3} value={value.situation} onChange={(event) => setValue({ ...value, situation: event.target.value })} /></Field>
        <Field label="行動（1行に1つ）"><textarea rows={4} value={value.actions.join('\n')} onChange={(event) => setValue({ ...value, actions: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })} /></Field>
        <Field label="結果"><textarea rows={3} value={value.result ?? ''} onChange={(event) => setValue({ ...value, result: event.target.value || null })} /></Field>
      </div>
      <div className="button-row">
        <button className="button button-secondary" onClick={onCancel} disabled={busy}>あとで確認</button>
        <button className="button button-primary" onClick={() => void onConfirm(value)} disabled={busy || !value.title.trim() || !value.situation.trim() || !value.role.trim() || value.actions.length === 0}>内容を確認して保存</button>
      </div>
    </div>
  );
}

export function SelfAnalysisPanel({ onChanged }: { onChanged: () => void }) {
  const [session, setSession] = useState<AnalysisSession | null>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [axes, setAxes] = useState<AxisAssessment[]>([]);
  const [content, setContent] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [experienceType, setExperienceType] = useState('ENGAGED');
  const [draft, setDraft] = useState<Experience>();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const current = await api<{ session: AnalysisSession | null }>('/api/v1/analysis-sessions/current');
      setSession(current.session);
      if (!current.session) {
        setMessages([]);
        setAxes([]);
        return;
      }
      const [messagePage, assessmentPage] = await Promise.all([
        api<Page<ChatMessage>>(`/api/v1/analysis-sessions/${current.session.id}/messages?limit=100`),
        api<Page<AxisAssessment>>(`/api/v1/axis-assessments?sessionId=${current.session.id}`),
      ]);
      setMessages(messagePage.items);
      setAxes(assessmentPage.items);
      setNotes(Object.fromEntries(assessmentPage.items.map((item) => [item.id, item.userNote ?? ''])));
      const userIds = messagePage.items.filter((item) => item.role === 'USER').map((item) => item.id);
      const latestUserId = userIds.at(-1);
      setSelectedIds((ids) => {
        const retained = ids.filter((id) => userIds.includes(id));
        return retained.length ? retained : latestUserId ? [latestUserId] : [];
      });
    } catch (reason) {
      setError(friendlyError(reason));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const activeAxes = useMemo(() => axes.filter((item) => !item.isStale), [axes]);
  const reviewedCount = activeAxes.filter((item) => item.userAssessment !== 'UNREVIEWED').length;

  async function run(name: string, task: () => Promise<void>) {
    setBusy(name);
    setError('');
    setHint('');
    try { await task(); } catch (reason) { setError(friendlyError(reason)); } finally { setBusy(''); }
  }

  function start(mode: 'START_NEW' | 'RESTART_ACTIVE') {
    void run('start', async () => {
      await api<AnalysisSession>('/api/v1/analysis-sessions', { method: 'POST', body: { startMode: mode, title: '自己分析' } });
      await load();
      onChanged();
    });
  }

  function send() {
    const text = content.trim();
    if (!session || !text) return;
    void run('chat', async () => {
      const turn = await api<ChatTurn>(`/api/v1/analysis-sessions/${session.id}/messages`, {
        method: 'POST', body: { content: text, clientMessageId: crypto.randomUUID() },
      });
      setMessages((items) => [...items, turn.userMessage, turn.assistantMessage]);
      setSelectedIds((ids) => [...new Set([...ids, turn.userMessage.id])]);
      setContent('');
      if (turn.experienceReady) setHint('この会話から経験カードを作成できます。使う回答を選び、下のボタンを押してください。');
      if (turn.completionIntent === 'SUGGESTED') setHint('十分に話せた可能性があります。経験カードを確認した後、4軸分析へ進めます。');
      await load();
      onChanged();
    });
  }

  function createDraft() {
    if (!session || selectedIds.length === 0) return;
    void run('draft', async () => {
      const created = await api<Experience>(`/api/v1/analysis-sessions/${session.id}/experience-drafts`, {
        method: 'POST', body: { experienceType, messageIds: selectedIds },
      });
      setDraft(created);
    });
  }

  async function confirmDraft(value: Experience) {
    await run('confirm', async () => {
      await api<{ experience: Experience }>(`/api/v1/experiences/${value.id}`, {
        method: 'PATCH',
        body: { title: value.title, situation: value.situation, role: value.role, actions: value.actions, result: value.result, status: 'CONFIRMED' },
      });
      setDraft(undefined);
      setSelectedIds([]);
      setHint('経験カードを確認済みにしました。会話を続けるか、4軸分析へ進めます。');
      await load();
      onChanged();
    });
  }

  function generateAxes() {
    if (!session) return;
    void run('axes', async () => {
      const generated = await api<Page<AxisAssessment>>(`/api/v1/analysis-sessions/${session.id}/axis-assessments/generate`, { method: 'POST' });
      setAxes(generated.items);
      setNotes(Object.fromEntries(generated.items.map((item) => [item.id, ''])));
      setHint('4軸の分析案を生成しました。4項目すべてを本人評価してください。');
      await load();
    });
  }

  function assess(item: AxisAssessment, assessment: string) {
    void run(`axis-${item.id}`, async () => {
      const saved = await api<AxisAssessment>(`/api/v1/axis-assessments/${item.id}`, {
        method: 'PATCH', body: { assessment, note: notes[item.id] ?? '' },
      });
      setAxes((items) => items.map((axis) => axis.id === saved.id ? saved : axis));
      await load();
      onChanged();
    });
  }

  function finalize() {
    if (!session) return;
    void run('finalize', async () => {
      await api(`/api/v1/analysis-sessions/${session.id}/finalize`, { method: 'POST' });
      let recomputeFailed = false;
      try { await api('/api/v1/overall-self-analysis/recompute', { method: 'POST' }); } catch { recomputeFailed = true; }
      setHint(recomputeFailed ? '自己分析は確定済みですが、総合傾向の再集計に失敗しました。ホームから再試行してください。' : '自己分析を確定しました。ホームで結果を確認できます。');
      await load();
      onChanged();
    });
  }

  if (session === undefined) return <Spinner label="自己分析を読み込んでいます…" />;
  if (!session) return (
    <Panel title="自己分析" lead="AIとの会話を、確認可能な経験と4軸の根拠に変えます。">
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="start-card"><span className="step-number">01</span><h3>新しい自己分析を始める</h3><p>まずは最近印象に残った出来事から話してください。回答はあとで経験カードとして確認できます。</p><button className="button button-primary" onClick={() => start('START_NEW')} disabled={busy === 'start'}>始める</button></div>
    </Panel>
  );

  return (
    <div className="stack">
      {error ? <Notice tone="error">{error} <button className="text-button" onClick={() => void load()}>再読み込み</button></Notice> : null}
      {hint ? <Notice tone="success">{hint}</Notice> : null}
      <Panel title={session.title} lead="本人が確認するまで、AIの整理結果は仮説として扱われます。" actions={<Tag tone={session.status === 'READY_TO_FINALIZE' ? 'good' : 'warn'}>{session.status}</Tag>}>
        <div className="progress-strip"><span>回答 <strong>{session.progress.userMessageCount}</strong></span><span>確認済み経験 <strong>{session.progress.confirmedExperienceCount}</strong></span><span>4軸評価 <strong>{reviewedCount}/4</strong></span></div>
      </Panel>

      <Panel title="1. AIと振り返る" lead="具体的な場面・自分の行動・結果や気持ちを、分かる範囲で答えてください。">
        <Notice tone="info">終了したいときは、その旨を送るか下の4軸分析へ進んでください。AIが終了候補を示しても自動確定はしません。</Notice>
        <div className="chat-log" aria-live="polite">
          {messages.length === 0 ? <Empty>「最近、時間を忘れて取り組んだことは？」など、話しやすい出来事から始めてください。</Empty> : messages.map((message) => (
            <div className={`message message-${message.role.toLowerCase()}`} key={message.id}>
              {message.role === 'USER' ? <input aria-label="経験カードに使う" type="checkbox" checked={selectedIds.includes(message.id)} onChange={(event) => setSelectedIds((ids) => event.target.checked ? [...ids, message.id] : ids.filter((id) => id !== message.id))} /> : null}
              <div><small>{message.role === 'USER' ? 'あなた' : 'Polaris AI'}</small><p>{message.content}</p></div>
            </div>
          ))}
        </div>
        <div className="composer"><textarea rows={4} maxLength={10000} value={content} onChange={(event) => setContent(event.target.value)} placeholder="できごとや、そのとき考えたことを入力…" /><button className="button button-primary" onClick={send} disabled={busy === 'chat' || !content.trim()}>{busy === 'chat' ? 'AIが考えています…' : '送信'}</button></div>
      </Panel>

      <Panel title="2. 経験を根拠として残す" lead="上のチェックで使う回答を選び、経験カード案を作成します。">
        <div className="inline-form"><select value={experienceType} onChange={(event) => setExperienceType(event.target.value)}>{EXPERIENCE_TYPES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><button className="button button-secondary" onClick={createDraft} disabled={busy === 'draft' || selectedIds.length === 0}>{busy === 'draft' ? '整理しています…' : `選択した回答から作成（${selectedIds.length}件）`}</button></div>
        {draft ? <DraftEditor draft={draft} busy={busy === 'confirm'} onConfirm={confirmDraft} onCancel={() => setDraft(undefined)} /> : null}
      </Panel>

      <Panel title="3. 4軸を本人評価する" lead="根拠が不足している軸は、無理に傾向を決めず「判断できない」と表示します。" actions={<button className="button button-secondary" onClick={generateAxes} disabled={busy === 'axes' || session.progress.userMessageCount < 1}>{activeAxes.length ? '4軸を再生成' : '4軸を生成'}</button>}>
        {activeAxes.length === 0 ? <Empty>回答が1件以上あれば生成できます。経験カードを確認すると、より具体的な根拠が反映されます。</Empty> : <div className="axis-review-list">{activeAxes.map((item) => (
          <article className="axis-review" key={item.id}>
            <div className="editor-heading"><h3>{AXIS_NAMES[item.axis] ?? item.axis}</h3><Tag tone={item.position === 'INSUFFICIENT_EVIDENCE' ? 'warn' : 'neutral'}>{POSITION_NAMES[item.position] ?? item.position}</Tag></div>
            <div className={`axis-scale position-${item.position.toLowerCase()}`} aria-label={`現在位置：${POSITION_NAMES[item.position] ?? item.position}`}><span /><span /><span /><span /><span /><i /></div>
            <p>{item.displayStatement}</p>
            {[...item.leftEvidence, ...item.rightEvidence, ...item.bothEvidence, ...item.contextEvidence].length ? <details><summary>確認済みの根拠（{[...item.leftEvidence, ...item.rightEvidence, ...item.bothEvidence, ...item.contextEvidence].length}件）</summary>{[...item.leftEvidence, ...item.rightEvidence, ...item.bothEvidence, ...item.contextEvidence].map((evidence) => <blockquote key={evidence.id}>{evidence.quote || evidence.statement}</blockquote>)}</details> : <Notice tone="warning">この軸を判断できる確認済み根拠がありません。</Notice>}
            <Field label="補足メモ（任意）"><textarea rows={2} value={notes[item.id] ?? ''} onChange={(event) => setNotes({ ...notes, [item.id]: event.target.value })} /></Field>
            <div className="choice-row">{ASSESSMENTS.map(([value, label]) => <button key={value} className={`choice ${item.userAssessment === value ? 'selected' : ''}`} onClick={() => assess(item, value)} disabled={busy === `axis-${item.id}`}>{label}</button>)}</div>
          </article>
        ))}</div>}
      </Panel>

      <Panel title="4. 自己分析を確定する" lead="確定後は総合傾向へ反映されます。追加で話した場合は4軸を再生成・再評価します。">
        <div className="button-row"><button className="button button-primary" onClick={finalize} disabled={busy === 'finalize' || session.status !== 'READY_TO_FINALIZE'}>{busy === 'finalize' ? 'レポートを作成しています…' : '本人評価を確定する'}</button><button className="button button-danger-ghost" onClick={() => start('RESTART_ACTIVE')} disabled={busy === 'start'}>このセッションを破棄してやり直す</button></div>
        {session.status !== 'READY_TO_FINALIZE' ? <p className="muted">4軸すべてを評価すると確定できます。</p> : null}
      </Panel>
    </div>
  );
}
