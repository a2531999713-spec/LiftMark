require('dotenv').config();
const knex = require('knex');
const db = knex({ client: 'pg', connection: process.env.DATABASE_URL });
(async () => {
  // 检查 plan_phases 表结构
  const phaseCols = await db.raw(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'plan_phases' ORDER BY ordinal_position;
  `);
  console.log('plan_phases columns:');
  phaseCols.rows.forEach(r => console.log('  ' + r.column_name + ' (' + r.data_type + ')'));

  // 检查 training_plans 表结构
  const planCols = await db.raw(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'training_plans' ORDER BY ordinal_position;
  `);
  console.log('\ntraining_plans columns:');
  planCols.rows.forEach(r => console.log('  ' + r.column_name + ' (' + r.data_type + ')'));

  // 检查 training_plans 里 188 用户的所有计划
  const plans = await db('training_plans').where({ user_id: 'usr_90fe5d00deaf431c8a15e140b056ff8e' });
  console.log('\ntraining_plans for usr_90fe5d00deaf431c8a15e140b056ff8e:', plans.length);
  plans.forEach(p => console.log('  id=' + p.id + ' name=' + p.name + ' client_id=' + p.client_id));

  // 检查 plan_phases 的数据
  const phases = await db('plan_phases').limit(5);
  console.log('\nplan_phases sample (5 rows):');
  phases.forEach(p => console.log('  ', JSON.stringify(p)));

  await db.destroy();
})().catch(e => { console.error(e.message); process.exit(1); });
