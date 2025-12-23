// ============================================================================
// EQUIPMENT CHECK-IN & DRIVE TRACKING API
// ============================================================================

// POST /api/equipment-checkin - Create equipment check-in with drives
app.post('/api/equipment-checkin', requireAuth, async (req, res) => {
    try {
        const { equipment, drives } = req.body;
        
        await pool.query('BEGIN');
        
        // Insert equipment
        const equipmentResult = await pool.query(
            `INSERT INTO equipment_checkin (
                ticket_number, client_id, equipment_name, equipment_type,
                equipment_model, equipment_serial, checkin_date, checked_in_by,
                status, current_location, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *`,
            [
                equipment.ticket_number,
                equipment.client_id,
                equipment.equipment_name,
                equipment.equipment_type,
                equipment.equipment_model,
                equipment.equipment_serial,
                equipment.checkin_date || new Date().toISOString().split('T')[0],
                equipment.checked_in_by,
                equipment.status || 'checked_in',
                equipment.current_location || 'receiving',
                equipment.notes
            ]
        );
        
        const equipmentId = equipmentResult.rows[0].id;
        
        // Insert drives if provided
        const insertedDrives = [];
        if (drives && drives.length > 0) {
            for (const drive of drives) {
                const driveResult = await pool.query(
                    `INSERT INTO hard_drives (
                        equipment_id, drive_serial_number, drive_manufacturer,
                        drive_model, drive_capacity, status
                    ) VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING *`,
                    [
                        equipmentId,
                        drive.drive_serial_number,
                        drive.drive_manufacturer,
                        drive.drive_model,
                        drive.drive_capacity,
                        'checked_in'
                    ]
                );
                insertedDrives.push(driveResult.rows[0]);
            }
        }
        
        await pool.query('COMMIT');
        
        res.json({
            equipment: equipmentResult.rows[0],
            drives: insertedDrives
        });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error creating equipment check-in:', error);
        res.status(500).json({ error: 'Failed to create equipment check-in' });
    }
});

// GET /api/equipment-checkin - Get all equipment with filters
app.get('/api/equipment-checkin', requireAuth, async (req, res) => {
    try {
        const { status, ticket_number, client_id, past_hold, start_date, end_date } = req.query;
        
        let query = `
            SELECT 
                e.*,
                CURRENT_DATE > e.hold_until_date as is_past_hold,
                CURRENT_DATE - e.hold_until_date as days_past_hold,
                COUNT(h.id) as drive_count
            FROM equipment_checkin e
            LEFT JOIN hard_drives h ON e.id = h.equipment_id
            WHERE 1=1
        `;
        
        const params = [];
        let paramCount = 1;
        
        if (status) {
            query += ` AND e.status = $${paramCount}`;
            params.push(status);
            paramCount++;
        }
        
        if (ticket_number) {
            query += ` AND e.ticket_number ILIKE $${paramCount}`;
            params.push(`%${ticket_number}%`);
            paramCount++;
        }
        
        if (client_id) {
            query += ` AND e.client_id ILIKE $${paramCount}`;
            params.push(`%${client_id}%`);
            paramCount++;
        }
        
        if (past_hold === 'true') {
            query += ` AND e.hold_until_date < CURRENT_DATE AND e.status = 'checked_in'`;
        }
        
        if (start_date) {
            query += ` AND e.checkin_date >= $${paramCount}`;
            params.push(start_date);
            paramCount++;
        }
        
        if (end_date) {
            query += ` AND e.checkin_date <= $${paramCount}`;
            params.push(end_date);
            paramCount++;
        }
        
        query += ' GROUP BY e.id ORDER BY e.checkin_date DESC, e.id DESC';
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching equipment:', error);
        res.status(500).json({ error: 'Failed to fetch equipment' });
    }
});

