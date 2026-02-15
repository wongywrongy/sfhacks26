import { useState } from 'react';
import { api } from '../api';

export default function CreateProjectModal({ onClose, onCreated, buildingId, unitId, prefillCity, prefillState, prefillMonthlyCost }) {
  const hasBuildingContext = !!(buildingId && unitId);
  const [form, setForm] = useState({
    name: '',
    priceLow: '',
    priceHigh: '',
    estimatedMonthlyCost: prefillMonthlyCost ? String(prefillMonthlyCost) : '',
    city: prefillCity || '',
    state: prefillState || '',
    expectedMemberCount: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const payload = {
        name: form.name,
        priceLow: Number(form.priceLow) || 0,
        priceHigh: Number(form.priceHigh) || 0,
        estimatedMonthlyCost: Number(form.estimatedMonthlyCost),
        city: form.city,
        state: form.state,
        expectedMemberCount: Number(form.expectedMemberCount),
      };
      if (hasBuildingContext) {
        payload.buildingId = buildingId;
        payload.unitId = unitId;
      }
      const project = await api.createProject(payload);
      onCreated(project);
    } catch (err) {
      setError(err.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{hasBuildingContext ? 'Create Deal' : 'Create New Group'}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>Group Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="e.g. The Sunset Crew"
              required
            />
          </div>

          {!hasBuildingContext && (
            <div className="form-row">
              <div className="form-group">
                <label>Price Range Low ($)</label>
                <input
                  type="number"
                  value={form.priceLow}
                  onChange={(e) => update('priceLow', e.target.value)}
                  placeholder="400000"
                />
              </div>
              <div className="form-group">
                <label>Price Range High ($)</label>
                <input
                  type="number"
                  value={form.priceHigh}
                  onChange={(e) => update('priceHigh', e.target.value)}
                  placeholder="600000"
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Estimated Monthly Cost ($) *</label>
            <input
              type="number"
              value={form.estimatedMonthlyCost}
              onChange={(e) => update('estimatedMonthlyCost', e.target.value)}
              placeholder="3000"
              required
              disabled={hasBuildingContext && prefillMonthlyCost}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>City</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => update('city', e.target.value)}
                placeholder="San Francisco"
                disabled={hasBuildingContext && prefillCity}
              />
            </div>
            <div className="form-group">
              <label>State</label>
              <input
                type="text"
                value={form.state}
                onChange={(e) => update('state', e.target.value)}
                placeholder="CA"
                maxLength={2}
                disabled={hasBuildingContext && prefillState}
              />
            </div>
          </div>

          <div className="form-group">
            <label>How Many People? (2-10) *</label>
            <input
              type="number"
              value={form.expectedMemberCount}
              onChange={(e) => update('expectedMemberCount', e.target.value)}
              min="2"
              max="10"
              required
            />
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creating...' : hasBuildingContext ? 'Create Deal' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
