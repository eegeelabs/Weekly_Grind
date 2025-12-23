// ============================================================================
// HARD DRIVE DESTRUCTION MODULE - API ENDPOINTS
// Add these endpoints to your server.js file
// ============================================================================

// GET /api/hard-drive-destruction - Get all destruction records
app.get('/api/hard-drive-destruction', requireAuth, async (req, res) => {
    try {
        const { status, client_name, start_date, end_date, destroyed_by } = req.query;
        
        let query = `
            SELECT 
                id,
                destruction_date,
                client_name,
                client_id,
                drive_serial_number,
                drive_manufacturer,
                drive_model,
                drive_capacity,
                drive_type,
                destruction_method,
                destroyed_by,
                witness,
                certificate_number,
                asset_tag,
                original_location,
                department,
                status,
                notes,
                special_requirements,
                compliance_standard,
                batch_number,
                certificate_issued,
                certificate_issued_date,
                created_at,
                created_by,
                updated_at,
                updated_by
            FROM hard_drive_destruction
            WHERE 1=1
        `;
        
        const params = [];
        let paramCount = 1;
        
        // Add filters if provided
        if (status) {
            query += ` AND status = $${paramCount}`;
            params.push(status);
            paramCount++;
        }
        
        if (client_name) {
            query += ` AND client_name ILIKE $${paramCount}`;
            params.push(`%${client_name}%`);
            paramCount++;
        }
        
        if (start_date) {
            query += ` AND destruction_date >= $${paramCount}`;
            params.push(start_date);
            paramCount++;
        }
        
        if (end_date) {
            query += ` AND destruction_date <= $${paramCount}`;
            params.push(end_date);
            paramCount++;
        }
        
        if (destroyed_by) {
            query += ` AND destroyed_by = $${paramCount}`;
            params.push(destroyed_by);
            paramCount++;
        }
        
        query += ' ORDER BY destruction_date DESC, id DESC';
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching hard drive destruction records:', error);
        res.status(500).json({ error: 'Failed to fetch destruction records' });
    }
});

// GET /api/hard-drive-destruction/:id - Get single destruction record
app.get('/api/hard-drive-destruction/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'SELECT * FROM hard_drive_destruction WHERE id = $1',
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Destruction record not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching destruction record:', error);
        res.status(500).json({ error: 'Failed to fetch destruction record' });
    }
});

// POST /api/hard-drive-destruction - Create new destruction record
app.post('/api/hard-drive-destruction', requireRole(['coordinator', 'supervisor', 'manager']), async (req, res) => {
    try {
        const {
            destruction_date,
            client_name,
            client_id,
            drive_serial_number,
            drive_manufacturer,
            drive_model,
            drive_capacity,
            drive_type,
            destruction_method,
            destroyed_by,
            witness,
            certificate_number,
            asset_tag,
            original_location,
            department,
            status,
            notes,
            special_requirements,
            compliance_standard,
            batch_number,
            certificate_issued,
            certificate_issued_date
        } = req.body;
        
        const result = await pool.query(
            `INSERT INTO hard_drive_destruction (
                destruction_date, client_name, client_id,
                drive_serial_number, drive_manufacturer, drive_model,
                drive_capacity, drive_type, destruction_method,
                destroyed_by, witness, certificate_number,
                asset_tag, original_location, department,
                status, notes, special_requirements,
                compliance_standard, batch_number,
                certificate_issued, certificate_issued_date,
                created_by
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18,
                $19, $20, $21, $22, $23
            ) RETURNING *`,
            [
                destruction_date || new Date().toISOString().split('T')[0],
                client_name,
                client_id,
                drive_serial_number,
                drive_manufacturer,
                drive_model,
                drive_capacity,
                drive_type,
                destruction_method,
                destroyed_by,
                witness,
                certificate_number,
                asset_tag,
                original_location,
                department,
                status || 'completed',
                notes,
                special_requirements,
                compliance_standard,
                batch_number,
                certificate_issued || false,
                certificate_issued_date,
                req.session.username
            ]
        );
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error creating destruction record:', error);
        res.status(500).json({ error: 'Failed to create destruction record' });
    }
});

