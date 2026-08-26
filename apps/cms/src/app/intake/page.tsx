'use client'

import { useState } from 'react'

import { LEAD_SOURCES } from '../../lib/leadSources'
import { I18nProvider, LangSwitcher, useLocale, type Dict } from '../../lib/i18n'

type FormState = { status: 'idle' | 'submitting' | 'ok' | 'error'; message?: string }

const DICT: Dict = {
  title: { zh: '线索手动入池', en: 'Manual Lead Intake' },
  subtitle: {
    zh: '抖音 / 小红书等渠道的线索在此手动录入，与其他来源统一归到一个池子。',
    en: 'Manually add leads from Douyin / Xiaohongshu and other channels into the shared pool.',
  },
  projectId: { zh: '项目 ID', en: 'Project ID' },
  projectIdPlaceholder: { zh: '正整数', en: 'positive integer' },
  source: { zh: '来源', en: 'Source' },
  name: { zh: '称呼', en: 'Name' },
  namePlaceholder: { zh: '客户称呼（可空）', en: 'Customer name (optional)' },
  phone: { zh: '手机号', en: 'Phone' },
  phonePlaceholder: { zh: '1 开头 11 位', en: '11 digits, starting with 1' },
  wechat: { zh: '微信号', en: 'WeChat' },
  wechatPlaceholder: { zh: '6~20 位字母数字', en: '6-20 alphanumeric characters' },
  note: { zh: '需求备注', en: 'Note' },
  notePlaceholder: {
    zh: '客户需求 / 意向说明（可空）',
    en: 'Customer needs / intent (optional)',
  },
  submitting: { zh: '提交中…', en: 'Submitting…' },
  submit: { zh: '录入线索', en: 'Add lead' },
  added: { zh: '线索 #{id} 已入池', en: 'Lead #{id} added' },
  merged: { zh: '线索已合并进 #{id}', en: 'Merged into lead #{id}' },
  errorNetwork: { zh: '网络异常，请稍后再试', en: 'Network error, please try again later' },
  errorSubmit: { zh: '提交失败', en: 'Submission failed' },
}

function IntakeForm() {
  const { t } = useLocale()
  const [source, setSource] = useState<string>(LEAD_SOURCES[2].value) // 默认“抖音”
  const [projectId, setProjectId] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [wechat, setWechat] = useState('')
  const [note, setNote] = useState('')
  const [state, setState] = useState<FormState>({ status: 'idle' })

  async function submit() {
    setState({ status: 'submitting' })
    try {
      const res = await fetch('/api/v2/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, source, name, phone, wechat, note }),
      })
      const json = (await res.json()) as {
        success: boolean
        data?: { id: number; duplicate?: boolean }
        error?: { message?: string }
      }
      if (!res.ok || !json.success) {
        setState({ status: 'error', message: json.error?.message ?? t('errorSubmit') })
        return
      }
      const id = String(json.data?.id ?? '')
      setState({
        status: 'ok',
        message: t(json.data?.duplicate ? 'merged' : 'added').replaceAll('{id}', id),
      })
      setName('')
      setPhone('')
      setWechat('')
      setNote('')
    } catch {
      setState({ status: 'error', message: t('errorNetwork') })
    }
  }

  return (
    <main style={{ maxWidth: 520, margin: '40px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>{t('title')}</h1>
        <LangSwitcher />
      </div>
      <p style={{ color: '#666', fontSize: 13, marginBottom: 24 }}>{t('subtitle')}</p>

      <label style={labelStyle}>
        {t('projectId')}
        <input
          type="number"
          min={1}
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          style={inputStyle}
          placeholder={t('projectIdPlaceholder')}
        />
      </label>

      <label style={labelStyle}>
        {t('source')}
        <select value={source} onChange={(e) => setSource(e.target.value)} style={inputStyle}>
          {LEAD_SOURCES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label.zh}
            </option>
          ))}
        </select>
      </label>

      <label style={labelStyle}>
        {t('name')}
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} maxLength={50} placeholder={t('namePlaceholder')} />
      </label>

      <label style={labelStyle}>
        {t('phone')}
        <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} placeholder={t('phonePlaceholder')} />
      </label>

      <label style={labelStyle}>
        {t('wechat')}
        <input value={wechat} onChange={(e) => setWechat(e.target.value)} style={inputStyle} placeholder={t('wechatPlaceholder')} />
      </label>

      <label style={labelStyle}>
        {t('note')}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
          maxLength={500}
          placeholder={t('notePlaceholder')}
        />
      </label>

      <button onClick={submit} disabled={state.status === 'submitting'} style={buttonStyle}>
        {state.status === 'submitting' ? t('submitting') : t('submit')}
      </button>

      {state.status === 'ok' && <p style={{ color: '#2f6b4f', fontSize: 13 }}>{state.message}</p>}
      {state.status === 'error' && <p style={{ color: '#a8402a', fontSize: 13 }}>{state.message}</p>}
    </main>
  )
}

export default function LeadIntakePage() {
  return (
    <I18nProvider
      dict={DICT}
      titles={{ zh: '线索手动入池 · 觉策增长', en: 'Manual Lead Intake · Juece Growth' }}
    >
      <IntakeForm />
    </I18nProvider>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', marginBottom: 14, fontSize: 13, color: '#333' }
const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 6,
  padding: '8px 10px',
  fontSize: 14,
  border: '1px solid #ccc',
  borderRadius: 6,
  boxSizing: 'border-box',
}
const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 0',
  fontSize: 15,
  color: '#fff',
  background: '#3a5f52',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
}