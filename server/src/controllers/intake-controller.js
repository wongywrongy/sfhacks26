const { EmploymentType, UnitSize } = require('../../../shared/enums');
const { processIntake } = require('../services/intake-service');

const EMPLOYMENT_VALUES = Object.values(EmploymentType);
const UNIT_VALUES = Object.values(UnitSize);

function validateIntake(body) {
  const errors = [];

  if (!body.firstName?.trim()) errors.push({ field: 'firstName', message: 'First name is required' });
  if (!body.lastName?.trim()) errors.push({ field: 'lastName', message: 'Last name is required' });

  if (!body.dateOfBirth) {
    errors.push({ field: 'dateOfBirth', message: 'Date of birth is required' });
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(body.dateOfBirth)) {
    errors.push({ field: 'dateOfBirth', message: 'Date of birth must be YYYY-MM-DD' });
  }

  if (!body.ssn) {
    errors.push({ field: 'ssn', message: 'SSN is required' });
  } else if (!/^\d{9}$/.test(body.ssn)) {
    errors.push({ field: 'ssn', message: 'SSN must be exactly 9 digits' });
  }

  if (!body.street?.trim()) errors.push({ field: 'street', message: 'Street address is required' });
  if (!body.city?.trim()) errors.push({ field: 'city', message: 'City is required' });
  if (!body.state?.trim()) errors.push({ field: 'state', message: 'State is required' });
  if (!body.zip?.trim()) errors.push({ field: 'zip', message: 'ZIP code is required' });

  const income = Number(body.monthlyIncome);
  if (!body.monthlyIncome || isNaN(income) || income <= 0) {
    errors.push({ field: 'monthlyIncome', message: 'Monthly income must be a positive number' });
  }

  if (!EMPLOYMENT_VALUES.includes(body.employmentType)) {
    errors.push({ field: 'employmentType', message: 'Invalid employment type' });
  }

  if (!UNIT_VALUES.includes(body.unitPreference)) {
    errors.push({ field: 'unitPreference', message: 'Invalid unit size preference' });
  }

  if (body.consent !== true) {
    errors.push({ field: 'consent', message: 'Consent is required to proceed' });
  }

  return errors;
}

async function handleIntake(req, res) {
  const errors = validateIntake(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: true, message: errors[0].message, field: errors[0].field, errors });
  }

  const memberData = {
    firstName: req.body.firstName.trim(),
    lastName: req.body.lastName.trim(),
    dateOfBirth: req.body.dateOfBirth,
    ssn: req.body.ssn,
    street: req.body.street.trim(),
    city: req.body.city.trim(),
    state: req.body.state.trim(),
    zip: req.body.zip.trim(),
    monthlyIncome: Number(req.body.monthlyIncome),
    employmentType: req.body.employmentType,
    unitSize: req.body.unitPreference,
  };

  const result = await processIntake(req.params.intakeToken, memberData);

  if (result.error) {
    return res.status(404).json({ error: true, message: result.message });
  }

  res.status(201).json({ success: true, message: 'Your information has been submitted successfully.' });
}

module.exports = { handleIntake };
