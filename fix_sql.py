import re

FILE = '/home/runner/work/petwash-marketplace/petwash-marketplace/server/routes/prestige-pass.ts'

with open(FILE, 'r') as f:
    content = f.read()

original = content

# ── Group 1: Simple integer ID SELECTs ──────────────────────────────────────

# Line 14204
content = content.replace(
    'const reqRow = await pool.query(`SELECT * FROM approval_requests WHERE id = ${parseInt(requestId, 10)}`);',
    "const reqRow = await pool.query('SELECT * FROM approval_requests WHERE id = $1', [parseInt(requestId, 10)]);"
)

# Line 14641
content = content.replace(
    'const planResult = await pool.query(`SELECT * FROM remediation_plans WHERE id = ${parseInt(planId)}`);',
    "const planResult = await pool.query('SELECT * FROM remediation_plans WHERE id = $1', [parseInt(planId, 10)]);"
)

# Line 14644
content = content.replace(
    'const outcomesResult = await pool.query(`SELECT * FROM remediation_outcomes WHERE remediation_plan_id = ${parseInt(planId)}`);',
    "const outcomesResult = await pool.query('SELECT * FROM remediation_outcomes WHERE remediation_plan_id = $1', [parseInt(planId, 10)]);"
)

# Line 14885
content = content.replace(
    'const actionResult = await pool.query(`SELECT recommendation_score_id FROM recommendation_actions WHERE id = ${parseInt(sourceId)}`);',
    "const actionResult = await pool.query('SELECT recommendation_score_id FROM recommendation_actions WHERE id = $1', [parseInt(sourceId, 10)]);"
)

# Line 14892
content = content.replace(
    'const outcomeResult = await pool.query(`SELECT remediation_plan_id FROM remediation_outcomes WHERE id = ${parseInt(sourceId)}`);',
    "const outcomeResult = await pool.query('SELECT remediation_plan_id FROM remediation_outcomes WHERE id = $1', [parseInt(sourceId, 10)]);"
)

# Line 14902
content = content.replace(
    'const urResult = await pool.query(`SELECT recommendation_score_id FROM unified_recommendations WHERE id = ${parseInt(sourceId)}`);',
    "const urResult = await pool.query('SELECT recommendation_score_id FROM unified_recommendations WHERE id = $1', [parseInt(sourceId, 10)]);"
)

# Line 14993
content = content.replace(
    'const recRow = await pool.query(`SELECT * FROM unified_recommendations WHERE id = ${recommendationId}`);',
    "const recRow = await pool.query('SELECT * FROM unified_recommendations WHERE id = $1', [parseInt(recommendationId, 10)]);"
)

# Line 15525
content = content.replace(
    'const recRow = await pool.query(`SELECT * FROM unified_recommendations WHERE id = ${recId}`);',
    "const recRow = await pool.query('SELECT * FROM unified_recommendations WHERE id = $1', [parseInt(recId, 10)]);"
)

# Line 15927
content = content.replace(
    'const adj = await pool.query(`SELECT * FROM escalation_policy_adjustments WHERE id = ${id}`);',
    "const adj = await pool.query('SELECT * FROM escalation_policy_adjustments WHERE id = $1', [parseInt(id, 10)]);"
)

# Line 16015
content = content.replace(
    'const s = await pool.query(`SELECT * FROM reviewer_workload_suggestions WHERE id = ${suggestionId}`);',
    "const s = await pool.query('SELECT * FROM reviewer_workload_suggestions WHERE id = $1', [parseInt(suggestionId, 10)]);"
)

# Line 16156
content = content.replace(
    'await pool.query(`UPDATE governance_alerts SET acknowledged = true WHERE id = ${id}`);',
    "await pool.query('UPDATE governance_alerts SET acknowledged = true WHERE id = $1', [parseInt(id, 10)]);"
)

# Line 16616
content = content.replace(
    "await pool.query(`UPDATE go_live_checklist SET status = 'pending', verified_by = NULL, verified_at = NULL WHERE id = ${id}`);",
    "await pool.query(\"UPDATE go_live_checklist SET status = 'pending', verified_by = NULL, verified_at = NULL WHERE id = $1\", [parseInt(id, 10)]);"
)

# Line 16810
content = content.replace(
    'const r = await pool.query(`SELECT * FROM e2e_proof_runs WHERE id = ${parseInt(req.params.id)}`);',
    "const r = await pool.query('SELECT * FROM e2e_proof_runs WHERE id = $1', [parseInt(req.params.id, 10)]);"
)

# Line 17369
content = content.replace(
    "await pool.query(`UPDATE anomaly_events SET status = 'acknowledged' WHERE id = ${id}`);",
    "await pool.query(\"UPDATE anomaly_events SET status = 'acknowledged' WHERE id = $1\", [parseInt(id, 10)]);"
)

# Line 17380
content = content.replace(
    "await pool.query(`UPDATE anomaly_events SET status = 'resolved', resolved_at = NOW() WHERE id = ${id}`);",
    "await pool.query(\"UPDATE anomaly_events SET status = 'resolved', resolved_at = NOW() WHERE id = $1\", [parseInt(id, 10)]);"
)

# Line 17596
content = content.replace(
    'const aps = await pool.query(`SELECT priority_score FROM alert_priority_scores WHERE alert_id = ${anomalyEventId}`);',
    "const aps = await pool.query('SELECT priority_score FROM alert_priority_scores WHERE alert_id = $1', [parseInt(anomalyEventId, 10)]);"
)

