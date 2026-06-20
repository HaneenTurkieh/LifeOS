// routes/internships.js — Internship Tracker
const buildCrudRouter = require('../lib/crudRouter');
module.exports = buildCrudRouter({
  table: 'internships',
  fields: ['company', 'role', 'status', 'applied_date', 'notes', 'link'],
  orderBy: 'id DESC',
});