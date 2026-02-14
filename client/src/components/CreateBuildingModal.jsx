import { useState } from 'react';
import { api } from '../api';

export default function CreateBuildingModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    address: '',
    city: '',
    state: '',
    type: 'house',
  });
  const [units, setUnits] = useState([{ name: '', bedrooms: '', monthlyCost: '' }]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // When switching to house, reset to single unit
      if (field === 'type' && value === 'house') {
        setUnits([{ name: '', bedrooms: '', monthlyCost: '' }]);
      }
      return next;
    });
  }

  function updateUnit(index, field, value) {
    setUnits((prev) => prev.map((u, i) => (i === index ? { ...u, [field]: value } : u)));
  }

  function addUnit() {
    setUnits((prev) => [...prev, { name: '', bedrooms: '', monthlyCost: '' }]);
  }

  function removeUnit(index) {
    setUnits((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const data = {
        address: form.address,
        city: form.city,
        state: form.state,
        type: form.type,
        units: units.map((u) => ({
          name: form.type === 'house' ? null : u.name || null,
          bedrooms: Number(u.bedrooms) || 0,
          monthlyCost: Number(u.monthlyCost) || 0,
        })),
      };
      const building = await api.createBuilding(data);
      onCreated(building);
    } catch (err) {
      setError(err.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const isHouse = form.type === 'house';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Property</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>Address *</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => update('address', e.target.value)}
              placeholder="412 Irving St"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>City *</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => update('city', e.target.value)}
                placeholder="San Francisco"
                required
              />
            </div>
            <div className="form-group">
              <label>State *</label>
              <input
                type="text"
                value={form.state}
                onChange={(e) => update('state', e.target.value)}
                placeholder="CA"
                maxLength={2}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Type *</label>
            <select value={form.type} onChange={(e) => update('type', e.target.value)}>
              <option value="house">House</option>
              <option value="apartment">Apartment</option>
              <option value="condo">Condo</option>
            </select>
          </div>

          {isHouse ? (
            <div className="form-row">
              <div className="form-group">
                <label>Bedrooms</label>
                <input
                  type="number"
                  value={units[0]?.bedrooms || ''}
                  onChange={(e) => updateUnit(0, 'bedrooms', e.target.value)}
                  placeholder="3"
                />
              </div>
              <div className="form-group">
                <label>Monthly Cost ($)</label>
                <input
                  type="number"
                  value={units[0]?.monthlyCost || ''}
                  onChange={(e) => updateUnit(0, 'monthlyCost', e.target.value)}
                  placeholder="3600"
                />
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Units</label>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addUnit}>+ Add Unit</button>
              </div>
              {units.map((u, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                    {i === 0 && <label>Name</label>}
                    <input
                      type="text"
                      value={u.name}
                      onChange={(e) => updateUnit(i, 'name', e.target.value)}
                      placeholder={`Unit ${i + 1}A`}
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    {i === 0 && <label>BR</label>}
                    <input
                      type="number"
                      value={u.bedrooms}
                      onChange={(e) => updateUnit(i, 'bedrooms', e.target.value)}
                      placeholder="2"
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1.5, marginBottom: 0 }}>
                    {i === 0 && <label>$/mo</label>}
                    <input
                      type="number"
                      value={u.monthlyCost}
                      onChange={(e) => updateUnit(i, 'monthlyCost', e.target.value)}
                      placeholder="2400"
                    />
                  </div>
                  {units.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeUnit(i)}
                      style={{
                        background: 'none', border: 'none', color: 'var(--text-muted)',
                        cursor: 'pointer', fontSize: 16, padding: '4px 6px', lineHeight: 1,
                      }}
                    >&times;</button>
                  )}
                </div>
              ))}
            </div>
          )}

          {error && <div className="form-error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Add Property'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