# Line 17634 - second occurrence of similar pattern 
content = content.replace(
    'const aps = await pool.query(`SELECT priority_score FROM alert_priority_scores WHERE alert_id = ${anomalyEventId}`);',
    "const aps = await pool.query('SELECT priority_score FROM alert_priority_scores WHERE alert_id = $1', [parseInt(anomalyEventId, 10)]);"
)

# Line 17916
content = content.replace(
    'const rca = await pool.query(`SELECT * FROM incident_rca WHERE incident_id = ${id} ORDER BY generated_at DESC LIMIT 1`);',
    "const rca = await pool.query('SELECT * FROM incident_rca WHERE incident_id = $1 ORDER BY generated_at DESC LIMIT 1', [parseInt(id, 10)]);"
)

# Line 17931
content = content.replace(
    'const incRow = await pool.query(`SELECT * FROM incidents WHERE id = ${id}`);',
    "const incRow = await pool.query('SELECT * FROM incidents WHERE id = $1', [parseInt(id, 10)]);"
)

# Line 17964
content = content.replace(
    'const rcaRow = await pool.query(`SELECT * FROM incident_rca WHERE incident_id = ${id}`);',
    "const rcaRow = await pool.query('SELECT * FROM incident_rca WHERE incident_id = $1', [parseInt(id, 10)]);"
)

# Line 17938
content = content.replace(
    'const ae = await pool.query(`SELECT anomaly_type, detected_at FROM anomaly_events WHERE id = ${incident.anomaly_event_id}`);',
    "const ae = await pool.query('SELECT anomaly_type, detected_at FROM anomaly_events WHERE id = $1', [incident.anomaly_event_id]);"
)

# Line 18039
content = content.replace(
    'const incRow = await pool.query(`SELECT * FROM incidents WHERE id = ${incidentId}`);',
    "const incRow = await pool.query('SELECT * FROM incidents WHERE id = $1', [parseInt(incidentId, 10)]);"
)

# Line 18043
content = content.replace(
    'const rcaRow = await pool.query(`SELECT * FROM incident_rca WHERE incident_id = ${incidentId} ORDER BY generated_at DESC LIMIT 1`);',
    "const rcaRow = await pool.query('SELECT * FROM incident_rca WHERE incident_id = $1 ORDER BY generated_at DESC LIMIT 1', [parseInt(incidentId, 10)]);"
)

# Line 18053
content = content.replace(
    'const ae = await pool.query(`SELECT anomaly_type FROM anomaly_events WHERE id = ${inc.anomaly_event_id}`);',
    "const ae = await pool.query('SELECT anomaly_type FROM anomaly_events WHERE id = $1', [inc.anomaly_event_id]);"
)

# Line 18059
content = content.replace(
    "await pool.query(`DELETE FROM remediation_suggestions WHERE incident_id = ${incidentId} AND status = 'pending'`);",
    "await pool.query(\"DELETE FROM remediation_suggestions WHERE incident_id = $1 AND status = 'pending'\", [parseInt(incidentId, 10)]);"
)

# Line 18077
content = content.replace(
    'const suggestions = await pool.query(`SELECT * FROM remediation_suggestions WHERE incident_id = ${incidentId} ORDER BY rank ASC`);',
    "const suggestions = await pool.query('SELECT * FROM remediation_suggestions WHERE incident_id = $1 ORDER BY rank ASC', [parseInt(incidentId, 10)]);"
)

# Line 18097
content = content.replace(
    'const rows = await pool.query(`SELECT * FROM remediation_suggestions WHERE incident_id = ${incidentId} ORDER BY rank ASC`);',
    "const rows = await pool.query('SELECT * FROM remediation_suggestions WHERE incident_id = $1 ORDER BY rank ASC', [parseInt(incidentId, 10)]);"
)

# Line 18110
content = content.replace(
    'const sRow = await pool.query(`SELECT * FROM remediation_suggestions WHERE id = ${sid}`);',
    "const sRow = await pool.query('SELECT * FROM remediation_suggestions WHERE id = $1', [parseInt(sid, 10)]);"
)

# Line 18158
content = content.replace(
    'const updated = await pool.query(`SELECT * FROM remediation_suggestions WHERE id = ${sid}`);',
    "const updated = await pool.query('SELECT * FROM remediation_suggestions WHERE id = $1', [parseInt(sid, 10)]);"
)

# Line 18171
content = content.replace(
    'const sRow = await pool.query(`SELECT * FROM remediation_suggestions WHERE id = ${sid}`);',
    "const sRow = await pool.query('SELECT * FROM remediation_suggestions WHERE id = $1', [parseInt(sid, 10)]);"
)

# Line 18191
content = content.replace(
    'const updated = await pool.query(`SELECT * FROM remediation_suggestions WHERE id = ${sid}`);',
    "const updated = await pool.query('SELECT * FROM remediation_suggestions WHERE id = $1', [parseInt(sid, 10)]);"
)

# Line 18483 - first occurrence of rule.id UPDATE
content = content.replace(
    'await pool.query(`UPDATE self_healing_rules SET last_triggered_at = NOW(), trigger_count = trigger_count + 1 WHERE id = ${rule.id}`);\n        await logDecision(\'notify\');',
    "await pool.query('UPDATE self_healing_rules SET last_triggered_at = NOW(), trigger_count = trigger_count + 1 WHERE id = $1', [rule.id]);\n        await logDecision('notify');"
)

# Line 18503 - second occurrence  
content = content.replace(
    'await pool.query(`UPDATE self_healing_rules SET last_triggered_at = NOW(), trigger_count = trigger_count + 1 WHERE id = ${rule.id}`);\n          await logDecision(\'notify\', { reason: \'confidence_below_40\' });',
    "await pool.query('UPDATE self_healing_rules SET last_triggered_at = NOW(), trigger_count = trigger_count + 1 WHERE id = $1', [rule.id]);\n          await logDecision('notify', { reason: 'confidence_below_40' });"
)

