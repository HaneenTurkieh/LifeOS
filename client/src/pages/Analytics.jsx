import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import GlassCard from '../components/GlassCard.jsx';
import PageLoader from '../components/Loader.jsx';

const PURPLE = '#7C6AF0';
const PIE_COLORS = ['#7C6AF0', '#FFB84D', '#4CC38A', '#FF7A63', '#06B6D4', '#A855F7'];

const tooltipStyle = {
  contentStyle: { background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(124,106,240,0.2)', borderRadius: 14, fontSize: 12 },
};

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    api.get('/analytics').then(setData).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !data) return <PageLoader />;

  return (
    <div>
      <PageHeader eyebrow="Analytics" title="Your trends, at a glance" subtitle="Tasks, habits, study time, mood and productivity over the last weeks." />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <GlassCard className="p-6">
          <h3 className="font-display font-semibold text-ink mb-4">Tasks completed per week</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.tasksPerWeek}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,34,51,0.06)" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="tasks" fill={PURPLE} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard delay={0.05} className="p-6">
          <h3 className="font-display font-semibold text-ink mb-4">Habits completed per week</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.habitsPerWeek}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,34,51,0.06)" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="habits" fill="#4CC38A" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard delay={0.1} className="p-6">
          <h3 className="font-display font-semibold text-ink mb-4">Study hours per week</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.studyHoursPerWeek}>
              <defs>
                <linearGradient id="studyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FFB84D" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#FFB84D" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,34,51,0.06)" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} />
              <Area type="monotone" dataKey="hours" stroke="#F59E0B" strokeWidth={2.5} fill="url(#studyGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard delay={0.15} className="p-6">
          <h3 className="font-display font-semibold text-ink mb-4">Mood trend (last 14 days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.moodTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,34,51,0.06)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[1, 5]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Line type="monotone" dataKey="mood" stroke="#FF7A63" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard delay={0.2} className="p-6">
          <h3 className="font-display font-semibold text-ink mb-4">Productivity trend (last 14 days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.productivityTrend}>
              <defs>
                <linearGradient id="prodGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PURPLE} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={PURPLE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,34,51,0.06)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} />
              <Area type="monotone" dataKey="score" stroke={PURPLE} strokeWidth={2.5} fill="url(#prodGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard delay={0.25} className="p-6">
          <h3 className="font-display font-semibold text-ink mb-4">Completed tasks by category</h3>
          {data.tasksByCategory.length === 0 ? (
            <p className="text-sm text-ink/40 py-10 text-center">Complete a few tasks to see this chart fill in.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data.tasksByCategory} dataKey="c" nameKey="category" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {data.tasksByCategory.map((entry, idx) => <Cell key={entry.category} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip {...tooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </GlassCard>
      </div>
    </div>
  );
}