// Housing affordability: 30% of gross monthly income
const AFFORDABILITY_THRESHOLD = 0.3;

// Debt-to-income ratio boundaries
const DTI = Object.freeze({
  HEALTHY_MAX: 0.36,
  ACCEPTABLE_MAX: 0.43,
});

// If removing a member pushes group DTI above this, they are a critical dependency
const RESILIENCE_THRESHOLD = 0.43;

// Weights for unit-based contribution model
const UNIT_SIZE_WEIGHTS = Object.freeze({
  studio: 0.7,
  '1br': 1.0,
  '2br': 1.3,
  '3br': 1.6,
});

// Hybrid model: 50% equal split, 50% income proportional
const HYBRID_SPLIT = Object.freeze({
  EQUAL_PORTION: 0.5,
  PROPORTIONAL_PORTION: 0.5,
});

module.exports = {
  AFFORDABILITY_THRESHOLD,
  DTI,
  RESILIENCE_THRESHOLD,
  UNIT_SIZE_WEIGHTS,
  HYBRID_SPLIT,
};
