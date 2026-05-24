/**
 * Admin payment-device stock tests.
 *
 * Covers the CRUD + assignment-history endpoints WITHOUT touching the
 * real DB. Uses a thin in-memory mock of the drizzle db object so we
 * can verify route logic + Zod validation + history-write ordering.
 *
 * Real DB safety (append-only trigger, unique constraints) is enforced
 * by migration 0031 and tested separately by Postgres itself.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const state = vi.hoisted(() => ({
  devices: [] as any[],
  assignments: [] as any[],
  nextDeviceId: 1,
  nextAssignmentId: 1,
  // Set per-test to force the create path to throw a 23505 dup-key error
  forceDupOnInsert: false,
}));

// Mock the schema barrel — only the symbols this route imports.
vi.mock('@shared/schema', () => ({
  paymentDevices: {
    id: 'id', serialNumber: 'serial_number', provider: 'provider', model: 'model',
    status: 'status', createdAt: 'created_at', updatedAt: 'updated_at',
    assignedMachineId: 'assigned_machine_id', assignedLocationId: 'assigned_location_id',
    installationDate: 'installation_date',
  },
  paymentDeviceAssignments: {
    id: 'id', deviceId: 'device_id', performedAt: 'performed_at',
  },
}));

// Minimal drizzle-shaped db mock. Each fluent chain ends in a thenable
// that resolves with the data the test set in `state`. Distinguish select
// vs insert vs update by tracking the most-recent verb.
vi.mock('../db', () => {
  function buildSelect() {
    return {
      from: (_table: any) => ({
        where: (_w: any) => ({
          limit: (_n: number) => ({
            then: (resolve: any) => Promise.resolve(state.devices.filter(filterMatch(_w)).slice(0, _n)).then(resolve),
          }),
          orderBy: (_o: any) => ({
            then: (resolve: any) => Promise.resolve(state.assignments.filter(filterMatch(_w))).then(resolve),
          }),
        }),
        orderBy: (_o: any) => ({
          then: (resolve: any) => Promise.resolve([...state.devices]).then(resolve),
        }),
      }),
    };
  }
  function buildInsert(table: any) {
    return {
      values: (vals: any) => {
        if (table?.id === 'id' && table?.serial_number === 'serial_number') {
          // Pretty fragile — but the mocks above only have these two tables
          // and the create path always inserts paymentDevices first.
        }
        return {
          returning: () => {
            if (state.forceDupOnInsert) {
              return Promise.reject({ code: '23505' });
            }
            const isDevice = 'serialNumber' in vals;
            if (isDevice) {
              const row = {
                id: state.nextDeviceId++,
                provider: vals.provider ?? 'nayax',
                model: vals.model,
                serialNumber: vals.serialNumber,
                partNumber: vals.partNumber ?? null,
                nayaxTerminalId: vals.nayaxTerminalId ?? null,
                simIccid: vals.simIccid ?? null,
                notes: vals.notes ?? null,
                status: vals.status ?? 'in_stock',
                assignedMachineId: null,
                assignedLocationId: null,
                installationDate: null,
                lastSeenAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              state.devices.push(row);
              return Promise.resolve([row]);
            }
            const arow = { id: state.nextAssignmentId++, ...vals, performedAt: new Date() };
            state.assignments.push(arow);
            return Promise.resolve([arow]);
          },
          then: (resolve: any) => {
            const isDevice = 'serialNumber' in vals;
            if (isDevice) {
              const row = {
                id: state.nextDeviceId++,
                provider: vals.provider ?? 'nayax',
                model: vals.model,
                serialNumber: vals.serialNumber,
                status: vals.status ?? 'in_stock',
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              state.devices.push(row);
              return Promise.resolve([row]).then(resolve);
            }
            const arow = { id: state.nextAssignmentId++, ...vals, performedAt: new Date() };
            state.assignments.push(arow);
            return Promise.resolve([arow]).then(resolve);
          },
        };
      },
    };
  }
  function buildUpdate(_table: any) {
    return {
      set: (vals: any) => ({
        where: (w: any) => ({
          returning: () => {
            const idx = state.devices.findIndex((d) => filterMatch(w)(d));
            if (idx === -1) return Promise.resolve([]);
            state.devices[idx] = { ...state.devices[idx], ...vals };
            return Promise.resolve([state.devices[idx]]);
          },
        }),
      }),
    };
  }
  function filterMatch(_w: any) {
    // The mock can't introspect drizzle's where(eq(...)) AST. The route's
    // queries are predictable per test, so we treat .where() as a no-op
    // and rely on the test setting state.devices to the expected subset.
    return (_x: any) => true;
  }
  return {
    db: {
      select: vi.fn(buildSelect),
      insert: vi.fn(buildInsert),
      update: vi.fn(buildUpdate),
    },
  };
});

const { default: adminPaymentDevicesRouter } = await import('../routes/admin-payment-devices');

function buildApp() {
  const app = express();
  app.use(express.json());
  // Skip the real admin auth stack — tests cover route logic only.
  // Stub req.user so adminUid() returns a known string.
  app.use((req: any, _res, next) => {
    req.user = { uid: 'admin-test-uid' };
    next();
  });
  app.use('/api/admin/payment-devices', adminPaymentDevicesRouter);
  return app;
}

beforeEach(() => {
  state.devices = [];
  state.assignments = [];
  state.nextDeviceId = 1;
  state.nextAssignmentId = 1;
  state.forceDupOnInsert = false;
});

describe('admin payment-devices — CRUD', () => {
  it('POST / creates a device + writes initial history row', async () => {
    const res = await request(buildApp())
      .post('/api/admin/payment-devices')
      .send({
        provider: 'nayax',
        model: 'VPOS Touch',
        serialNumber: '0434332725182400',
      });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.device.serialNumber).toBe('0434332725182400');
    expect(res.body.device.status).toBe('in_stock');
    // Initial history row was written with eventType='unassigned'.
    expect(state.assignments).toHaveLength(1);
    expect(state.assignments[0].eventType).toBe('unassigned');
    expect(state.assignments[0].performedBy).toBe('admin-test-uid');
  });

  it('POST / rejects invalid body with 400', async () => {
    const res = await request(buildApp())
      .post('/api/admin/payment-devices')
      .send({ model: 'VPOS Touch' }); // missing serialNumber
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_body');
  });

  it('POST / surfaces duplicate-serial as 409', async () => {
    state.forceDupOnInsert = true;
    const res = await request(buildApp())
      .post('/api/admin/payment-devices')
      .send({ model: 'VPOS Touch', serialNumber: '0434332725182400' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('duplicate_serial');
  });

  it('GET / lists devices and supports status filter', async () => {
    state.devices = [
      { id: 1, provider: 'nayax', model: 'VPOS Touch', serialNumber: 'A', status: 'in_stock', createdAt: new Date(), updatedAt: new Date() },
      { id: 2, provider: 'nayax', model: 'VPOS Touch', serialNumber: 'B', status: 'installed', createdAt: new Date(), updatedAt: new Date() },
    ];
    const res = await request(buildApp())
      .get('/api/admin/payment-devices?status=installed');
    expect(res.status).toBe(200);
    expect(res.body.devices).toHaveLength(1);
    expect(res.body.devices[0].serialNumber).toBe('B');
  });

  it('GET /:id returns the device or 404', async () => {
    state.devices = [
      { id: 1, provider: 'nayax', model: 'VPOS Touch', serialNumber: 'A', status: 'in_stock', createdAt: new Date(), updatedAt: new Date() },
    ];
    const ok = await request(buildApp()).get('/api/admin/payment-devices/1');
    expect(ok.status).toBe(200);
    expect(ok.body.device.serialNumber).toBe('A');

    state.devices = [];
    const notFound = await request(buildApp()).get('/api/admin/payment-devices/999');
    expect(notFound.status).toBe(404);
  });

  it('GET /:id/history returns the assignment history rows', async () => {
    state.assignments = [
      { id: 1, deviceId: 7, statusAtEvent: 'in_stock', eventType: 'unassigned', performedBy: 'admin', performedAt: new Date() },
      { id: 2, deviceId: 7, statusAtEvent: 'installed', eventType: 'assigned', performedBy: 'admin', performedAt: new Date() },
    ];
    const res = await request(buildApp()).get('/api/admin/payment-devices/7/history');
    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(2);
  });
});

describe('admin payment-devices — assignment', () => {
  it('POST /:id/assign records history FIRST then updates device', async () => {
    state.devices = [
      {
        id: 1, provider: 'nayax', model: 'VPOS Touch', serialNumber: 'A',
        status: 'in_stock', assignedMachineId: null, assignedLocationId: null,
        installationDate: null, createdAt: new Date(), updatedAt: new Date(),
      },
    ];
    const res = await request(buildApp())
      .post('/api/admin/payment-devices/1/assign')
      .send({
        machineId: 'machine-tlv-1',
        locationId: 'loc-tlv',
        newStatus: 'installed',
        eventType: 'assigned',
        note: 'Installed at Dizengoff station',
      });
    expect(res.status).toBe(200);
    expect(res.body.device.assignedMachineId).toBe('machine-tlv-1');
    expect(res.body.device.status).toBe('installed');
    // History was written.
    expect(state.assignments).toHaveLength(1);
    expect(state.assignments[0].eventType).toBe('assigned');
    expect(state.assignments[0].statusAtEvent).toBe('installed');
    // First installation set installationDate.
    expect(res.body.device.installationDate).toBeDefined();
  });

  it('POST /:id/assign with invalid newStatus → 400', async () => {
    const res = await request(buildApp())
      .post('/api/admin/payment-devices/1/assign')
      .send({
        machineId: 'machine-tlv-1',
        locationId: null,
        newStatus: 'EXPLODED',
        eventType: 'assigned',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_body');
  });

  it('POST /:id/assign with invalid eventType → 400', async () => {
    const res = await request(buildApp())
      .post('/api/admin/payment-devices/1/assign')
      .send({
        machineId: 'machine-tlv-1',
        locationId: null,
        newStatus: 'installed',
        eventType: 'pewpew',
      });
    expect(res.status).toBe(400);
  });

  it('POST /:id/assign with unknown id → 404', async () => {
    state.devices = [];
    const res = await request(buildApp())
      .post('/api/admin/payment-devices/999/assign')
      .send({ machineId: null, locationId: null, newStatus: 'in_stock', eventType: 'unassigned' });
    expect(res.status).toBe(404);
  });
});

describe('admin payment-devices — safety', () => {
  it('PATCH /:id rejects extra status field (status moves via /assign only)', async () => {
    state.devices = [
      {
        id: 1, provider: 'nayax', model: 'VPOS Touch', serialNumber: 'A',
        status: 'in_stock', createdAt: new Date(), updatedAt: new Date(),
      },
    ];
    // status is NOT in UpdateDeviceSchema — extra fields are tolerated by
    // Zod safeParse but never applied because the SET object only spreads
    // the schema-allowed keys. Verify status didn't change.
    const res = await request(buildApp())
      .patch('/api/admin/payment-devices/1')
      .send({ notes: 'fine', status: 'active' });
    expect(res.status).toBe(200);
    expect(res.body.device.status).toBe('in_stock'); // unchanged
    expect(res.body.device.notes).toBe('fine');
  });

  it('Source-pin: history INSERT must come BEFORE the device UPDATE in /:id/assign', async () => {
    const src = (await import('node:fs')).readFileSync(
      'server/routes/admin-payment-devices.ts',
      'utf8',
    );
    // Slice from the assign route declaration to the next router.X call
    // — robust against nested template-literal braces.
    const startIdx = src.indexOf("router.post('/:id/assign'");
    const tailIdx = src.indexOf('export default router', startIdx);
    expect(startIdx).toBeGreaterThan(0);
    expect(tailIdx).toBeGreaterThan(startIdx);
    const assignBlock = src.slice(startIdx, tailIdx);
    const insertIdx = assignBlock.indexOf('db.insert(paymentDeviceAssignments)');
    // Drizzle chain — source is `db\n      .update(paymentDevices)`.
    const updateIdx = assignBlock.indexOf('.update(paymentDevices)');
    expect(insertIdx).toBeGreaterThan(0);
    expect(updateIdx).toBeGreaterThan(insertIdx); // history first
  });

  it('Source-pin: only schema-allowed fields land in the UPDATE set', async () => {
    const src = (await import('node:fs')).readFileSync(
      'server/routes/admin-payment-devices.ts',
      'utf8',
    );
    // PATCH route MUST NOT spread `parsed.data.status` — status changes
    // go through /assign so they're history-tracked. If a future PR adds
    // status into the PATCH .set(), this test fails.
    const startIdx = src.indexOf("router.patch('/:id'");
    const tailIdx = src.indexOf("router.post('/:id/assign'", startIdx);
    expect(startIdx).toBeGreaterThan(0);
    expect(tailIdx).toBeGreaterThan(startIdx);
    const patchBlock = src.slice(startIdx, tailIdx);
    expect(patchBlock).not.toMatch(/status:\s*parsed\.data\.status/);
    expect(patchBlock).not.toMatch(/assignedMachineId:\s*parsed\.data/);
    expect(patchBlock).not.toMatch(/assignedLocationId:\s*parsed\.data/);
  });
});