// GET /api/equipment-checkin/:id - Get single equipment with drives
app.get('/api/equipment-checkin/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get equipment
        const equipmentResult = await pool.query(
            'SELECT * FROM equipment_checkin WHERE id = $1',
            [id]
        );
        
        if (equipmentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Equipment not found' });
        }
        
        // Get associated drives
        const drivesResult = await pool.query(
            'SELECT * FROM hard_drives WHERE equipment_id = $1 ORDER BY id',
            [id]
        );
        
        res.json({
            equipment: equipmentResult.rows[0],
            drives: drivesResult.rows
        });
    } catch (error) {
        console.error('Error fetching equipment:', error);
        res.status(500).json({ error: 'Failed to fetch equipment' });
    }
});

// PUT /api/equipment-checkin/:id - Update equipment
app.put('/api/equipment-checkin/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            ticket_number, client_id, equipment_name, equipment_type,
            equipment_model, equipment_serial, status, current_location, notes
        } = req.body;
        
        const result = await pool.query(
            `UPDATE equipment_checkin SET
                ticket_number = $1,
                client_id = $2,
                equipment_name = $3,
                equipment_type = $4,
                equipment_model = $5,
                equipment_serial = $6,
                status = $7,
                current_location = $8,
                notes = $9
            WHERE id = $10
            RETURNING *`,
            [
                ticket_number, client_id, equipment_name, equipment_type,
                equipment_model, equipment_serial, status, current_location,
                notes, id
            ]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Equipment not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating equipment:', error);
        res.status(500).json({ error: 'Failed to update equipment' });
    }
});

// DELETE /api/equipment-checkin/:id - Delete equipment and drives (admin only)
app.delete('/api/equipment-checkin/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Drives will be automatically deleted due to CASCADE
        const result = await pool.query(
            'DELETE FROM equipment_checkin WHERE id = $1 RETURNING *',
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Equipment not found' });
        }
        
        res.json({ message: 'Equipment and associated drives deleted successfully' });
    } catch (error) {
        console.error('Error deleting equipment:', error);
        res.status(500).json({ error: 'Failed to delete equipment' });
    }
});

