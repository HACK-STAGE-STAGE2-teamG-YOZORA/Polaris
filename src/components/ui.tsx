'use client';

import type { ReactNode } from 'react';
import { Alert, Chip, CircularProgress, Paper } from '@mui/material';

export function Panel({ title, lead, actions, children }: { title: string; lead?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <Paper component="section" elevation={0} className="panel">
      <div className="panel-heading">
        <div><h2>{title}</h2>{lead ? <p>{lead}</p> : null}</div>
        {actions ? <div className="panel-actions">{actions}</div> : null}
      </div>
      {children}
    </Paper>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'success' | 'warning' | 'error'; children: ReactNode }) {
  return <Alert severity={tone} variant="outlined" className={`notice notice-${tone}`}>{children}</Alert>;
}

export function Spinner({ label = '読み込み中…' }: { label?: string }) {
  return <div className="spinner" role="status"><CircularProgress size={22} color="secondary" />{label}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>;
}

export function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
  return <Chip component="span" size="small" label={children} className={`tag tag-${tone}`} />;
}