# Line 18524 - third occurrence (after L3 execute)
content = content.replace(
    'await pool.query(`UPDATE self_healing_rules SET last_triggered_at = NOW(), trigger_count = trigger_count + 1 WHERE id = ${rule.id}`);\n          const openIncRes3',
    "await pool.query('UPDATE self_healing_rules SET last_triggered_at = NOW(), trigger_count = trigger_count + 1 WHERE id = $1', [rule.id]);\n          const openIncRes3"
)

# Line 18540 - fourth occurrence (L4)
content = content.replace(
    'await pool.query(`UPDATE self_healing_rules SET last_triggered_at = NOW(), trigger_count = trigger_count + 1 WHERE id = ${rule.id}`);\n        const openIncRes4',
    "await pool.query('UPDATE self_healing_rules SET last_triggered_at = NOW(), trigger_count = trigger_count + 1 WHERE id = $1', [rule.id]);\n        const openIncRes4"
)

# Line 18576 - remaining occurrences if any
# Check if there are more occurrences in the content after previous replacements
remaining_count = content.count('`UPDATE self_healing_rules SET last_triggered_at = NOW(), trigger_count = trigger_count + 1 WHERE id = ${rule.id}`')
print(f"Remaining rule.id UPDATE occurrences: {remaining_count}")

# Replace any remaining occurrences
content = content.replace(
    '`UPDATE self_healing_rules SET last_triggered_at = NOW(), trigger_count = trigger_count + 1 WHERE id = ${rule.id}`',
    "'UPDATE self_healing_rules SET last_triggered_at = NOW(), trigger_count = trigger_count + 1 WHERE id = $1', [rule.id]"
)

# Line 18685
content = content.replace(
    'await pool.query(`DELETE FROM self_healing_rules WHERE id = ${id}`);\n    return res.json({ deleted: id });',
    "await pool.query('DELETE FROM self_healing_rules WHERE id = $1', [parseInt(id, 10)]);\n    return res.json({ deleted: id });"
)

# Line 18705
content = content.replace(
    'const ruleRes = await pool.query(`SELECT * FROM self_healing_rules WHERE id = ${id}`);\n    if (!ruleRes.rows.length) return res.status(404).json({ error: \'Rule not found\' });\n    const rule = ruleRes.rows[0];\n\n    const setClauses: string[] = [];',
    "const ruleRes = await pool.query('SELECT * FROM self_healing_rules WHERE id = $1', [parseInt(id, 10)]);\n    if (!ruleRes.rows.length) return res.status(404).json({ error: 'Rule not found' });\n    const rule = ruleRes.rows[0];\n\n    const setClauses: string[] = [];"
)

# Line 18757
content = content.replace(
    'const updated = await pool.query(`SELECT * FROM self_healing_rules WHERE id = ${id}`);\n    return res.json({ rule: updated.rows[0], changes: auditRows });',
    "const updated = await pool.query('SELECT * FROM self_healing_rules WHERE id = $1', [parseInt(id, 10)]);\n    return res.json({ rule: updated.rows[0], changes: auditRows });"
)

# Line 18785
content = content.replace(
    'const ruleRes = await pool.query(`SELECT * FROM self_healing_rules WHERE id = ${id}`);\n    if (!ruleRes.rows.length) return res.status(404).json({ error: \'Rule not found\' });\n    const rows',
    "const ruleRes = await pool.query('SELECT * FROM self_healing_rules WHERE id = $1', [parseInt(id, 10)]);\n    if (!ruleRes.rows.length) return res.status(404).json({ error: 'Rule not found' });\n    const rows"
)

# Line 18896
content = content.replace(
    'const ruleRes = await pool.query(`SELECT * FROM self_healing_rules WHERE id = ${id}`);\n    if (!ruleRes.rows.length) return res.status(404).json({ error: \'Rule not found\' });\n    const rule = ruleRes.rows[0];\n    if (!rule.approval_required)',
    "const ruleRes = await pool.query('SELECT * FROM self_healing_rules WHERE id = $1', [parseInt(id, 10)]);\n    if (!ruleRes.rows.length) return res.status(404).json({ error: 'Rule not found' });\n    const rule = ruleRes.rows[0];\n    if (!rule.approval_required)"
)

# Line 18935
content = content.replace(
    'const execRes = await pool.query(`SELECT id, rule_id FROM self_healing_executions WHERE id = ${execId}`);',
    "const execRes = await pool.query('SELECT id, rule_id FROM self_healing_executions WHERE id = $1', [parseInt(execId, 10)]);"
)

# Line 18940
content = content.replace(
    'const existing = await pool.query(`SELECT id FROM false_positive_reviews WHERE execution_id = ${execId}`);',
    "const existing = await pool.query('SELECT id FROM false_positive_reviews WHERE execution_id = $1', [parseInt(execId, 10)]);"
)

# Line 18961
content = content.replace(
    'const del = await pool.query(`DELETE FROM false_positive_reviews WHERE execution_id = ${execId} RETURNING id`);',
    "const del = await pool.query('DELETE FROM false_positive_reviews WHERE execution_id = $1 RETURNING id', [parseInt(execId, 10)]);"
)

# Line 18976
content = content.replace(
    'const ruleRes = await pool.query(`SELECT id, name FROM self_healing_rules WHERE id = ${ruleId}`);',
    "const ruleRes = await pool.query('SELECT id, name FROM self_healing_rules WHERE id = $1', [parseInt(ruleId, 10)]);"
)

