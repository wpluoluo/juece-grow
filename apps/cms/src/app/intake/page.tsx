'use client'

import { useState } from 'react'

import { LEAD_SOURCES } from '../../lib/leadSources'

type FormState = { status: 'idle' | 'submitting' | 'ok' | 'error'; message?: string }

export default function LeadIntakePage() {
  const [source, setSource] = useState('douyin')
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
      const json = (await res.json()) as { success: boolean; data?: { id: number; duplicate?: boolean }; error?: { message?: string } }
      if (!res.ok || !json.success) {
        setState({ status: 'error', message: json.error?.message ?? '提交失败' })
        return
      }
      setState({
        status: 'ok',
        message: json.data?.duplicate ? `线索已合并进 #${json.data.id}` : `线索 #${json.data?.id} 已入池`,
      })
      setName('')
      setPhone('')
      setWechat('')
      setNote('')
    } catch {
      setState({ status: 'error', message: '网络异常，请稍后再试' })
    }
  }

  return (
    <main style={{ maxWidth: 520, margin: '40px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 20 }}>线索手动入池</h1>
      <p style={{ color: '#666', fontSize: 13, marginBottom: 24 }}>
        抖音 / 小红书等渠道的线索在此手动录入，与其他来源统一归到一个池子。
      </p>

      <label style={labelStyle}>
        项目 ID
        <input type="number" min={1} value={projectId} onChange={(e) => setProjectId(e.target.value)} style={inputStyle} placeholder="正整数" />
      </label>

      <label style={labelStyle}>
        来源
        <select value={source} onChange={(e) => setSource(e.target.value)} style={inputStyle}>
          {LEAD_SOURCES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label.zh}
            </option>
          ))}
        </select>
      </label>

      <label style={labelStyle}>
        称呼
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} maxLength={50} placeholder="客户称呼（可空）" />
      </label>

      <label style={labelStyle}>
        手机号
        <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} placeholder="1 开头 11 位" />
      </label>

      <label style={labelStyle}>
        微信号
        <input value={wechat} onChange={(e) => setWechat(e.target.value)} style={inputStyle} placeholder="6~20 位字母数字" />
      </label>

      <label style={labelStyle}>
        需求备注
        <textarea value={note} onChange={(e) => setNote(e.target.value)} style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} maxLength={500} placeholder="客户需求 / 意向说明（可空）" />
      </label>

      <button onClick={submit} disabled={state.status === 'submitting'} style={buttonStyle}>
        {state.status === 'submitting' ? '提交中…' : '录入线索'}
      </button>

      {state.status === 'ok' && <p style={{ color: '#2f7d4f', fontSize: 13 }}>{state.message}</p>}
      {state.status === 'error' && <p style={{ color: '#b3402a', fontSize: 13 }}>{state.message}</p>}
    </main>
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
  background: '#1f6feb',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
}