// Hackathon auth: check for a hardcoded API key in the Authorization header.
// Production would use real JWT sessions.
const ORG_API_KEY = process.env.ORG_API_KEY || 'commonground-dev-key';
const HARDCODED_ORG_ID = 'org-001';

function orgAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || header !== `Bearer ${ORG_API_KEY}`) {
    return res.status(401).json({ error: true, message: 'Unauthorized' });
  }
  req.orgId = HARDCODED_ORG_ID;
  next();
}

module.exports = { orgAuth };