# Line 19026
content = content.replace(
    'const r = await pool.query(`SELECT * FROM false_positive_reviews WHERE execution_id = ${execId}`);',
    "const r = await pool.query('SELECT * FROM false_positive_reviews WHERE execution_id = $1', [parseInt(execId, 10)]);"
)

# Line 19043
content = content.replace(
    'const ruleRes = await pool.query(`SELECT * FROM self_healing_rules WHERE id = ${ruleId}`);\n    if (!ruleRes.rows.length) return res.status(404).json({ error: \'Rule not found\' });\n    const rule = ruleRes.rows[0];\n    const { enabled',
    "const ruleRes = await pool.query('SELECT * FROM self_healing_rules WHERE id = $1', [parseInt(ruleId, 10)]);\n    if (!ruleRes.rows.length) return res.status(404).json({ error: 'Rule not found' });\n    const rule = ruleRes.rows[0];\n    const { enabled"
)

# Line 19122
content = content.replace(
    'const ruleRes = await pool.query(`SELECT name FROM self_healing_rules WHERE id = ${ruleId}`);',
    "const ruleRes = await pool.query('SELECT name FROM self_healing_rules WHERE id = $1', [parseInt(ruleId, 10)]);"
)

# Line 19184
content = content.replace(
    'const anomaly = await pool.query(`SELECT * FROM anomaly_events WHERE id = ${anomalyEventId}`);',
    "const anomaly = await pool.query('SELECT * FROM anomaly_events WHERE id = $1', [parseInt(anomalyEventId, 10)]);"
)

# Line 19193
content = content.replace(
    'const aps = await pool.query(`SELECT * FROM alert_priority_scores WHERE alert_id = ${anomalyEventId}`);',
    "const aps = await pool.query('SELECT * FROM alert_priority_scores WHERE alert_id = $1', [parseInt(anomalyEventId, 10)]);"
)

# Line 19203
content = content.replace(
    'const ksLogs = await pool.query(`SELECT * FROM kill_switch_trigger_log WHERE anomaly_event_id = ${anomalyEventId} ORDER BY triggered_at ASC`);',
    "const ksLogs = await pool.query('SELECT * FROM kill_switch_trigger_log WHERE anomaly_event_id = $1 ORDER BY triggered_at ASC', [parseInt(anomalyEventId, 10)]);"
)

# Line 19225
content = content.replace(
    'const inc = await pool.query(`SELECT * FROM incidents WHERE id = ${id}`);',
    "const inc = await pool.query('SELECT * FROM incidents WHERE id = $1', [parseInt(id, 10)]);"
)

# Line 19328
content = content.replace(
    'const incRes = await pool.query(`SELECT * FROM incidents WHERE id = ${id}`);',
    "const incRes = await pool.query('SELECT * FROM incidents WHERE id = $1', [parseInt(id, 10)]);"
)

# Line 19418
content = content.replace(
    'const res2 = await pool.query(`SELECT id, title, postmortem_text FROM incidents WHERE id = ${id}`);',
    "const res2 = await pool.query('SELECT id, title, postmortem_text FROM incidents WHERE id = $1', [parseInt(id, 10)]);"
)

# Line 19510
content = content.replace(
    'const ruleRes = await pool.query(`SELECT * FROM self_healing_rules WHERE id = ${id}`);\n    if (!ruleRes.rows.length) return res.status(404).json({ error: \'Rule not found\' });\n    const rule = ruleRes.rows[0];\n    const newLevel',
    "const ruleRes = await pool.query('SELECT * FROM self_healing_rules WHERE id = $1', [parseInt(id, 10)]);\n    if (!ruleRes.rows.length) return res.status(404).json({ error: 'Rule not found' });\n    const rule = ruleRes.rows[0];\n    const newLevel"
)

# Line 19574
content = content.replace(
    'const ruleRes = await pool.query(`SELECT id, name, autonomy_level, approval_mode FROM self_healing_rules WHERE id = ${id}`);',
    "const ruleRes = await pool.query('SELECT id, name, autonomy_level, approval_mode FROM self_healing_rules WHERE id = $1', [parseInt(id, 10)]);"
)

# Line 19577
content = content.replace(
    'const promotions = await pool.query(`SELECT * FROM autonomy_promotions WHERE rule_id = ${id} ORDER BY promoted_at DESC LIMIT 20`);',
    "const promotions = await pool.query('SELECT * FROM autonomy_promotions WHERE rule_id = $1 ORDER BY promoted_at DESC LIMIT 20', [parseInt(id, 10)]);"
)

# Line 19578
content = content.replace(
    'const demotions = await pool.query(`SELECT * FROM autonomy_demotions WHERE rule_id = ${id} ORDER BY demoted_at DESC LIMIT 20`);',
    "const demotions = await pool.query('SELECT * FROM autonomy_demotions WHERE rule_id = $1 ORDER BY demoted_at DESC LIMIT 20', [parseInt(id, 10)]);"
)

# Line 19891
content = content.replace(
    'const ruleRes = await pool.query(`SELECT * FROM self_healing_rules WHERE id = ${id}`);\n    if (!ruleRes.rows.length) return res.status(404).json({ error: \'Rule not found\' });\n    const rule = ruleRes.rows[0];\n    const approval',
    "const ruleRes = await pool.query('SELECT * FROM self_healing_rules WHERE id = $1', [parseInt(id, 10)]);\n    if (!ruleRes.rows.length) return res.status(404).json({ error: 'Rule not found' });\n    const rule = ruleRes.rows[0];\n    const approval"
)

