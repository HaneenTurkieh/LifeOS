// routes/projects.js — Project Tracker (idea -> design -> dev -> testing -> deployment)
const buildCrudRouter = require('../lib/crudRouter');
module.exports = buildCrudRouter({
  table: 'projects',
  fields: ['title', 'description', 'stage', 'progress'],
  orderBy: 'created_at DESC',
});