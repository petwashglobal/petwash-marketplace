import { runReconciliationNow } from './server/services/DailyReconciliationJob';
async function main() {
  await runReconciliationNow('2026-03-29');
  console.log('DONE');
}
main();