# ── Group 2: UPDATE with integer id ──────────────────────────────────────────

# Line 15935
content = content.replace(
    "await pool.query(`UPDATE escalation_policy_adjustments SET status = 'approved' WHERE id = ${id}`);",
    "await pool.query(\"UPDATE escalation_policy_adjustments SET status = 'approved' WHERE id = $1\", [parseInt(id, 10)]);"
)

# Line 15945
content = content.replace(
    "await pool.query(`UPDATE escalation_policy_adjustments SET status = 'rejected' WHERE id = ${id}`);",
    "await pool.query(\"UPDATE escalation_policy_adjustments SET status = 'rejected' WHERE id = $1\", [parseInt(id, 10)]);"
)

# ── Group 3: delta + scoreId ──────────────────────────────────────────────────

# Line 14888
content = content.replace(
    'await pool.query(`UPDATE recommendation_scores SET confidence_score = GREATEST(0, LEAST(100, confidence_score + ${delta})) WHERE id = ${scoreId}`);\n        updates.push(`recommendation_score #${scoreId} adjusted by ${delta > 0 ? \'+\' : \'\'}${delta}`);\n      }\n    } else if (sourceType === \'remediation_outcome\')',
    "await pool.query('UPDATE recommendation_scores SET confidence_score = GREATEST(0, LEAST(100, confidence_score + $1)) WHERE id = $2', [delta, scoreId]);\n        updates.push(`recommendation_score #${scoreId} adjusted by ${delta > 0 ? '+' : ''}${delta}`);\n      }\n    } else if (sourceType === 'remediation_outcome')"
)

# Line 14897-14902 (remediation_outcome delta fix) - the more complex subquery pattern
content = content.replace(
    'await pool.query(`\n          UPDATE recommendation_scores SET confidence_score = GREATEST(0, LEAST(100, confidence_score + ${delta}))\n          WHERE target_entity_type = (SELECT target_entity_type FROM remediation_plans WHERE id = ${planId} LIMIT 1)\n        `);',
    "await pool.query('UPDATE recommendation_scores SET confidence_score = GREATEST(0, LEAST(100, confidence_score + $1)) WHERE target_entity_type = (SELECT target_entity_type FROM remediation_plans WHERE id = $2 LIMIT 1)', [delta, planId]);"
)

# Line 14905 (unified_recommendation delta fix)
content = content.replace(
    'await pool.query(`UPDATE recommendation_scores SET confidence_score = GREATEST(0, LEAST(100, confidence_score + ${delta})) WHERE id = ${scoreId}`);\n        updates.push(`recommendation_score #${scoreId} adjusted by ${delta > 0 ? \'+\' : \'\'}${delta}`);\n      }\n    }\n    // Auto-create',
    "await pool.query('UPDATE recommendation_scores SET confidence_score = GREATEST(0, LEAST(100, confidence_score + $1)) WHERE id = $2', [delta, scoreId]);\n        updates.push(`recommendation_score #${scoreId} adjusted by ${delta > 0 ? '+' : ''}${delta}`);\n      }\n    }\n    // Auto-create"
)

# Line 14470
content = content.replace(
    'await pool.query(`UPDATE recommendation_scores SET confidence_score = GREATEST(0, confidence_score - 5) WHERE id = ${recommendationScoreId}`);',
    "await pool.query('UPDATE recommendation_scores SET confidence_score = GREATEST(0, confidence_score - 5) WHERE id = $1', [recommendationScoreId]);"
)

# Line 14433
content = content.replace(
    'await pool.query(`UPDATE recommendation_actions SET sla_met = false WHERE id = ${b.id}`);',
    "await pool.query('UPDATE recommendation_actions SET sla_met = false WHERE id = $1', [b.id]);"
)

# Line 14484
content = content.replace(
    'const r = await pool.query(`UPDATE recommendation_actions SET sla_met = ${!!slaMet} WHERE id = ${id} RETURNING *`);',
    "const r = await pool.query('UPDATE recommendation_actions SET sla_met = $1 WHERE id = $2 RETURNING *', [!!slaMet, parseInt(id, 10)]);"
)

# ── Group 4: Month-based queries ──────────────────────────────────────────────

# The month validation is already present (checked in view), but the queries use template literals
# Fix LIKE '${month}%' patterns
content = content.replace(
    "pool.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'closed') AS closed FROM finance_close_periods WHERE period_key LIKE '${month}%'`).catch(() => ({ rows: [{}] }))",
    "pool.query(\"SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'closed') AS closed FROM finance_close_periods WHERE period_key LIKE $1\", [month + '%']).catch(() => ({ rows: [{}] }))"
)

content = content.replace(
    "pool.query(`SELECT COUNT(*) AS total, SUM(net_amount_cents) AS total_net FROM wallet_transactions WHERE transaction_type = 'settlement' AND created_at >= '${month}-01' AND created_at < '${month}-01'::date + INTERVAL '1 month'`).catch(() => ({ rows: [{}] }))",
    "pool.query(\"SELECT COUNT(*) AS total, SUM(net_amount_cents) AS total_net FROM wallet_transactions WHERE transaction_type = 'settlement' AND created_at >= ($1 || '-01')::date AND created_at < ($1 || '-01')::date + INTERVAL '1 month'\", [month]).catch(() => ({ rows: [{}] }))"
)

