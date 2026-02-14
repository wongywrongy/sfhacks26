import { useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import './IntakeForm.css'

const EMPLOYMENT_OPTIONS = [
  { value: 'salaried', label: 'Salaried' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'government', label: 'Government' },
  { value: 'gig', label: 'Gig Worker' },
  { value: 'retired', label: 'Retired' },
  { value: 'other', label: 'Other' },
]


const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
]

export default function IntakeForm() {
  const { intakeToken } = useParams()
  const [phase, setPhase] = useState('form') // form | submitting | success | error
  const [errorMsg, setErrorMsg] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  // Use a ref for SSN so it never sits in reactive state
  const ssnRef = useRef('')
  const [ssnDisplay, setSsnDisplay] = useState('')

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    monthlyIncome: '',
    employmentType: '',
    consent: false,
  })

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (fieldErrors[field]) {
      setFieldErrors((prev) => { const next = { ...prev }; delete next[field]; return next })
    }
  }

  function handleSsnChange(e) {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 9)
    ssnRef.current = raw
    // Show only last 4 digits, mask the rest
    if (raw.length <= 4) {
      setSsnDisplay(raw)
    } else {
      const masked = '\u2022'.repeat(raw.length - 4) + raw.slice(-4)
      setSsnDisplay(masked)
    }
    if (fieldErrors.ssn) {
      setFieldErrors((prev) => { const next = { ...prev }; delete next.ssn; return next })
    }
  }

  function handleIncomeChange(e) {
    const raw = e.target.value.replace(/[^0-9.]/g, '')
    updateField('monthlyIncome', raw)
  }

  function validate() {
    const errors = {}
    if (!form.firstName.trim()) errors.firstName = 'Required'
    if (!form.lastName.trim()) errors.lastName = 'Required'
    if (!form.dateOfBirth) errors.dateOfBirth = 'Required'
    if (ssnRef.current.length !== 9) errors.ssn = 'Must be 9 digits'
    if (!form.street.trim()) errors.street = 'Required'
    if (!form.city.trim()) errors.city = 'Required'
    if (!form.state) errors.state = 'Required'
    if (!form.zip.trim()) errors.zip = 'Required'
    const income = parseFloat(form.monthlyIncome)
    if (!form.monthlyIncome || isNaN(income) || income <= 0) errors.monthlyIncome = 'Enter a positive amount'
    if (!form.employmentType) errors.employmentType = 'Required'
    if (!form.consent) errors.consent = 'You must consent to proceed'
    return errors
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errors = validate()
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setPhase('submitting')
    setErrorMsg('')

    try {
      const payload = {
        ...form,
        ssn: ssnRef.current,
        monthlyIncome: parseFloat(form.monthlyIncome),
      }

      const res = await fetch(`/api/intake/${intakeToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      // Clear SSN from memory immediately after sending
      ssnRef.current = ''
      setSsnDisplay('')

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || 'Something went wrong. Please try again.')
      }

      setPhase('success')
    } catch (err) {
      setErrorMsg(err.message)
      setPhase('error')
    }
  }

  if (phase === 'success') {
    return (
      <div className="intake-page">
        <div className="intake-card intake-success">
          <div className="success-icon">&#10003;</div>
          <h1>You're All Set!</h1>
          <p>Your info has been submitted. Your group organizer will follow up with next steps.</p>
          <p className="success-note">You can close this page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="intake-page">
      <div className="intake-card">
        <div className="intake-header">
          <h1>CommonGround</h1>
          <p className="intake-subtitle">Your group needs your info for the housing application. Fill this out and you're done.</p>
        </div>

        {(phase === 'error' && errorMsg) && (
          <div className="intake-error-banner">{errorMsg}</div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Name */}
          <div className="field-row">
            <div className="field-group">
              <label htmlFor="firstName">First Name</label>
              <input
                id="firstName"
                type="text"
                value={form.firstName}
                onChange={(e) => updateField('firstName', e.target.value)}
                className={fieldErrors.firstName ? 'field-error' : ''}
              />
              {fieldErrors.firstName && <span className="error-text">{fieldErrors.firstName}</span>}
            </div>
            <div className="field-group">
              <label htmlFor="lastName">Last Name</label>
              <input
                id="lastName"
                type="text"
                value={form.lastName}
                onChange={(e) => updateField('lastName', e.target.value)}
                className={fieldErrors.lastName ? 'field-error' : ''}
              />
              {fieldErrors.lastName && <span className="error-text">{fieldErrors.lastName}</span>}
            </div>
          </div>

          {/* DOB + SSN */}
          <div className="field-row">
            <div className="field-group">
              <label htmlFor="dateOfBirth">Date of Birth</label>
              <input
                id="dateOfBirth"
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => updateField('dateOfBirth', e.target.value)}
                className={fieldErrors.dateOfBirth ? 'field-error' : ''}
              />
              {fieldErrors.dateOfBirth && <span className="error-text">{fieldErrors.dateOfBirth}</span>}
            </div>
            <div className="field-group">
              <label htmlFor="ssn">Social Security Number</label>
              <input
                id="ssn"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={ssnDisplay}
                onChange={handleSsnChange}
                placeholder="&bull;&bull;&bull;&bull;&bull;1234"
                className={fieldErrors.ssn ? 'field-error' : ''}
              />
              <span className="field-hint">Your SSN is transmitted securely and never stored in your browser.</span>
              {fieldErrors.ssn && <span className="error-text">{fieldErrors.ssn}</span>}
            </div>
          </div>

          {/* Address */}
          <div className="field-group full-width">
            <label htmlFor="street">Street Address</label>
            <input
              id="street"
              type="text"
              value={form.street}
              onChange={(e) => updateField('street', e.target.value)}
              className={fieldErrors.street ? 'field-error' : ''}
            />
            {fieldErrors.street && <span className="error-text">{fieldErrors.street}</span>}
          </div>

          <div className="field-row field-row-3">
            <div className="field-group">
              <label htmlFor="city">City</label>
              <input
                id="city"
                type="text"
                value={form.city}
                onChange={(e) => updateField('city', e.target.value)}
                className={fieldErrors.city ? 'field-error' : ''}
              />
              {fieldErrors.city && <span className="error-text">{fieldErrors.city}</span>}
            </div>
            <div className="field-group">
              <label htmlFor="state">State</label>
              <select
                id="state"
                value={form.state}
                onChange={(e) => updateField('state', e.target.value)}
                className={fieldErrors.state ? 'field-error' : ''}
              >
                <option value="">Select</option>
                {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {fieldErrors.state && <span className="error-text">{fieldErrors.state}</span>}
            </div>
            <div className="field-group">
              <label htmlFor="zip">ZIP Code</label>
              <input
                id="zip"
                type="text"
                inputMode="numeric"
                maxLength="10"
                value={form.zip}
                onChange={(e) => updateField('zip', e.target.value)}
                className={fieldErrors.zip ? 'field-error' : ''}
              />
              {fieldErrors.zip && <span className="error-text">{fieldErrors.zip}</span>}
            </div>
          </div>

          {/* Financial */}
          <div className="field-row">
            <div className="field-group">
              <label htmlFor="monthlyIncome">Gross Monthly Income</label>
              <div className="input-prefix-wrap">
                <span className="input-prefix">$</span>
                <input
                  id="monthlyIncome"
                  type="text"
                  inputMode="decimal"
                  value={form.monthlyIncome}
                  onChange={handleIncomeChange}
                  placeholder="0.00"
                  className={fieldErrors.monthlyIncome ? 'field-error' : ''}
                />
              </div>
              {fieldErrors.monthlyIncome && <span className="error-text">{fieldErrors.monthlyIncome}</span>}
            </div>
            <div className="field-group">
              <label htmlFor="employmentType">Employment Type</label>
              <select
                id="employmentType"
                value={form.employmentType}
                onChange={(e) => updateField('employmentType', e.target.value)}
                className={fieldErrors.employmentType ? 'field-error' : ''}
              >
                <option value="">Select</option>
                {EMPLOYMENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {fieldErrors.employmentType && <span className="error-text">{fieldErrors.employmentType}</span>}
            </div>
          </div>

          {/* Consent */}
          <div className="consent-section">
            <label className="consent-label">
              <input
                type="checkbox"
                checked={form.consent}
                onChange={(e) => updateField('consent', e.target.checked)}
              />
              <span>
                I authorize this organization to perform a soft credit inquiry and background screening
                on my behalf. This will <strong>not</strong> affect my credit score.
              </span>
            </label>
            {fieldErrors.consent && <span className="error-text">{fieldErrors.consent}</span>}
          </div>

          <button
            type="submit"
            className="submit-btn"
            disabled={phase === 'submitting'}
          >
            {phase === 'submitting' ? (
              <span className="spinner-wrap"><span className="spinner" /> Submitting&hellip;</span>
            ) : (
              'Submit Info'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
