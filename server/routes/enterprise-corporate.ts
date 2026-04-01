import express from "express";
import { storage } from "../storage";
import { requireAdmin } from "../adminAuth";
import { z } from "zod";
import { 
  insertJvPartnerSchema, 
  insertJvContractSchema, 
  insertSupplierSchema,
  insertSupplierPaymentSchema,
  insertSupplierQualityScoreSchema,
  insertStationRegistrySchema
} from "@shared/schema";
import { pool } from "../db";
import { nanoid } from "nanoid";

const router = express.Router();

// =================== JV PARTNERS ===================

// GET /api/enterprise/corporate/jv-partners - Get all JV partners
router.get("/jv-partners", requireAdmin, async (req, res) => {
  try {
    const partners = await storage.getAllJvPartners();
    res.json(partners);
  } catch (error: any) {
    console.error("[Enterprise Corporate] Error fetching JV partners:", error);
    res.status(500).json({ error: "Failed to fetch JV partners" });
  }
});

// GET /api/enterprise/corporate/jv-partners/active - Get active JV partners
router.get("/jv-partners/active", requireAdmin, async (req, res) => {
  try {
    const partners = await storage.getActiveJvPartners();
    res.json(partners);
  } catch (error: any) {
    console.error("[Enterprise Corporate] Error fetching active JV partners:", error);
    res.status(500).json({ error: "Failed to fetch active JV partners" });
  }
});

// POST /api/enterprise/corporate/jv-partners - Create new JV partner
router.post("/jv-partners", requireAdmin, async (req, res) => {
  try {
    const validated = insertJvPartnerSchema.parse(req.body);
    const partner = await storage.createJvPartner(validated);
    res.status(201).json(partner);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("[Enterprise Corporate] Error creating JV partner:", error);
    res.status(500).json({ error: "Failed to create JV partner" });
  }
});

// PUT /api/enterprise/corporate/jv-partners/:id - Update JV partner
router.put("/jv-partners/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    // Validate updates using partial schema (all fields optional)
    const updateSchema = insertJvPartnerSchema.partial();
    const validated = updateSchema.parse(req.body);
    const partner = await storage.updateJvPartner(id, validated);
    res.json(partner);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("[Enterprise Corporate] Error updating JV partner:", error);
    res.status(500).json({ error: "Failed to update JV partner" });
  }
});

// GET /api/enterprise/corporate/jv-partners/:id/contracts - Get partner's contracts
router.get("/jv-partners/:id/contracts", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const contracts = await storage.getJvPartnerContracts(id);
    res.json(contracts);
  } catch (error: any) {
    console.error("[Enterprise Corporate] Error fetching JV partner contracts:", error);
    res.status(500).json({ error: "Failed to fetch contracts" });
  }
});

// =================== BOARD MEMBERS ===================

router.get("/board-members", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, first_name, last_name, email, phone, position, bio, photo_url,
              is_active, appointed_date, termination_date, voting_rights, equity_shares,
              created_at, updated_at
       FROM board_members
       ORDER BY appointed_date ASC`
    );
    res.json(result.rows);
  } catch (error: any) {
    console.error("[Enterprise Corporate] Error fetching board members:", error);
    res.status(500).json({ error: "Failed to fetch board members" });
  }
});

router.post("/board-members", requireAdmin, async (req, res) => {
  try {
    const schema = z.object({
      first_name:        z.string().min(1),
      last_name:         z.string().min(1),
      email:             z.string().email().optional(),
      phone:             z.string().optional(),
      position:          z.string().min(1),
      bio:               z.string().optional(),
      photo_url:         z.string().url().optional(),
      is_active:         z.boolean().default(true),
      appointed_date:    z.string().optional(),
      termination_date:  z.string().optional(),
      voting_rights:     z.boolean().default(true),
      equity_shares:     z.number().min(0).optional(),
    });
    const data = schema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO board_members
         (first_name, last_name, email, phone, position, bio, photo_url, is_active,
          appointed_date, termination_date, voting_rights, equity_shares, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())
       RETURNING *`,
      [data.first_name, data.last_name, data.email ?? null, data.phone ?? null,
       data.position, data.bio ?? null, data.photo_url ?? null, data.is_active,
       data.appointed_date ?? null, data.termination_date ?? null,
       data.voting_rights, data.equity_shares ?? null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: error.errors });
    console.error("[Enterprise Corporate] Error creating board member:", error);
    res.status(500).json({ error: "Failed to create board member" });
  }
});