content = content.replace(
    "pool.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'released') AS released FROM payout_batches WHERE created_at >= '${month}-01' AND created_at < '${month}-01'::date + INTERVAL '1 month'`).catch(() => ({ rows: [{}] }))",
    "pool.query(\"SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'released') AS released FROM payout_batches WHERE created_at >= ($1 || '-01')::date AND created_at < ($1 || '-01')::date + INTERVAL '1 month'\", [month]).catch(() => ({ rows: [{}] }))"
)

content = content.replace(
    "pool.query(`SELECT COUNT(*) AS total, SUM(delivered_count) AS delivered, SUM(failed_count) AS failed FROM governance_delivery_analytics WHERE sent_at >= '${month}-01' AND sent_at < '${month}-01'::date + INTERVAL '1 month'`).catch(() => ({ rows: [{}] }))",
    "pool.query(\"SELECT COUNT(*) AS total, SUM(delivered_count) AS delivered, SUM(failed_count) AS failed FROM governance_delivery_analytics WHERE sent_at >= ($1 || '-01')::date AND sent_at < ($1 || '-01')::date + INTERVAL '1 month'\", [month]).catch(() => ({ rows: [{}] }))"
)

content = content.replace(
    "pool.query(`SELECT AVG(confidence_score) AS avg_conf FROM recommendation_scores WHERE created_at >= '${month}-01' AND created_at < '${month}-01'::date + INTERVAL '1 month'`).catch(() => ({ rows: [{}] }))",
    "pool.query(\"SELECT AVG(confidence_score) AS avg_conf FROM recommendation_scores WHERE created_at >= ($1 || '-01')::date AND created_at < ($1 || '-01')::date + INTERVAL '1 month'\", [month]).catch(() => ({ rows: [{}] }))"
)

# The INSERT with month, packStr, signature
content = content.replace(
    "await pool.query(`\n      INSERT INTO operating_review_packs (month, pack_json, signature)\n      VALUES ('${month}', '${packStr}'::jsonb, '${signature}')\n      ON CONFLICT (month) DO UPDATE SET pack_json = EXCLUDED.pack_json, signature = EXCLUDED.signature, generated_at = NOW()\n    `);",
    "await pool.query('INSERT INTO operating_review_packs (month, pack_json, signature) VALUES ($1, $2::jsonb, $3) ON CONFLICT (month) DO UPDATE SET pack_json = EXCLUDED.pack_json, signature = EXCLUDED.signature, generated_at = NOW()', [month, JSON.stringify(packJson), signature]);"
)

# ── Group 5: String key queries ───────────────────────────────────────────────

# Line 16224
content = content.replace(
    "const r = await pool.query(`SELECT enabled FROM system_kill_switches WHERE key = '${key}'`);",
    "const r = await pool.query('SELECT enabled FROM system_kill_switches WHERE key = $1', [key]);"
)

# Line 16232
content = content.replace(
    "const r = await pool.query(`SELECT response_hash FROM idempotency_keys WHERE key = '${iKey.replace(/'/g, \"''\")}' AND endpoint = '${endpoint.replace(/'/g, \"''\")}'\`);",
    "const r = await pool.query('SELECT response_hash FROM idempotency_keys WHERE key = $1 AND endpoint = $2', [iKey, endpoint]);"
)

# Line 16259
content = content.replace(
    "await pool.query(`INSERT INTO system_kill_switches (key, enabled) VALUES ('${k}', true) ON CONFLICT (key) DO NOTHING`);",
    "await pool.query('INSERT INTO system_kill_switches (key, enabled) VALUES ($1, true) ON CONFLICT (key) DO NOTHING', [k]);"
)

# Line 16272
content = content.replace(
    "const current = await pool.query(`SELECT enabled FROM system_kill_switches WHERE key = '${key.replace(/'/g, \"''\")}'`);",
    "const current = await pool.query('SELECT enabled FROM system_kill_switches WHERE key = $1', [key]);"
)

# Line 16275
content = content.replace(
    "await pool.query(`UPDATE system_kill_switches SET enabled = ${newVal}, updated_at = NOW() WHERE key = '${key.replace(/'/g, \"''\")}'`);",
    "await pool.query('UPDATE system_kill_switches SET enabled = $1, updated_at = NOW() WHERE key = $2', [newVal, key]);"
)

# Line 17600
content = content.replace(
    "const current = await pool.query(`SELECT enabled FROM system_kill_switches WHERE key = '${killSwitchKey}'`);",
    "const current = await pool.query('SELECT enabled FROM system_kill_switches WHERE key = $1', [killSwitchKey]);"
)

# Line 17603
content = content.replace(
    "await pool.query(`INSERT INTO system_kill_switches (key, enabled) VALUES ('${killSwitchKey}', false) ON CONFLICT (key) DO UPDATE SET enabled = false, updated_at = NOW()`);",
    "await pool.query('INSERT INTO system_kill_switches (key, enabled) VALUES ($1, false) ON CONFLICT (key) DO UPDATE SET enabled = false, updated_at = NOW()', [killSwitchKey]);"
)

# Line 17605
content = content.replace(
    "await pool.query(`UPDATE system_kill_switches SET enabled = false, updated_at = NOW() WHERE key = '${killSwitchKey}'`);",
    "await pool.query('UPDATE system_kill_switches SET enabled = false, updated_at = NOW() WHERE key = $1', [killSwitchKey]);"
)

# Line 18121
content = content.replace(
    "await pool.query(`UPDATE system_kill_switches SET enabled = ${val}, updated_at = NOW() WHERE key = '${params.key}'`);",
    "await pool.query('UPDATE system_kill_switches SET enabled = $1, updated_at = NOW() WHERE key = $2', [val, params.key]);"
)

# ── Group 6: JSONB patterns ───────────────────────────────────────────────────

