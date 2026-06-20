// routes/cv.js — CV Builder: projects, skills, certifications
const express = require('express');
const router = express.Router();
const buildCrudRouter = require('../lib/crudRouter');

router.use('/projects', buildCrudRouter({ table: 'cv_projects', fields: ['title', 'description', 'tech', 'link'] }));
router.use('/skills', buildCrudRouter({ table: 'cv_skills', fields: ['name', 'level', 'category'] }));
router.use('/certifications', buildCrudRouter({ table: 'cv_certifications', fields: ['title', 'issuer', 'date', 'link'] }));

module.exports = router;