router.patch("/board-members/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    const allowed = ['first_name','last_name','email','phone','position','bio','photo_url',
                     'is_active','appointed_date','termination_date','voting_rights','equity_shares'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(req.body[key]);
      }
    }
    if (fields.length === 0) return res.status(400).json({ error: "No fields to update" });
    fields.push(`updated_at = NOW()`);
    values.push(id);
    const result = await pool.query(
      `UPDATE board_members SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Board member not found" });
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("[Enterprise Corporate] Error updating board member:", error);
    res.status(500).json({ error: "Failed to update board member" });
  }
});

// =================== BOARD MEETINGS ===================

router.get("/board-meetings", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.id, m.meeting_date, m.meeting_type, m.location, m.agenda,
              m.minutes_document, m.status, m.created_at, m.updated_at,
              COALESCE(
                json_agg(json_build_object(
                  'member_id', a.board_member_id,
                  'name', bm.first_name || ' ' || bm.last_name,
                  'attended', a.attended
                )) FILTER (WHERE a.id IS NOT NULL), '[]'
              ) AS attendees
       FROM board_meetings m
       LEFT JOIN board_meeting_attendees a ON a.board_meeting_id = m.id
       LEFT JOIN board_members bm ON bm.id = a.board_member_id
       GROUP BY m.id
       ORDER BY m.meeting_date DESC`
    );
    res.json(result.rows);
  } catch (error: any) {
    console.error("[Enterprise Corporate] Error fetching board meetings:", error);
    res.status(500).json({ error: "Failed to fetch board meetings" });
  }
});

router.post("/board-meetings", requireAdmin, async (req, res) => {
  try {
    const schema = z.object({
      meeting_date:      z.string(),
      meeting_type:      z.enum(['annual', 'special', 'emergency', 'committee']).default('special'),
      location:          z.string().optional(),
      agenda:            z.string().optional(),
      minutes_document:  z.string().optional(),
      status:            z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).default('scheduled'),
      attendee_ids:      z.array(z.number()).optional(),
    });
    const data = schema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO board_meetings (meeting_date, meeting_type, location, agenda, minutes_document, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW()) RETURNING *`,
      [new Date(data.meeting_date), data.meeting_type, data.location ?? null,
       data.agenda ?? null, data.minutes_document ?? null, data.status]
    );
    const meeting = result.rows[0];
    if (data.attendee_ids?.length) {
      for (const memberId of data.attendee_ids) {
        await pool.query(
          `INSERT INTO board_meeting_attendees (board_meeting_id, board_member_id, attended) VALUES ($1,$2,false)
           ON CONFLICT DO NOTHING`,
          [meeting.id, memberId]
        );
      }
    }
    res.status(201).json(meeting);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: error.errors });
    console.error("[Enterprise Corporate] Error creating board meeting:", error);
    res.status(500).json({ error: "Failed to create board meeting" });
  }
});

router.patch("/board-meetings/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    const allowed = ['meeting_date','meeting_type','location','agenda','minutes_document','status'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(key === 'meeting_date' ? new Date(req.body[key]) : req.body[key]);
      }
    }
    if (fields.length === 0) return res.status(400).json({ error: "No fields to update" });
    fields.push(`updated_at = NOW()`);
    values.push(id);
    const result = await pool.query(
      `UPDATE board_meetings SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Board meeting not found" });
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("[Enterprise Corporate] Error updating board meeting:", error);
    res.status(500).json({ error: "Failed to update board meeting" });
  }
});

// =================== SUPPLIERS ===================

// GET /api/enterprise/corporate/suppliers - Get all suppliers
router.get("/suppliers", requireAdmin, async (req, res) => {
  try {
    const suppliers = await storage.getAllSuppliers();
    res.json(suppliers);
  } catch (error: any) {
    console.error("[Enterprise Corporate] Error fetching suppliers:", error);
    res.status(500).json({ error: "Failed to fetch suppliers" });
  }
});

// GET /api/enterprise/corporate/suppliers/active - Get active suppliers
router.get("/suppliers/active", requireAdmin, async (req, res) => {
  try {
    const suppliers = await storage.getActiveSuppliers();
    res.json(suppliers);
  } catch (error: any) {
    console.error("[Enterprise Corporate] Error fetching active suppliers:", error);
    res.status(500).json({ error: "Failed to fetch active suppliers" });
  }
});

// POST /api/enterprise/corporate/suppliers - Create new supplier
router.post("/suppliers", requireAdmin, async (req, res) => {
  try {
    const validated = insertSupplierSchema.parse(req.body);
    const supplier = await storage.createSupplier(validated);
    res.status(201).json(supplier);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("[Enterprise Corporate] Error creating supplier:", error);
    res.status(500).json({ error: "Failed to create supplier" });
  }
});

// PUT /api/enterprise/corporate/suppliers/:id - Update supplier
router.put("/suppliers/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updateSchema = insertSupplierSchema.partial();
    const validated = updateSchema.parse(req.body);
    const supplier = await storage.updateSupplier(id, validated);
    res.json(supplier);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("[Enterprise Corporate] Error updating supplier:", error);
    res.status(500).json({ error: "Failed to update supplier" });
  }
});