# Line 16886
content = content.replace(
    """await pool.query(`UPDATE go_live_gates SET checks_json = checks_json || '{"config_audit_passed": ${gateVal}}'::jsonb WHERE id = (SELECT id FROM go_live_gates ORDER BY id DESC LIMIT 1)`);""",
    """await pool.query("UPDATE go_live_gates SET checks_json = checks_json || jsonb_build_object('config_audit_passed', $1::boolean) WHERE id = (SELECT id FROM go_live_gates ORDER BY id DESC LIMIT 1)", [gateVal]);"""
)

# Line 16983
content = content.replace(
    """await pool.query(`UPDATE go_live_gates SET checks_json = checks_json || '{"shadow_no_mismatches": ${noMismatches}}'::jsonb WHERE id = (SELECT id FROM go_live_gates ORDER BY id DESC LIMIT 1)`);""",
    """await pool.query("UPDATE go_live_gates SET checks_json = checks_json || jsonb_build_object('shadow_no_mismatches', $1::boolean) WHERE id = (SELECT id FROM go_live_gates ORDER BY id DESC LIMIT 1)", [noMismatches]);"""
)

# Line 17067
content = content.replace(
    """await pool.query(`UPDATE go_live_gates SET checks_json = checks_json || '{"drill_success_rate_ok": ${drillOk}}'::jsonb WHERE id = (SELECT id FROM go_live_gates ORDER BY id DESC LIMIT 1)`);""",
    """await pool.query("UPDATE go_live_gates SET checks_json = checks_json || jsonb_build_object('drill_success_rate_ok', $1::boolean) WHERE id = (SELECT id FROM go_live_gates ORDER BY id DESC LIMIT 1)", [drillOk]);"""
)

# ── Group 7: Other parameterized ─────────────────────────────────────────────

# Line 17154
content = content.replace(
    """await pool.query(`UPDATE go_live_gates SET status = 'approved', approved_by = '${by}', approved_at = NOW() WHERE id = (SELECT id FROM go_live_gates ORDER BY id DESC LIMIT 1)`);""",
    """await pool.query("UPDATE go_live_gates SET status = 'approved', approved_by = $1, approved_at = NOW() WHERE id = (SELECT id FROM go_live_gates ORDER BY id DESC LIMIT 1)", [by]);"""
)

# Line 17214
content = content.replace(
    "await pool.query(`INSERT INTO rollout_phases (phase, traffic_percentage, enabled) VALUES ('${phase}', ${traffic}, true)`);",
    "await pool.query('INSERT INTO rollout_phases (phase, traffic_percentage, enabled) VALUES ($1, $2, true)', [phase, traffic]);"
)

# Line 19398
content = content.replace(
    "await pool.query(`UPDATE incidents SET postmortem_text = '${postmortemText.replace(/'/g, \"''\")}' WHERE id = ${id}`);",
    "await pool.query('UPDATE incidents SET postmortem_text = $1 WHERE id = $2', [postmortemText, parseInt(id, 10)]);"
)

# Line 19552
content = content.replace(
    'await pool.query(`UPDATE self_healing_rules SET autonomy_level = ${newLevel} WHERE id = ${id}`);',
    "await pool.query('UPDATE self_healing_rules SET autonomy_level = $1 WHERE id = $2', [newLevel, parseInt(id, 10)]);"
)

# ── Group 8: Dynamic SET clause patterns ─────────────────────────────────────

# Line 15229: review_follow_up_actions SET
content = content.replace(
    'const r = await pool.query(`UPDATE review_follow_up_actions SET ${sets.join(\', \')} WHERE id = ${id} RETURNING *`);',
    "values.push(parseInt(id, 10));\n    const r = await pool.query(`UPDATE review_follow_up_actions SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`, values);"
)

# Line 18673: self_healing_rules PATCH SET
content = content.replace(
    'const r = await pool.query(`UPDATE self_healing_rules SET ${setClauses.join(\', \')} WHERE id = ${id} RETURNING *`);\n    if (!r.rows.length) return res.status(404).json({ error: \'Rule not found\' });\n    return res.json({ rule: r.rows[0] });\n  } catch (err: any) {\n    return res.status(500).json({ error: \'Update failed\'',
    "const values: any[] = [];\n    setClauses.forEach((clause, i) => {\n      // reindex existing $N placeholders — they were set as positional but we rebuild\n    });\n    // rebuild setClauses with proper $N indices\n    const setClauses2: string[] = [];\n    if (name !== undefined) { values.push(name); setClauses2.push(`name = $${values.length}`); }\n    if (minScore !== undefined) { values.push(parseInt(minScore)); setClauses2.push(`min_score = $${values.length}`); }\n    if (consecutiveTriggers !== undefined) { values.push(parseInt(consecutiveTriggers)); setClauses2.push(`consecutive_triggers = $${values.length}`); }\n    if (enabled !== undefined) { values.push(!!enabled); setClauses2.push(`enabled = $${values.length}`); }\n    if (rationale !== undefined) { values.push(rationale); setClauses2.push(`rationale = $${values.length}`); }\n    values.push(parseInt(id, 10));\n    const r = await pool.query(`UPDATE self_healing_rules SET ${setClauses2.join(', ')} WHERE id = $${values.length} RETURNING *`, values);\n    if (!r.rows.length) return res.status(404).json({ error: 'Rule not found' });\n    return res.json({ rule: r.rows[0] });\n  } catch (err: any) {\n    return res.status(500).json({ error: 'Update failed'"
)

