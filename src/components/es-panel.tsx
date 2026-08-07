'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, friendlyError } from './api-client';
import type { EsAnalysis, EsDocument, EsRevision, Experience } from './types';
import { Empty, Field, Notice, Panel, Spinner, Tag } from './ui';

type EsSummary = Pick<EsDocument, 'id' | 'companyId' | 'targetRole' | 'question' | 'characterLimit' | 'characterCount' | 'status' | 'createdAt' | 'updatedAt'>;
type Company = { id: string; name: string; targetRole: string | null; factCount: number };
type Extraction = { sourceType: string; extractionMethod: string; originalFilename: string; pageCount: number | null; extractedText: string; characterCount: number; requiresReview: true; warnings: string[] };

const countCharacters = (value: string) => [...value.replace(/\r\n?/g, '\n')].length;
const STATUS_NAMES: Record<string, string> = { VERIFIED: '確認済み', PARTIALLY_VERIFIED: '一部確認', NEEDS_CONFIRMATION: '要確認', CONTRADICTED: '矛盾あり' };

function AnalysisView({ analysis, title }: { analysis: EsAnalysis; title: string }) {
  return (
    <div className="analysis-result">
      <div className="editor-heading"><h3>{title}</h3><Tag tone={analysis.submissionReadiness === 'READY_TO_SUBMIT' ? 'good' : 'warn'}>{analysis.submissionReadiness === 'READY_TO_SUBMIT' ? '提出可能' : '要確認'}</Tag></div>
      {analysis.freshness === 'STALE' ? <Notice tone="warning">元の自己分析・経験・ESが更新されたため、この検査結果は古くなっています。再検査してください。</Notice> : null}
      <div className="metric-grid compact"><div><strong>{analysis.characterCount}</strong><span>文字</span></div><div><strong>{analysis.withinCharacterLimit ? '内' : '超過'}</strong><span>文字数制限</span></div><div><strong>{analysis.questionCoverage}</strong><span>設問への回答</span></div></div>
      <h4>根拠状態</h4>
      {analysis.claims.length === 0 ? <Empty>確認対象の主張はありません。</Empty> : <div className="claim-list">{analysis.claims.map((claim) => <article key={claim.id}><Tag tone={claim.status === 'VERIFIED' ? 'good' : claim.status === 'CONTRADICTED' ? 'bad' : 'warn'}>{STATUS_NAMES[claim.status] ?? claim.status}</Tag><p>{claim.text}</p>{claim.explanation ? <small>{claim.explanation}</small> : null}</article>)}</div>}
      <h4>問題箇所</h4>
      {analysis.issues.length === 0 ? <p className="muted">問題は検出されませんでした。</p> : <ul className="issue-list">{analysis.issues.map((issue, index) => <li key={`${issue.code}-${index}`}><strong>{issue.message}</strong>{issue.sentence ? <span>{issue.sentence}</span> : null}</li>)}</ul>}
      {analysis.comments.length ? <><h4>AIコメント</h4><div className="comment-list">{analysis.comments.map((comment, index) => <p key={`${comment.category}-${index}`}><small>{comment.category}</small>{comment.message}</p>)}</div></> : null}
    </div>
  );
}