// GET /api/equipment-checkin/stats/summary - Get check-in statistics
app.get('/api/equipment-checkin/stats/summary', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total_equipment,
                COUNT(DISTINCT client_id) as total_clients,
                SUM(CASE WHEN status = 'checked_in' THEN 1 ELSE 0 END) as checked_in,
                SUM(CASE WHEN status = 'ready_for_destruction' THEN 1 ELSE 0 END) as ready,
                SUM(CASE WHEN status = 'destroyed' THEN 1 ELSE 0 END) as destroyed,
                SUM(CASE WHEN hold_until_date < CURRENT_DATE AND status = 'checked_in' THEN 1 ELSE 0 END) as past_hold
            FROM equipment_checkin
        `);
        
        const drivesResult = await pool.query(`
            SELECT COUNT(*) as total_drives FROM hard_drives
        `);
        
        res.json({
            ...result.rows[0],
            total_drives: drivesResult.rows[0].total_drives
        });
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// GET /api/equipment-checkin/past-hold - Get equipment past 30-day hold
app.get('/api/equipment-checkin/past-hold', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                e.*,
                CURRENT_DATE - e.hold_until_date as days_past_hold,
                COUNT(h.id) as drive_count
            FROM equipment_checkin e
            LEFT JOIN hard_drives h ON e.id = h.equipment_id
            WHERE e.hold_until_date < CURRENT_DATE 
              AND e.status = 'checked_in'
            GROUP BY e.id
            ORDER BY e.hold_until_date ASC
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching past hold equipment:', error);
        res.status(500).json({ error: 'Failed to fetch past hold equipment' });
    }
});

// POST /api/equipment-checkin/:id/ready-for-destruction - Mark equipment ready for destruction
app.post('/api/equipment-checkin/:id/ready-for-destruction', requireRole('coordinator', 'supervisor', 'manager'), async (req, res) => {
    try {
        const { id } = req.params;
        
        await pool.query('BEGIN');
        
        // Update equipment status
        const equipmentResult = await pool.query(
            `UPDATE equipment_checkin 
             SET status = 'ready_for_destruction',
                 ready_for_destruction_date = CURRENT_DATE
             WHERE id = $1
             RETURNING *`,
            [id]
        );
        
        if (equipmentResult.rows.length === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ error: 'Equipment not found' });
        }
        
        // Update all associated drives
        await pool.query(
            `UPDATE hard_drives 
             SET status = 'ready_for_destruction'
             WHERE equipment_id = $1`,
            [id]
        );
        
        await pool.query('COMMIT');
        
        res.json(equipmentResult.rows[0]);
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error marking equipment ready:', error);
        res.status(500).json({ error: 'Failed to mark equipment ready' });
    }
});

// POST /api/hard-drives/batch-destroy - Destroy multiple drives in batch
app.post('/api/hard-drives/batch-destroy', requireRole('coordinator', 'supervisor', 'manager'), async (req, res) => {
    try {
        const { drive_ids, destruction_method, destroyed_by, batch_number, witness } = req.body;
        
        if (!drive_ids || drive_ids.length === 0) {
            return res.status(400).json({ error: 'No drives specified' });
        }
        
        await pool.query('BEGIN');
        
        const destruction_date = new Date().toISOString().split('T')[0];
        
        // Update all drives
        for (const driveId of drive_ids) {
            await pool.query(
                `UPDATE hard_drives 
                 SET status = 'destroyed',
                     destruction_date = $1,
                     destroyed_by = $2,
                     destruction_method = $3,
                     batch_number = $4
                 WHERE id = $5`,
                [destruction_date, destroyed_by, destruction_method, batch_number, driveId]
            );
        }
        
        // Check if all drives for each equipment are destroyed, update equipment status
        const equipmentIds = await pool.query(
            `SELECT DISTINCT equipment_id FROM hard_drives WHERE id = ANY($1)`,
            [drive_ids]
        );
        
        for (const row of equipmentIds.rows) {
            const pendingDrives = await pool.query(
                `SELECT COUNT(*) FROM hard_drives 
                 WHERE equipment_id = $1 AND status != 'destroyed'`,
                [row.equipment_id]
            );
            
            if (parseInt(pendingDrives.rows[0].count) === 0) {
                await pool.query(
                    `UPDATE equipment_checkin 
                     SET status = 'destroyed' 
                     WHERE id = $1`,
                    [row.equipment_id]
                );
            }
        }
        
        await pool.query('COMMIT');
        
        res.json({ 
            message: 'Drives destroyed successfully',
            drives_destroyed: drive_ids.length,
            batch_number: batch_number
        });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error destroying drives:', error);
        res.status(500).json({ error: 'Failed to destroy drives' });
    }
});

// GET /api/hard-drives/ready-for-destruction - Get all drives ready for destruction
app.get('/api/hard-drives/ready-for-destruction', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                h.*,
                e.ticket_number,
                e.client_id,
                e.equipment_name,
                e.equipment_serial,
                e.hold_until_date,
                CURRENT_DATE - e.hold_until_date as days_past_hold
            FROM hard_drives h
            JOIN equipment_checkin e ON h.equipment_id = e.id
            WHERE h.status = 'ready_for_destruction'
            ORDER BY e.hold_until_date ASC, h.id ASC
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching ready drives:', error);
        res.status(500).json({ error: 'Failed to fetch ready drives' });
    }
});

// GET /api/hard-drives/stats - Get drive statistics
app.get('/api/hard-drives/stats', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total_drives,
                SUM(CASE WHEN status = 'checked_in' THEN 1 ELSE 0 END) as checked_in,
                SUM(CASE WHEN status = 'ready_for_destruction' THEN 1 ELSE 0 END) as ready,
                SUM(CASE WHEN status = 'destroyed' THEN 1 ELSE 0 END) as destroyed,
                COUNT(DISTINCT batch_number) FILTER (WHERE batch_number IS NOT NULL) as total_batches
            FROM hard_drives
        `);
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching drive stats:', error);
        res.status(500).json({ error: 'Failed to fetch drive statistics' });
    }
});