// GET /api/enterprise/corporate/suppliers/:id/contracts - Get supplier's contracts
router.get("/suppliers/:id/contracts", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const contracts = await storage.getSupplierContracts(id);
    res.json(contracts);
  } catch (error: any) {
    console.error("[Enterprise Corporate] Error fetching supplier contracts:", error);
    res.status(500).json({ error: "Failed to fetch contracts" });
  }
});

// GET /api/enterprise/corporate/suppliers/:id/payments - Get supplier's payments
router.get("/suppliers/:id/payments", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const payments = await storage.getSupplierPayments(id);
    res.json(payments);
  } catch (error: any) {
    console.error("[Enterprise Corporate] Error fetching supplier payments:", error);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

// POST /api/enterprise/corporate/suppliers/:id/payments - Create supplier payment
router.post("/suppliers/:id/payments", requireAdmin, async (req, res) => {
  try {
    const supplierId = parseInt(req.params.id);
    const validated = insertSupplierPaymentSchema.parse({ ...req.body, supplierId });
    const payment = await storage.createSupplierPayment(validated);
    res.status(201).json(payment);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("[Enterprise Corporate] Error creating supplier payment:", error);
    res.status(500).json({ error: "Failed to create payment" });
  }
});

// GET /api/enterprise/corporate/suppliers/:id/quality-scores - Get supplier's quality scores
router.get("/suppliers/:id/quality-scores", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const scores = await storage.getSupplierQualityScores(id);
    res.json(scores);
  } catch (error: any) {
    console.error("[Enterprise Corporate] Error fetching supplier quality scores:", error);
    res.status(500).json({ error: "Failed to fetch quality scores" });
  }
});

// POST /api/enterprise/corporate/suppliers/:id/quality-scores - Create quality score
router.post("/suppliers/:id/quality-scores", requireAdmin, async (req, res) => {
  try {
    const supplierId = parseInt(req.params.id);
    const validated = insertSupplierQualityScoreSchema.parse({ ...req.body, supplierId });
    const score = await storage.createSupplierQualityScore(validated);
    res.status(201).json(score);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("[Enterprise Corporate] Error creating supplier quality score:", error);
    res.status(500).json({ error: "Failed to create quality score" });
  }
});

// =================== STATION REGISTRY ===================

// GET /api/enterprise/corporate/stations - Get all stations
router.get("/stations", requireAdmin, async (req, res) => {
  try {
    const { filter } = req.query;
    let stations;
    
    if (filter === "active") {
      stations = await storage.getActiveStations();
    } else {
      stations = await storage.getAllStations();
    }
    
    res.json(stations);
  } catch (error: any) {
    console.error("[Enterprise Corporate] Error fetching stations:", error);
    res.status(500).json({ error: "Failed to fetch stations" });
  }
});

// GET /api/enterprise/corporate/stations/country/:country - Get stations by country
router.get("/stations/country/:country", requireAdmin, async (req, res) => {
  try {
    const { country } = req.params;
    const stations = await storage.getStationsByCountry(country);
    res.json(stations);
  } catch (error: any) {
    console.error("[Enterprise Corporate] Error fetching stations by country:", error);
    res.status(500).json({ error: "Failed to fetch stations" });
  }
});

// GET /api/enterprise/corporate/stations/:stationId - Get station by canonical ID
router.get("/stations/:stationId", requireAdmin, async (req, res) => {
  try {
    const { stationId } = req.params;
    const station = await storage.getStationByCanonicalId(stationId);
    if (!station) {
      return res.status(404).json({ error: "Station not found" });
    }
    res.json(station);
  } catch (error: any) {
    console.error("[Enterprise Corporate] Error fetching station:", error);
    res.status(500).json({ error: "Failed to fetch station" });
  }
});

// POST /api/enterprise/corporate/stations - Create new station
router.post("/stations", requireAdmin, async (req, res) => {
  try {
    const validated = insertStationRegistrySchema.parse(req.body);
    const station = await storage.createStation(validated);
    res.status(201).json(station);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("[Enterprise Corporate] Error creating station:", error);
    res.status(500).json({ error: "Failed to create station" });
  }
});

// PATCH /api/enterprise/corporate/stations/:id - Update station
router.patch("/stations/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;
    const station = await storage.updateStation(id, updates);
    res.json(station);
  } catch (error: any) {
    console.error("[Enterprise Corporate] Error updating station:", error);
    res.status(500).json({ error: "Failed to update station" });
  }
});

// PATCH /api/enterprise/corporate/stations/:id/revenue - Update station revenue/washes
router.patch("/stations/:id/revenue", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { revenue, washes } = req.body;
    const station = await storage.updateStationRevenue(id, revenue, washes);
    res.json(station);
  } catch (error: any) {
    console.error("[Enterprise Corporate] Error updating station revenue:", error);
    res.status(500).json({ error: "Failed to update revenue" });
  }
});

export default router;
