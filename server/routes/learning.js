// routes/learning.js — Learning Tracker (courses, books, certifications)
const buildCrudRouter = require('../lib/crudRouter');
module.exports = buildCrudRouter({
  table: 'learning_items',
  fields: ['type', 'title', 'provider', 'status', 'progress', 'notes'],
  orderBy: 'created_at DESC',
});