export function EsPanel({ revision, onChanged }: { revision: number; onChanged: () => void }) {
  const [items, setItems] = useState<EsSummary[]>();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [document, setDocument] = useState<EsDocument>();
  const [question, setQuestion] = useState('');
  const [characterLimit, setCharacterLimit] = useState(400);
  const [targetRole, setTargetRole] = useState('');
  const [originalText, setOriginalText] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [preferredIds, setPreferredIds] = useState<string[]>([]);
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text');
  const [extraction, setExtraction] = useState<Extraction>();
  const [extractionConfirmed, setExtractionConfirmed] = useState(false);
  const [analysis, setAnalysis] = useState<EsAnalysis>();
  const [esRevision, setEsRevision] = useState<EsRevision>();
  const [verification, setVerification] = useState<EsAnalysis>();
  const [emphasis, setEmphasis] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadIndex = useCallback(async () => {
    setError('');
    try {
      const [documents, companyPage, experiencePage] = await Promise.all([
        api<{ items: EsSummary[] }>('/api/v1/es-documents'),
        api<{ items: Company[] }>('/api/v1/companies'),
        api<{ items: Experience[] }>('/api/v1/experiences?status=CONFIRMED'),
      ]);
      setItems(documents.items);
      setCompanies(companyPage.items);
      setExperiences(experiencePage.items);
    } catch (reason) { setError(friendlyError(reason)); }
  }, []);
  useEffect(() => { void loadIndex(); }, [loadIndex, revision]);

  async function run(name: string, task: () => Promise<void>) {
    setBusy(name); setError(''); setNotice('');
    try { await task(); } catch (reason) { setError(friendlyError(reason)); } finally { setBusy(''); }
  }

  function resetForm() {
    setDocument(undefined); setQuestion(''); setCharacterLimit(400); setTargetRole(''); setOriginalText(''); setCompanyId(''); setPreferredIds([]); setExtraction(undefined); setExtractionConfirmed(false); setAnalysis(undefined); setEsRevision(undefined); setVerification(undefined); setNotice(''); setError('');
  }

  function openDocument(id: string) {
    void run('open', async () => {
      const item = await api<EsDocument>(`/api/v1/es-documents/${id}`);
      setDocument(item); setQuestion(item.question); setCharacterLimit(item.characterLimit); setTargetRole(item.targetRole ?? ''); setOriginalText(item.originalText); setCompanyId(item.companyId ?? ''); setPreferredIds(item.preferredExperienceIds); setInputMode('text'); setExtraction(undefined); setExtractionConfirmed(true);
      setAnalysis(item.analyses.find((entry) => entry.sourceKind === 'ORIGINAL' && entry.freshness === 'CURRENT') ?? item.analyses[0]);
      setEsRevision(item.revisions.find((entry) => entry.freshness === 'CURRENT') ?? item.revisions[0]);
      setVerification(item.analyses.find((entry) => entry.sourceKind === 'REVISION' && entry.freshness === 'CURRENT'));
    });
  }

  function extractFile(file: File | undefined) {
    if (!file) return;
    void run('extract', async () => {
      const formData = new FormData(); formData.append('file', file);
      const result = await api<Extraction>('/api/v1/es-text-extractions', { method: 'POST', formData });
      setExtraction(result); setOriginalText(result.extractedText); setExtractionConfirmed(false);
      setNotice('文字を抽出しました。誤読がないか本文を確認・修正し、確認欄を選んでください。');
    });
  }

  function save() {
    if (!question.trim() || !originalText.trim()) return;
    void run('save', async () => {
      const payload = { companyId: companyId || null, targetRole: targetRole || null, question, characterLimit, originalText, preferredExperienceIds: preferredIds, emphasis: emphasis.split('\n').map((item) => item.trim()).filter(Boolean) };
      const saved = document
        ? await api<EsDocument>(`/api/v1/es-documents/${document.id}`, { method: 'PATCH', body: payload })
        : await api<EsDocument>('/api/v1/es-documents', { method: 'POST', body: payload });
      setDocument(saved); setAnalysis(undefined); setEsRevision(undefined); setVerification(undefined); setExtraction(undefined); setExtractionConfirmed(true); setNotice('ES原文を保存しました。次に根拠と設問への回答を検査できます。');
      await loadIndex(); onChanged();
    });
  }

  function analyze() {
    if (!document) return;
    void run('analyze', async () => {
      const result = await api<EsAnalysis>(`/api/v1/es-documents/${document.id}/analyses`, { method: 'POST' });
      setAnalysis(result); setEsRevision(undefined); setVerification(undefined); setNotice('原文を検査しました。指摘を確認してから完成版ES案を作成できます。'); await loadIndex(); onChanged();
    });
  }

  function revise() {
    if (!document || !analysis) return;
    void run('revise', async () => {
      const result = await api<EsRevision>(`/api/v1/es-documents/${document.id}/revisions`, { method: 'POST', body: { emphasis: emphasis.split('\n').map((item) => item.trim()).filter(Boolean), preserveExpressions: [] } });
      setEsRevision(result); setVerification(undefined); setNotice('完成版ES案を作成しました。提出前に再検査してください。'); await loadIndex(); onChanged();
    });
  }

  function verify() {
    if (!esRevision) return;
    void run('verify', async () => {
      const result = await api<EsAnalysis>(`/api/v1/es-revisions/${esRevision.id}/verify`, { method: 'POST' });
      setVerification(result); setNotice(result.submissionReadiness === 'READY_TO_SUBMIT' ? '設問・文字数・根拠の再検査を通過しました。' : '再検査で確認事項が残りました。内容を確認してください。'); await loadIndex(); onChanged();
    });
  }

  const characterCount = useMemo(() => countCharacters(originalText), [originalText]);
  const fileNeedsConfirmation = inputMode === 'file' && extraction?.requiresReview && !extractionConfirmed;

  return (
    <div className="stack">
      {error ? <Notice tone="error">{error}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}
      <Panel title="ES添削" lead="文章貼り付け・PNG/JPEG・PDFに対応。AIから返す添削案は文章のみです。" actions={<button className="button button-secondary" onClick={resetForm}>新規作成</button>}>
        <div className="es-layout">
          <aside className="document-list"><h3>保存済みES</h3>{!items ? <Spinner /> : items.length === 0 ? <Empty>まだありません。</Empty> : items.map((item) => <button key={item.id} className={document?.id === item.id ? 'active' : ''} onClick={() => openDocument(item.id)}><strong>{item.question}</strong><small>{item.characterCount}/{item.characterLimit}文字 · {item.status}</small></button>)}</aside>
          <div className="es-workspace">
            <div className="segmented input-tabs"><button className={inputMode === 'text' ? 'active' : ''} onClick={() => setInputMode('text')}>文章を貼り付け</button><button className={inputMode === 'file' ? 'active' : ''} onClick={() => setInputMode('file')}>画像・PDF</button></div>
            {inputMode === 'file' ? <div className="upload-zone"><input type="file" accept="image/png,image/jpeg,application/pdf" onChange={(event) => extractFile(event.target.files?.[0])} disabled={busy === 'extract'} />{busy === 'extract' ? <Spinner label="ページを読み取り、文字を抽出しています…" /> : <p>PNG/JPEG/PDF、10MB以下。PDFは10ページまで。抽出した文章はこの画面でだけ確認し、確認後に保存します。</p>}</div> : null}
            {extraction ? <Notice tone="warning"><strong>{extraction.sourceType} / {extraction.extractionMethod}</strong>{extraction.pageCount ? ` · ${extraction.pageCount}ページ` : ''}<br />抽出文は未確認です。{extraction.warnings.join(' ')}</Notice> : null}
            <div className="form-grid">
              <Field label="設問"><textarea rows={3} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="例：学生時代に力を入れたことを教えてください" /></Field>
              <Field label="文字数上限"><input type="number" min={1} max={10000} value={characterLimit} onChange={(event) => setCharacterLimit(Number(event.target.value))} /></Field>
              <Field label="対象職種（任意）"><input value={targetRole} onChange={(event) => setTargetRole(event.target.value)} /></Field>
              <Field label="企業（任意）" hint="登録済みの公式情報だけを企業事実の根拠として使います。"><select value={companyId} onChange={(event) => setCompanyId(event.target.value)}><option value="">指定しない</option>{companies.map((company) => <option value={company.id} key={company.id}>{company.name}（根拠{company.factCount}件）</option>)}</select></Field>
              <Field label="ES原文" hint={`${characterCount.toLocaleString()} / 20,000文字`}><textarea rows={12} value={originalText} onChange={(event) => setOriginalText(event.target.value)} placeholder="ES本文を入力してください" /></Field>
              {experiences.length ? <fieldset className="field checklist"><legend>優先したい確認済み経験（任意）</legend>{experiences.map((item) => <label key={item.id}><input type="checkbox" checked={preferredIds.includes(item.id)} onChange={(event) => setPreferredIds((ids) => event.target.checked ? [...ids, item.id] : ids.filter((id) => id !== item.id))} />{item.title}</label>)}</fieldset> : null}
              <Field label="重視すること（任意・1行に1つ）"><textarea rows={3} value={emphasis} onChange={(event) => setEmphasis(event.target.value)} placeholder="結論を先にする&#10;自分の行動を具体的にする" /></Field>
            </div>
            {extraction?.requiresReview ? <label className="confirm-check"><input type="checkbox" checked={extractionConfirmed} onChange={(event) => setExtractionConfirmed(event.target.checked)} />抽出文を読み、原文として保存してよい内容だと確認しました</label> : null}
            <div className="button-row"><button className="button button-primary" onClick={save} disabled={busy === 'save' || fileNeedsConfirmation || !question.trim() || !originalText.trim() || characterCount > 20000 || characterLimit < 1 || characterLimit > 10000}>{document ? '変更を保存' : 'ES原文を保存'}</button>{document ? <button className="button button-secondary" onClick={analyze} disabled={busy === 'analyze'}>{busy === 'analyze' ? '根拠を検査しています…' : '原文を検査'}</button> : null}</div>
          </div>
        </div>
      </Panel>

      {analysis ? <Panel title="検査結果" actions={<button className="button button-primary" onClick={revise} disabled={busy === 'revise'}>{busy === 'revise' ? '完成版を作成しています…' : '完成版ES案を作成'}</button>}><AnalysisView analysis={analysis} title="原文の検査" /></Panel> : null}
      {esRevision ? <Panel title="完成版ES案" lead="文章のみを返します。再検査が完了するまでは提出可能と断定しません。" actions={<button className="button button-secondary" onClick={() => void navigator.clipboard.writeText(esRevision.revisedText)}>文章をコピー</button>}>
        {esRevision.freshness === 'STALE' ? <Notice tone="warning">この完成版は古くなっています。原文を再検査して作り直してください。</Notice> : null}
        <textarea className="final-es" readOnly rows={14} value={esRevision.revisedText} />
        <p className="character-line">{esRevision.characterCount} / {characterLimit}文字</p>
        <h3>改善理由</h3><div className="change-list">{esRevision.changes.map((change) => <article key={change.id}><p><del>{change.before}</del></p><p><ins>{change.after}</ins></p><small>{change.reason}</small></article>)}</div>
        <button className="button button-primary" onClick={verify} disabled={busy === 'verify'}>{busy === 'verify' ? '完成版を再検査しています…' : '完成版を再検査'}</button>
      </Panel> : null}
      {verification ? <Panel title="提出前の再検査"><AnalysisView analysis={verification} title="完成版の検査" /></Panel> : null}
    </div>
  );
}