# Line 18743: self_healing_rules tune SET
content = content.replace(
    'await pool.query(`UPDATE self_healing_rules SET ${setClauses.join(\', \')} WHERE id = ${id}`);\n\n    for (const row of auditRows)',
    "const tuneValues: any[] = [];\n    const tuneClauses: string[] = [];\n    if (minScore !== undefined && setClauses.some(c => c.startsWith('min_score'))) { tuneValues.push(parseInt(minScore)); tuneClauses.push(`min_score = $${tuneValues.length}`); }\n    if (consecutiveTriggers !== undefined && setClauses.some(c => c.startsWith('consecutive_triggers'))) { tuneValues.push(parseInt(consecutiveTriggers)); tuneClauses.push(`consecutive_triggers = $${tuneValues.length}`); }\n    if (cooldownMinutes !== undefined && setClauses.some(c => c.startsWith('cooldown_minutes'))) { tuneValues.push(parseInt(cooldownMinutes)); tuneClauses.push(`cooldown_minutes = $${tuneValues.length}`); }\n    tuneValues.push(parseInt(id, 10));\n    await pool.query(`UPDATE self_healing_rules SET ${tuneClauses.join(', ')} WHERE id = $${tuneValues.length}`, tuneValues);\n\n    for (const row of auditRows)"
)

# ── Group 9: Conditional summary UPDATE ──────────────────────────────────────

# Line 19261
content = content.replace(
    "await pool.query(`UPDATE incidents SET status = 'resolved', resolved_at = NOW()${summary ? `, summary = '${summary.replace(/'/g, \"''\")}'\` : ''} WHERE id = ${id}`);",
    """if (summary) {
      await pool.query("UPDATE incidents SET status = $1, resolved_at = NOW(), summary = $2 WHERE id = $3", ['resolved', summary, parseInt(id, 10)]);
    } else {
      await pool.query("UPDATE incidents SET status = $1, resolved_at = NOW() WHERE id = $2", ['resolved', parseInt(id, 10)]);
    }"""
)

# ── Group 10: Complex INSERTs ─────────────────────────────────────────────────

# Line 19297
content = content.replace(
    "await pool.query(`INSERT INTO incident_timeline_entries (incident_id, event_type, content, actor, metadata_json, occurred_at) VALUES (${incident.id}, 'anomaly_detected', 'Anomaly detected: ${a.anomaly_type} — ${a.severity} severity, +${parseFloat(a.deviation_pct).toFixed(1)}% deviation', 'anomaly_engine', '{\"anomaly_id\":${a.id},\"severity\":\"${a.severity}\",\"score\":${a.priority_score}}'::jsonb, '${a.detected_at}')`);",
    "await pool.query('INSERT INTO incident_timeline_entries (incident_id, event_type, content, actor, metadata_json, occurred_at) VALUES ($1, $2, $3, $4, $5::jsonb, $6)', [incident.id, 'anomaly_detected', 'Anomaly detected: ' + a.anomaly_type + ' — ' + a.severity + ' severity, +' + parseFloat(a.deviation_pct).toFixed(1) + '% deviation', 'anomaly_engine', JSON.stringify({anomaly_id: a.id, severity: a.severity, score: a.priority_score}), a.detected_at]);"
)

# Line 19302
content = content.replace(
    "await pool.query(`INSERT INTO incident_timeline_entries (incident_id, event_type, content, actor, metadata_json, occurred_at) VALUES (${incident.id}, 'priority_scored', 'Alert prioritized: score ${s.priority_score}/100, rank #${s.rank}', 'priority_engine', '{\"score\":${s.priority_score},\"rank\":${s.rank}}'::jsonb, '${s.computed_at}')`);",
    "await pool.query('INSERT INTO incident_timeline_entries (incident_id, event_type, content, actor, metadata_json, occurred_at) VALUES ($1, $2, $3, $4, $5::jsonb, $6)', [incident.id, 'priority_scored', 'Alert prioritized: score ' + s.priority_score + '/100, rank #' + s.rank, 'priority_engine', JSON.stringify({score: s.priority_score, rank: s.rank}), s.computed_at]);"
)

# Line 19307
content = content.replace(
    "await pool.query(`INSERT INTO incident_timeline_entries (incident_id, event_type, content, actor, metadata_json, occurred_at) VALUES (${incident.id}, 'kill_switch_${ks.action_taken}', 'Kill switch ${ks.kill_switch_key} ${ks.action_taken}', 'operator', '{\"kill_switch_key\":\"${ks.kill_switch_key}\",\"score\":${ks.priority_score}}'::jsonb, '${ks.triggered_at}')`);",
    "await pool.query('INSERT INTO incident_timeline_entries (incident_id, event_type, content, actor, metadata_json, occurred_at) VALUES ($1, $2, $3, $4, $5::jsonb, $6)', [incident.id, 'kill_switch_' + ks.action_taken, 'Kill switch ' + ks.kill_switch_key + ' ' + ks.action_taken, 'operator', JSON.stringify({kill_switch_key: ks.kill_switch_key, score: ks.priority_score}), ks.triggered_at]);"
)

# Count changes
changed = sum(1 for a, b in zip(original.splitlines(), content.splitlines()) if a != b)
print(f"Lines changed: {changed}")
print(f"Original size: {len(original)}")
print(f"New size: {len(content)}")

# Check for remaining template literal pool.query calls
remaining = re.findall(r'pool\.query\(`[^`]*\$\{[^}]+\}[^`]*`', content)
print(f"\nRemaining template literal injections: {len(remaining)}")
for r in remaining[:20]:
    print(f"  {r[:120]}")

with open(FILE, 'w') as f:
    f.write(content)

print("\nDone writing file.")
