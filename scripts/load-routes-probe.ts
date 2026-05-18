console.log('starting');
import('../server/routes.ts').then(() => {
  console.log('ROUTES LOADED OK');
}).catch((e: any) => {
  console.error('LOAD FAIL ===');
  console.error('  errorKind:', e?.constructor?.name || typeof e);
  console.error('  message:', e?.message);
  console.error('  stack head:');
  console.error(e?.stack?.split('\n').slice(0, 10).join('\n'));
});
