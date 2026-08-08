'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, friendlyError } from './api-client';
import type { Experience } from './types';
import { Empty, Notice, Panel, Spinner, Tag } from './ui';

const TYPE_NAMES: Record<string, string> = {
  ENGAGED: '熱中', ACHIEVEMENT: '達成', CHALLENGE: '挑戦', DRAINING_SUCCESS: '消耗した成功', TEAM_CONFLICT: 'チーム葛藤', OTHER: 'その他',
};

export function ExperiencesPanel({ revision, onChanged }: { revision: number; onChanged: () => void }) {
  const [items, setItems] = useState<Experience[]>();
  const [filter, setFilter] = useState<'ALL' | 'DRAFT' | 'CONFIRMED'>('ALL');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const query = filter === 'ALL' ? '' : `?status=${filter}`;
      const result = await api<{ items: Experience[] }>(`/api/v1/experiences${query}`);
      setItems(result.items);
    } catch (reason) { setError(friendlyError(reason)); }
  }, [filter]);

  useEffect(() => { void load(); }, [load, revision]);

  async function mutate(id: string, action: 'confirm' | 'delete') {
    setBusy(id);
    setError('');
    try {
      if (action === 'confirm') await api(`/api/v1/experiences/${id}`, { method: 'PATCH', body: { status: 'CONFIRMED' } });
      else await api(`/api/v1/experiences/${id}`, { method: 'DELETE' });
      await load();
      onChanged();
    } catch (reason) { setError(friendlyError(reason)); } finally { setBusy(''); }
  }

  return (
    <div className="stack">
      {error ? <Notice tone="error">{error} <button className="text-button" onClick={() => void load()}>再試行</button></Notice> : null}
      <Panel title="経験カード" lead="自己分析で話した内容を、本人確認済みの根拠として管理します。" actions={<div className="segmented">{(['ALL', 'DRAFT', 'CONFIRMED'] as const).map((value) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value === 'ALL' ? 'すべて' : value === 'DRAFT' ? '未確認' : '確認済み'}</button>)}</div>}>
        {!items ? <Spinner label="経験を読み込んでいます…" /> : items.length === 0 ? <Empty>該当する経験カードはありません。自己分析の会話から作成できます。</Empty> : (
          <div className="experience-grid">{items.map((item) => (
            <article className="experience-card" key={item.id}>
              <div className="editor-heading"><div><small>{TYPE_NAMES[item.type] ?? item.type}</small><h3>{item.title}</h3></div><Tag tone={item.status === 'CONFIRMED' ? 'good' : 'warn'}>{item.status === 'CONFIRMED' ? '確認済み' : '未確認'}</Tag></div>
              <dl><dt>状況</dt><dd>{item.situation}</dd><dt>役割</dt><dd>{item.role}</dd><dt>行動</dt><dd>{item.actions.join(' / ')}</dd>{item.result ? <><dt>結果</dt><dd>{item.result}</dd></> : null}</dl>
              {item.evidenceQuotes.length ? <details><summary>会話の根拠</summary>{item.evidenceQuotes.map((quote, index) => <blockquote key={`${quote.messageId}-${index}`}>{quote.quote}</blockquote>)}</details> : null}
              <div className="button-row">
                {item.status === 'DRAFT' ? <button className="button button-primary" onClick={() => void mutate(item.id, 'confirm')} disabled={busy === item.id}>内容を確認済みにする</button> : null}
                <button className="button button-danger-ghost" onClick={() => { if (window.confirm('この経験カードを削除しますか？')) void mutate(item.id, 'delete'); }} disabled={busy === item.id}>削除</button>
              </div>
            </article>
          ))}</div>
        )}
      </Panel>
    </div>
  );
}