// PUT /api/hard-drive-destruction/:id - Update destruction record
app.put('/api/hard-drive-destruction/:id', requireRole(['coordinator', 'supervisor', 'manager']), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            destruction_date,
            client_name,
            client_id,
            drive_serial_number,
            drive_manufacturer,
            drive_model,
            drive_capacity,
            drive_type,
            destruction_method,
            destroyed_by,
            witness,
            certificate_number,
            asset_tag,
            original_location,
            department,
            status,
            notes,
            special_requirements,
            compliance_standard,
            batch_number,
            certificate_issued,
            certificate_issued_date
        } = req.body;
        
        const result = await pool.query(
            `UPDATE hard_drive_destruction SET
                destruction_date = $1,
                client_name = $2,
                client_id = $3,
                drive_serial_number = $4,
                drive_manufacturer = $5,
                drive_model = $6,
                drive_capacity = $7,
                drive_type = $8,
                destruction_method = $9,
                destroyed_by = $10,
                witness = $11,
                certificate_number = $12,
                asset_tag = $13,
                original_location = $14,
                department = $15,
                status = $16,
                notes = $17,
                special_requirements = $18,
                compliance_standard = $19,
                batch_number = $20,
                certificate_issued = $21,
                certificate_issued_date = $22,
                updated_by = $23
            WHERE id = $24
            RETURNING *`,
            [
                destruction_date,
                client_name,
                client_id,
                drive_serial_number,
                drive_manufacturer,
                drive_model,
                drive_capacity,
                drive_type,
                destruction_method,
                destroyed_by,
                witness,
                certificate_number,
                asset_tag,
                original_location,
                department,
                status,
                notes,
                special_requirements,
                compliance_standard,
                batch_number,
                certificate_issued,
                certificate_issued_date,
                req.session.username,
                id
            ]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Destruction record not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating destruction record:', error);
        res.status(500).json({ error: 'Failed to update destruction record' });
    }
});

// DELETE /api/hard-drive-destruction/:id - Delete destruction record (admin only)
app.delete('/api/hard-drive-destruction/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'DELETE FROM hard_drive_destruction WHERE id = $1 RETURNING *',
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Destruction record not found' });
        }
        
        res.json({ message: 'Destruction record deleted successfully', deleted: result.rows[0] });
    } catch (error) {
        console.error('Error deleting destruction record:', error);
        res.status(500).json({ error: 'Failed to delete destruction record' });
    }
});

// GET /api/hard-drive-destruction/stats/summary - Get summary statistics
app.get('/api/hard-drive-destruction/stats/summary', requireAuth, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        let dateFilter = '';
        const params = [];
        
        if (start_date && end_date) {
            dateFilter = 'WHERE destruction_date BETWEEN $1 AND $2';
            params.push(start_date, end_date);
        } else if (start_date) {
            dateFilter = 'WHERE destruction_date >= $1';
            params.push(start_date);
        } else if (end_date) {
            dateFilter = 'WHERE destruction_date <= $1';
            params.push(end_date);
        }
        
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total_destroyed,
                COUNT(DISTINCT client_name) as total_clients,
                COUNT(DISTINCT batch_number) as total_batches,
                SUM(CASE WHEN certificate_issued THEN 1 ELSE 0 END) as certificates_issued,
                COUNT(DISTINCT destroyed_by) as techs_involved
            FROM hard_drive_destruction
            ${dateFilter}
        `, params);
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching destruction statistics:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// GET /api/hard-drive-destruction/stats/by-tech - Get destruction count by tech
app.get('/api/hard-drive-destruction/stats/by-tech', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                destroyed_by,
                COUNT(*) as count,
                MIN(destruction_date) as first_destruction,
                MAX(destruction_date) as last_destruction
            FROM hard_drive_destruction
            WHERE destroyed_by IS NOT NULL
            GROUP BY destroyed_by
            ORDER BY count DESC
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching tech statistics:', error);
        res.status(500).json({ error: 'Failed to fetch tech statistics' });
    }
});
