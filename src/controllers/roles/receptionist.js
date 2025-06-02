// src/controllers/roles/receptionist.js

import connectDB from '../../db/index.js';

// Create a new receptionist
export const createReceptionist = async (req, res) => {
    let conn;
    try {
        const pool = connectDB();
        conn = await pool.getConnection();
        const {
            receptionist_name,
            receptionist_phone,
            receptionist_email,
            business_center_id,
            rec_other_detail
        } = req.body;

        // Validate required fields
        if (!receptionist_name || !business_center_id) {
            return res.status(400).json({ message: 'Receptionist name and business center are required' });
        }

        // Check if business center exists and get brand_id
        const [businessCenter] = await conn.query(
            'SELECT id, brand_id FROM business_center WHERE id = ?',
            [business_center_id]
        );

        if (businessCenter.length === 0) {
            return res.status(404).json({ message: 'Business center not found' });
        }

        // Get brand limits and current count
        const [brandLimits] = await conn.query(
            'SELECT receptionist as receptionist_limit FROM brand WHERE id = ?',
            [businessCenter[0].brand_id]
        );

        const [currentCount] = await conn.query(
            `SELECT COUNT(*) as count FROM receptionist r 
             JOIN business_center bc ON r.business_center_id = bc.id 
             WHERE bc.brand_id = ?`,
            [businessCenter[0].brand_id]
        );

        if (currentCount[0].count >= brandLimits[0].receptionist_limit) {
            return res.status(400).json({ 
                message: `Cannot create more receptionists. Brand limit (${brandLimits[0].receptionist_limit}) reached.` 
            });
        }

        // Check if email already exists
        if (receptionist_email) {
            const [existingReceptionist] = await conn.query(
                'SELECT id FROM receptionist WHERE receptionist_email = ?',
                [receptionist_email]
            );

            if (existingReceptionist.length > 0) {
                return res.status(400).json({ message: 'Email already exists' });
            }
        }

        await conn.beginTransaction();

        const [result] = await conn.query(
            `INSERT INTO receptionist (
                receptionist_name,
                receptionist_phone,
                receptionist_email,
                business_center_id,
                rec_other_detail
            ) VALUES (?, ?, ?, ?, ?)`,
            [
                receptionist_name,
                receptionist_phone,
                receptionist_email,
                business_center_id,
                rec_other_detail || ''
            ]
        );

        await conn.commit();

        res.status(201).json({
            message: 'Receptionist created successfully',
            id: result.insertId
        });

    } catch (error) {
        if (conn) {
            await conn.rollback();
        }
        console.error('Error creating receptionist:', error);
        res.status(500).json({ message: 'Error creating receptionist', error: error.message });
    } finally {
        if (conn) {
            conn.release();
        }
    }
};

// Get all receptionists
export const getAllReceptionists = async (req, res) => {
    let conn;
    try {
        const pool = connectDB();
        conn = await pool.getConnection();

        const [receptionists] = await conn.query(
            `SELECT r.*, bc.business_name 
             FROM receptionist r
             LEFT JOIN business_center bc ON r.business_center_id = bc.id
             ORDER BY r.created_at DESC`
        );

        res.json(receptionists);

    } catch (error) {
        console.error('Error fetching receptionists:', error);
        res.status(500).json({ message: 'Error fetching receptionists' });
    } finally {
        if (conn) {
            conn.release();
        }
    }
};

// Get receptionist by ID
export const getReceptionistById = async (req, res) => {
    let conn;
    try {
        const pool = connectDB();
        conn = await pool.getConnection();

        const [receptionist] = await conn.query(
            `SELECT r.*, bc.business_name 
             FROM receptionist r
             LEFT JOIN business_center bc ON r.business_center_id = bc.id
             WHERE r.id = ?`,
            [req.params.id]
        );

        if (receptionist.length === 0) {
            return res.status(404).json({ message: 'Receptionist not found' });
        }

        res.json(receptionist[0]);

    } catch (error) {
        console.error('Error fetching receptionist:', error);
        res.status(500).json({ message: 'Error fetching receptionist' });
    } finally {
        if (conn) {
            conn.release();
        }
    }
};

// Update receptionist
export const updateReceptionist = async (req, res) => {
    let conn;
    try {
        const pool = connectDB();
        conn = await pool.getConnection();

        const {
            receptionist_name,
            receptionist_phone,
            receptionist_email,
            business_center_id,
            rec_other_detail
        } = req.body;

        // Validate required fields
        if (!receptionist_name || !business_center_id) {
            return res.status(400).json({ message: 'Receptionist name and business center are required' });
        }

        // Check if business center exists
        const [businessCenter] = await conn.query(
            'SELECT id FROM business_center WHERE id = ?',
            [business_center_id]
        );

        if (businessCenter.length === 0) {
            return res.status(404).json({ message: 'Business center not found' });
        }

        await conn.beginTransaction();

        const [result] = await conn.query(
            `UPDATE receptionist SET
                receptionist_name = ?,
                receptionist_phone = ?,
                receptionist_email = ?,
                business_center_id = ?,
                rec_other_detail = ?
            WHERE id = ?`,
            [
                receptionist_name,
                receptionist_phone,
                receptionist_email,
                business_center_id,
                rec_other_detail,
                req.params.id
            ]   
        );

        if (result.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Receptionist not found' });
        }

        await conn.commit();

        const [updatedReceptionist] = await conn.query(
            `SELECT r.*, bc.business_name 
             FROM receptionist r
             LEFT JOIN business_center bc ON r.business_center_id = bc.id
             WHERE r.id = ?`,
            [req.params.id]
        );

        res.json({
            message: 'Receptionist updated successfully',
            receptionist: updatedReceptionist[0]
        });

    } catch (error) {
        if (conn) {
            await conn.rollback();
        }
        console.error('Error updating receptionist:', error);
        res.status(500).json({ message: 'Error updating receptionist' });
    } finally {
        if (conn) {
            conn.release();
        }
    }
};

// Delete receptionist
export const deleteReceptionist = async (req, res) => {
    let conn;
    try {
        const pool = connectDB();
        conn = await pool.getConnection();

        await conn.beginTransaction();

        // First get the receptionist details to find corresponding user
        const [receptionist] = await conn.query(
            'SELECT receptionist_name, receptionist_email FROM receptionist WHERE id = ?',
            [req.params.id]
        );

        if (receptionist.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Receptionist not found' });
        }

        // Delete the corresponding user first (due to foreign key constraints)
        await conn.query(
            'DELETE FROM users WHERE username = ? AND email = ? AND role_id = (SELECT id FROM roles WHERE role_name = "receptionist")',
            [receptionist[0].receptionist_name, receptionist[0].receptionist_email]
        );

        // Then delete the receptionist
        const [result] = await conn.query(
            'DELETE FROM receptionist WHERE id = ?',
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Receptionist not found' });
        }

        await conn.commit();
        res.json({ message: 'Receptionist and associated user account deleted successfully' });

    } catch (error) {
        if (conn) {
            await conn.rollback();
        }
        console.error('Error deleting receptionist:', error);
        res.status(500).json({ message: 'Error deleting receptionist', error: error.message });
    } finally {
        if (conn) {
            conn.release();
        }
    }
};
